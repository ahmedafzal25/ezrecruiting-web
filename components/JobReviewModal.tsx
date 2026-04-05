import React from 'react';
import { Modal, Badge } from './UI';
import { Building2, MapPin, Briefcase, DollarSign } from 'lucide-react';

interface JobReviewModalProps {
    job: any;
    onClose: () => void;
}

const JobReviewModal: React.FC<JobReviewModalProps> = ({ job, onClose }) => {
    if (!job) return null;

    return (
        <Modal isOpen={!!job} onClose={onClose} title="Job Details">
            <div className="space-y-6">
                {/* Header Section */}
                <div className="border-b border-neutral-800 pb-4">
                    <h2 className="text-2xl font-bold text-white mb-2">{job.title}</h2>
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                        <span className="flex items-center gap-1.5">
                            <Building2 size={16} className="text-neutral-500" />
                            {job.company}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <MapPin size={16} className="text-neutral-500" />
                            {job.location}
                        </span>
                    </div>
                </div>

                {/* Badges Section */}
                <div className="flex flex-wrap gap-3">
                    <Badge variant="info">
                        <span className="flex items-center gap-1">
                            <Briefcase size={12} /> {job.type}
                        </span>
                    </Badge>
                    {job.salary && (
                        <Badge variant="success">
                            <span className="flex items-center gap-1">
                                <DollarSign size={12} /> {job.salary}
                            </span>
                        </Badge>
                    )}
                </div>

                {/* Description & Requirements */}
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-2">Description</h3>
                        <p className="text-sm text-neutral-400 whitespace-pre-wrap leading-relaxed">
                            {job.description || 'No description provided.'}
                        </p>
                    </div>
                    {job.requirements && (
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-2 mt-4">Requirements</h3>
                            <p className="text-sm text-neutral-400 whitespace-pre-wrap leading-relaxed">
                                {job.requirements}
                            </p>
                        </div>
                    )}
                </div>

                {/* Skills */}
                {job.skills && job.skills.length > 0 && (
                    <div className="pt-4 border-t border-neutral-800">
                        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-3">Required Skills</h3>
                        <div className="flex flex-wrap gap-2">
                            {job.skills.map((skill: string, index: number) => (
                                <span 
                                    key={index} 
                                    className="text-xs px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full border border-neutral-700"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default JobReviewModal;
