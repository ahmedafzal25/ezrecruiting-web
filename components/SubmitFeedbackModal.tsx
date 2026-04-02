import React, { useState } from 'react';
import { Modal, Button, Badge } from './UI';
import { Star, MessageSquare, ThumbsUp, Send } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useToast } from './Toast';

interface SubmitFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    interviewId: string;
    candidateName: string;
    onSuccess: () => void;
}

export const SubmitFeedbackModal: React.FC<SubmitFeedbackModalProps> = ({ isOpen, onClose, interviewId, candidateName, onSuccess }) => {
    const [technicalScore, setTechnicalScore] = useState(50);
    const [communicationScore, setCommunicationScore] = useState(50);
    const [recommendation, setRecommendation] = useState('Hire');
    const [detailedFeedback, setDetailedFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const { addToast, ToastContainer } = useToast();

    // Reset state when opened for a new interview (optional, logic can go in useEffect if desired)
    React.useEffect(() => {
        if (isOpen) {
            setTechnicalScore(50);
            setCommunicationScore(50);
            setRecommendation('Hire');
            setDetailedFeedback('');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!detailedFeedback.trim()) {
            addToast('error', 'Please provide detailed feedback for the recruiter.');
            return;
        }

        try {
            setSubmitting(true);
            await apiRequest(`/interviews/${interviewId}/feedback`, 'POST', {
                technicalScore,
                communicationScore,
                detailedFeedback,
                recommendation
            });
            
            addToast('success', 'Evaluation submitted successfully!');
            onSuccess();
            onClose();
        } catch (error: any) {
            addToast('error', error.message || 'Failed to submit feedback.');
        } finally {
            setSubmitting(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-blue-500';
        if (score >= 40) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Interview Evaluation: ${candidateName}`}
        >
            <div className="space-y-6">
                <ToastContainer />
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        Please provide your honest, professional evaluation. This structured feedback will help the hiring team make an informed decision on <strong>{candidateName}</strong>. 
                        Once submitted, this interview will be marked as Completed.
                    </p>
                </div>

                {/* Score Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Star className="w-4 h-4 text-purple-500" /> Technical Score
                            </label>
                            <span className={`font-bold text-lg ${getScoreColor(technicalScore)}`}>{technicalScore}/100</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={technicalScore} 
                            onChange={(e) => setTechnicalScore(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:bg-gray-700"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Struggled</span>
                            <span>Average</span>
                            <span>Exceptional</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <MessageSquare className="w-4 h-4 text-blue-500" /> Communication
                            </label>
                            <span className={`font-bold text-lg ${getScoreColor(communicationScore)}`}>{communicationScore}/100</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={communicationScore} 
                            onChange={(e) => setCommunicationScore(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Poor</span>
                            <span>Clear</span>
                            <span>Articulate</span>
                        </div>
                    </div>
                </div>

                {/* Recommendation Dropdown */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                        <ThumbsUp className="w-4 h-4 text-green-500" /> Final Recommendation
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {['Strong Hire', 'Hire', 'No Hire'].map((rec) => (
                            <label 
                                key={rec}
                                className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${
                                    recommendation === rec 
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-sm' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="recommendation" 
                                    value={rec} 
                                    checked={recommendation === rec} 
                                    onChange={(e) => setRecommendation(e.target.value)}
                                    className="hidden"
                                />
                                <span className={`font-medium ${
                                    recommendation === rec 
                                        ? 'text-purple-700 dark:text-purple-400' 
                                        : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                    {rec}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Detailed Feedback Textarea */}
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Detailed Feedback & Notes
                    </label>
                    <textarea 
                        className="w-full rounded-lg py-3 px-4 transition-shadow outline-none border bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[140px] resize-y"
                        placeholder="Provide detailed context on the scores above. What were their technical strengths? Where did they struggle? (e.g., 'Candidate struggled with graph algorithms but provided excellent system design insights...')"
                        value={detailedFeedback}
                        onChange={(e) => setDetailedFeedback(e.target.value)}
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        className="mr-2"
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={submitting}
                        className="bg-[#7B2CBF] hover:bg-[#5A189A] border-none shadow-md text-white font-semibold"
                        icon={Send}
                    >
                        {submitting ? 'Submitting...' : 'Submit Evaluation'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SubmitFeedbackModal;
