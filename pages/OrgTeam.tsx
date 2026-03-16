import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Users, Plus, Trash2, Mail, User, Lock, Search, UserPlus, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useTheme } from '../components/ThemeContext';

interface Recruiter {
    _id: string;
    name: string;
    email: string;
    createdAt: string;
}

export const OrgTeam: React.FC = () => {
    const { isDark } = useTheme();
    const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Invite modal
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '' });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');

    // Remove confirmation modal
    const [removeTarget, setRemoveTarget] = useState<Recruiter | null>(null);
    const [removeLoading, setRemoveLoading] = useState(false);

    useEffect(() => {
        fetchRecruiters();
    }, []);

    const fetchRecruiters = async () => {
        try {
            setLoading(true);
            const data = await apiRequest('/organization/recruiters');
            setRecruiters(data);
        } catch (err) {
            console.error('Failed to fetch recruiters:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        setInviteError('');
        if (!inviteForm.name || !inviteForm.email || !inviteForm.password) {
            setInviteError('All fields are required');
            return;
        }
        if (inviteForm.password.length < 8) {
            setInviteError('Password must be at least 8 characters');
            return;
        }

        try {
            setInviteLoading(true);
            await apiRequest('/organization/recruiters/invite', 'POST', inviteForm);
            setShowInvite(false);
            setInviteForm({ name: '', email: '', password: '' });
            fetchRecruiters();
        } catch (err: any) {
            setInviteError(err.message || 'Failed to invite recruiter');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        try {
            setRemoveLoading(true);
            await apiRequest(`/organization/recruiters/${removeTarget._id}`, 'DELETE');
            setRemoveTarget(null);
            fetchRecruiters();
        } catch (err: any) {
            console.error('Failed to remove recruiter:', err);
        } finally {
            setRemoveLoading(false);
        }
    };

    const filtered = recruiters.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const textMuted = isDark ? 'text-neutral-400' : 'text-[#6b46a0]';
    const textPrimary = isDark ? 'text-white' : 'text-[#1a0033]';
    const borderColor = isDark ? 'border-purple-900/30' : 'border-purple-200';
    const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-purple-50';
    const headerBg = isDark ? 'bg-[#0D0117]/60' : 'bg-purple-50/60';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${textPrimary}`}>Team Management</h1>
                    <p className={`text-sm mt-1 ${textMuted}`}>
                        Manage your organization's recruiters and their access
                    </p>
                </div>
                <Button icon={UserPlus} onClick={() => setShowInvite(true)}>
                    Invite Recruiter
                </Button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-[#7B2CBF]/20 text-[#9D4EDD]">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Total Recruiters</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>{recruiters.length}</p>
                    </div>
                </Card>
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-green-500/20 text-green-400">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Active</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>{recruiters.length}</p>
                    </div>
                </Card>
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400">
                        <Mail size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Invited This Month</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>
                            {recruiters.filter(r => {
                                const d = new Date(r.createdAt);
                                const now = new Date();
                                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                            }).length}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Search bar */}
            <div className="max-w-sm">
                <Input
                    placeholder="Search by name or email…"
                    icon={Search}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Data Table */}
            <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`${headerBg} border-b ${borderColor}`}>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider`}>Recruiter</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden md:table-cell`}>Email</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden sm:table-cell`}>Status</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden lg:table-cell`}>Date Added</th>
                                <th className={`text-right py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider`}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className={`text-center py-12 ${textMuted}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[#7B2CBF] border-t-transparent rounded-full animate-spin" />
                                            <span>Loading team…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className={`text-center py-12 ${textMuted}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <Users size={32} className="opacity-30" />
                                            <p className="font-medium">No recruiters found</p>
                                            <p className="text-xs">Invite your first recruiter to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(rec => (
                                    <tr key={rec._id} className={`border-b ${borderColor} ${hoverBg} transition-colors`}>
                                        <td className="py-3.5 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7B2CBF] to-[#9D4EDD] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
                                                    {rec.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={`font-semibold ${textPrimary}`}>{rec.name}</p>
                                                    <p className={`text-xs md:hidden ${textMuted}`}>{rec.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`py-3.5 px-5 hidden md:table-cell ${textMuted}`}>{rec.email}</td>
                                        <td className="py-3.5 px-5 hidden sm:table-cell">
                                            <Badge variant="success">Active</Badge>
                                        </td>
                                        <td className={`py-3.5 px-5 hidden lg:table-cell ${textMuted}`}>
                                            {new Date(rec.createdAt).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <button
                                                onClick={() => setRemoveTarget(rec)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                            >
                                                <Trash2 size={14} />
                                                <span className="hidden sm:inline">Remove</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ====== Invite Recruiter Modal ====== */}
            <Modal isOpen={showInvite} onClose={() => { setShowInvite(false); setInviteError(''); }} title="Invite Recruiter">
                <div className="space-y-4">
                    <p className={`text-sm ${textMuted}`}>
                        Create a recruiter account linked to your organization. They will be able to post jobs and manage applicants.
                    </p>
                    {inviteError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertTriangle size={16} />
                            {inviteError}
                        </div>
                    )}
                    <Input
                        label="Full Name"
                        icon={User}
                        placeholder="e.g. Jane Smith"
                        value={inviteForm.name}
                        onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    />
                    <Input
                        label="Email Address"
                        icon={Mail}
                        type="email"
                        placeholder="e.g. jane@company.com"
                        value={inviteForm.email}
                        onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    />
                    <Input
                        label="Temporary Password"
                        icon={Lock}
                        type="password"
                        placeholder="Min 8 characters"
                        value={inviteForm.password}
                        onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => { setShowInvite(false); setInviteError(''); }}>Cancel</Button>
                        <Button onClick={handleInvite} disabled={inviteLoading}>
                            {inviteLoading ? 'Creating…' : 'Create Account'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ====== Remove Confirmation Modal ====== */}
            <Modal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove Recruiter">
                <div className="space-y-4">
                    <div className={`flex items-start gap-3 p-4 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className={`font-semibold ${textPrimary}`}>Are you sure?</p>
                            <p className={`text-sm mt-1 ${textMuted}`}>
                                This will permanently remove <strong>{removeTarget?.name}</strong> ({removeTarget?.email}) from your organization. They will lose access to all organization resources.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
                        <Button
                            className="!bg-red-600 hover:!bg-red-700 !shadow-red-900/30"
                            onClick={handleRemove}
                            disabled={removeLoading}
                        >
                            {removeLoading ? 'Removing…' : 'Remove Recruiter'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
