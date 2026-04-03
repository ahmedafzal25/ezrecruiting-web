
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Badge, Modal } from '../components/UI';
import { Video, Calendar, DollarSign, Clock, User, Briefcase, Star, Upload, MessageSquare, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, CheckCircle2, XCircle, ArrowRight, MapPin, Shield, Building2, Search } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { User as UserType, Interview, Message } from '../types';
import InterviewsTab from '../components/InterviewsTab';
import { FreelancerProfile } from '../components/FreelancerProfile';
import { ApplicantReviewModal } from '../components/ApplicantReviewModal';

const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const InterviewerDashboard: React.FC = () => {
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [user, setUser] = useState<UserType | null>(null);
    const [delegatedJobs, setDelegatedJobs] = useState<any[]>([]);

    useEffect(() => {
        apiRequest('/users/profile').then(setUser).catch(console.error);
        apiRequest('/interviews/my-interviews')
            .then(data => {
                console.log('Interviewer my-interviews fetched:', data);
                setInterviews(data);
            })
            .catch(console.error);
        apiRequest('/interviews/my-messages').then(setMessages).catch(console.error);
        apiRequest('/freelancers/delegations')
            .then(data => setDelegatedJobs(data))
            .catch(console.error);
    }, []);

    const pendingDelegations = delegatedJobs.filter(job => job.delegationStatus === 'pending');

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Interviewer Dashboard</h2>
                    <p className="text-neutral-400">Welcome back, {user?.firstName}. Manage your sessions.</p>
                </div>
                <div className="flex gap-3">
                    <Badge variant="success">Available</Badge>
                    <span className="text-sm text-neutral-400 self-center">Rate: {user?.hourlyRate || '$0'}/hr</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-purple-900/10 border-l-4 border-l-[#7B2CBF]">
                    <h3 className="text-3xl font-bold mb-1">{interviews.length}</h3>
                    <p className="text-neutral-400">Total Sessions</p>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-green-900/10 border-l-4 border-l-green-500">
                    <h3 className="text-3xl font-bold mb-1">${(interviews.filter(i => i.status === 'Completed').length * parseFloat(user?.hourlyRate?.toString() || '0')).toFixed(0)}</h3>
                    <p className="text-neutral-400">Total Earnings</p>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-blue-900/10 border-l-4 border-l-blue-500">
                    <h3 className="text-3xl font-bold mb-1">5.0</h3>
                    <p className="text-neutral-400">Average Rating</p>
                </Card>
            </div>

            <div className="grid xl:grid-cols-2 gap-8">
                <Card title="Upcoming Schedule" className="flex flex-col h-full">
                    {interviews.filter(i => i.status === 'Scheduled').length === 0 ? <p className="text-neutral-500">No interviews scheduled.</p> : (() => {
                        const scheduled = interviews.filter(i => i.status === 'Scheduled');
                        const visible   = scheduled.slice(0, 3);
                        const overflow  = scheduled.length - visible.length;
                        return (
                            <div className="space-y-3">
                                {visible.map(inv => {
                                const candidate = (inv.candidateId as any);
                                const recruiter = (inv.recruiterId as any);
                                const job = (inv.jobId as any);
                                const candidateName =
                                    candidate?.name ||
                                    (candidate?.firstName || candidate?.lastName
                                        ? `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim()
                                        : null) ||
                                    'Unknown Candidate';
                                const jobTitle = job?.title || 'Unspecified Role';
                                const company = job?.company || recruiter?.companyName || recruiter?.name || 'Unknown Company';

                                return (
                                    <div key={inv._id} className="p-4 bg-neutral-800 rounded-lg flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Candidate */}
                                            <p className="font-bold text-white flex items-center gap-2 truncate">
                                                <User size={14} className="text-[#7B2CBF] flex-shrink-0" />
                                                {candidateName}
                                            </p>
                                            {/* Job title */}
                                            <p className="text-sm text-neutral-300 flex items-center gap-2 mt-1 truncate">
                                                <Briefcase size={13} className="text-neutral-500 flex-shrink-0" />
                                                {jobTitle}
                                            </p>
                                            {/* Company / Recruiter */}
                                            <p className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5 truncate">
                                                <Star size={11} className="text-neutral-600 flex-shrink-0" />
                                                via {company}
                                            </p>
                                            {/* Date/time */}
                                            <p className="text-xs text-neutral-400 flex items-center gap-2 mt-2">
                                                <Clock size={11} className="text-[#7B2CBF] flex-shrink-0" />
                                                {inv.scheduledTime ? new Date(inv.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : `${(inv as any).date} at ${(inv as any).time}`}
                                            </p>
                                        </div>
                                        <a
                                            href={`#/interview/room/${inv.meetingId}`}
                                            className="text-xs bg-[#7B2CBF] px-3 py-1.5 rounded text-white hover:bg-[#9D4EDD] transition-colors whitespace-nowrap flex-shrink-0 self-center"
                                        >
                                            Join Room
                                        </a>
                                    </div>
                                );
                            })}

                                {/* Overflow badge */}
                                {overflow > 0 && (
                                    <p className="text-xs text-neutral-500 text-center py-1">
                                        +{overflow} more interview{overflow > 1 ? 's' : ''} not shown
                                    </p>
                                )}

                                {/* View full schedule link */}
                                <Link
                                    to="/interviewer/schedule"
                                    className="block w-full text-center text-sm font-medium text-[#9D4EDD] hover:text-[#c084fc] mt-1 pt-3 border-t border-neutral-700 transition-colors"
                                >
                                    View Full Schedule &rarr;
                                </Link>
                            </div>
                        );
                    })()}
                </Card>

                <Card title="Pending Project Requests" className="border-amber-500/20 bg-amber-500/5">
                    {pendingDelegations.length === 0 ? <p className="text-neutral-500">No pending projects.</p> : (
                        <div className="space-y-3">
                            {pendingDelegations.map(job => (
                                <div key={job._id} className="p-4 border border-amber-500/30 rounded-lg bg-neutral-900/50">
                                    <div className="mb-3">
                                        <p className="font-semibold text-white flex gap-2 items-center">
                                            <Briefcase size={16} className="text-amber-400" />
                                            {job.title}
                                        </p>
                                        <p className="text-sm text-neutral-400 mt-1">
                                            Company: <span className="font-medium text-white">{job.company || job.postedBy?.companyName}</span>
                                        </p>
                                        <p className="text-sm text-neutral-400 mt-1">
                                            Delegated by: <span className="font-medium text-white">{job.postedBy?.name}</span>
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await apiRequest(`/freelancers/delegations/${job._id}/accept`, 'PUT');
                                                    alert("✅ Delegation accepted! You can now manage this pipeline in Delegated Projects.");
                                                    setDelegatedJobs(prev => prev.filter(j => j._id !== job._id)); // Optimistic UI
                                                } catch (e: any) { alert(e.message || "Failed to accept"); }
                                            }}
                                        >
                                            Accept Project
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-red-900/50 text-red-500 hover:bg-red-900/20"
                                            size="sm"
                                            onClick={async () => {
                                                if (!confirm('Are you sure you want to decline this delegation?')) return;
                                                try {
                                                    await apiRequest(`/freelancers/delegations/${job._id}/reject`, 'PUT');
                                                    alert("Delegation declined.");
                                                    setDelegatedJobs(prev => prev.filter(j => j._id !== job._id)); // Optimistic UI
                                                } catch (e: any) { alert(e.message || "Failed to reject"); }
                                            }}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card title="Pending Feedback" className="xl:col-span-2">
                    {interviews.filter(i => (i.status === 'Completed' || i.status === 'Scheduled') && !i.feedback && new Date(i.scheduledTime || Date.now()).getTime() < Date.now()).length === 0 ? (
                        <p className="text-neutral-500 text-center py-6">No pending feedback right now.</p>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {interviews
                                .filter(i => (i.status === 'Completed' || i.status === 'Scheduled') && !i.feedback && new Date(i.scheduledTime || Date.now()).getTime() < Date.now())
                                .map(inv => (
                                <div key={inv._id} className="p-4 border border-neutral-800 rounded-lg flex flex-col justify-between h-full bg-neutral-900/40">
                                    <div>
                                        <p className="font-bold text-white mb-2">{inv.candidateId?.name || 'Candidate'}</p>
                                        <p className="text-xs text-neutral-400 mb-3">
                                            {inv.scheduledTime ? new Date(inv.scheduledTime).toLocaleString() : 'Past Interview'}
                                        </p>
                                    </div>
                                    <a href={`#/interviewer/feedback/${inv._id}`} className="text-sm font-semibold text-center bg-[#7B2CBF] px-4 py-2 rounded text-white hover:bg-[#9D4EDD] transition-colors">
                                        Submit Evaluation
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export const InterviewerProfile: React.FC = () => {
    const [user, setUser] = useState<UserType | null>(null);
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', headline: '', bio: '', skills: '', hourlyRate: '', yearsOfExperience: '', availability: ''
    });
    const [profilePicture, setProfilePicture] = useState<string | null>(null);

    useEffect(() => {
        apiRequest('/users/profile').then((data) => {
            setUser(data);
            setProfilePicture(data.profilePicture);
            setFormData({
                firstName: data.firstName || data.name.split(' ')[0] || '',
                lastName: data.lastName || data.name.split(' ').slice(1).join(' ') || '',
                headline: data.profile?.headline || '',
                bio: data.profile?.bio || '',
                skills: data.profile?.skills ? data.profile.skills.join(', ') : '',
                hourlyRate: data.profile?.hourlyRate || '',
                yearsOfExperience: data.profile?.yearsOfExperience || '',
                availability: data.profile?.availability ? data.profile.availability.join(', ') : ''
            });
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        try {
            const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
            const availabilityArray = formData.availability.split(',').map(s => s.trim()).filter(s => s.length > 0);
            await apiRequest('/users/profile', 'PUT', {
                ...formData,
                skills: skillsArray,
                availability: availabilityArray,
                hourlyRate: parseFloat(formData.hourlyRate) || 0
            });
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
                alert('Photo updated');
            } catch (err: any) {
                alert(`Error uploading image: ${err.message || 'Unknown error'}`);
            }
        }
    };

    if (!user) return <div>Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold">Interviewer Profile</h2>
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
                    <p className="text-neutral-400 text-sm mb-4">Freelance Interviewer</p>
                    <Badge variant="info">{formData.hourlyRate || '0'}/hr</Badge>
                </Card>

                <Card className="md:col-span-2 p-8 space-y-6">
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
                            <Briefcase size={20} className="text-[#7B2CBF]" /> Expertise
                        </h3>
                        <div className="space-y-4">
                            <Input label="Professional Headline" placeholder="e.g. Senior System Design Interviewer" value={formData.headline} onChange={e => setFormData({ ...formData, headline: e.target.value })} />
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Bio / Expertise</label>
                                <textarea className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white h-24 focus:border-[#7B2CBF] outline-none"
                                    placeholder="Describe your technical expertise..."
                                    value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                />
                            </div>
                            <Input label="Skills (Comma separated)" value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <DollarSign size={20} className="text-[#7B2CBF]" /> Rates & Availability
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <Input label="Hourly Rate ($)" placeholder="50" value={formData.hourlyRate} onChange={e => setFormData({ ...formData, hourlyRate: e.target.value.replace(/[^0-9]/g, '') })} />
                            <Input label="Years of Exp" placeholder="5" value={formData.yearsOfExperience} onChange={e => setFormData({ ...formData, yearsOfExperience: e.target.value })} />
                            <Input label="Availability (Comma separated)" placeholder="Weekends, Evenings" value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button onClick={handleSave}>Save Changes</Button>
                    </div>
                </Card>
            </div>

            {/* Trust & Verification Portfolio Builder */}
            <div className="mt-8">
                <FreelancerProfile />
            </div>
        </div>
    );
};

export const InterviewerInterviews: React.FC = () => {
    return <InterviewsTab role="INTERVIEWER" />;
};

export const InterviewerRequests: React.FC = () => {
    const [interviews, setInterviews] = useState<Interview[]>([]);

    useEffect(() => {
        const fetchRequests = () => {
            apiRequest('/interviews/my-interviews')
                .then(data => setInterviews(data))
                .catch(console.error);
        };
        fetchRequests();
    }, []);

    const pendingRequests = interviews.filter(i => i.status === 'Pending');

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Booking Requests</h2>
            <p className="text-neutral-400">Review and respond to incoming interview requests from recruiters.</p>

            {pendingRequests.length === 0 ? (
                <Card className="text-center py-12">
                    <Calendar size={48} className="text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500 text-lg">No pending booking requests at this time.</p>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingRequests.map(inv => (
                        <Card key={inv._id} className="flex flex-col h-full border hover:border-[#7B2CBF]/30 transition-all">
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <Badge variant="warning">Pending Request</Badge>
                                    <span className="text-xs text-neutral-500">{new Date(inv.createdAt || Date.now()).toLocaleDateString()}</span>
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg text-white mb-1">
                                        For: {(inv.candidateId as any)?.name || 'Unknown Candidate'}
                                    </h3>
                                    <p className="text-sm text-neutral-400 flex items-center gap-2">
                                        <Briefcase size={14} className="text-[#7B2CBF]" />
                                        Requested by: {(inv.recruiterId as any)?.name || 'Unknown Recruiter'}
                                    </p>
                                </div>

                                <div className="p-3 bg-neutral-900 rounded-lg space-y-2">
                                    <p className="text-sm text-white flex items-center gap-2 font-medium">
                                        <Calendar size={14} className="text-[#7B2CBF]" />
                                        {inv.scheduledTime ? new Date(inv.scheduledTime).toLocaleDateString() : 'TBD Date'}
                                    </p>
                                    <p className="text-sm text-white flex items-center gap-2 font-medium">
                                        <Clock size={14} className="text-[#7B2CBF]" />
                                        {inv.scheduledTime ? new Date(inv.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD Time'}
                                    </p>
                                </div>

                                {inv.notes && (
                                    <div className="text-sm text-neutral-300 bg-neutral-800/50 p-3 rounded-lg border border-neutral-700">
                                        <span className="text-[#7B2CBF] font-semibold block mb-1">Notes from Recruiter:</span>
                                        {inv.notes}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-800">
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={async () => {
                                        try {
                                            await apiRequest(`/interviews/${inv._id}/status`, 'PATCH', { status: 'Accepted' });
                                            alert("Interview accepted!");
                                            apiRequest('/interviews/my-interviews').then(setInterviews);
                                        } catch (e) { alert("Failed to accept"); }
                                    }}
                                >
                                    Accept
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400"
                                    onClick={async () => {
                                        try {
                                            await apiRequest(`/interviews/${inv._id}/status`, 'PATCH', { status: 'Rejected' });
                                            alert("Interview rejected");
                                            apiRequest('/interviews/my-interviews').then(setInterviews);
                                        } catch (e) { alert("Failed to reject"); }
                                    }}
                                >
                                    Decline
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FREELANCER SERVICE MANAGER
// Allows a freelancer to create, edit, toggle, and delete their service listings
// ─────────────────────────────────────────────────────────────────────────────
interface MyService {
    _id: string;
    title: string;
    description: string;
    skills: string[];
    price: number;
    durationMinutes: number;
    isActive: boolean;
}

const EMPTY_FORM = { title: '', description: '', skills: '', price: '', durationMinutes: '60' };

export const FreelancerServiceManager: React.FC = () => {
    const [services, setServices] = useState<MyService[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<MyService | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const data = await apiRequest('/freelancers/services');
            setServices(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchServices(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormOpen(true);
    };

    const openEdit = (svc: MyService) => {
        setEditing(svc);
        setForm({
            title: svc.title,
            description: svc.description,
            skills: svc.skills.join(', '),
            price: svc.price.toString(),
            durationMinutes: svc.durationMinutes.toString(),
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.description || !form.price) {
            alert('Title, description, and price are required.'); return;
        }
        setSaving(true);
        try {
            const payload = {
                title: form.title,
                description: form.description,
                skills: form.skills,
                price: Number(form.price),
                durationMinutes: Number(form.durationMinutes) || 60,
            };
            if (editing) {
                await apiRequest(`/freelancers/services/${editing._id}`, 'PUT', payload);
            } else {
                await apiRequest('/freelancers/services', 'POST', payload);
            }
            setFormOpen(false);
            fetchServices();
        } catch (err: any) {
            alert(err.message || 'Failed to save service');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (svc: MyService) => {
        try {
            await apiRequest(`/freelancers/services/${svc._id}`, 'PUT', { isActive: !svc.isActive });
            fetchServices();
        } catch (err: any) { alert('Failed to update'); }
    };

    const handleDelete = async (svc: MyService) => {
        if (!confirm(`Delete "${svc.title}"? This cannot be undone.`)) return;
        try {
            await apiRequest(`/freelancers/services/${svc._id}`, 'DELETE');
            fetchServices();
        } catch (err: any) { alert('Failed to delete'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">My Services</h2>
                    <p className="text-neutral-400 text-sm mt-1">Publish interview services for recruiters to book.</p>
                </div>
                <Button icon={Plus} onClick={openCreate}>Create Service</Button>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <div key={i} className="h-36 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />)}
                </div>
            ) : services.length === 0 ? (
                <div className="text-center py-20 border border-neutral-800 rounded-xl">
                    <Briefcase size={48} className="text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500 text-lg font-medium">No services yet</p>
                    <p className="text-neutral-600 text-sm mt-1 mb-6">Create your first service so recruiters can find and book you.</p>
                    <Button icon={Plus} onClick={openCreate}>Create Your First Service</Button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {services.map(svc => (
                        <div key={svc._id} className={`p-5 rounded-xl border transition-all ${
                            svc.isActive
                                ? 'bg-neutral-900 border-neutral-800 hover:border-[#7B2CBF]/40'
                                : 'bg-neutral-950 border-neutral-800/50 opacity-60'
                        }`}>
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-white truncate">{svc.title}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                            svc.isActive ? 'bg-green-500/15 text-green-400' : 'bg-neutral-700 text-neutral-400'
                                        }`}>
                                            {svc.isActive ? 'Live' : 'Paused'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-neutral-400 line-clamp-1">{svc.description}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {svc.skills.slice(0, 4).map((s, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-full border border-neutral-700">{s}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xl font-black text-white">${svc.price}</p>
                                    <p className="text-xs text-neutral-500">{svc.durationMinutes} min</p>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-800">
                                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(svc)}>
                                    <Edit2 size={12} /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => handleToggle(svc)}>
                                    {svc.isActive ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} />}
                                    {svc.isActive ? 'Pause' : 'Activate'}
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-400 border-red-900/40 hover:bg-red-900/20" onClick={() => handleDelete(svc)}>
                                    <Trash2 size={13} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit modal */}
            <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Service' : 'Create New Service'}>
                <div className="space-y-4">
                    <Input label="Service Title *" placeholder='e.g. "Expert React & System Design Interview"'
                        value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Description *</label>
                        <textarea
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white text-sm h-24 outline-none focus:border-[#7B2CBF] resize-none"
                            placeholder="Describe what you'll evaluate and your approach..."
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <Input label="Skills (comma separated)" placeholder="React, TypeScript, System Design"
                        value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Price ($) *" type="number" placeholder="150"
                            value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                        <div>
                            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Duration</label>
                            <select className="w-full bg-black/50 border border-neutral-800 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#7B2CBF]"
                                value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })}>
                                <option value="30">30 minutes</option>
                                <option value="45">45 minutes</option>
                                <option value="60">60 minutes</option>
                                <option value="90">90 minutes</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-neutral-800">
                        <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Publish Service'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELEGATED PROJECTS — Freelancer views & manages delegated job pipelines
// ─────────────────────────────────────────────────────────────────────────────

interface DelegatedJob {
    _id: string;
    title: string;
    description: string;
    company: string;
    location: string;
    type: string;
    skills: string[];
    salary?: string;
    delegationStatus: 'pending' | 'accepted' | 'completed';
    applicants: string[];
    postedBy: {
        _id: string;
        name: string;
        companyName?: string;
        profilePicture?: string;
        email?: string;
    };
    createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
    pending:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   label: 'Pending Approval' },
    accepted:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Active Project' },
    completed: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    label: 'Completed' },
};

export const DelegatedProjects: React.FC = () => {
    const [jobs, setJobs] = useState<DelegatedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchDelegations = async () => {
        setLoading(true);
        try {
            const data = await apiRequest('/freelancers/delegations');
            setJobs(data);
        } catch (err) {
            console.error('fetchDelegations error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDelegations(); }, []);

    const handleAccept = async (jobId: string) => {
        setActionLoading(jobId);
        try {
            await apiRequest(`/freelancers/delegations/${jobId}/accept`, 'PUT');
            alert('✅ Delegation accepted! You can now manage this pipeline.');
            fetchDelegations();
        } catch (err: any) {
            alert(err.message || 'Failed to accept delegation');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (jobId: string) => {
        if (!confirm('Are you sure you want to decline this delegation?')) return;
        setActionLoading(jobId);
        try {
            await apiRequest(`/freelancers/delegations/${jobId}/reject`, 'PUT');
            alert('Delegation declined.');
            fetchDelegations();
        } catch (err: any) {
            alert(err.message || 'Failed to reject delegation');
        } finally {
            setActionLoading(null);
        }
    };

    const pendingCount = jobs.filter(j => j.delegationStatus === 'pending').length;
    const activeCount = jobs.filter(j => j.delegationStatus === 'accepted').length;
    const completedCount = jobs.filter(j => j.delegationStatus === 'completed').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">Delegated Projects</h2>
                <p className="text-neutral-400 text-sm mt-1">
                    Job pipelines assigned to you by recruiters. Accept to start managing the hiring process.
                </p>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
                    <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
                    <p className="text-xs text-neutral-400 mt-1">Pending</p>
                </div>
                <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
                    <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                    <p className="text-xs text-neutral-400 mt-1">Active</p>
                </div>
                <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-400">{completedCount}</p>
                    <p className="text-xs text-neutral-400 mt-1">Completed</p>
                </div>
            </div>

            {/* Job Cards */}
            {loading ? (
                <div className="grid md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-56 bg-neutral-900 border border-neutral-800 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : jobs.length === 0 ? (
                <div className="text-center py-20 border border-neutral-800 rounded-xl">
                    <Briefcase size={48} className="text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500 text-lg font-medium">No delegated projects yet</p>
                    <p className="text-neutral-600 text-sm mt-1">
                        When a recruiter delegates a job pipeline to you, it will appear here.
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {jobs.map(job => {
                        const style = STATUS_STYLES[job.delegationStatus] || STATUS_STYLES.pending;
                        const isProcessing = actionLoading === job._id;

                        return (
                            <div
                                key={job._id}
                                className={`flex flex-col bg-neutral-900 border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg ${
                                    job.delegationStatus === 'pending'
                                        ? 'border-amber-500/30 hover:shadow-amber-900/10'
                                        : job.delegationStatus === 'accepted'
                                            ? 'border-emerald-500/20 hover:shadow-emerald-900/10'
                                            : 'border-neutral-800 hover:shadow-purple-900/10'
                                }`}
                            >
                                {/* Status banner */}
                                <div className={`px-5 py-2.5 flex items-center justify-between ${style.bg} border-b ${style.border}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${job.delegationStatus === 'pending' ? 'bg-amber-400 animate-pulse' : job.delegationStatus === 'accepted' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                                        <span className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
                                            {style.label}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-500">
                                        {new Date(job.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Job Details */}
                                <div className="p-5 flex-1 space-y-3">
                                    <h3 className="font-bold text-white text-lg leading-snug">{job.title}</h3>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
                                        <span className="flex items-center gap-1.5">
                                            <Building2 size={13} className="text-neutral-500" />
                                            {job.company}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <MapPin size={13} className="text-neutral-500" />
                                            {job.location}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Briefcase size={13} className="text-neutral-500" />
                                            {job.type}
                                        </span>
                                    </div>

                                    {job.salary && (
                                        <p className="text-sm text-neutral-300 flex items-center gap-1.5">
                                            <DollarSign size={13} className="text-[#7B2CBF]" />
                                            {job.salary}
                                        </p>
                                    )}

                                    {job.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {job.skills.slice(0, 5).map((sk, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full border border-neutral-700">
                                                    {sk}
                                                </span>
                                            ))}
                                            {job.skills.length > 5 && (
                                                <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-500 rounded-full">
                                                    +{job.skills.length - 5}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Recruiter info */}
                                    <div className="flex items-center gap-2.5 pt-2 border-t border-neutral-800">
                                        <img
                                            src={job.postedBy?.profilePicture || '/assets/default-avatar.png'}
                                            alt={job.postedBy?.name}
                                            className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">
                                                {job.postedBy?.name}
                                            </p>
                                            <p className="text-[10px] text-neutral-500 truncate">
                                                {job.postedBy?.companyName || job.postedBy?.email}
                                            </p>
                                        </div>
                                        <span className="ml-auto text-[10px] text-neutral-500 flex items-center gap-1">
                                            <User size={10} />
                                            {job.applicants?.length || 0} applicants
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                {job.delegationStatus === 'pending' && (
                                    <div className="px-5 pb-5 flex gap-3">
                                        <Button
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                            onClick={() => handleAccept(job._id)}
                                            disabled={isProcessing}
                                        >
                                            <CheckCircle2 size={15} />
                                            {isProcessing ? 'Accepting...' : 'Accept Project'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-red-900/50 text-red-400 hover:bg-red-900/20 gap-1.5"
                                            onClick={() => handleReject(job._id)}
                                            disabled={isProcessing}
                                        >
                                            <XCircle size={15} />
                                            Decline
                                        </Button>
                                    </div>
                                )}

                                {job.delegationStatus === 'accepted' && (
                                    <div className="px-5 pb-5">
                                        <div className="flex items-center gap-2.5 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/15 mb-3">
                                            <Shield size={16} className="text-emerald-400 flex-shrink-0" />
                                            <p className="text-xs text-neutral-300 leading-relaxed">
                                                You're actively managing this pipeline. Review applicants, conduct interviews, and propose your top hire.
                                            </p>
                                        </div>
                                        <Link 
                                            to="/interviewer/pipeline" 
                                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Manage Pipeline &rarr;
                                        </Link>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEWER APPLICANTS — Pipeline management for delegated projects
// ─────────────────────────────────────────────────────────────────────────────

export const InterviewerApplicants: React.FC = () => {
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
            alert('Failed to update status. You may not have authorization for this pipeline.');
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

    const handleProposeHire = async () => {
        if (!selectedApp) return;
        if (!confirm('Are you sure? This will lock the pipeline and send this candidate to the recruiter for final approval.')) return;
        
        try {
            await apiRequest(`/freelancers/delegations/${selectedApp.job._id || selectedApp.job}/propose/${selectedApp.candidate._id}`, 'POST');
            alert('🎉 Candidate successfully proposed to Recruiter! Your pipeline mission is complete.');
            window.location.hash = '#/interviewer';
        } catch (error: any) {
            alert(error.message || 'Failed to propose candidate');
        }
    };

    // Helper to get consistent data
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
            <div>
                <h2 className="text-2xl font-bold">Manage Pipeline</h2>
                <p className="text-neutral-400 text-sm mt-1">
                    Review applicants and schedule interviews for the job pipelines you are managing.
                </p>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-neutral-500 w-5 h-5" />
                    <Input placeholder="Search candidates..." className="pl-10" />
                </div>
            </div>

            {loading ? <p>Loading pipeline...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {applications.length === 0 && <p className="text-neutral-500 col-span-3">No applicants found for your delegated projects yet.</p>}
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
                onProposeHire={handleProposeHire}
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
                            className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-3 text-white h-32 focus:border-[#7B2CBF] outline-none"
                            placeholder="Type your message to the candidate..."
                            value={messageData.content}
                            onChange={e => setMessageData({ content: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsMessageOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendMessage}>Send Message</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
