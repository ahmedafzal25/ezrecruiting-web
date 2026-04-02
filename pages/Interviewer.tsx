
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Badge, Modal } from '../components/UI';
import { Video, Calendar, DollarSign, Clock, User, Briefcase, Star, Upload, MessageSquare, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { User as UserType, Interview, Message } from '../types';
import InterviewsTab from '../components/InterviewsTab';
import { FreelancerProfile } from '../components/FreelancerProfile';

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

    useEffect(() => {
        apiRequest('/users/profile').then(setUser).catch(console.error);
        apiRequest('/interviews/my-interviews')
            .then(data => {
                console.log('Interviewer my-interviews fetched:', data);
                setInterviews(data);
            })
            .catch(console.error);
        apiRequest('/interviews/my-messages').then(setMessages).catch(console.error);
    }, []);

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

                <Card title="Booking Requests">
                    {interviews.filter(i => i.status === 'Pending').length === 0 ? <p className="text-neutral-500">No pending booking requests.</p> : (
                        <div className="space-y-3">
                            {interviews.filter(i => i.status === 'Pending').map(inv => (
                                <div key={inv._id} className="p-4 border border-neutral-800 rounded-lg bg-neutral-900/50">
                                    <div className="mb-3">
                                        <p className="font-semibold text-white flex gap-2 items-center">
                                            <Calendar size={16} className="text-[#7B2CBF]" />
                                            {inv.scheduledTime ? new Date(inv.scheduledTime).toLocaleString() : 'Unknown Time'}
                                        </p>
                                        <p className="text-sm text-neutral-400 mt-1">
                                            Requested by: <span className="font-medium text-white">{(inv.recruiterId as any)?.name}</span>
                                        </p>
                                        <p className="text-sm text-neutral-400">
                                            For Candidate: <span className="font-medium text-white">{(inv.candidateId as any)?.name}</span>
                                        </p>
                                        {inv.notes && (
                                            <div className="mt-2 p-2 bg-neutral-800 rounded text-xs text-neutral-300">
                                                <span className="text-neutral-500 font-semibold">Notes:</span> {inv.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await apiRequest(`/freelancers/requests/${inv._id}/accept`, 'PUT');
                                                    alert("Interview accepted!");
                                                    // Refresh list
                                                    apiRequest('/interviews/my-interviews').then(setInterviews);
                                                } catch (e) { alert("Failed to accept"); }
                                            }}
                                        >
                                            Accept
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-red-900/50 text-red-500 hover:bg-red-900/20"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    await apiRequest(`/freelancers/requests/${inv._id}/reject`, 'PUT');
                                                    alert("Interview rejected");
                                                    // Refresh list
                                                    apiRequest('/interviews/my-interviews').then(setInterviews);
                                                } catch (e) { alert("Failed to reject"); }
                                            }}
                                        >
                                            Decline
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

