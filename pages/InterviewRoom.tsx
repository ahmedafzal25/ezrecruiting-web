import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    Monitor, Code, Users, Maximize2, Minimize2, UserX, Eye, ShieldAlert,
    CheckCircle, X, ClipboardCheck, PlayCircle
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { apiRequest } from '../utils/api';
import { useProctoring, type ProctoringEvent } from '../hooks/useProctoring';
import { useTheme } from '../components/ThemeContext';

// ICE servers for WebRTC
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

interface PeerUser {
    socketId: string;
    userId: string;
    userName: string;
}

interface RemoteStream {
    socketId: string;
    userId: string;
    userName: string;
    stream: MediaStream;
}

interface InterviewData {
    _id: string;
    meetingId: string;
    scheduledTime: string;
    status: string;
    candidateId: { _id: string; name: string; email: string; profilePicture?: string };
    recruiterId: { _id: string; name: string; email: string; profilePicture?: string };
    interviewerId?: { _id: string; name: string; email: string; profilePicture?: string };
    jobId?: { _id: string; title: string; company: string };
    isUserHost?: boolean; // Server-computed authoritative host flag
}

// ==============================
// Inline CSS for video grid
// ==============================
const VIDEO_GRID_STYLES = `
  .video-grid {
    display: grid;
    gap: 16px;
    padding: 24px;
    padding-bottom: 90px; /* Space for floating control bar */
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    height: 100%;
    width: 100%;
    align-content: center;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .video-tile {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-card, #111827);
    min-height: 200px;
    max-height: 45vh;
    border: 1px solid var(--border-color, rgba(255,255,255,0.05));
    transition: box-shadow 0.3s ease, transform 0.3s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }
  .video-tile:hover {
    box-shadow: 0 8px 30px rgba(123, 44, 191, 0.3);
    transform: translateY(-2px);
  }
  .video-tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .video-tile .video-label {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(17, 24, 39, 0.7);
    backdrop-filter: blur(8px);
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    pointer-events: none;
    border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  }
  .video-tile .kick-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(239, 68, 68, 0.85);
    border: none;
    border-radius: 8px;
    color: #fff;
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
    z-index: 10;
  }
  .video-tile:hover .kick-btn {
    opacity: 1;
  }
  .video-tile .kick-btn:hover {
    background: rgba(220, 38, 38, 1);
  }
  .video-tile .local-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(123, 44, 191, 0.75);
    backdrop-filter: blur(6px);
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    pointer-events: none;
    letter-spacing: 0.5px;
  }
  .video-tile .video-off-overlay {
    position: absolute;
    inset: 0;
    background: var(--bg-card, #111827);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .video-tile .avatar-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--bg-header, #1f2937);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Sidebar mode — compact vertical stack for when coding panel is visible */
  .video-grid.sidebar-mode {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
    padding-bottom: 80px;
    align-content: start;
  }
  .video-grid.sidebar-mode .video-tile {
    min-height: 140px;
    max-height: 35vh;
    border-radius: 12px;
  }
`;

const InterviewRoom: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast, ToastContainer } = useToast();
    const { isDark } = useTheme();

    // Interview state
    const [interview, setInterview] = useState<InterviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Waiting Room State
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    const [admissionRequests, setAdmissionRequests] = useState<PeerUser[]>([]);

    // Media state
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isEditorFocused, setIsEditorFocused] = useState(false);

    // Proctoring alert state (recruiter side)
    const [proctorAlerts, setProctorAlerts] = useState<Array<ProctoringEvent & { candidateName?: string }>>([])
    const [isAlertDropdownOpen, setIsAlertDropdownOpen] = useState(false);
    const alertDropdownRef = useRef<HTMLDivElement>(null);
    // Mirror ref so the socket closure can read the latest value
    const alertDropdownOpenRef = useRef(false);
    useEffect(() => { alertDropdownOpenRef.current = isAlertDropdownOpen; }, [isAlertDropdownOpen]);

    // Participant dropdown state
    const [isParticipantDropdownOpen, setIsParticipantDropdownOpen] = useState(false);
    const participantDropdownRef = useRef<HTMLDivElement>(null);

    // Code editor state
    const getStarterCode = (name = 'Candidate') => `# Welcome to the Procruit Interview Sandbox, ${name}!\n# Write your code here...\n\nprint("Hello World!")\n`;
    const [code, setCode] = useState<string>(getStarterCode());
    const [editorLanguage, setEditorLanguage] = useState('python');

    // Adaptive Test State
    const [adaptiveSession, setAdaptiveSession] = useState<any>(null);
    const [lastEvaluation, setLastEvaluation] = useState<any>(null);
    const [evaluating, setEvaluating] = useState(false);

    // **** Dynamic Layout: Coding test visible only after host starts it ****
    const [isCodingTestVisible, setIsCodingTestVisible] = useState(false);

    // **** End Interview Modal State ****
    const [showEndInterviewModal, setShowEndInterviewModal] = useState(false);
    const [completingInterview, setCompletingInterview] = useState(false);
    const [interviewerRemarks, setInterviewerRemarks] = useState('');

    // Remote streams — one entry per connected peer
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const socketRef = useRef<Socket | null>(null);
    // Map of socketId -> RTCPeerConnection (supports multiple peers)
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const isInitiatorRef = useRef(false);
    // Editor container ref for proctoring copy/paste detection
    const editorContainerRef = useRef<HTMLDivElement>(null);
    // Remote video elements — keyed by socketId
    const remoteVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
    // Mirror refs so socket closures always read current code/language
    const codeRef = useRef<string>(code);
    const languageRef = useRef<string>(editorLanguage);
    useEffect(() => { codeRef.current = code; }, [code]);
    useEffect(() => { languageRef.current = editorLanguage; }, [editorLanguage]);

    // Sync ref for admission status — socket handlers check this immediately
    // (React state updates are async and can race with simultaneous events)
    const admittedRef = useRef(false);
    // Queue of peers received via room-users BEFORE admission was confirmed
    const pendingPeersRef = useRef<PeerUser[]>([]);

    // Stable ref for host status — socket closures read this directly (no stale closure risk)
    const isHostRef = useRef(false);

    // User info
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;
    // Primary: use server-computed isUserHost from the interview document.
    // Fallback: role-based check so UI renders correctly before interview loads.
    const roleBasedIsHost = user?.role === 'RECRUITER' || user?.role === 'recruiter' || user?.role === 'organization' || user?.role === 'FREELANCER' || user?.role === 'freelancer';
    const isRecruiter = interview?.isUserHost ?? roleBasedIsHost;

    // Keep isHostRef in sync with the derived isRecruiter value on every render
    isHostRef.current = isRecruiter;

    // ===========================
    // Proctoring Hook (Candidate only)
    // ===========================
    const { events: proctoringEvents, isConnected: proctorWsConnected, flushLogs } = useProctoring({
        interviewId: interview?._id || '',
        videoRef: localVideoRef,
        editorContainerRef,
        enabled: !isRecruiter && !!interview,
        isVideoOff: isVideoOff,
        captureIntervalMs: 500,
        socketRef: socketRef as React.RefObject<Socket | null>,
        roomId: interview?.meetingId || '',
    });

    // Click-outside to close alert dropdown and participant dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (alertDropdownRef.current && !alertDropdownRef.current.contains(e.target as Node)) {
                setIsAlertDropdownOpen(false);
            }
            if (participantDropdownRef.current && !participantDropdownRef.current.contains(e.target as Node)) {
                setIsParticipantDropdownOpen(false);
            }
        };
        if (isAlertDropdownOpen || isParticipantDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isAlertDropdownOpen, isParticipantDropdownOpen]);

    // ===========================
    // Fetch Interview Details
    // ===========================
    useEffect(() => {
        const fetchInterview = async () => {
            try {
                const data = await apiRequest(`/interviews/${id}`);
                console.log('[InterviewRoom] Interview loaded. isUserHost =', data.isUserHost, '| role =', user?.role, '| userId =', user?._id || user?.id);
                setInterview(data);
                
                // Personalize the welcome message based on fetched candidate data
                if (code === getStarterCode('Candidate')) {
                    const candidateName = data.candidateId?.name || 'Candidate';
                    setCode(getStarterCode(candidateName));
                }

                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to load interview');
                setLoading(false);
            }
        };
        fetchInterview();
    }, [id]);

    // ===========================
    // Create WebRTC Peer Connection
    // ===========================
    const createPeerConnection = useCallback((remoteSocketId: string, peerUser: PeerUser, socket: Socket) => {
        // Avoid creating duplicate connections
        if (peerConnectionsRef.current.has(remoteSocketId)) {
            return peerConnectionsRef.current.get(remoteSocketId)!;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current.set(remoteSocketId, pc);

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Handle remote tracks — add/update in remoteStreams state
        pc.ontrack = (event) => {
            if (event.streams[0]) {
                const incomingStream = event.streams[0];
                setRemoteStreams((prev) => {
                    const exists = prev.find((rs) => rs.socketId === remoteSocketId);
                    if (exists) {
                        // Update the stream if connection re-negotiated
                        return prev.map((rs) =>
                            rs.socketId === remoteSocketId ? { ...rs, stream: incomingStream } : rs
                        );
                    }
                    return [
                        ...prev,
                        {
                            socketId: remoteSocketId,
                            userId: peerUser.userId,
                            userName: peerUser.userName,
                            stream: incomingStream,
                        },
                    ];
                });

                // Attach stream to the video element if it's already mounted
                const videoEl = remoteVideoRefs.current.get(remoteSocketId);
                if (videoEl) {
                    videoEl.srcObject = incomingStream;
                }
            }
        };

        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    to: remoteSocketId,
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (
                pc.iceConnectionState === 'disconnected' ||
                pc.iceConnectionState === 'failed'
            ) {
                addToast('error', 'Connection to peer lost');
                setRemoteStreams((prev) => prev.filter((rs) => rs.socketId !== remoteSocketId));
                peerConnectionsRef.current.delete(remoteSocketId);
            }
        };

        return pc;
    }, [addToast]);

    // ===========================
    // Initialize Media & Socket
    // ===========================
    useEffect(() => {
        if (!interview || error) return;

        let isMounted = true;
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        // Helper: connects to peers — creates RTCPeerConnection and sends offers
        const connectToPeers = (peers: PeerUser[], socket: Socket) => {
            isInitiatorRef.current = true;
            peers.forEach((peer) => {
                const pc = createPeerConnection(peer.socketId, peer, socket);
                pc.createOffer()
                    .then((offer) => pc.setLocalDescription(offer))
                    .then(() => {
                        socket.emit('offer', {
                            offer: pc.localDescription,
                            to: peer.socketId,
                        });
                    })
                    .catch((err) => console.error('Error creating offer:', err));
            });
        };

        const initRoom = async () => {
            // Determine host status NOW (synchronously) using the server flag.
            // This MUST happen before io() connects so admittedRef is set before any socket event fires.
            const isHost = interview.isUserHost === true || roleBasedIsHost;
            console.log('[InterviewRoom] initRoom: isHost =', isHost, '| interview.isUserHost =', interview.isUserHost, '| roleBasedIsHost =', roleBasedIsHost);

            if (isHost) {
                admittedRef.current = true;
                isHostRef.current = true;
                console.log('[InterviewRoom] ✅ Host confirmed — admittedRef set BEFORE socket connects.');
            }

            // 1. Get local media stream
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (err: any) {
                addToast('error', 'Camera/microphone access denied. You can still join but others will not see/hear you.');
                localStreamRef.current = new MediaStream();
            }

            // 2. Connect to Socket.IO
            const socket = io('/', {
                auth: { token, userName: user?.name },
                transports: ['websocket', 'polling'],
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                if (!isMounted) return;
                addToast('info', 'Connected to interview server');
                console.log('[InterviewRoom] Emitting join-room. meetingId =', interview.meetingId, '| sending role:', isHost ? 'host' : (user?.role || 'CANDIDATE'));
                socket.emit('join-room', {
                    roomId: interview.meetingId,
                    userId: user?._id || user?.id,
                    userName: user?.name || 'Unknown User',
                    role: isHost ? 'host' : (user?.role || 'CANDIDATE'),
                });
            });

            socket.on('waiting-for-host', () => {
                if (!isMounted) return;
                // ABSOLUTE guard: if we know we're the host, never show waiting screen.
                if (isHostRef.current) {
                    console.warn('[InterviewRoom] ⚠️ Got waiting-for-host but isHostRef=true — forcing admit, ignoring event.');
                    admittedRef.current = true;
                    setIsWaitingForHost(false);
                    return;
                }
                setIsWaitingForHost(true);
            });

            socket.on('admitted', () => {
                if (!isMounted) return;
                admittedRef.current = true;
                setIsWaitingForHost(false);
                addToast('success', '✅ You have been admitted to the interview!');
                socket.emit('request-editor-state', { roomId: interview.meetingId });

                // If any peers were queued (from room-users arriving before admitted),
                // initiate WebRTC connections now.
                if (pendingPeersRef.current.length > 0) {
                    connectToPeers(pendingPeersRef.current, socket);
                    pendingPeersRef.current = [];
                }
            });

            socket.on('admission-denied', () => {
                if (!isMounted) return;
                addToast('error', 'Your request to join was denied');
                socket.disconnect();
                const dashboardPath = isRecruiter ? '/recruiter/dashboard' : '/candidate/dashboard';
                navigate(dashboardPath);
            });

            socket.on('admission-request', (requestingUser: PeerUser) => {
                if (!isMounted) return;
                setAdmissionRequests(prev => {
                    if (prev.find(u => u.socketId === requestingUser.socketId)) return prev;
                    return [...prev, requestingUser];
                });
            });

            socket.on('admission-canceled', ({ socketId }) => {
                if (!isMounted) return;
                setAdmissionRequests(prev => prev.filter(u => u.socketId !== socketId));
            });

            socket.on('connect_error', (err) => {
                if (!isMounted) return;
                addToast('error', `Connection error: ${err.message}`);
            });

            // Existing users already in room — connect to each
            // For candidates: only proceed if already admitted; otherwise queue peers.
            socket.on('room-users', (users: PeerUser[]) => {
                if (!isMounted || users.length === 0) return;

                if (admittedRef.current) {
                    // Already admitted (recruiter or post-admission) — connect immediately
                    connectToPeers(users, socket);
                } else {
                    // Not yet admitted — queue peers for later
                    pendingPeersRef.current = [...pendingPeersRef.current, ...users];
                }
            });

            // New user joined — they will send us an offer
            socket.on('user-connected', (peer: PeerUser) => {
                if (!isMounted) return;
                addToast('success', `${peer.userName} has joined the interview`);
                createPeerConnection(peer.socketId, peer, socket);
            });

            // WebRTC: Receive offer
            socket.on('offer', async ({ offer, from, userId, userName }) => {
                if (!isMounted) return;
                try {
                    const peerUser: PeerUser = { socketId: from, userId, userName };
                    const pc = createPeerConnection(from, peerUser, socket);
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('answer', { answer, to: from });
                } catch (err) {
                    console.error('Error handling offer:', err);
                }
            });

            // WebRTC: Receive answer
            socket.on('answer', async ({ answer, from }) => {
                if (!isMounted) return;
                try {
                    const pc = peerConnectionsRef.current.get(from);
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                } catch (err) {
                    console.error('Error handling answer:', err);
                }
            });

            // WebRTC: Receive ICE candidate
            socket.on('ice-candidate', async ({ candidate, from }) => {
                if (!isMounted) return;
                try {
                    const pc = peerConnectionsRef.current.get(from);
                    if (pc && candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                } catch (err) {
                    console.error('Error handling ICE candidate:', err);
                }
            });

            // Code sync from peer
            socket.on('code-change', ({ code: incomingCode, language }) => {
                if (!isMounted) return;
                setCode(incomingCode);
                // language is only set on language-change events now, kept for backward compat
                if (language !== undefined) setEditorLanguage(language);
            });

            // Language-only change from peer
            socket.on('language-change', ({ language: incomingLang }) => {
                if (!isMounted) return;
                setEditorLanguage(incomingLang);
            });

            // Reconnect re-sync: ask the room for current editor state
            socket.on('provide-editor-state', ({ requesterId }) => {
                if (!isMounted) return;
                // Respond directly to the requester with our current state
                // We read directly from React state via a ref pattern
                socket.emit('editor-state-response', {
                    targetSocketId: requesterId,
                    code: codeRef.current,
                    language: languageRef.current,
                });
            });

            // Receive synced state after a reconnect
            socket.on('editor-state-sync', ({ code: syncedCode, language: syncedLang }) => {
                if (!isMounted) return;
                setCode(syncedCode);
                setEditorLanguage(syncedLang);
                addToast('info', 'Editor re-synced with the latest session state.');
            });

            // On reconnect: request editor state from anyone already in the room
            socket.io.on('reconnect', () => {
                if (!isMounted || !interview) return;
                socket.emit('join-room', {
                    roomId: interview.meetingId,
                    userId: user?._id || user?.id,
                    userName: user?.name || 'Unknown User',
                    role: isHostRef.current ? 'host' : (user?.role || 'CANDIDATE'),
                });
                socket.emit('request-editor-state', { roomId: interview.meetingId });
            });

            // User disconnected — remove their stream and peer connection
            socket.on('user-disconnected', ({ socketId, userName: disconnectedName }) => {
                if (!isMounted) return;
                addToast('info', `${disconnectedName} has left the interview`);
                const pc = peerConnectionsRef.current.get(socketId);
                if (pc) {
                    pc.close();
                    peerConnectionsRef.current.delete(socketId);
                }
                setRemoteStreams((prev) => prev.filter((rs) => rs.socketId !== socketId));
            });

            // Adaptive Test Sync
            socket.on('adaptive-test-sync', (data: any) => {
                if (!isMounted) return;
                console.log('[InterviewRoom] Received adaptive test sync', data);
                if (data.sessionData) setAdaptiveSession(data.sessionData);
                if (data.evaluation !== undefined) setLastEvaluation(data.evaluation);
            });

            // ==============================
            // Real-Time Proctoring Alerts (Recruiter receives these)
            // ==============================
            socket.on('proctor-event', (eventData: any) => {
                if (!isMounted) return;
                try {
                    console.log('[InterviewRoom] Recruiter received proctor-event:', eventData);

                    const alert = {
                        type: eventData.type,
                        detail: eventData.detail,
                        timestamp: eventData.timestamp,
                        candidateName: eventData.candidateName,
                    } as ProctoringEvent & { candidateName?: string };

                    setProctorAlerts(prev => [...prev, alert]);

                    // Show a toast notification ONLY if the alert dropdown is closed
                    if (!alertDropdownOpenRef.current) {
                        const icon = eventData.type === 'tab_switch' ? '🔀'
                            : eventData.type === 'copy' ? '📋'
                                : eventData.type === 'paste' ? '📌'
                                    : eventData.type === 'face_lost' ? '👤'
                                        : eventData.type === 'gaze' ? '👁️'
                                            : eventData.type === 'screenshot' ? '📸' : '⚠️';

                        const severity = eventData.type === 'screenshot' ? 'error' : 'warning';
                        addToast(severity, `${icon} Proctor Alert: ${eventData.candidateName || 'Candidate'} — ${eventData.detail}`);
                    }
                } catch (err) {
                    console.error('[InterviewRoom] Error processing proctor-event:', err);
                }
            });

            // ==============================
            // Kicked from room (target user)
            // ==============================
            socket.on('kicked-from-room', async () => {
                if (!isMounted) return;
                addToast('error', 'You have been removed from the session by the host.');

                if (!isHostRef.current) {
                    console.log('[InterviewRoom] Flushing proctoring logs before kick...');
                    try { await flushLogs(); } catch (e) { console.error('Failed to flush logs on kick', e); }
                }

                // Clean up all connections
                peerConnectionsRef.current.forEach((pc) => pc.close());
                peerConnectionsRef.current.clear();
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                }
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach((t) => t.stop());
                }
                socket.disconnect();
                // Redirect to appropriate dashboard after a short delay to let toast show
                setTimeout(() => {
                    const dashboardPath = user?.role === 'RECRUITER' ? '/recruiter/dashboard' : '/candidate/dashboard';
                    navigate(dashboardPath);
                }, 1500);
            });

            // ==============================
            // Interview Ended (Host completed interview — everyone ejected)
            // ==============================
            socket.on('interview-ended', async ({ message, endedBy }) => {
                if (!isMounted) return;
                addToast('info', `✅ ${message || 'This interview has been completed.'}`);

                if (!isHostRef.current) {
                    console.log('[InterviewRoom] Flushing proctoring logs before interview end...');
                    try { await flushLogs(); } catch (e) { console.error('Failed to flush logs on end', e); }
                }

                // Clean up all connections
                peerConnectionsRef.current.forEach((pc) => pc.close());
                peerConnectionsRef.current.clear();
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                }
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach((t) => t.stop());
                }
                socket.disconnect();
                // Redirect to dashboard after delay
                setTimeout(() => {
                    const isFreelancer = user?.role === 'INTERVIEWER' || user?.role === 'freelancer';
                    const dashboardPath = isFreelancer
                        ? '/interviewer'
                        : (user?.role === 'RECRUITER' ? '/recruiter/schedule' : '/candidate/interviews');
                    navigate(dashboardPath);
                }, 2000);
            });

            // ==============================
            // Coding test visibility sync (host broadcasts to participants)
            // ==============================
            socket.on('coding-test-started', () => {
                if (!isMounted) return;
                setIsCodingTestVisible(true);
                addToast('info', '📝 Coding test has been started by the host.');
            });
        };

        initRoom();

        return () => {
            isMounted = false;
            // Cleanup
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [interview, error]);

    // ===========================
    // Attach stream to video elements after render
    // ===========================

    // Callback ref for local video — re-attaches stream whenever the
    // <video> element mounts (e.g. when transitioning from waiting room
    // to the active room, React unmounts the old element and mounts a new one).
    const setLocalVideoRef = useCallback((el: HTMLVideoElement | null) => {
        (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        if (el && localStreamRef.current) {
            el.srcObject = localStreamRef.current;
        }
    }, []);

    // When a video element mounts for a remote stream, attach the stream
    const setRemoteVideoRef = useCallback((socketId: string, el: HTMLVideoElement | null) => {
        remoteVideoRefs.current.set(socketId, el);
        if (el) {
            const rs = remoteStreams.find((r) => r.socketId === socketId);
            if (rs?.stream) {
                el.srcObject = rs.stream;
            }
        }
    }, [remoteStreams]);

    // ===========================
    // Control Functions
    // ===========================
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTracks = localStreamRef.current.getVideoTracks();
            videoTracks.forEach((track) => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;
            }
            if (localStreamRef.current) {
                const videoTrack = localStreamRef.current.getVideoTracks()[0];
                if (videoTrack) {
                    peerConnectionsRef.current.forEach((pc) => {
                        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                        if (sender) sender.replaceTrack(videoTrack);
                    });
                }
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            }
            setIsScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                // Replace track in all peer connections
                peerConnectionsRef.current.forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }

                screenTrack.onended = () => {
                    toggleScreenShare();
                };

                setIsScreenSharing(true);
                addToast('info', 'Screen sharing started');
            } catch (err) {
                addToast('error', 'Failed to start screen sharing');
            }
        }
    };

    const admitCandidate = (socketId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('admit-user', { targetSocketId: socketId });
            setAdmissionRequests(prev => prev.filter(u => u.socketId !== socketId));
        }
    };

    const denyCandidate = (socketId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('deny-user', { targetSocketId: socketId });
            setAdmissionRequests(prev => prev.filter(u => u.socketId !== socketId));
        }
    };

    const endCall = async () => {
        // If user is a host (recruiter/interviewer), show the "Complete Interview" modal
        if (isRecruiter) {
            setShowEndInterviewModal(true);
            return;
        }

        // Non-host (candidate): just leave the call
        if (!isRecruiter && interview?._id) {
            console.log('[InterviewRoom] Flushing proctoring logs before leaving...');
            try {
                await flushLogs();
                console.log('[InterviewRoom] Proctoring logs flushed successfully.');
            } catch (err) {
                console.error('[InterviewRoom] Failed to flush proctoring logs:', err);
            }
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        const dashboardPath = user?.role === 'RECRUITER'
            ? '/recruiter/schedule'
            : '/candidate/interviews';
        navigate(dashboardPath);
    };

    // "Just Leave" — host leaves without completing
    const justLeaveCall = async () => {
        setShowEndInterviewModal(false);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        const isFreelancer = user?.role === 'INTERVIEWER' || user?.role === 'freelancer';
        const dashboardPath = isFreelancer
            ? '/interviewer'
            : '/recruiter/schedule';
        navigate(dashboardPath);
    };

    // "Complete Interview" — host finalizes everything
    const completeInterview = async () => {
        if (!interview?._id) return;
        setCompletingInterview(true);

        try {
            // ── STEP 1: Flush proctoring logs (so server has full log) ────────
            if (!isRecruiter) {
                try { await flushLogs(); } catch (e) { /* ignore */ }
            }

            // ── STEP 2: KICK ALL PARTICIPANTS FIRST ───────────────────────────
            console.log('[InterviewRoom] 🔌 Kicking all participants...');
            if (socketRef.current && interview.meetingId) {
                socketRef.current.emit('end-interview', { meetingId: interview.meetingId });
            }

            // Stop all local streams immediately (free camera/mic)
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();

            // ── STEP 3: POST /complete — responds instantly, AI runs in BG ────
            console.log('[InterviewRoom] 🚀 Posting /complete (fast — AI runs in background)...');
            await apiRequest(`/interviews/${interview._id}/complete`, 'POST', {
                interviewerRemarks: interviewerRemarks.trim(),
                codingTestSessionId: adaptiveSession?.sessionId || undefined,
            });

            addToast('success', '✅ Interview completed! AI report is generating in the background.');

            // ── STEP 4: Navigate to dashboard ─────────────────────────────────
            setTimeout(() => {
                if (socketRef.current) socketRef.current.disconnect();
                const isFreelancer = user?.role === 'INTERVIEWER' || user?.role === 'freelancer';
                navigate(isFreelancer ? '/interviewer' : '/recruiter/schedule');
            }, 800);

        } catch (err: any) {
            console.error('[InterviewRoom] ❌ Failed to complete interview:', err);
            addToast('error', err.message || 'Failed to complete interview');
        } finally {
            setCompletingInterview(false);
            setShowEndInterviewModal(false);
        }
    };

    const kickParticipant = (targetSocketId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('kick-user', { targetSocketId });
            addToast('info', 'Participant has been removed from the session.');
        }
    };

    // ===========================
    // Adaptive Test Controls
    // ===========================
    const startAdaptiveTest = async () => {
        if (!interview || !interview.candidateId) return;
        try {
            setEvaluating(true);
            const res = await apiRequest('/coding-test/start', 'POST', { 
                jobId: interview.jobId?._id, 
                candidateId: interview.candidateId._id 
            });
            const sessionData = {
                sessionId: res.sessionId,
                currentQuestion: res.question,
                questionNumber: res.questionNumber,
                difficulty: res.currentDifficulty,
                status: 'in_progress',
                finalScore: null
            };
            setAdaptiveSession(sessionData);
            setLastEvaluation(null);
            
            // **** Show coding panel and broadcast to room ****
            setIsCodingTestVisible(true);
            
            if (socketRef.current) {
                socketRef.current.emit('adaptive-test-event', {
                    sessionData,
                    evaluation: null
                });
                // Notify all participants to show coding panel
                if (interview.meetingId) {
                    socketRef.current.emit('coding-test-started-event', {
                        roomId: interview.meetingId,
                    });
                }
            }
            addToast('success', 'Adaptive test started');
        } catch (err: any) {
            addToast('error', err.message || 'Failed to start test');
        } finally {
            setEvaluating(false);
        }
    };

    const submitAndNextAdaptiveTest = async () => {
        if (!adaptiveSession) return;
        try {
            setEvaluating(true);
            const submitRes = await apiRequest(`/coding-test/${adaptiveSession.sessionId}/submit`, 'POST', { 
                questionId: adaptiveSession.currentQuestion._id, 
                submittedCode: codeRef.current 
            });
            
            const passed = submitRes.passed;
            addToast(passed ? 'success' : 'warning', passed ? 'All test cases passed!' : `Passed ${submitRes.score}% of test cases`);
            
            const nextRes = await apiRequest(`/coding-test/${adaptiveSession.sessionId}/next`);
            
            let newSessionData;
            if (nextRes.done) {
                newSessionData = { ...adaptiveSession, status: 'completed', finalScore: nextRes.finalScore };
                addToast('success', `Test Completed! Final Score: ${nextRes.finalScore}%`);
            } else {
                newSessionData = {
                    ...adaptiveSession,
                    currentQuestion: nextRes.question,
                    questionNumber: nextRes.questionNumber,
                    difficulty: nextRes.currentDifficulty
                };
            }
            
            setAdaptiveSession(newSessionData);
            setLastEvaluation(submitRes);
            
            if (socketRef.current) {
                socketRef.current.emit('adaptive-test-event', {
                    sessionData: newSessionData,
                    evaluation: submitRes
                });
            }
        } catch (err: any) {
            addToast('error', err.message || 'Failed to evaluate code');
        } finally {
            setEvaluating(false);
        }
    };

    // ===========================
    // Code Editor Change
    // ===========================
    const handleCodeChange = (value: string | undefined) => {
        const newCode = value || '';
        setCode(newCode);
        if (socketRef.current && interview) {
            socketRef.current.emit('code-change', {
                roomId: interview.meetingId,
                code: newCode,
                language: editorLanguage,
            });
        }
    };

    // ===========================
    // Loading / Error States
    // ===========================
    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#7B2CBF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-neutral-400">Loading interview room...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <VideoOff className="text-red-400" size={28} />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Cannot Join Interview</h2>
                    <p className="text-neutral-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 bg-[#7B2CBF] text-white rounded-lg hover:bg-[#9D4EDD] transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (isWaitingForHost) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-6 px-4">
                <style>{VIDEO_GRID_STYLES}</style>
                <ToastContainer />

                {/* Camera preview so the candidate can check A/V before being admitted */}
                <div className="relative rounded-xl overflow-hidden border border-[#7B2CBF]/30 shadow-xl shadow-purple-900/20" style={{ width: 280, height: 200 }}>
                    <video
                        ref={setLocalVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                            <VideoOff size={32} className="text-neutral-600" />
                        </div>
                    )}
                    <span style={{
                        position: 'absolute', bottom: 8, left: 8,
                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#fff'
                    }}>{user?.name || 'You'}</span>

                    {/* Mini A/V controls */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                        <button
                            onClick={toggleMute}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs ${isMuted ? 'bg-red-500/80' : 'bg-black/60 hover:bg-black/80'
                                }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs ${isVideoOff ? 'bg-red-500/80' : 'bg-black/60 hover:bg-black/80'
                                }`}
                            title={isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
                        >
                            {isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
                        </button>
                    </div>
                </div>

                {/* Status text */}
                <div className="text-center">
                    <div className="w-12 h-12 bg-[#7B2CBF]/20 border border-[#7B2CBF]/40 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="text-[#9D4EDD]" size={24} />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Waiting for Host</h2>
                    <p className="text-neutral-400 mb-6 text-center max-w-md text-sm">
                        You are in the waiting room. The host will admit you shortly.
                    </p>
                    <div className="flex gap-2 items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#7B2CBF] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-[#7B2CBF] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-[#7B2CBF] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>

                <button
                    onClick={() => {
                        if (socketRef.current) socketRef.current.disconnect();
                        navigate(-1);
                    }}
                    className="px-6 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors text-sm"
                >
                    Leave Waiting Room
                </button>
            </div>
        );
    }

    const totalConnected = remoteStreams.length + 1; // +1 for local

    return (
        <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-black text-white' : 'bg-[#F3EEFF] text-[#1a0033]'}`}>
            {/* Inject video grid styles */}
            <style>{VIDEO_GRID_STYLES}</style>
            <ToastContainer />

            {/* Top Bar */}
            <header className={`relative z-[100] h-14 flex items-center justify-between px-4 flex-shrink-0 backdrop-blur-sm border-b ${isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white/80 border-purple-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] flex items-center justify-center text-xs font-bold shadow-lg shadow-purple-500/20">
                        AI
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold">
                            {interview?.jobId?.title ? `Interview: ${interview.jobId.title}` : 'Procruit Interview'}
                        </h1>
                        <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>
                            {interview?.meetingId?.slice(0, 8)}... • {interview?.status}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative">
                    {/* View Coding Test Results Button */}
                    {isRecruiter && interview?.candidateId?._id && interview?.jobId?._id && (
                        <button
                            onClick={() => window.open(`#/recruiter/coding-test-result/${interview.jobId._id}/candidate/${interview.candidateId._id}`, '_blank')}
                            className="flex items-center gap-2 px-3 py-1 bg-[#7B2CBF]/10 border border-[#7B2CBF]/30 hover:bg-[#7B2CBF]/20 rounded-full transition-colors shadow-lg shadow-purple-900/10"
                            title="View candidate's adaptive coding test performance"
                        >
                            <Code size={13} className="text-[#9D4EDD]" />
                            <span className="text-xs font-semibold text-[#9D4EDD]">Test Results</span>
                        </button>
                    )}

                    {/* Participant count */}
                    <div className="relative" ref={participantDropdownRef}>
                        <button
                            onClick={() => setIsParticipantDropdownOpen(prev => !prev)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full cursor-pointer transition-all duration-200 ${isParticipantDropdownOpen
                                ? 'bg-neutral-700 border border-neutral-600 ring-1 ring-neutral-500/30'
                                : 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700'
                                }`}
                            title="View Participants"
                        >
                            <Users size={12} className="text-neutral-400" />
                            <span className="text-xs text-neutral-300">{totalConnected} participant{totalConnected !== 1 ? 's' : ''}</span>
                        </button>

                        {/* Participant Dropdown panel */}
                        {isParticipantDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-64 max-h-80 overflow-y-auto bg-neutral-900/95 border border-neutral-700 rounded-xl shadow-2xl backdrop-blur-md z-[10000]">
                                {/* Header */}
                                <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-white">In this call</span>
                                    <span className="text-[11px] text-neutral-500">{totalConnected}</span>
                                </div>

                                {/* Participant list */}
                                <div className="px-2 py-2 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/60 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 border border-neutral-700">
                                            <Users size={14} className="text-neutral-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-white truncate">{user?.name || 'You'}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-medium">YOU</span>
                                            </div>
                                        </div>
                                    </div>
                                    {remoteStreams.map((rs, i) => (
                                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/60 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 border border-neutral-700">
                                                <Users size={14} className="text-neutral-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-neutral-300 truncate">{rs.userName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {remoteStreams.length > 0 ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-xs text-green-400">Live</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                            <span className="text-xs text-yellow-400">Waiting for participant...</span>
                        </div>
                    )}
                </div>

                {/* Proctoring status indicator — Candidate only */}
                {!isRecruiter && interview && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${proctorWsConnected
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-amber-500/10 border border-amber-500/20'
                        }`}
                        title={proctorWsConnected ? 'AI proctoring is active — gaze, tab-switch, and copy/paste are being monitored' : 'AI proctoring is connecting...'}
                    >
                        <Eye size={13} className={proctorWsConnected ? 'text-emerald-400' : 'text-amber-400'} />
                        <span className={`text-xs font-medium ${proctorWsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                            AI Monitor {proctorWsConnected ? 'Active' : 'Connecting…'}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${proctorWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    </div>
                )}

                {/* Proctoring alert dropdown — Recruiter only */}
                {isRecruiter && proctorAlerts.length > 0 && (
                    <div className="relative" ref={alertDropdownRef}>
                        <button
                            onClick={() => setIsAlertDropdownOpen(prev => !prev)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full cursor-pointer transition-all duration-200 ${isAlertDropdownOpen
                                ? 'bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30'
                                : 'bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15'
                                }`}
                            title={`${proctorAlerts.length} proctoring alert(s) — click to ${isAlertDropdownOpen ? 'close' : 'view'}`}
                        >
                            <ShieldAlert size={13} className="text-amber-400" />
                            <span className="text-xs font-semibold text-amber-400">
                                {proctorAlerts.length} Alert{proctorAlerts.length !== 1 ? 's' : ''}
                            </span>
                        </button>

                        {/* Dropdown panel */}
                        {isAlertDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-96 max-h-80 overflow-y-auto bg-neutral-900/95 border border-neutral-700 rounded-xl shadow-2xl backdrop-blur-md z-[10000]">
                                {/* Header */}
                                <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert size={14} className="text-amber-400" />
                                        <span className="text-sm font-semibold text-white">Proctoring Alerts</span>
                                    </div>
                                    <span className="text-[11px] text-neutral-500">{proctorAlerts.length} total</span>
                                </div>

                                {/* Alert list */}
                                <div className="px-2 py-2 flex flex-col gap-1.5">
                                    {[...proctorAlerts].reverse().map((alert, i) => {
                                        const icon = alert.type === 'tab_switch' ? '🔀'
                                            : alert.type === 'copy' ? '📋'
                                                : alert.type === 'paste' ? '📌'
                                                    : alert.type === 'face_lost' ? '👤'
                                                        : alert.type === 'gaze' ? '👁️' : '⚠️';
                                        return (
                                            <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/60 transition-colors">
                                                <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold text-amber-300">{alert.candidateName || 'Candidate'}</p>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-medium">
                                                            {alert.type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-300 mt-0.5">{alert.detail}</p>
                                                    <p className="text-[10px] text-neutral-500 mt-0.5">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* Main Content — Dynamic Layout */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Admission Requests Overlay (Host Only) */}
                {isRecruiter && admissionRequests.length > 0 && (
                    <div className="absolute top-4 right-4 z-50 flex flex-col gap-3">
                        {admissionRequests.map(req => (
                            <div key={req.socketId} className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl shadow-2xl w-80 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#7B2CBF]/20 rounded-full flex items-center justify-center">
                                        <Users className="text-[#9D4EDD]" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">{req.userName}</p>
                                        <p className="text-xs text-neutral-400">wants to join</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => denyCandidate(req.socketId)}
                                        className="flex-1 py-1.5 px-3 rounded text-sm font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition border border-neutral-700"
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => admitCandidate(req.socketId)}
                                        className="flex-1 py-1.5 px-3 rounded text-sm font-medium bg-[#7B2CBF] text-white hover:bg-[#9D4EDD] transition"
                                    >
                                        Admit
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ========== CODING PANEL (only visible after host starts test) ========== */}
                {isCodingTestVisible && (
                    <div ref={editorContainerRef} className={`flex flex-col transition-all duration-500 ${isEditorFocused ? 'flex-[3]' : 'flex-[2]'}`} style={{ minWidth: 0 }}>
                        {/* Editor Header */}
                        <div className={`h-10 border-b flex items-center justify-between px-4 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-purple-200'}`}>
                            <div className="flex items-center gap-2">
                                <Code size={14} className="text-[#7B2CBF]" />
                                <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Coding Sandbox</span>
                                
                                {isRecruiter && (!adaptiveSession || adaptiveSession.status === 'completed') && (
                                    <button
                                        onClick={startAdaptiveTest}
                                        disabled={evaluating}
                                        className="ml-4 bg-[#7B2CBF]/20 text-[#9D4EDD] hover:bg-[#7B2CBF]/40 border border-[#7B2CBF]/30 px-3 py-1 rounded text-xs font-semibold transition"
                                    >
                                        {evaluating ? 'Starting...' : adaptiveSession ? 'Restart Test' : 'Start Adaptive Test'}
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value="python"
                                    disabled
                                    className={`border text-xs rounded px-2 py-1 opacity-80 cursor-not-allowed outline-none ${isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-purple-50 border-purple-200 text-[#6b46a0]'}`}
                                >
                                    <option value="python">Python</option>
                                </select>
                                <button
                                    onClick={() => setIsEditorFocused(!isEditorFocused)}
                                    className={`transition-colors p-1 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-[#6b46a0] hover:text-[#1a0033]'}`}
                                    title={isEditorFocused ? 'Minimize editor' : 'Maximize editor'}
                                >
                                    {isEditorFocused ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Adaptive Test Panel */}
                        {adaptiveSession && adaptiveSession.status === 'in_progress' && (
                            <div className="bg-neutral-800 border-b border-neutral-700 p-4 max-h-48 overflow-y-auto shrink-0 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-white text-base">
                                            Q{adaptiveSession.questionNumber}: {adaptiveSession.currentQuestion?.title}
                                        </h3>
                                        <div className="flex gap-2 text-[10px] mt-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-[#7B2CBF]/20 text-[#9D4EDD] uppercase font-bold border border-[#7B2CBF]/30">
                                                {adaptiveSession.difficulty.replace('_', ' ')}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 border border-neutral-600">
                                                {adaptiveSession.currentQuestion?.category}
                                            </span>
                                        </div>
                                    </div>
                                    {isRecruiter && (
                                        <button
                                            onClick={submitAndNextAdaptiveTest}
                                            disabled={evaluating}
                                            className="bg-[#7B2CBF] hover:bg-[#9D4EDD] text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-md whitespace-nowrap"
                                        >
                                            {evaluating ? 'Evaluating...' : 'Submit & Next Question'}
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-neutral-300 mt-2 whitespace-pre-wrap leading-relaxed">
                                    {adaptiveSession.currentQuestion?.description}
                                </p>
                                
                                {lastEvaluation && (!lastEvaluation.passed) && (
                                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-200">
                                        <strong className="text-red-400">Previous Result:</strong> Failed ({lastEvaluation.score}%). Next time, be sure to check logic and edge cases.
                                    </div>
                                )}
                                {lastEvaluation && lastEvaluation.passed && (
                                    <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded p-2 text-xs text-green-200">
                                        <strong className="text-green-400">Previous Result:</strong> Passed 100%!
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {adaptiveSession && adaptiveSession.status === 'completed' && (
                             <div className="bg-[#7B2CBF]/10 border-b border-[#7B2CBF]/30 p-4 shrink-0 flex items-center justify-between">
                                 <div>
                                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                                        <CheckCircle size={16} className="text-emerald-400" />
                                        Test Completed
                                    </h3>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        The candidate has finished the adaptive coding test.
                                    </p>
                                 </div>
                                 <div className="text-right">
                                    <span className="block text-xl font-black text-emerald-400">{adaptiveSession.finalScore}%</span>
                                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Final Score</span>
                                 </div>
                             </div>
                        )}

                        {/* Monaco Editor */}
                        <div className="flex-1 relative">
                            <Editor
                                height="100%"
                                language={editorLanguage}
                                theme={isDark ? 'vs-dark' : 'light'}
                                value={code}
                                onChange={handleCodeChange}
                                options={{
                                    fontSize: 14,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    padding: { top: 16 },
                                    lineNumbers: 'on',
                                    renderWhitespace: 'selection',
                                    bracketPairColorization: { enabled: true },
                                    cursorBlinking: 'smooth',
                                    smoothScrolling: true,
                                    wordWrap: 'on',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* ========== VIDEO AREA ========== */}
                {/* When coding is hidden → full area. When coding visible → compact sidebar. */}
                <div className={`${
                    isCodingTestVisible
                        ? 'w-[320px] min-w-[280px] max-w-[380px] border-l'
                        : 'flex-1'
                } overflow-hidden relative transition-all duration-500 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-[#EDE4FF] border-purple-200'}`}>
                    
                    {/* "Start Coding Test" Button — Host only, shown in full video view */}
                    {!isCodingTestVisible && isRecruiter && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                            <button
                                onClick={() => {
                                    setIsCodingTestVisible(true);
                                    // Broadcast to room
                                    if (socketRef.current && interview?.meetingId) {
                                        socketRef.current.emit('coding-test-started-event', {
                                            roomId: interview.meetingId,
                                        });
                                    }
                                    addToast('info', '📝 Coding panel opened. Use "Start Adaptive Test" to begin the assessment.');
                                }}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-[#7B2CBF] to-[#480CA8] text-white rounded-full shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 text-sm font-semibold border border-purple-400/20"
                            >
                                <PlayCircle size={18} />
                                <span>Start Coding Test</span>
                            </button>
                        </div>
                    )}

                    <div className={`video-grid ${isCodingTestVisible ? 'sidebar-mode' : ''}`} style={{ height: '100%' }}>

                        {/* Local Video Tile */}
                        <div className="video-tile">
                            <video
                                ref={setLocalVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {isVideoOff && (
                                <div className="video-off-overlay">
                                    <div className="avatar-circle">
                                        <VideoOff size={24} className="text-neutral-600" />
                                    </div>
                                </div>
                            )}
                            <span className="local-badge">YOU {isScreenSharing && '· SCREEN'}</span>
                            <span className="video-label">{user?.name || 'You'}</span>
                        </div>

                        {/* Remote Video Tiles — one per connected peer */}
                        {remoteStreams.map((rs) => (
                            <div key={rs.socketId} className="video-tile">
                                <video
                                    ref={(el) => setRemoteVideoRef(rs.socketId, el)}
                                    autoPlay
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                                <span className="video-label">{rs.userName}</span>

                                {/* Kick button — Host only, appears on hover */}
                                {isRecruiter && (
                                    <button
                                        className="kick-btn"
                                        onClick={() => kickParticipant(rs.socketId)}
                                        title={`Remove ${rs.userName} from session`}
                                    >
                                        <UserX size={13} />
                                        Kick
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Empty waiting state — only when no remote peers connected */}
                        {remoteStreams.length === 0 && (
                            <div className="video-tile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                                <div className="avatar-circle" style={{ width: 72, height: 72 }}>
                                    <Users size={30} className="text-neutral-600" />
                                </div>
                                <p style={{ color: '#6b7280', fontSize: 13 }}>Waiting for participant...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== END INTERVIEW MODAL ========== */}
            {showEndInterviewModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95" style={{ animationDuration: '0.2s' }}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] flex items-center justify-center shadow-lg shadow-purple-500/20">
                                    <ClipboardCheck size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">End Interview Session</h2>
                                    <p className="text-xs text-neutral-500">Choose how to exit this interview</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEndInterviewModal(false)}
                                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Final Remarks */}
                            <div>
                                <label className="block text-sm font-semibold text-neutral-300 mb-2">
                                    Final Remarks / Candidate Evaluation
                                </label>
                                <p className="text-xs text-neutral-500 mb-2">
                                    Your qualitative feedback will be included in the AI-powered interview report.
                                </p>
                                <textarea
                                    value={interviewerRemarks}
                                    onChange={(e) => setInterviewerRemarks(e.target.value)}
                                    rows={4}
                                    placeholder="e.g. Candidate showed strong analytical skills but struggled with system design concepts. Communication was clear and professional..."
                                    className="w-full bg-black/50 border border-neutral-700 rounded-xl py-3 px-4 text-white text-sm placeholder-neutral-600 focus:border-[#7B2CBF] focus:ring-1 focus:ring-[#7B2CBF] transition-all outline-none resize-none leading-relaxed"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-3">
                                {/* Complete Interview */}
                                <button
                                    onClick={completeInterview}
                                    disabled={completingInterview}
                                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-[#7B2CBF] to-[#480CA8] text-white rounded-xl font-semibold text-sm hover:from-[#9D4EDD] hover:to-[#6B21A8] transition-all duration-200 shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {completingInterview ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Completing & Generating AI Report...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            Complete Interview & Generate AI Report
                                        </>
                                    )}
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-neutral-800" />
                                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-semibold">or</span>
                                    <div className="flex-1 h-px bg-neutral-800" />
                                </div>

                                {/* Just Leave */}
                                <button
                                    onClick={justLeaveCall}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-neutral-700 bg-neutral-800/50 text-neutral-300 rounded-xl font-medium text-sm hover:bg-neutral-800 hover:text-white transition-all duration-200"
                                >
                                    <PhoneOff size={16} />
                                    Just Leave (Don't Complete)
                                </button>
                            </div>

                            <p className="text-[10px] text-neutral-600 text-center">
                                "Complete Interview" will end the session for all participants, finalize any active coding test, and trigger the AI evaluation report.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Control Bar - Floating Pill */}
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-center gap-3 px-6 py-3 border rounded-full backdrop-blur-xl ${isDark ? 'bg-neutral-900/95 border-neutral-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.6)]' : 'bg-white/95 border-purple-200 shadow-[0_8px_32px_rgba(123,44,191,0.15)]'}`}>
                {/* Mute */}
                <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : isDark
                            ? 'bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700'
                            : 'bg-purple-50 text-[#1a0033] border border-purple-200 hover:bg-purple-100'
                        }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {/* Video Toggle */}
                <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isVideoOff
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : isDark
                            ? 'bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700'
                            : 'bg-purple-50 text-[#1a0033] border border-purple-200 hover:bg-purple-100'
                        }`}
                    title={isVideoOff ? 'Turn on Video' : 'Turn off Video'}
                >
                    {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>

                {/* Screen Share */}
                <button
                    onClick={toggleScreenShare}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${isScreenSharing
                        ? 'bg-[#7B2CBF]/20 text-[#7B2CBF] border border-[#7B2CBF]/30 hover:bg-[#7B2CBF]/30'
                        : isDark
                            ? 'bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700'
                            : 'bg-purple-50 text-[#1a0033] border border-purple-200 hover:bg-purple-100'
                        }`}
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                    <Monitor size={20} />
                </button>

                {/* Divider */}
                <div className={`w-px h-8 mx-2 ${isDark ? 'bg-neutral-700' : 'bg-purple-200'}`} />

                {/* End Call — visible to ALL users */}
                <button
                    onClick={endCall}
                    className="h-11 px-6 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-red-500/20 active:scale-95 text-sm font-semibold"
                    title={isRecruiter ? 'End / Complete Interview' : 'Leave Call'}
                >
                    <PhoneOff size={18} />
                    <span>{isRecruiter ? 'End Interview' : 'Leave Call'}</span>
                </button>

                {/* Recruiter Controls */}
                {isRecruiter && remoteStreams.length > 0 && (
                    <>
                        <div className={`w-px h-8 mx-2 ${isDark ? 'bg-neutral-700' : 'bg-purple-200'}`} />
                        {/* Quick-kick from footer when only 1 remote peer */}
                        {remoteStreams.length === 1 && (
                            <button
                                onClick={() => kickParticipant(remoteStreams[0].socketId)}
                                className={`h-11 px-5 rounded-full border flex items-center justify-center gap-2 transition-all duration-200 text-sm font-medium ${isDark ? 'bg-neutral-800 text-red-400 border-red-500/30 hover:bg-red-500/10' : 'bg-white text-red-500 border-red-400/30 hover:bg-red-50'}`}
                                title={`Remove ${remoteStreams[0].userName} from session`}
                            >
                                <UserX size={18} />
                                <span>Kick Candidate</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default InterviewRoom;
