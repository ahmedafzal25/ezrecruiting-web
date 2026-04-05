import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, Code, Award, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface AIEvaluation {
    suitabilityScore: number;
    strengths: string[];
    weaknesses: string[];
    redFlags: string[];
    codingScore: number;
    evaluatedAt: string;
}

interface AIReportCardProps {
    evaluation: AIEvaluation;
    candidateName?: string;
    jobTitle?: string;
    interviewerRemarks?: string;
    codingTestConducted?: boolean;
    codingTestSessionId?: string;
    jobId?: string;
    candidateId?: string;
}

const AIReportCard: React.FC<AIReportCardProps> = ({
    evaluation,
    candidateName = 'Candidate',
    jobTitle,
    interviewerRemarks,
    codingTestConducted = true,
    codingTestSessionId,
    jobId,
    candidateId,
}) => {
    const [animatedScore, setAnimatedScore] = useState(0);

    // Animate score on mount
    useEffect(() => {
        const target = evaluation.suitabilityScore;
        const duration = 1200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedScore(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [evaluation.suitabilityScore]);

    // Score color scheme
    const getScoreTheme = (score: number) => {
        if (score >= 70) return {
            color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)',
            border: 'rgba(16, 185, 129, 0.3)', label: 'Strong Candidate',
            gradient: 'from-emerald-500 to-green-400',
        };
        if (score >= 40) return {
            color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)',
            border: 'rgba(245, 158, 11, 0.3)', label: 'Moderate Candidate',
            gradient: 'from-amber-500 to-yellow-400',
        };
        return {
            color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)',
            border: 'rgba(239, 68, 68, 0.3)', label: 'Needs Improvement',
            gradient: 'from-red-500 to-rose-400',
        };
    };

    const theme = getScoreTheme(evaluation.suitabilityScore);
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

    return (
        <div className="space-y-5 animate-in fade-in" style={{ animationDuration: '0.5s' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B2CBF] to-[#480CA8] flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Award size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">AI Interview Evaluation</h3>
                        <p className="text-xs text-neutral-500">
                            {candidateName}{jobTitle ? ` • ${jobTitle}` : ''}
                        </p>
                    </div>
                </div>
                {evaluation.evaluatedAt && (
                    <span className="text-[10px] text-neutral-600 font-medium">
                        {new Date(evaluation.evaluatedAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </span>
                )}
            </div>

            {/* Score Section */}
            <div className="relative p-6 rounded-2xl border backdrop-blur-sm"
                style={{ background: theme.bg, borderColor: theme.border }}>
                <div className="flex items-center gap-8">
                    {/* Circular Progress */}
                    <div className="relative flex-shrink-0">
                        <svg width="128" height="128" viewBox="0 0 128 128" className="transform -rotate-90">
                            {/* Background circle */}
                            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.05)"
                                strokeWidth="8" />
                            {/* Progress circle */}
                            <circle cx="64" cy="64" r="54" fill="none"
                                stroke={theme.color} strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-white">{animatedScore}</span>
                            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">/ 100</span>
                        </div>
                    </div>

                    {/* Score Details */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                                {theme.label}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 mb-4">
                            Overall suitability score based on coding performance, behavioral assessment,
                            and automated proctoring analysis.
                        </p>

                        {/* Coding Score Badge */}
                        <div className="flex items-center gap-3">
                            {codingTestConducted ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/80 border border-neutral-700 rounded-lg">
                                    <Code size={14} className="text-[#9D4EDD]" />
                                    <span className="text-xs text-neutral-300">Coding Score:</span>
                                    <span className="text-sm font-bold text-white">{evaluation.codingScore}%</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/80 border border-neutral-700 rounded-lg">
                                    <Code size={14} className="text-neutral-500" />
                                    <span className="text-xs text-neutral-500">No coding test conducted</span>
                                </div>
                            )}
                        </div>

                        {/* View Coding Test Results button */}
                        {codingTestConducted && jobId && candidateId && (
                            <a
                                href={`#/recruiter/coding-test-result/${jobId}/candidate/${candidateId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 mt-3 bg-[#7B2CBF]/10 border border-[#7B2CBF]/30 hover:bg-[#7B2CBF]/20 rounded-lg transition-colors text-xs font-semibold text-[#9D4EDD] no-underline w-fit"
                            >
                                <ExternalLink size={13} />
                                View Coding Test Results
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Strengths & Weaknesses — Two Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                            <TrendingUp size={14} className="text-emerald-400" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-400">Strengths</h4>
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 rounded text-emerald-500/70 font-semibold">
                            {(evaluation.strengths || []).length}
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {(evaluation.strengths || []).map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500/60 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-neutral-300 leading-relaxed">{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Weaknesses */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                            <TrendingDown size={14} className="text-amber-400" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-400">Weaknesses</h4>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 rounded text-amber-500/70 font-semibold">
                            {(evaluation.weaknesses || []).length}
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {(evaluation.weaknesses || []).map((w, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <AlertTriangle size={14} className="text-amber-500/60 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-neutral-300 leading-relaxed">{w}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Interviewer Remarks */}
            {interviewerRemarks && interviewerRemarks.trim() && (
                <div className="p-4 rounded-xl bg-[#7B2CBF]/5 border border-[#7B2CBF]/15">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-[#7B2CBF]/15 flex items-center justify-center">
                            <Award size={14} className="text-[#9D4EDD]" />
                        </div>
                        <h4 className="text-sm font-bold text-[#9D4EDD]">Interviewer Remarks</h4>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap pl-8">
                        {interviewerRemarks}
                    </p>
                </div>
            )}

            {/* Red Flags Section — Conditional */}
            {(evaluation.redFlags?.length ?? 0) > 0 && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 relative overflow-hidden">
                    {/* Urgent visual indicator */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />

                    <div className="flex items-center gap-2 mb-3 pl-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                            <ShieldAlert size={16} className="text-red-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-red-400">Proctoring Red Flags</h4>
                            <p className="text-[10px] text-red-400/50">
                                Automated alerts detected during the interview session
                            </p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-0.5 bg-red-500/15 rounded-full text-red-400 font-bold">
                            {evaluation.redFlags!.length} flag{evaluation.redFlags!.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <ul className="space-y-2 pl-2">
                        {evaluation.redFlags!.map((flag, i) => (
                            <li key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                <ShieldAlert size={13} className="text-red-500/70 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-red-200/80 leading-relaxed">{flag}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AIReportCard;
