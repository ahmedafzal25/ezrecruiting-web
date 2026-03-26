import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../components/UI';
import { Star, MessageSquare } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useToast } from '../components/Toast';

export const SubmitFeedback: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast, ToastContainer } = useToast();

    const [interview, setInterview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [technicalScore, setTechnicalScore] = useState<number | ''>('');
    const [communicationScore, setCommunicationScore] = useState<number | ''>('');
    const [detailedFeedback, setDetailedFeedback] = useState('');

    useEffect(() => {
        const fetchInterview = async () => {
            try {
                const data = await apiRequest(`/interviews/${id}`);
                setInterview(data);
            } catch (err: any) {
                addToast('error', err.message || 'Failed to fetch interview details.');
            } finally {
                setLoading(false);
            }
        };
        fetchInterview();
    }, [id, addToast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (technicalScore === '' || communicationScore === '' || !detailedFeedback.trim()) {
            addToast('error', 'Please fill out all fields before submitting.');
            return;
        }

        if (Number(technicalScore) < 0 || Number(technicalScore) > 100 || 
            Number(communicationScore) < 0 || Number(communicationScore) > 100) {
            addToast('error', 'Scores must be between 0 and 100.');
            return;
        }

        try {
            setSubmitting(true);
            await apiRequest(`/interviews/${id}/feedback`, 'POST', {
                technicalScore: Number(technicalScore),
                communicationScore: Number(communicationScore),
                detailedFeedback
            });
            
            addToast('success', 'Feedback submitted successfully!');
            setTimeout(() => {
                navigate('/interviewer/dashboard');
            }, 1000);
        } catch (err: any) {
            addToast('error', err.message || 'Failed to submit feedback.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-3 border-[#7B2CBF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className="text-center p-20 text-neutral-400">
                Interview not found or you don't have access.
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8">
            <ToastContainer />
            <h1 className="text-3xl font-bold text-white mb-2">Submit Candidate Feedback</h1>
            <p className="text-neutral-400 mb-8">
                Evaluating candidate: <span className="text-white font-semibold">{interview.candidateId?.name}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="p-8 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <Star className="text-[#9D4EDD]" size={20} /> Scores (0-100)
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Technical Score</label>
                                <input 
                                    type="number" 
                                    min="0" max="100" 
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-[#7B2CBF] transition-all outline-none"
                                    value={technicalScore}
                                    onChange={e => setTechnicalScore(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="e.g. 85"
                                />
                                <p className="text-xs text-neutral-500 mt-1">Rate the candidate's coding and technical problem solving.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Communication Score</label>
                                <input 
                                    type="number" 
                                    min="0" max="100" 
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-[#7B2CBF] transition-all outline-none"
                                    value={communicationScore}
                                    onChange={e => setCommunicationScore(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="e.g. 90"
                                />
                                <p className="text-xs text-neutral-500 mt-1">Rate the candidate's ability to explain their thought process.</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-800">
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <MessageSquare className="text-[#9D4EDD]" size={20} /> Detailed Evaluation
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">Feedback & Notes for the Recruiter</label>
                            <textarea 
                                rows={6}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-[#7B2CBF] transition-all outline-none"
                                value={detailedFeedback}
                                onChange={e => setDetailedFeedback(e.target.value)}
                                placeholder="Provide detailed feedback on their strengths, weaknesses, and your overall recommendation..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button 
                            type="submit" 
                            className="px-8 text-lg font-semibold shadow-lg shadow-purple-900/40"
                            disabled={submitting}
                        >
                            {submitting ? 'Submitting...' : 'Submit Evaluation'}
                        </Button>
                    </div>
                </Card>
            </form>
        </div>
    );
};

export default SubmitFeedback;
