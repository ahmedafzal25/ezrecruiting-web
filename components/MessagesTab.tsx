
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Send, Search, ArrowLeft, MessageSquare, Circle, User as UserIcon } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useTheme } from './ThemeContext';
import { DEFAULT_AVATAR } from '../utils/defaultAvatar';

interface Contact {
  _id: string;
  name: string;
  role: string;
  profilePicture?: string;
}

interface Conversation {
  contact: Contact;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: { _id: string };
  };
  unreadCount: number;
}

interface ChatMessage {
  _id: string;
  senderId: { _id: string; name: string; profilePicture?: string };
  receiverId: { _id: string; name: string };
  content: string;
  isRead: boolean;
  createdAt: string;
}

const MessagesTab: React.FC = () => {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const deepLinkHandled = useRef(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?._id || currentUser?.id;

  // ─── Socket.IO: register for real-time messaging ───
  useEffect(() => {
    if (!currentUserId) return;
    const token = localStorage.getItem('token');

    const socket = io('/', {
      auth: { token, userName: currentUser?.name },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register-user', currentUserId);
    });

    socket.on('receive-message', (msg: ChatMessage) => {
      // If the message is from the active chat, add it to the chat
      setChatMessages(prev => {
        const isFromActiveContact =
          msg.senderId._id === activeContact?._id;
        if (isFromActiveContact) {
          // Mark as read immediately
          apiRequest(`/interviews/messages/read/${msg.senderId._id}`, 'PUT').catch(() => {});
          return [...prev, msg];
        }
        return prev;
      });

      // Update conversation list
      setConversations(prev => {
        const contactId = msg.senderId._id === currentUserId
          ? msg.receiverId._id
          : msg.senderId._id;

        const existing = prev.find(c => c.contact._id === contactId);
        if (existing) {
          return prev.map(c => {
            if (c.contact._id === contactId) {
              return {
                ...c,
                lastMessage: msg,
                unreadCount: msg.senderId._id !== currentUserId
                  ? c.unreadCount + 1
                  : c.unreadCount,
              };
            }
            return c;
          }).sort((a, b) =>
            new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
          );
        } else {
          // New conversation
          const newConvo: Conversation = {
            contact: msg.senderId._id === currentUserId
              ? msg.receiverId as any
              : msg.senderId as any,
            lastMessage: msg,
            unreadCount: msg.senderId._id !== currentUserId ? 1 : 0,
          };
          return [newConvo, ...prev];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId]);

  // Keep activeContact ref in sync for socket handler
  const activeContactRef = useRef(activeContact);
  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);

  // Patch the socket handler to use ref
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    const handler = (msg: ChatMessage) => {
      const isFromActiveContact = msg.senderId._id === activeContactRef.current?._id;
      if (isFromActiveContact) {
        setChatMessages(prev => [...prev, msg]);
        apiRequest(`/interviews/messages/read/${msg.senderId._id}`, 'PUT').catch(() => {});
      }

      setConversations(prev => {
        const contactId = msg.senderId._id === currentUserId
          ? msg.receiverId._id
          : msg.senderId._id;

        const existing = prev.find(c => c.contact._id === contactId);
        if (existing) {
          return prev.map(c => {
            if (c.contact._id === contactId) {
              return {
                ...c,
                lastMessage: msg,
                unreadCount: msg.senderId._id !== currentUserId && msg.senderId._id !== activeContactRef.current?._id
                  ? c.unreadCount + 1
                  : 0,
              };
            }
            return c;
          }).sort((a, b) =>
            new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
          );
        } else {
          const newConvo: Conversation = {
            contact: msg.senderId._id === currentUserId ? msg.receiverId as any : msg.senderId as any,
            lastMessage: msg,
            unreadCount: msg.senderId._id !== currentUserId ? 1 : 0,
          };
          return [newConvo, ...prev];
        }
      });
    };

    socket.off('receive-message');
    socket.on('receive-message', handler);

    return () => {
      socket.off('receive-message', handler);
    };
  }, [activeContact, currentUserId]);

  // ─── Fetch conversations ───
  useEffect(() => {
    setLoading(true);
    apiRequest('/interviews/conversations')
      .then(data => {
        setConversations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ─── Load chat when active contact changes ───
  const openChat = useCallback(async (contact: Contact) => {
    setActiveContact(contact);
    setMobileShowChat(true);

    try {
      const msgs = await apiRequest(`/interviews/messages/${contact._id}`);
      setChatMessages(msgs);
      // Mark as read
      await apiRequest(`/interviews/messages/read/${contact._id}`, 'PUT');
      // Update unread count in sidebar
      setConversations(prev =>
        prev.map(c =>
          c.contact._id === contact._id ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      console.error('Failed to load chat:', err);
    }
  }, []);

  // ─── Deep-link: auto-open chat from ?userId=... ───
  useEffect(() => {
    if (deepLinkHandled.current || loading) return;
    const targetUserId = searchParams.get('userId');
    if (!targetUserId) return;

    deepLinkHandled.current = true;
    // Clear the query param from URL to avoid re-triggering
    setSearchParams({}, { replace: true });

    // Check if conversation already exists
    const existing = conversations.find(c => c.contact._id === targetUserId);
    if (existing) {
      openChat(existing.contact);
    } else {
      // Fetch user info and create a new conversation placeholder
      apiRequest(`/users/by-id/${targetUserId}`)
        .then((userData: any) => {
          const contact: Contact = {
            _id: userData._id || targetUserId,
            name: userData.name || 'User',
            role: userData.role || '',
            profilePicture: userData.profilePicture,
          };
          openChat(contact);
        })
        .catch(() => {
          // If user lookup fails, still try to open with minimal info
          openChat({ _id: targetUserId, name: 'User', role: '' });
        });
    }
  }, [loading, conversations, searchParams, openChat, setSearchParams]);

  // ─── Auto-scroll to bottom ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Send message ───
  const handleSend = async () => {
    if (!newMessage.trim() || !activeContact || sending) return;

    setSending(true);
    try {
      const saved = await apiRequest('/interviews/message', 'POST', {
        receiverId: activeContact._id,
        content: newMessage.trim(),
      });

      // Optimistic update
      const optimisticMsg: ChatMessage = {
        _id: saved._id || Date.now().toString(),
        senderId: { _id: currentUserId, name: currentUser?.name, profilePicture: currentUser?.profilePicture },
        receiverId: { _id: activeContact._id, name: activeContact.name },
        content: newMessage.trim(),
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      setChatMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');

      // Emit via socket for real-time delivery
      if (socketRef.current) {
        socketRef.current.emit('send-message', {
          receiverId: activeContact._id,
          message: optimisticMsg,
        });
      }

      // Update conversation sidebar
      setConversations(prev => {
        const existing = prev.find(c => c.contact._id === activeContact._id);
        if (existing) {
          return prev.map(c =>
            c.contact._id === activeContact._id
              ? { ...c, lastMessage: optimisticMsg }
              : c
          ).sort((a, b) =>
            new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
          );
        }
        return [{ contact: activeContact, lastMessage: optimisticMsg, unreadCount: 0 }, ...prev];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Filtered conversations ───
  const filteredConversations = conversations.filter(c =>
    c.contact.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── Helpers ───
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatChatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'RECRUITER': return 'bg-blue-500/20 text-blue-400';
      case 'CANDIDATE': return 'bg-green-500/20 text-green-400';
      case 'INTERVIEWER': return 'bg-amber-500/20 text-amber-400';
      case 'ADMIN': return 'bg-red-500/20 text-red-400';
      default: return 'bg-neutral-500/20 text-neutral-400';
    }
  };

  const shouldShowDateDivider = (msgs: ChatMessage[], idx: number) => {
    if (idx === 0) return true;
    const curr = new Date(msgs[idx].createdAt).toDateString();
    const prev = new Date(msgs[idx - 1].createdAt).toDateString();
    return curr !== prev;
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // ─── Styles ───
  const bg = isDark ? 'bg-[#0d0d0d]' : 'bg-[#faf8ff]';
  const cardBg = isDark ? 'bg-[#141414]' : 'bg-white';
  const sidebarBg = isDark ? 'bg-[#111111]' : 'bg-[#f8f5ff]';
  const hoverBg = isDark ? 'hover:bg-[#1a1a2e]' : 'hover:bg-purple-50';
  const activeBg = isDark ? 'bg-[#1a1a2e] border-l-2 border-[#7B2CBF]' : 'bg-purple-50 border-l-2 border-[#7B2CBF]';
  const textPrimary = isDark ? 'text-white' : 'text-[#1a0033]';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-[#6b46a0]';
  const textMuted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const borderColor = isDark ? 'border-[#1e1e2e]' : 'border-purple-100';
  const inputBg = isDark ? 'bg-[#1a1a2e]' : 'bg-[#f3eeff]';

  return (
    <div className={`h-[calc(100vh-120px)] flex rounded-2xl overflow-hidden shadow-2xl ${cardBg} border ${borderColor}`}>
      {/* ═══════ LEFT: Conversation List ═══════ */}
      <div className={`w-full md:w-[380px] flex-shrink-0 flex flex-col ${sidebarBg} border-r ${borderColor} ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className={`p-5 border-b ${borderColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] flex items-center justify-center shadow-lg shadow-purple-500/20">
                <MessageSquare className="w-4.5 h-4.5 text-white" />
              </div>
              <h2 className={`text-lg font-bold ${textPrimary}`}>Messages</h2>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#7B2CBF] text-white animate-pulse">
                  {totalUnread}
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border ${borderColor} ${inputBg} ${textPrimary} placeholder:${textMuted} focus:outline-none focus:ring-2 focus:ring-[#7B2CBF]/50 focus:border-[#7B2CBF] transition-all`}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#7B2CBF] border-t-transparent animate-spin" />
              <p className={`text-sm ${textMuted}`}>Loading...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#7B2CBF]/10 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[#7B2CBF]/40" />
              </div>
              <p className={`text-sm font-medium ${textSecondary}`}>
                {searchTerm ? 'No conversations found' : 'No messages yet'}
              </p>
              <p className={`text-xs ${textMuted}`}>
                Messages from the platform will appear here
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.contact._id}
                onClick={() => openChat(conv.contact)}
                className={`w-full flex items-center gap-3 px-5 py-4 transition-all duration-200 ${
                  activeContact?._id === conv.contact._id ? activeBg : hoverBg
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={conv.contact.profilePicture || DEFAULT_AVATAR}
                    alt={conv.contact.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#7B2CBF]/20"
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                  />
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#7B2CBF] flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <span className="text-[10px] font-bold text-white">{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${textPrimary}`}>{conv.contact.name}</span>
                    <span className={`text-[10px] flex-shrink-0 ${conv.unreadCount > 0 ? 'text-[#7B2CBF] font-semibold' : textMuted}`}>
                      {formatTime(conv.lastMessage.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRoleBadgeColor(conv.contact.role)}`}>
                      {conv.contact.role}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-1 ${conv.unreadCount > 0 ? `${textPrimary} font-medium` : textMuted}`}>
                    {conv.lastMessage.senderId._id === currentUserId ? 'You: ' : ''}
                    {conv.lastMessage.content}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══════ RIGHT: Chat Area ═══════ */}
      <div className={`flex-1 flex flex-col ${bg} ${!mobileShowChat && !activeContact ? '' : ''} ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b ${borderColor} ${cardBg}`}>
              <button
                onClick={() => { setMobileShowChat(false); setActiveContact(null); }}
                className={`md:hidden p-1.5 rounded-lg ${hoverBg}`}
              >
                <ArrowLeft className={`w-5 h-5 ${textPrimary}`} />
              </button>
              <img
                src={activeContact.profilePicture || DEFAULT_AVATAR}
                alt={activeContact.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#7B2CBF]/20"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
              />
              <div>
                <h3 className={`text-sm font-bold ${textPrimary}`}>{activeContact.name}</h3>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRoleBadgeColor(activeContact.role)}`}>
                  {activeContact.role}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#7B2CBF]/10 flex items-center justify-center">
                    <Send className="w-7 h-7 text-[#7B2CBF]/40" />
                  </div>
                  <p className={`text-sm ${textSecondary}`}>Start a conversation with {activeContact.name}</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isMine = msg.senderId._id === currentUserId;
                  const showDivider = shouldShowDateDivider(chatMessages, idx);

                  return (
                    <React.Fragment key={msg._id}>
                      {showDivider && (
                        <div className="flex items-center gap-3 my-4">
                          <div className={`flex-1 h-px ${isDark ? 'bg-neutral-800' : 'bg-purple-100'}`} />
                          <span className={`text-[10px] font-medium uppercase tracking-wider ${textMuted}`}>
                            {formatDateDivider(msg.createdAt)}
                          </span>
                          <div className={`flex-1 h-px ${isDark ? 'bg-neutral-800' : 'bg-purple-100'}`} />
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                            isMine
                              ? 'bg-gradient-to-br from-[#7B2CBF] to-[#5a1da8] text-white rounded-br-md'
                              : `${isDark ? 'bg-[#1a1a2e]' : 'bg-white border border-purple-100'} ${textPrimary} rounded-bl-md`
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : textMuted} text-right`}>
                            {formatChatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={`px-5 py-4 border-t ${borderColor} ${cardBg}`}>
              <div className={`flex items-end gap-3 rounded-2xl px-4 py-2.5 ${inputBg} border ${borderColor} focus-within:ring-2 focus-within:ring-[#7B2CBF]/50 focus-within:border-[#7B2CBF] transition-all`}>
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  rows={1}
                  className={`flex-1 bg-transparent text-sm resize-none outline-none max-h-24 ${textPrimary} placeholder:${textMuted}`}
                  style={{ minHeight: '24px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    newMessage.trim()
                      ? 'bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 active:scale-95'
                      : `${isDark ? 'bg-neutral-800 text-neutral-600' : 'bg-neutral-200 text-neutral-400'} cursor-not-allowed`
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state — no chat selected */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#7B2CBF]/15 to-[#480CA8]/10 flex items-center justify-center">
              <MessageSquare className="w-12 h-12 text-[#7B2CBF]/30" />
            </div>
            <h3 className={`text-lg font-bold ${textPrimary}`}>Your Messages</h3>
            <p className={`text-sm text-center max-w-xs ${textSecondary}`}>
              Select a conversation from the sidebar to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesTab;
