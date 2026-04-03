import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from './UI';
import { User, DollarSign, BookOpen, Plus, X, Save, Trash2, Briefcase, Link as LinkIcon } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useToast } from './Toast';

export const FreelancerProfile: React.FC = () => {
    // Basic info
    const [bio, setBio] = useState('');
    const [hourlyRate, setHourlyRate] = useState<number | ''>('');
    const [skills, setSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState('');
    
    // Arrays for Trust & Verification
    const [experience, setExperience] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    
    const [saving, setSaving] = useState(false);
    
    const { addToast, ToastContainer } = useToast();

    // Hydrate existing profile data on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await apiRequest('/users/profile');
                if (data) {
                    // freelancer fields are saved directly on the User schema according to our new backend setup
                    setBio(data.bio || '');
                    setHourlyRate(data.hourlyRate || '');
                    setSkills(data.skills || []);
                    
                    if (data.experience && data.experience.length > 0) {
                        const formattedExperience = data.experience.map((exp: any) => ({
                            ...exp,
                            startDate: exp.startDate ? exp.startDate.split('T')[0] : '',
                            endDate: exp.endDate ? exp.endDate.split('T')[0] : ''
                        }));
                        setExperience(formattedExperience);
                    } else {
                        setExperience([{ title: '', company: '', startDate: '', endDate: '', description: '' }]);
                    }
                    
                    setProjects(data.projects?.length ? data.projects : [{ title: '', role: '', link: '', description: '' }]);
                }
            } catch (err) {
                console.error("Failed to load profile", err);
            }
        };
        fetchProfile();
    }, []);

    const handleAddSkill = () => {
        const cleanedSkill = skillInput.trim();
        if (cleanedSkill && !skills.includes(cleanedSkill)) {
            setSkills([...skills, cleanedSkill]);
            setSkillInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSkill();
        }
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const handleSaveProfile = async () => {
        if (!bio || !hourlyRate || skills.length === 0) {
            addToast('error', 'Please fill out all fields and add at least one skill.');
            return;
        }

        // Validate Experience logic
        for (const exp of experience) {
            if (!exp.startDate) {
                addToast('error', 'Start date is required for all experience entries.');
                return;
            }

            const start = new Date(exp.startDate);
            const end = exp.endDate ? new Date(exp.endDate) : null;
            const today = new Date();

            if (start > today) {
                addToast('error', 'Work experience start date cannot be in the future.');
                return;
            }

            if (end && start > end) {
                addToast('error', 'Start date cannot be after the end date.');
                return;
            }
        }

        try {
            setSaving(true);
            await apiRequest('/freelancers/profile', 'PUT', { 
                bio, 
                hourlyRate: Number(hourlyRate), 
                skills,
                experience,
                projects
            });
            addToast('success', 'Profile updated successfully!');
        } catch (error: any) {
            addToast('error', error.message || 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    // --- Dynamic Form Handlers ---
    const handleAddExperience = () => setExperience([...experience, { title: '', company: '', startDate: '', endDate: '', description: '' }]);
    const handleRemoveExperience = (index: number) => setExperience(experience.filter((_, i) => i !== index));
    const handleExperienceChange = (index: number, field: string, value: string) => {
        const update = [...experience];
        update[index][field] = value;
        setExperience(update);
    };

    const handleAddProject = () => setProjects([...projects, { title: '', role: '', link: '', description: '' }]);
    const handleRemoveProject = (index: number) => setProjects(projects.filter((_, i) => i !== index));
    const handleProjectChange = (index: number, field: string, value: string) => {
        const update = [...projects];
        update[index][field] = value;
        setProjects(update);
    };

    return (
        <Card className="max-w-2xl mx-auto border border-neutral-800 dark:bg-neutral-900 shadow-xl">
            <ToastContainer />
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="text-[#9D4EDD]" /> Public Profile Setup
                </h2>
                <p className="text-gray-500 dark:text-neutral-400 mt-1">
                    Complete your profile so companies know your expertise and rates.
                </p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Professional Bio
                    </label>
                    <textarea 
                        className="w-full rounded-lg py-3 px-4 transition-shadow outline-none border bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-[#9D4EDD] focus:border-[#9D4EDD] min-h-[120px] resize-y"
                        placeholder="Tell companies about your experience as a technical interviewer..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                </div>

                <div>
                    <Input 
                        label="Hourly Rate ($/hr)" 
                        type="number"
                        min="0"
                        placeholder="e.g. 50"
                        icon={DollarSign}
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value ? Number(e.target.value) : '')}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Technical Skills
                    </label>
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 size-4" />
                            <input 
                                className="w-full rounded-lg py-2.5 pl-9 pr-4 transition-shadow outline-none border bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-[#9D4EDD] focus:border-[#9D4EDD]"
                                placeholder="Add skills (e.g. React, Node.js, System Design) and press Enter"
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <Button 
                            className="bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white" 
                            onClick={handleAddSkill}
                            icon={Plus}
                        >
                            Add
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
                        {skills.length === 0 && <span className="text-gray-400 dark:text-neutral-500 text-sm italic m-1">No skills added yet</span>}
                        {skills.map((skill, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium shadow-sm">
                                {skill}
                                <button 
                                    onClick={() => handleRemoveSkill(skill)}
                                    className="hover:text-purple-900 dark:hover:text-purple-100 ml-1 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 p-0.5 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                {/* WORK EXPERIENCE */}
                <div className="pt-6 border-t border-gray-200 dark:border-neutral-800">
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Briefcase size={16} /> Work Experience
                        </label>
                        <Button size="sm" variant="outline" onClick={handleAddExperience} icon={Plus}>Add</Button>
                    </div>
                    <div className="space-y-4">
                        {experience.length === 0 && <p className="text-sm text-gray-400">No experience added.</p>}
                        {experience.map((exp, idx) => (
                            <div key={idx} className="p-4 border border-gray-200 dark:border-neutral-800 rounded-lg relative bg-gray-50 dark:bg-neutral-800/20">
                                <button onClick={() => handleRemoveExperience(idx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                <div className="grid grid-cols-2 gap-3 mb-3 pr-6">
                                    <Input label="Job Title" value={exp.title} onChange={e => handleExperienceChange(idx, 'title', e.target.value)} />
                                    <Input label="Company" value={exp.company} onChange={e => handleExperienceChange(idx, 'company', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <Input label="Start Date" type="date" value={exp.startDate} onChange={e => handleExperienceChange(idx, 'startDate', e.target.value)} />
                                    <Input label="End Date (Leave blank if Present)" type="date" value={exp.endDate} onChange={e => handleExperienceChange(idx, 'endDate', e.target.value)} />
                                </div>
                                <Input label="Description" value={exp.description} onChange={e => handleExperienceChange(idx, 'description', e.target.value)} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* PROJECTS */}
                <div className="pt-6 border-t border-gray-200 dark:border-neutral-800">
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <LinkIcon size={16} /> Notable Projects
                        </label>
                        <Button size="sm" variant="outline" onClick={handleAddProject} icon={Plus}>Add</Button>
                    </div>
                    <div className="space-y-4">
                        {projects.length === 0 && <p className="text-sm text-gray-400">No projects added.</p>}
                        {projects.map((proj, idx) => (
                            <div key={idx} className="p-4 border border-gray-200 dark:border-neutral-800 rounded-lg relative bg-gray-50 dark:bg-neutral-800/20">
                                <button onClick={() => handleRemoveProject(idx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                <div className="grid grid-cols-2 gap-3 mb-3 pr-6">
                                    <Input label="Project Title" value={proj.title} onChange={e => handleProjectChange(idx, 'title', e.target.value)} />
                                    <Input label="Your Role" value={proj.role} onChange={e => handleProjectChange(idx, 'role', e.target.value)} />
                                </div>
                                <Input label="Project Link" value={proj.link} onChange={e => handleProjectChange(idx, 'link', e.target.value)} className="mb-3" />
                                <Input label="Short Description" value={proj.description} onChange={e => handleProjectChange(idx, 'description', e.target.value)} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-200 dark:border-neutral-800 flex justify-end">
                    <Button 
                        className="bg-[#7B2CBF] hover:bg-[#5A189A] border-none text-white shadow-lg"
                        size="lg"
                        icon={Save}
                        onClick={handleSaveProfile}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default FreelancerProfile;
