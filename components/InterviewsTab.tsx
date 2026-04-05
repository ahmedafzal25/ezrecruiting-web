import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Clock, Video, Plus, Briefcase,
    Search, X, Award, User
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import { Card, Button, Badge, Modal, Input } from './UI';
import { useToast } from './Toast';
import AIReportCard from './AIReportCard';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface InterviewData {
    _id: string;
    meetingId: string;
    scheduledTime: string;
    status: 'Pending' | 'Accepted' | 'Rejected' | 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
    notes?: string;
    candidateId: { _id: string; name: string; email: string; profilePicture?: string };
    recruiterId: { _id: string; name: string; email: string; profilePicture?: string };
    interviewerId?: { _id: string; name: string; email: string; profilePicture?: string };
    jobId?: { _id: string; title: string; company: string };
    interviewerRemarks?: string;
    codingTestConducted?: boolean;
    aiEvaluation?: {
        suitabilityScore: number;
        strengths: string[];
        weaknesses: string[];
        redFlags: string[];
        codingScore: number;
        evaluatedAt: string;
    };
}

interface CandidateOption { _id: string; name: string; email: string; }
interface JobOption { _id: string; title: string; company: string; }

interface InterviewsTabProps {
    role: 'RECRUITER' | 'CANDIDATE' | 'INTERVIEWER';
}

const statusBadgeVariant: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
    Scheduled: 'info',
    InProgress: 'warning',
    Completed: 'success',
    Cancelled: 'danger',
};

// ─────────────────────────────────────────────────────────────
// Avatar helper — shows photo if available, fallback to initials
// ─────────────────────────────────────────────────────────────
const Avatar: React.FC<{
    name?: string;
    photoUrl?: string;
    size?: 'sm' | 'md';
}> = ({ name, photoUrl, size = 'md' }) => {
    const [imgError, setImgError] = useState(false);
    const dim = size === 'md' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm';

    if (photoUrl && !imgError) {
        return (
            <img
                src={photoUrl}
                alt={name || 'User'}
                onError={() => setImgError(true)}
                className={`${dim} rounded-full object-cover flex-shrink-0 border border-neutral-700`}
            />
        );
    }

    return (
        <div className={`${dim} rounded-full bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {name?.charAt(0)?.toUpperCase() || <User size={size === 'md' ? 18 : 14} />}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const InterviewsTab: React.FC<InterviewsTabProps> = ({ role }) => {
    const navigate = useNavigate();
    const { addToast, ToastContainer } = useToast();

    const [interviews, setInterviews] = useState<InterviewData[]>([]);
    const [upcomingInterviews, setUpcomingInterviews] = useState<InterviewData[]>([]);
    const [pastInterviews, setPastInterviews] = useState<InterviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // History search
    const [historySearch, setHistorySearch] = useState('');

    // AI Report modal
    const [selectedReport, setSelectedReport] = useState<InterviewData | null>(null);

    // Schedule form (Recruiter only)
    const [candidates, setCandidates] = useState<CandidateOption[]>([]);
    const [jobs, setJobs] = useState<JobOption[]>([]);
    const [formData, setFormData] = useState({
        candidateId: '', jobId: '', scheduledDate: '', scheduledTime: '', notes: '',
    });
    const [scheduling, setScheduling] = useState(false);

    // ── Data fetching ────────────────────────────────────────
    useEffect(() => {
        fetchInterviews();
    }, []);

    const fetchInterviews = async () => {
        try {
            setLoading(true);
            const data = await apiRequest('/interviews/my-interviews');
            if (Array.isArray(data)) {
                 // Fallback for endpoints that haven't been migrated yet (or test mocks)
                 setInterviews(data);
                 setUpcomingInterviews(data.filter(i => !['Completed', 'Cancelled', 'Pending'].includes(i.status) && new Date(i.scheduledTime) >= new Date()));
                 setPastInterviews(data.filter(i => ['Completed', 'Cancelled'].includes(i.status) || new Date(i.scheduledTime) < new Date()));
            } else {
                 // New `{ activeInterviews, pastInterviews }` structure
                 setInterviews([...(data.activeInterviews || []), ...(data.pastInterviews || [])]);
                 setUpcomingInterviews(data.activeInterviews || []);
                 setPastInterviews(data.pastInterviews || []);
            }
        } catch (err: any) {
            addToast('error', err.message || 'Failed to load interviews');
        } finally {
            setLoading(false);
        }
    };

    const openScheduleModal = async () => {
        setShowScheduleModal(true);
        try {
            const jobsData = await apiRequest('/jobs/my-jobs');
            setJobs(jobsData || []);
        } catch (err: any) {
            addToast('error', 'Failed to load your jobs');
        }
        try {
            const candidatesData = await apiRequest('/interviews/eligible-candidates');
            setCandidates(candidatesData || []);
        } catch (err: any) {
            addToast('error', 'Failed to load eligible candidates');
        }
    };

    const handleSchedule = async () => {
        if (!formData.candidateId || !formData.scheduledDate || !formData.scheduledTime) {
            addToast('error', 'Please fill in all required fields');
            return;
        }
        const scheduledDateObj = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
        if (scheduledDateObj <= new Date()) {
            addToast('error', 'Please select a future date and time.');
            return;
        }
        setScheduling(true);
        try {
            await apiRequest('/interviews/schedule', 'POST', {
                candidateId: formData.candidateId,
                jobId: formData.jobId || undefined,
                scheduledTime: scheduledDateObj.toISOString(),
                notes: formData.notes,
            });
            addToast('success', 'Interview scheduled successfully!');
            setShowScheduleModal(false);
            setFormData({ candidateId: '', jobId: '', scheduledDate: '', scheduledTime: '', notes: '' });
            fetchInterviews();
        } catch (err: any) {
            addToast('error', err.message || 'Failed to schedule interview');
        } finally {
            setScheduling(false);
        }
    };

    // Soft-cancel — backend sets status='Cancelled', record persists in history
    const handleCancel = async (interviewId: string) => {
        if (!window.confirm('Are you sure you want to cancel this interview?')) return;
        try {
            await apiRequest(`/interviews/${interviewId}`, 'DELETE');
            addToast('success', 'Interview cancelled — moved to history');
            // Optimistic update: flip status locally so UI reflects immediately
            setInterviews(prev =>
                prev.map(i => i._id === interviewId ? { ...i, status: 'Cancelled' } : i)
            );
        } catch (err: any) {
            addToast('error', err.message || 'Failed to cancel interview');
        }
    };

    // ── Helpers ──────────────────────────────────────────────
    const joinInterview = (meetingId: string) => navigate(`/interview/room/${meetingId}`);
    const isJoinable = (i: InterviewData) => i.status === 'Scheduled' || i.status === 'InProgress';

    const formatDate = (s: string) =>
        new Date(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const formatTime = (s: string) =>
        new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // ── Filtered history (search bar) ───────────────────────
    const filteredHistory = pastInterviews.filter((i) => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase();
        const otherPerson = role === 'RECRUITER' ? i.candidateId?.name : i.recruiterId?.name;
        return (
            otherPerson?.toLowerCase().includes(q) ||
            formatDate(i.scheduledTime).toLowerCase().includes(q) ||
            i.status.toLowerCase().includes(q) ||
            i.jobId?.title?.toLowerCase().includes(q)
        );
    });

    // ── Person shown for this role ───────────────────────────
    const getOtherPerson = (i: InterviewData) => {
        if (role === 'CANDIDATE') return i.interviewerId || i.recruiterId;
        return i.candidateId; // Both Recruiter and Interviewer should see the Candidate
    };

    // ─────────────────────────────────────────────────────────
    // Loading state
    // ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#7B2CBF] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <ToastContainer />

            {/* ── Header ─────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Interviews</h2>
                    <p className="text-neutral-400 text-sm mt-1">
                        {role === 'RECRUITER'
                            ? 'Schedule and manage your interview sessions'
                            : 'View your upcoming and past interviews'}
                    </p>
                </div>
                {role === 'RECRUITER' && (
                    <Button icon={Plus} onClick={openScheduleModal}>
                        Schedule Interview
                    </Button>
                )}
            </div>

            {/* ── Upcoming Interviews ─────────────────────── */}
            <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Calendar size={18} className="text-[#7B2CBF]" />
                    Upcoming
                </h3>

                {upcomingInterviews.length === 0 ? (
                    <Card>
                        <div className="text-center py-8">
                            <Calendar size={40} className="text-neutral-700 mx-auto mb-3" />
                            <p className="text-neutral-500">No upcoming interviews</p>
                            {role === 'RECRUITER' && (
                                <Button variant="outline" size="sm" className="mt-3" onClick={openScheduleModal}>
                                    Schedule One
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div className="grid gap-3">
                        {upcomingInterviews.map((interview) => {
                            const other = getOtherPerson(interview);
                            return (
                                <Card key={interview._id} className="hover:border-[#7B2CBF]/30 transition-all">
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Left: avatar + info */}
                                        <div className="flex items-center gap-4 min-w-0">
                                            <Avatar
                                                name={other?.name}
                                                photoUrl={other?.profilePicture}
                                                size="md"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className="font-semibold text-white truncate">{other?.name}</h4>
                                                    <Badge variant={statusBadgeVariant[interview.status] || 'neutral'}>
                                                        {interview.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-neutral-400 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={13} />
                                                        {formatDate(interview.scheduledTime)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={13} />
                                                        {formatTime(interview.scheduledTime)}
                                                    </span>
                                                    {interview.jobId && (
                                                        <span className="flex items-center gap-1 truncate">
                                                            <Briefcase size={13} />
                                                            {interview.jobId.title}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: actions */}
                                        <div className="flex gap-2 items-center flex-shrink-0">
                                            {role === 'RECRUITER' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                                                    onClick={() => handleCancel(interview._id)}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                            {isJoinable(interview) && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={Video}
                                                    onClick={() => joinInterview(interview.meetingId)}
                                                >
                                                    Join Room
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Interview History (inline, no modal) ────── */}
            {pastInterviews.length > 0 && (
                <section className="pt-6 mt-2 border-t border-neutral-800">
                    {/* Section header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Clock size={18} className="text-neutral-500" />
                            Interview History
                            <span className="text-xs font-normal text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">
                                {pastInterviews.length}
                            </span>
                        </h3>
                    </div>

                    {/* Search bar */}
                    <div className="relative mb-4">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                        <input
                            type="text"
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                            placeholder="Search by name, date, status, or job title…"
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-9 text-sm text-white placeholder-neutral-600 focus:border-[#7B2CBF] focus:ring-1 focus:ring-[#7B2CBF] transition-all outline-none"
                        />
                        {historySearch && (
                            <button
                                onClick={() => setHistorySearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* History list */}
                    {filteredHistory.length === 0 ? (
                        <div className="text-center py-8">
                            <Search size={32} className="text-neutral-700 mx-auto mb-2" />
                            <p className="text-neutral-500 text-sm">No interviews match "{historySearch}"</p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {filteredHistory.map((interview) => {
                                const other = getOtherPerson(interview);
                                return (
                                    <div
                                        key={interview._id}
                                        className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 transition-all"
                                    >
                                        {/* Left: avatar + info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar
                                                name={other?.name}
                                                photoUrl={other?.profilePicture}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-neutral-300 truncate">
                                                    {other?.name}
                                                </p>
                                                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-neutral-500 mt-0.5">
                                                    <span>{formatDate(interview.scheduledTime)}</span>
                                                    <span>{formatTime(interview.scheduledTime)}</span>
                                                    {interview.jobId && (
                                                        <span className="flex items-center gap-1 truncate">
                                                            <Briefcase size={11} />
                                                            {interview.jobId.title}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: badge + AI report */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {interview.status === 'Completed' && interview.aiEvaluation && (
                                                <button
                                                    onClick={() => setSelectedReport(interview)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7B2CBF]/10 border border-[#7B2CBF]/30 hover:bg-[#7B2CBF]/20 rounded-lg transition-colors text-xs font-semibold text-[#9D4EDD] whitespace-nowrap"
                                                >
                                                    <Award size={12} />
                                                    AI Report
                                                </button>
                                            )}
                                            <Badge variant={statusBadgeVariant[interview.status] || 'neutral'}>
                                                {interview.status}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* ── AI Report Detail Modal ─────────────────── */}
            {selectedReport && selectedReport.aiEvaluation && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedReport(null); }}
                >
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-md px-6 py-4 border-b border-neutral-800 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    name={getOtherPerson(selectedReport)?.name}
                                    photoUrl={getOtherPerson(selectedReport)?.profilePicture}
                                    size="sm"
                                />
                                <div>
                                    <h2 className="text-base font-bold text-white">AI Interview Report</h2>
                                    <p className="text-xs text-neutral-500">
                                        {getOtherPerson(selectedReport)?.name}
                                        {selectedReport.jobId ? ` · ${selectedReport.jobId.title}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedReport(null)}
                                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="px-6 py-5">
                            <AIReportCard
                                evaluation={selectedReport.aiEvaluation}
                                candidateName={getOtherPerson(selectedReport)?.name}
                                jobTitle={selectedReport.jobId?.title}
                                interviewerRemarks={selectedReport.interviewerRemarks}
                                codingTestConducted={selectedReport.codingTestConducted}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Schedule Interview Modal (Recruiter only) ── */}
            <Modal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                title="Schedule Interview"
            >
                <div className="space-y-4">
                    {/* Candidate */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                            Candidate <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={formData.candidateId}
                            onChange={(e) => setFormData({ ...formData, candidateId: e.target.value })}
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg py-2.5 px-4 text-white focus:border-[#7B2CBF] focus:ring-1 focus:ring-[#7B2CBF] transition-all outline-none"
                        >
                            <option value="">Select a candidate...</option>
                            {candidates.map((c) => (
                                <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                            ))}
                        </select>
                    </div>

                    {/* Job (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Job (Optional)</label>
                        <select
                            value={formData.jobId}
                            onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg py-2.5 px-4 text-white focus:border-[#7B2CBF] focus:ring-1 focus:ring-[#7B2CBF] transition-all outline-none"
                        >
                            <option value="">No specific job</option>
                            {jobs.map((j) => (
                                <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Date *"
                            type="date"
                            min={new Date().toLocaleDateString('en-CA')}
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                        />
                        <Input
                            label="Time *"
                            type="time"
                            value={formData.scheduledTime}
                            onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="Interview focus areas, preparation instructions..."
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg py-2.5 px-4 text-white placeholder-neutral-600 focus:border-[#7B2CBF] focus:ring-1 focus:ring-[#7B2CBF] transition-all outline-none resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowScheduleModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={handleSchedule}
                            disabled={scheduling}
                        >
                            {scheduling ? 'Scheduling...' : 'Schedule Interview'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InterviewsTab;
