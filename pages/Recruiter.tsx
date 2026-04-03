import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal } from '../components/UI';
import { Plus, Search, Calendar, Clock, Video, FileText, ChevronRight, BarChart2, User, MapPin, Briefcase, GraduationCap, Github, Linkedin, Globe, Upload, Lock, Shield, MessageSquare, Link as LinkIcon, Download, Star, DollarSign, Sparkles, Send, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { Job, User as UserType } from '../types';
import InterviewsTab from '../components/InterviewsTab';

// Helper to convert file to base64
const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

import { ApplicantReviewModal } from '../components/ApplicantReviewModal';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { FreelancerPublicProfileModal } from '../components/FreelancerPublicProfileModal';

export const RecruiterDashboard: React.FC = () => {
    const [stats, setStats] = useState({ jobs: 0, applicants: 0, interviews: 0, pipeline: { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 } });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const jobs = await apiRequest('/jobs/my-jobs');
                const allInterviews = await apiRequest('/interviews/my-interviews');
                const applications = await apiRequest('/jobs/applications/received');

                // Compute Upcoming Interviews only
                const now = new Date().getTime();
                const upcomingInterviews = allInterviews.filter((interview: any) => {
                    return new Date(interview.scheduledTime).getTime() > now;
                });

                const pipelineCounts = { Applied: 0, Screening: 0, Interview: 0, Offer: 0, Rejected: 0 };
                applications.forEach((app: any) => {
                    if (pipelineCounts[app.status as keyof typeof pipelineCounts] !== undefined) {
                        pipelineCounts[app.status as keyof typeof pipelineCounts]++;
                    }
                });

                setStats({
                    jobs: jobs.length,
                    applicants: applications.length,
                    interviews: upcomingInterviews.length,
                    pipeline: pipelineCounts
                });
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Recruiter Dashboard</h2>
                    <p className="text-neutral-400">Welcome back, here's what's happening today.</p>
                </div>
                <Button icon={Plus} onClick={() => window.location.href = '#/recruiter/jobs'}>Post New Job</Button>
            </div>
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-purple-900/10 border-l-4 border-l-[#7B2CBF]">
                    <h3 className="text-3xl font-bold mb-1">{stats.jobs}</h3>
                    <p className="text-neutral-400">Active Job Postings</p>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-blue-900/10 border-l-4 border-l-blue-500">
                    <h3 className="text-3xl font-bold mb-1">{stats.applicants}</h3>
                    <p className="text-neutral-400">Total Applicants</p>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-green-900/10 border-l-4 border-l-green-500">
                    <h3 className="text-3xl font-bold mb-1">{stats.interviews}</h3>
                    <p className="text-neutral-400">Scheduled Interviews</p>
                </Card>
            </div>

            {/* Pipeline Health */}
            <Card title="Application Pipeline">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(stats.pipeline).map(([status, count]) => (
                        <div key={status} className="p-4 bg-neutral-800/50 rounded-lg text-center border border-neutral-800">
                            <h4 className="text-2xl font-bold text-white mb-1">{count}</h4>
                            <p className="text-xs text-neutral-400 uppercase tracking-wider">{status}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-8">
                <Card title="Quick Actions">
                    <div className="space-y-4">
                        <Button className="w-full justify-start" icon={Search} variant="ghost" onClick={() => window.location.href = '#/recruiter/applicants'}>Find Candidates</Button>
                        <Button className="w-full justify-start" icon={Video} variant="ghost" onClick={() => window.location.href = '#/recruiter/hire-interviewer'}>Hire Freelance Interviewer</Button>
                        <Button className="w-full justify-start" icon={Plus} variant="ghost" onClick={() => window.location.href = '#/recruiter/jobs'}>Create New Job Post</Button>
                        <Button className="w-full justify-start" icon={User} variant="ghost" onClick={() => window.location.href = '#/recruiter/profile'}>Update Profile</Button>
                    </div>
                </Card>
                <Card title="Recent Applicants">
                    <div className="space-y-4">
                        <div className="p-4 text-neutral-500 text-center text-sm">Check the 'Applicants' tab to manage candidates.</div>
                        <Button variant="ghost" className="w-full mt-2 text-sm" onClick={() => window.location.href = '#/recruiter/applicants'}>View All Applicants</Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export const MyJobs: React.FC = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingJob, setIsCreatingJob] = useState(false);

    useEffect(() => {
        if (!isCreatingJob) {
            setLoading(true);
            apiRequest('/jobs/my-jobs').then(setJobs).catch(console.error).finally(() => setLoading(false));
        }
    }, [isCreatingJob]);

    if (loading) return <div>Loading jobs...</div>;

    if (isCreatingJob) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => setIsCreatingJob(false)} className="mb-4 text-neutral-400 hover:text-white">
                    ← Back to Jobs List
                </Button>
                <CreateJob onJobCreated={() => setIsCreatingJob(false)} onCancel={() => setIsCreatingJob(false)} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">My Job Postings</h2>
                <Button icon={Plus} onClick={() => setIsCreatingJob(true)}>Post New Job</Button>
            </div>

            {jobs.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900 rounded-xl border border-neutral-800">
                    <p className="text-neutral-400 mb-4">You haven't posted any jobs yet.</p>
                    <Button onClick={() => setIsCreatingJob(true)}>Create First Job</Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {jobs.map(job => (
                        <Card key={job._id} className="flex justify-between items-center p-6 group hover:border-[#7B2CBF]">
                            <div>
                                <h3 className="text-xl font-bold mb-1">{job.title}</h3>
                                <div className="flex gap-4 text-sm text-neutral-400 items-center">
                                    <span className="flex items-center gap-1"><MapPin size={14} /> {job.location} | {job.type}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                                    <Badge className="bg-[#7B2CBF]/20 text-[#7B2CBF] border-[#7B2CBF]/50 px-3 py-1 text-sm rounded-full font-bold ml-2">
                                        {job.applicantCount || 0} Applicants
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={job.status === 'Active' ? 'neutral' : 'outline'} className={job.status === 'Active' ? 'text-green-400 border-green-900' : 'text-neutral-500'}>
                                    {job.status}
                                </Badge>
                                <Button variant="outline" size="sm" onClick={() => window.location.href = `#/recruiter/ranked/${job._id}`}>
                                    <Sparkles className="w-4 h-4 mr-1.5" />AI Rankings
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export const CreateJob: React.FC<{ onJobCreated?: () => void, onCancel?: () => void }> = ({ onJobCreated, onCancel }) => {
    const [formData, setFormData] = useState({
        title: '',
        location: '',
        type: 'Full-time',
        description: '',
        requirements: '',
        salary: '',
        company: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch user profile to get company name
        apiRequest('/users/profile').then(user => {
            const orgName = user.organization?.name || user.companyName;
            if (orgName) {
                setFormData(prev => ({ ...prev, company: orgName }));
            }
        }).catch(err => console.error(err));
    }, []);

    const handleSubmit = async () => {
        if (!formData.title || !formData.location || !formData.company) {
            alert("Please fill in all required fields (and ensure your profile has a Company Name)");
            return;
        }

        setLoading(true);
        try {
            await apiRequest('/jobs', 'POST', formData);
            alert('Job posted successfully!');
            setFormData({ title: '', location: '', type: 'Full-time', description: '', requirements: '', salary: '', company: formData.company });
            if (onJobCreated) onJobCreated();
        } catch (err) {
            alert('Failed to post job');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Create New Job Post</h2>
            <Card className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <Input
                        label="Job Title"
                        placeholder="e.g. Senior Product Designer"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                    <Input
                        label="Company Name"
                        placeholder="Your Company"
                        value={formData.company}
                        onChange={e => setFormData({ ...formData, company: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <Input
                        label="Location"
                        placeholder="e.g. Remote / New York"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                    />
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Employment Type</label>
                        <select
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#7B2CBF]"
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option>Full-time</option>
                            <option>Contract</option>
                            <option>Part-time</option>
                            <option>Remote</option>
                        </select>
                    </div>
                </div>
                <Input
                    label="Salary Range"
                    placeholder="e.g. $100k - $120k"
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                />
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Job Description</label>
                    <textarea
                        className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-32 focus:border-[#7B2CBF] outline-none"
                        placeholder="Describe the role responsibilities..."
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Requirements</label>
                    <textarea
                        className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-32 focus:border-[#7B2CBF] outline-none"
                        placeholder="List skills and requirements..."
                        value={formData.requirements}
                        onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                    />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <Button variant="ghost" onClick={() => onCancel && onCancel()}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Posting...' : 'Publish Job'}</Button>
                </div>
            </Card>
        </div>
    )
}


export const Applicants: React.FC = () => {
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [isMessageOpen, setIsMessageOpen] = useState(false);

    // Modal Forms
    const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
    const [messageData, setMessageData] = useState({ content: '' });

    const fetchApplications = async () => {
        try {
            const data = await apiRequest('/jobs/applications/received');
            setApplications(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            await apiRequest(`/jobs/applications/${id}/status`, 'PUT', { status });
            // Update local state
            setApplications(applications.map(app => app._id === id ? { ...app, status } : app));
            if (selectedApp && selectedApp._id === id) {
                setSelectedApp({ ...selectedApp, status });
            }
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleSchedule = async () => {
        if (!selectedApp || !scheduleData.date || !scheduleData.time) {
            alert("Please provide Date and Time.");
            return;
        }

        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const currentTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        if (scheduleData.date < todayStr || (scheduleData.date === todayStr && scheduleData.time < currentTimeStr)) {
            alert("Please select a valid future date and time.");
            return;
        }

        try {
            const scheduledTime = new Date(`${scheduleData.date}T${scheduleData.time}`).toISOString();
            await apiRequest('/interviews/schedule', 'POST', {
                candidateId: selectedApp.candidate._id,
                jobId: selectedApp.job?._id,
                scheduledTime
            });
            alert('Interview scheduled!');
            await handleStatusUpdate(selectedApp._id, 'Interview');
            setIsScheduleOpen(false);
        } catch (error) {
            alert('Failed to schedule');
        }
    };

    const handleSendMessage = async () => {
        if (!selectedApp) return;
        try {
            await apiRequest('/interviews/message', 'POST', {
                receiverId: selectedApp.candidate._id,
                content: messageData.content
            });
            alert('Message sent!');
            setIsMessageOpen(false);
        } catch (error) {
            alert('Failed to send message');
        }
    };

    // Helper to get consistent data (Snapshot vs Live Profile)
    const getCandidateData = (app: any) => {
        const profile = app.candidate.profile || {};
        return {
            name: app.candidate.name,
            profilePicture: app.candidate.profilePicture,
            headline: profile.headline || app.candidate.headline || 'Candidate',
            bio: profile.bio,
            skills: app.skills?.length > 0 ? app.skills : (profile.skills || app.candidate.skills || []),
            experience: app.experience?.length > 0 ? app.experience : (profile.experience || app.candidate.experience || []),
            education: app.education?.length > 0 ? app.education : (profile.education || app.candidate.education || []),
            resume: app.resume || profile.resume || app.candidate.resumeUrl
        };
    };

    const nowLocal = new Date();
    const minDateLocal = nowLocal.getFullYear() + '-' + String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + String(nowLocal.getDate()).padStart(2, '0');
    const minTimeLocal = scheduleData.date === minDateLocal ? String(nowLocal.getHours()).padStart(2, '0') + ':' + String(nowLocal.getMinutes()).padStart(2, '0') : undefined;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Applicants</h2>

            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-neutral-500 w-5 h-5" />
                    <Input placeholder="Search candidates..." className="pl-10" />
                </div>
            </div>

            {loading ? <p>Loading...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {applications.length === 0 && <p className="text-neutral-500 col-span-3">No applicants found yet.</p>}
                    {applications.map((app) => {
                        const data = getCandidateData(app);
                        return (
                            <Card key={app._id} className="flex flex-col gap-4 group hover:border-[#7B2CBF]/50 cursor-pointer relative" onClick={() => setSelectedApp(app)}>
                                <div className="absolute top-4 right-4">
                                    <Badge variant={app.status === 'Applied' ? 'neutral' : app.status === 'Rejected' ? 'outline' : 'neutral'} className={app.status === 'Rejected' ? 'text-red-400 border-red-900' : 'text-[#7B2CBF]'}>
                                        {app.status}
                                    </Badge>
                                </div>
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <img src={data.profilePicture || "/assets/default-avatar.png"} className="w-12 h-12 rounded-lg object-cover" alt="profile" />
                                        <div>
                                            <h3 className="font-semibold text-white">{data.name}</h3>
                                            <p className="text-xs text-neutral-400">{data.headline}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-neutral-500">
                                    Applied for <span className="text-white font-medium">{app.job.title}</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {data.skills?.slice(0, 3).map((s: string, idx: number) => (
                                        <span key={idx} className="text-xs bg-neutral-800 px-2 py-1 rounded text-neutral-300">{s}</span>
                                    ))}
                                </div>
                                <Button size="sm" variant="outline" className="w-full mt-auto" onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedApp(app);
                                }}>Review Application</Button>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Candidate Profile Modal */}
            <ApplicantReviewModal
                isOpen={selectedApp !== null}
                onClose={() => setSelectedApp(null)}
                application={selectedApp}
                onStatusUpdate={handleStatusUpdate}
                onSchedule={() => setIsScheduleOpen(true)}
                onMessage={() => setIsMessageOpen(true)}
            />

            {/* Schedule Interview Modal */}
            <Modal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} title="Schedule Interview">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Date" type="date" min={minDateLocal} value={scheduleData.date} onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })} />
                        <Input label="Time" type="time" min={minTimeLocal} value={scheduleData.time} onChange={e => setScheduleData({ ...scheduleData, time: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                        <Button onClick={handleSchedule}>Confirm Schedule</Button>
                    </div>
                </div>
            </Modal>

            {/* Send Message Modal */}
            <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)} title="Send Message">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Message</label>
                        <textarea
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-32 focus:border-[#7B2CBF] outline-none"
                            placeholder="Write your message here..."
                            value={messageData.content}
                            onChange={e => setMessageData({ ...messageData, content: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsMessageOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendMessage}>Send Message</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export const FindInterviewers: React.FC = () => {
    const [interviewers, setInterviewers] = useState<UserType[]>([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState<UserType | null>(null);
    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Booking Form State
    const [bookingData, setBookingData] = useState({
        jobId: '', candidateId: '', date: '', time: '', notes: ''
    });

    const [jobs, setJobs] = useState<any[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [maxRate, setMaxRate] = useState(150);

    const fetchInterviewers = async () => {
        try {
            const query = new URLSearchParams();
            if (searchTerm) query.append('skill', searchTerm);
            if (maxRate) query.append('maxRate', maxRate.toString());
            const data = await apiRequest(`/users/interviewers?${query.toString()}`);
            setInterviewers(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchInterviewers();
        // Pre-fetch jobs and candidates for the booking modal dropdowns
        apiRequest('/jobs/my-jobs').then(setJobs).catch(console.error);
        apiRequest('/interviews/eligible-candidates').then(setCandidates).catch(console.error);
    }, []);

    const handleHire = async () => {
        if (!selectedInterviewer || !bookingData.candidateId || !bookingData.date || !bookingData.time) {
            alert("Please fill in Candidate, Date, and Time.");
            return;
        }

        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const currentTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        if (bookingData.date < todayStr || (bookingData.date === todayStr && bookingData.time < currentTimeStr)) {
            alert("Please select a valid future date and time.");
            return;
        }

        try {
            await apiRequest('/interviews/schedule', 'POST', {
                candidateId: bookingData.candidateId,
                jobId: bookingData.jobId || undefined,
                interviewerId: selectedInterviewer._id,
                scheduledTime: `${bookingData.date}T${bookingData.time}:00`,
                notes: bookingData.notes,
                isDirectBooking: true // Flag to tell backend this is a booking request for an interviewer
            });
            alert('Booking request sent successfully!');
            setIsMessageOpen(false);
            setBookingData({ jobId: '', candidateId: '', date: '', time: '', notes: '' });
        } catch (error) {
            alert('Failed to send booking request');
        }
    };

    const nowLocal = new Date();
    const minDateLocal = nowLocal.getFullYear() + '-' + String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + String(nowLocal.getDate()).padStart(2, '0');
    const minTimeLocal = bookingData.date === minDateLocal ? String(nowLocal.getHours()).padStart(2, '0') + ':' + String(nowLocal.getMinutes()).padStart(2, '0') : undefined;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Find Freelance Interviewers</h2>

            <div className="flex flex-col md:flex-row gap-4 bg-neutral-900 p-6 rounded-xl border border-neutral-800 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Search by Skill</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-neutral-500 w-5 h-5 pointer-events-none" />
                        <input
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-[#7B2CBF] outline-none"
                            placeholder="e.g. React, Node.js"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="w-full md:w-64 pb-2">
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-neutral-400">Max Hourly Rate</label>
                        <span className="text-sm font-bold text-[#7B2CBF]">${maxRate}/hr</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="300"
                        step="5"
                        value={maxRate}
                        onChange={e => setMaxRate(Number(e.target.value))}
                        className="w-full accent-[#7B2CBF]"
                    />
                </div>
                <div>
                    <Button onClick={fetchInterviewers} className="h-[42px] px-8">Search</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {interviewers.map(user => (
                    <Card key={user._id} className="flex flex-col gap-4 group hover:border-[#7B2CBF]/50">
                        <div className="flex items-center gap-4">
                            <img src={user.profilePicture || "/assets/default-avatar.png"} className="w-16 h-16 rounded-xl object-cover" alt="profile" />
                            <div>
                                <h3 className="font-bold text-white">{user.name}</h3>
                                <p className="text-xs text-[#7B2CBF]">{(user as any).profile?.headline || 'Expert Interviewer'}</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-neutral-400">
                            <div className="flex items-center gap-2">
                                <DollarSign size={14} className="text-green-400" />
                                <span>{(user as any).profile?.hourlyRate || '50'}/hr</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-blue-400" />
                                <span>{(user as any).profile?.yearsOfExperience || '5+'} Years Experience</span>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {(user as any).profile?.skills?.slice(0, 3).map((s: string) => (
                                <Badge key={s} variant="neutral">{s}</Badge>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-auto">
                            <Button className="flex-1" variant="outline" onClick={() => { setSelectedInterviewer(user); setIsDetailsOpen(true); }}>
                                View Details
                            </Button>
                            <Button className="flex-1" onClick={() => { setSelectedInterviewer(user); setIsMessageOpen(true); }}>
                                Book
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isMessageOpen} onClose={() => setIsMessageOpen(false)} title={`Book ${selectedInterviewer?.name}`}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1.5">For Job (Optional)</label>
                            <select className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#7B2CBF]" value={bookingData.jobId} onChange={e => setBookingData({ ...bookingData, jobId: e.target.value })}>
                                <option value="">Select Job</option>
                                {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1.5">For Candidate</label>
                            <select className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#7B2CBF]" value={bookingData.candidateId} onChange={e => setBookingData({ ...bookingData, candidateId: e.target.value })}>
                                <option value="">Select Candidate</option>
                                {candidates.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Proposed Date" type="date" min={minDateLocal} value={bookingData.date} onChange={e => setBookingData({ ...bookingData, date: e.target.value })} />
                        <Input label="Proposed Time" type="time" min={minTimeLocal} value={bookingData.time} onChange={e => setBookingData({ ...bookingData, time: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Notes / Instructions</label>
                        <textarea
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-24 focus:border-[#7B2CBF] outline-none"
                            placeholder="Describe what you want the interviewer to focus on..."
                            value={bookingData.notes}
                            onChange={e => setBookingData({ ...bookingData, notes: e.target.value })}
                        />
                    </div>

                    <div className="px-4 py-3 bg-neutral-900 rounded-lg border border-neutral-800 flex justify-between items-center text-sm">
                        <span className="text-neutral-400">Interviewer Rate:</span>
                        <span className="text-white font-bold text-lg">${(selectedInterviewer as any)?.profile?.hourlyRate || '50'} <span className="text-xs text-neutral-500 font-normal">/hr</span></span>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsMessageOpen(false)}>Cancel</Button>
                        <Button onClick={handleHire}>Send Request</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Freelancer Profile">
                {selectedInterviewer && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-neutral-800 pb-4">
                            <img src={selectedInterviewer.profilePicture || "/assets/default-avatar.png"} className="w-20 h-20 rounded-xl object-cover" alt="profile" />
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedInterviewer.name}</h3>
                                <p className="text-[#7B2CBF]">{(selectedInterviewer as any).profile?.headline || 'Professional Interviewer'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                                <p className="text-xs text-neutral-400 mb-1">Hourly Rate</p>
                                <p className="text-lg font-bold text-white flex items-center gap-1">
                                    <DollarSign size={16} className="text-green-500" />
                                    {(selectedInterviewer as any).profile?.hourlyRate || '50'}/hr
                                </p>
                            </div>
                            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                                <p className="text-xs text-neutral-400 mb-1">Experience</p>
                                <p className="text-lg font-bold text-white flex items-center gap-1">
                                    <Clock size={16} className="text-blue-500" />
                                    {(selectedInterviewer as any).profile?.yearsOfExperience || '5+'} Years
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2">About</h4>
                            <p className="text-sm text-neutral-400 leading-relaxed bg-black/30 p-4 rounded-lg border border-neutral-800/50">
                                {(selectedInterviewer as any).profile?.bio || "This freelancer hasn't added a biography yet, but they have been vetted by our team to conduct high-quality technical interviews."}
                            </p>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2">Skills & Technologies</h4>
                            <div className="flex flex-wrap gap-2">
                                {(selectedInterviewer as any).profile?.skills && (selectedInterviewer as any).profile.skills.length > 0 ? (
                                    (selectedInterviewer as any).profile.skills.map((skill: string, idx: number) => (
                                        <Badge key={idx} variant="info">{skill}</Badge>
                                    ))
                                ) : (
                                    <span className="text-sm text-neutral-500">No skills listed</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-neutral-300 mb-2">Availability</h4>
                            <div className="flex flex-wrap gap-2">
                                {(selectedInterviewer as any).profile?.availability && (selectedInterviewer as any).profile.availability.length > 0 ? (
                                    (selectedInterviewer as any).profile.availability.map((av: string, idx: number) => (
                                        <Badge key={idx} variant="neutral">{av}</Badge>
                                    ))
                                ) : (
                                    <span className="text-sm text-neutral-500">Flexible</span>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-neutral-800">
                            <Button onClick={() => {
                                setIsDetailsOpen(false);
                                setIsMessageOpen(true);
                            }}>
                                Hire {selectedInterviewer.name.split(' ')[0]}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export const RecruiterProfile: React.FC = () => {
    const [user, setUser] = useState<UserType | null>(null);
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', companyName: '', website: '', companyDescription: ''
    });
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    useEffect(() => {
        apiRequest('/users/profile').then((data) => {
            setUser(data);
            setProfilePicture(data.profilePicture);
            // Check if organization is populated (it should be for Recruiters/Admins)
            const org = data.organization || {};

            setFormData({
                firstName: data.firstName || data.name.split(' ')[0] || '',
                lastName: data.lastName || data.name.split(' ').slice(1).join(' ') || '',
                companyName: org.name || data.companyName || '',
                website: org.website || data.website || '',
                companyDescription: org.description || data.companyDescription || ''
            });
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        try {
            // Note: Only ADMINs can actually update organization fields based on backend logic
            await apiRequest('/users/profile', 'PUT', { ...formData });
            alert('Profile updated!');
        } catch (e) { alert('Error updating profile'); }
    };

    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const formData = new FormData();
                formData.append('profilePicture', e.target.files[0]);

                const response = await apiRequest('/users/profile-picture', 'POST', formData);
                setProfilePicture(response.profilePicture);
                alert('Profile picture updated');
            } catch (err: any) {
                console.error(err);
                alert(`Error uploading image: ${err.message || 'Unknown error'}`);
            }
        }
    };

    if (!user) return <div>Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold">Recruiter Profile</h2>
            <div className="grid md:grid-cols-3 gap-8">
                <Card className="md:col-span-1 text-center p-6 h-fit">
                    <div className="relative w-32 h-32 mx-auto mb-4 group">
                        <img src={profilePicture || "/assets/default-avatar.png"} className="w-full h-full rounded-full object-cover border-4 border-[#7B2CBF]" alt="Profile" />
                        <label className="absolute bottom-0 right-0 p-2 bg-neutral-800 rounded-full border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer">
                            <Upload size={16} />
                            <input type="file" className="hidden" accept="image/*" onChange={handleProfilePictureChange} />
                        </label>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{user.name}</h3>
                    <p className="text-neutral-400 text-sm mb-4">Recruiter</p>
                </Card>

                <Card className="md:col-span-2 p-8 space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <User size={20} className="text-[#7B2CBF]" /> Personal
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input label="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                            <Input label="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <Briefcase size={20} className="text-[#7B2CBF]" /> Company
                        </h3>
                        <div className="space-y-4">
                            <Input label="Company Name" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                            <Input label="Website" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} />
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Company Description</label>
                                <textarea className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-24 focus:border-[#7B2CBF] outline-none"
                                    value={formData.companyDescription} onChange={e => setFormData({ ...formData, companyDescription: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button onClick={handleSave}>Save Changes</Button>
                    </div>

                    <div className="border-t border-neutral-800 pt-8 mt-8">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Lock size={20} className="text-[#7B2CBF]" /> Password & Security
                        </h3>
                        <ChangePasswordForm />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export const RecruiterInterviews: React.FC = () => <InterviewsTab role="RECRUITER" />;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE MARKETPLACE
// Fiverr-style grid of freelancer interview services
// ─────────────────────────────────────────────────────────────────────────────
interface FreelancerService {
    _id: string;
    title: string;
    description: string;
    skills: string[];
    price: number;
    durationMinutes: number;
    isActive: boolean;
    freelancerId: {
        _id: string;
        name: string;
        profilePicture?: string;
        averageRating?: number;
        bio?: string;
    };
    createdAt: string;
}

export const ServiceMarketplace: React.FC = () => {
    const [services, setServices] = useState<FreelancerService[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [skillFilter, setSkillFilter] = useState('');
    const [maxPrice, setMaxPrice] = useState(500);

    // Profile View modal
    const [viewProfileId, setViewProfileId] = useState<string | null>(null);

    // Delegation modal
    const [selected, setSelected] = useState<FreelancerService | null>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [delegationLoading, setDelegationLoading] = useState(false);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (skillFilter.trim()) params.append('skill', skillFilter.trim());
            if (maxPrice < 500) params.append('maxPrice', maxPrice.toString());
            const data = await apiRequest(`/recruiter/services?${params.toString()}`);
            setServices(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        apiRequest('/jobs/my-jobs').then(setJobs).catch(console.error);
    }, []);

    // Filter to only show Active jobs that haven't been delegated yet
    const availableJobs = jobs.filter(j => j.status === 'Active' && (!j.delegationStatus || j.delegationStatus === 'none'));

    const handleDelegate = async () => {
        if (!selected) return;
        if (!selectedJobId) {
            alert('Please select a job to delegate.');
            return;
        }

        setDelegationLoading(true);
        try {
            await apiRequest(`/jobs/${selectedJobId}/delegate`, 'POST', {
                freelancerId: selected.freelancerId._id,
            });
            alert('✅ Delegation request sent to freelancer!');
            setSelected(null);
            setSelectedJobId('');
            // Refresh jobs to update delegation status
            apiRequest('/jobs/my-jobs').then(setJobs).catch(console.error);
        } catch (err: any) {
            alert(err.message || 'Failed to delegate job.');
        } finally {
            setDelegationLoading(false);
        }
    };

    const renderStars = (rating: number = 0) => {
        const full = Math.floor(rating);
        return Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={12} className={i < full ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-600'} />
        ));
    };

    // Find the selected job object for the summary preview
    const selectedJob = jobs.find(j => (j._id || j.id) === selectedJobId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">Freelancer Marketplace</h2>
                <p className="text-neutral-400 text-sm mt-1">Delegate your hiring pipeline to expert freelancers — they'll find the perfect candidate for you.</p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-5 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Filter by Skill</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4 pointer-events-none" />
                        <input
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#7B2CBF] outline-none transition-colors"
                            placeholder="e.g. React, System Design, Node.js"
                            value={skillFilter}
                            onChange={e => setSkillFilter(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchServices()}
                        />
                    </div>
                </div>
                <div className="w-full md:w-72">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Max Price</label>
                        <span className="text-sm font-bold text-[#7B2CBF]">{maxPrice >= 500 ? 'Any' : `$${maxPrice}`}</span>
                    </div>
                    <input type="range" min="20" max="500" step="10" value={maxPrice}
                        onChange={e => setMaxPrice(Number(e.target.value))}
                        className="w-full accent-[#7B2CBF]" />
                </div>
                <Button onClick={fetchServices} className="h-[42px] px-8">Search</Button>
            </div>

            {/* Results count */}
            {!loading && (
                <p className="text-sm text-neutral-500">{services.length} service{services.length !== 1 ? 's' : ''} available</p>
            )}

            {/* Service Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-64 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : services.length === 0 ? (
                <div className="text-center py-20 border border-neutral-800 rounded-xl">
                    <Briefcase size={48} className="text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500 text-lg font-medium">No services found</p>
                    <p className="text-neutral-600 text-sm mt-1">Try adjusting your skill filter or price range</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map(svc => (
                        <div key={svc._id}
                            className="group flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-[#7B2CBF]/50 transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/20"
                        >
                            {/* Freelancer header */}
                            <div className="p-5 border-b border-neutral-800/70 flex items-center gap-3">
                                <img
                                    src={svc.freelancerId.profilePicture || '/assets/default-avatar.png'}
                                    alt={svc.freelancerId.name}
                                    className="w-11 h-11 rounded-full object-cover border-2 border-[#7B2CBF]/30"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white text-sm truncate">{svc.freelancerId.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {renderStars(svc.freelancerId.averageRating)}
                                        <span className="text-xs text-neutral-500 ml-1">
                                            {svc.freelancerId.averageRating?.toFixed(1) || 'New'}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setViewProfileId(svc.freelancerId._id)}
                                        className="text-[11px] text-[#9D4EDD] hover:text-[#c8b6ff] mt-1 text-left"
                                    >
                                        View Profile
                                    </button>
                                </div>
                                <Badge variant="neutral" className="text-[10px] px-2 bg-[#7B2CBF]/10 text-[#9D4EDD] border-[#7B2CBF]/20">
                                    {svc.durationMinutes} min
                                </Badge>
                            </div>

                            {/* Service body */}
                            <div className="flex-1 p-5 space-y-3">
                                <h3 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-[#9D4EDD] transition-colors">
                                    {svc.title}
                                </h3>
                                <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed">
                                    {svc.description}
                                </p>
                                {svc.skills.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {svc.skills.slice(0, 4).map((sk, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full border border-neutral-700">
                                                {sk}
                                            </span>
                                        ))}
                                        {svc.skills.length > 4 && (
                                            <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-500 rounded-full">
                                                +{svc.skills.length - 4}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer: price + CTA */}
                            <div className="p-5 pt-0 flex items-center justify-between">
                                <div>
                                    <span className="text-2xl font-black text-white">${svc.price}</span>
                                    <span className="text-xs text-neutral-500 ml-1">/ project</span>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => { 
                                        setSelected(svc); 
                                        setSelectedJobId('');
                                    }}
                                    className="bg-gradient-to-r from-[#7B2CBF] to-[#480CA8] hover:from-[#9D4EDD] hover:to-[#7B2CBF] text-white"
                                >
                                    <Send size={14} className="mr-1.5" />
                                    Delegate Job
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Delegation Modal ─────────────────────────────────────────────── */}
            <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Delegate Job Pipeline">
                {selected && (
                    <div className="space-y-5">
                        {/* Freelancer summary */}
                        <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                            <img
                                src={selected.freelancerId.profilePicture || '/assets/default-avatar.png'}
                                className="w-12 h-12 rounded-full object-cover border-2 border-[#7B2CBF]/30"
                                alt={selected.freelancerId.name}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white">{selected.freelancerId.name}</p>
                                <p className="text-xs text-neutral-400 truncate">{selected.title}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xl font-black text-white">${selected.price}</p>
                                <p className="text-[10px] text-neutral-500">per project</p>
                            </div>
                        </div>

                        {/* Visual Delegation Flow */}
                        <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-[#7B2CBF]/5 via-[#480CA8]/10 to-[#7B2CBF]/5 rounded-xl border border-[#7B2CBF]/20">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-9 h-9 rounded-full bg-[#7B2CBF]/20 flex items-center justify-center">
                                    <Briefcase size={16} className="text-[#9D4EDD]" />
                                </div>
                                <span className="text-[10px] text-neutral-400 font-medium">You</span>
                            </div>
                            <ArrowRight size={18} className="text-[#7B2CBF]/60 flex-shrink-0" />
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-9 h-9 rounded-full bg-[#7B2CBF]/20 flex items-center justify-center">
                                    <User size={16} className="text-[#9D4EDD]" />
                                </div>
                                <span className="text-[10px] text-neutral-400 font-medium">Freelancer</span>
                            </div>
                            <ArrowRight size={18} className="text-[#7B2CBF]/60 flex-shrink-0" />
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Sparkles size={16} className="text-emerald-400" />
                                </div>
                                <span className="text-[10px] text-neutral-400 font-medium">Hire</span>
                            </div>
                        </div>

                        {/* Job Selector */}
                        <div>
                            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                                Select Job Pipeline <span className="text-red-400">*</span>
                            </label>
                            <select
                                id="delegation-job-select"
                                className="w-full bg-black/50 border border-neutral-800 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#7B2CBF] transition-colors"
                                value={selectedJobId}
                                onChange={e => setSelectedJobId(e.target.value)}
                            >
                                <option value="">Choose a job to delegate...</option>
                                {availableJobs.map(j => (
                                    <option key={j._id || j.id} value={j._id || j.id}>
                                        {j.title} — {j.company} ({j.applicantCount ?? 0} applicants)
                                    </option>
                                ))}
                            </select>
                            {availableJobs.length === 0 && (
                                <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    No active jobs available for delegation. Create a job first.
                                </p>
                            )}
                        </div>

                        {/* Selected Job Summary */}
                        {selectedJob && (
                            <div className="p-3.5 bg-neutral-900/80 rounded-xl border border-neutral-800 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{selectedJob.title}</p>
                                        <p className="text-xs text-neutral-400 mt-0.5">{selectedJob.company} · {selectedJob.location}</p>
                                    </div>
                                    <Badge variant="neutral" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        {selectedJob.type}
                                    </Badge>
                                </div>
                                {selectedJob.skills?.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {selectedJob.skills.slice(0, 5).map((sk: string, i: number) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded-full">
                                                {sk}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Info Callout */}
                        <div className="flex gap-3 p-3.5 bg-[#7B2CBF]/5 rounded-xl border border-[#7B2CBF]/15">
                            <Shield size={18} className="text-[#9D4EDD] flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-neutral-300 leading-relaxed">
                                By delegating this job, this freelancer will manage the candidate pipeline, 
                                conduct interviews, and propose a final hire for your approval. You retain 
                                full control and can revoke delegation at any time.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-1 border-t border-neutral-800">
                            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                            <Button
                                onClick={handleDelegate}
                                disabled={delegationLoading || !selectedJobId}
                                className="bg-gradient-to-r from-[#7B2CBF] to-[#480CA8] hover:from-[#9D4EDD] hover:to-[#7B2CBF] disabled:opacity-50"
                            >
                                {delegationLoading ? (
                                    'Sending...'
                                ) : (
                                    <>
                                        <Send size={14} className="mr-1.5" />
                                        Send Delegation Request
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Public Profile View Modal */}
            <FreelancerPublicProfileModal 
                freelancerId={viewProfileId} 
                onClose={() => setViewProfileId(null)} 
            />
        </div>
    );
};

