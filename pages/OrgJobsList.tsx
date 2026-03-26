import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Briefcase, Search, Eye, Users, Calendar, User } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useTheme } from '../components/ThemeContext';

interface Job {
    _id: string;
    title: string;
    status: string;
    postedBy: {
        _id: string;
        name: string;
        firstName?: string;
        lastName?: string;
        email: string;
    };
    createdAt: string;
    applicantCount: number;
}

export const OrgJobsList: React.FC = () => {
    const { isDark } = useTheme();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const data = await apiRequest('/organization/jobs');
            setJobs(data);
        } catch (err) {
            console.error('Failed to fetch org jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = jobs.filter(j => 
        j.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (j.postedBy?.name && j.postedBy.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const activeJobsCount = jobs.filter(j => j.status === 'Active').length;
    const totalApplicants = jobs.reduce((sum, j) => sum + (j.applicantCount || 0), 0);

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
                    <h1 className={`text-2xl font-bold ${textPrimary}`}>Company Jobs Overview</h1>
                    <p className={`text-sm mt-1 ${textMuted}`}>
                        Monitor all hiring activities across your team
                    </p>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-[#7B2CBF]/20 text-[#9D4EDD]">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Total Jobs</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>{jobs.length}</p>
                    </div>
                </Card>
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-green-500/20 text-green-400">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Active Jobs</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>{activeJobsCount}</p>
                    </div>
                </Card>
                <Card className="!p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className={`text-xs font-medium ${textMuted}`}>Total Applicants</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>{totalApplicants}</p>
                    </div>
                </Card>
            </div>

            {/* Search bar */}
            <div className="max-w-sm">
                <Input 
                    placeholder="Search by job title or recruiter..." 
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
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider`}>Job Title</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider`}>Posted By</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden sm:table-cell`}>Date Posted</th>
                                <th className={`text-center py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden md:table-cell`}>Total Applicants</th>
                                <th className={`text-left py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider hidden lg:table-cell`}>Status</th>
                                <th className={`text-right py-3 px-5 font-semibold ${textMuted} text-xs uppercase tracking-wider`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className={`text-center py-12 ${textMuted}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[#7B2CBF] border-t-transparent rounded-full animate-spin" />
                                            <span>Loading jobs...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className={`text-center py-12 ${textMuted}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <Briefcase size={32} className="opacity-30" />
                                            <p className="font-medium">No jobs found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(job => (
                                    <tr key={job._id} className={`border-b ${borderColor} ${hoverBg} transition-colors`}>
                                        <td className={`py-3.5 px-5 font-semibold ${textPrimary}`}>
                                            {job.title}
                                        </td>
                                        <td className={`py-3.5 px-5`}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7B2CBF] to-[#9D4EDD] flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                                                    {(job.postedBy?.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`${textPrimary}`}>{job.postedBy?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className={`py-3.5 px-5 hidden sm:table-cell ${textMuted}`}>
                                            {new Date(job.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className={`py-3.5 px-5 hidden md:table-cell text-center`}>
                                            <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full text-xs font-bold ${job.applicantCount > 0 ? 'bg-[#7B2CBF]/10 text-[#7B2CBF]' : 'bg-neutral-500/10 text-neutral-400'}`}>
                                                {job.applicantCount || 0}
                                            </span>
                                        </td>
                                        <td className={`py-3.5 px-5 hidden lg:table-cell`}>
                                            <Badge variant={job.status === 'Active' ? 'success' : 'neutral'}>
                                                {job.status}
                                            </Badge>
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <Button 
                                                variant="primary" 
                                                size="sm" 
                                                className="!px-3 !py-1.5"
                                                onClick={() => setSelectedJob(job)}
                                            >
                                                <Eye size={14} className="mr-1.5" />
                                                View Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ====== View Details Stats View ====== */}
            <Modal isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} title="Job Details">
                {selectedJob && (
                    <div className="space-y-6">
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5 border border-purple-900/30' : 'bg-purple-50 border border-purple-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className={`text-xl font-bold ${textPrimary}`}>{selectedJob.title}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant={selectedJob.status === 'Active' ? 'success' : 'neutral'}>
                                            {selectedJob.status}
                                        </Badge>
                                        <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                                            <Calendar size={12} />
                                            Posted on {new Date(selectedJob.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-[#0D0117]/60' : 'bg-white'} shadow-sm border ${borderColor}`}>
                                    <p className={`text-xs ${textMuted} flex items-center gap-1.5 mb-1`}>
                                        <User size={14} /> Recruiter
                                    </p>
                                    <p className={`font-semibold ${textPrimary} truncate`}>{selectedJob.postedBy?.name}</p>
                                    <p className={`text-[10px] ${textMuted} truncate mt-0.5`}>{selectedJob.postedBy?.email}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-[#0D0117]/60' : 'bg-white'} shadow-sm border ${borderColor}`}>
                                    <p className={`text-xs ${textMuted} flex items-center gap-1.5 mb-1`}>
                                        <Users size={14} /> Pipeline
                                    </p>
                                    <p className={`font-semibold ${textPrimary}`}>{selectedJob.applicantCount || 0} Applicants</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setSelectedJob(null)}>Close</Button>
                            {/* "View Candidate Pipeline" (Read-Only format) */}
                            <Button 
                                variant="primary" 
                                onClick={() => {
                                    alert('Candidate Pipeline feature is read-only for Org Admins and will be fully available in the next release.');
                                }}
                            >
                                <Users size={16} className="mr-2" />
                                View Candidate Pipeline
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
