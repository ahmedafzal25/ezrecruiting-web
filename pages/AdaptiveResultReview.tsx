import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Card, Badge, Button } from '../components/UI';
import { ArrowLeft, CheckCircle, XCircle, Code2, Clock, Trophy, AlertCircle, Calendar } from 'lucide-react';
import { apiRequest } from '../utils/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CodingQuestion {
  _id: string;
  title: string;
  difficulty: string;
  category: string;
}

interface ResponseRecord {
  questionId: string;
  submittedCode: string;
  passed: boolean;
  score: number;
}

interface TestSession {
  _id: string;
  candidateId: { _id: string; name: string; email: string };
  jobId: { _id: string; title: string; company: string };
  questionsAsked: CodingQuestion[];
  responses: ResponseRecord[];
  status: string;
  finalScore: number;
  completedAt: string;
  createdAt: string;
}

const DIFFICULTY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  very_easy: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  easy: { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  hard: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
};

const CATEGORY_CONFIG: Record<string, { label: string }> = {
  basics: { label: 'Python Basics' },
  oop: { label: 'OOP' },
  dsa: { label: 'Data Structures & Algorithms' },
};

// ── Component ──────────────────────────────────────────────────────────────────
export const AdaptiveResultReview: React.FC = () => {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!jobId || !candidateId) return;

    apiRequest(`/coding-test/job/${jobId}/candidate/${candidateId}`)
      .then(data => {
        setSession(data);
        setLoading(false);
      })
      .catch(err => {
        setErrorMsg(err.message || 'Failed to load test results');
        setLoading(false);
      });
  }, [jobId, candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-neutral-800 border-t-[#7B2CBF] animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading candidate performance...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="text-center py-20 px-4">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Test Results Found</h2>
        <p className="text-neutral-400 max-w-md mx-auto mb-6">
          {errorMsg || "This candidate hasn't completed or started the coding test for this job yet."}
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const { candidateId: candidate, jobId: job, questionsAsked, responses, finalScore, status } = session;

  // Selected Data
  const selectedQuestion = questionsAsked[selectedIndex];
  const selectedResponse = responses.find(r => r.questionId === selectedQuestion?._id);

  return (
    <div className="space-y-6 max-h-[calc(100vh-80px)] min-h-[calc(100vh-80px)] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors mb-2 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Code2 className="text-[#7B2CBF] w-7 h-7" /> Adaptive Test Review
          </h2>
          <p className="text-neutral-400 mt-1">
            <strong className="text-white">{candidate.name}</strong> • {job.title}
          </p>
        </div>

        {/* Global Score Badges */}
        <div className="flex gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-3 flex items-center gap-4 shadow-lg shadow-black/20">
            <div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Status</p>
              <Badge variant={status === 'completed' ? 'success' : 'warning'}>
                {status === 'completed' ? 'Completed' : 'In Progress'}
              </Badge>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Final Score</p>
              <div className="flex items-center gap-2">
                <Trophy size={16} className={finalScore >= 80 ? 'text-emerald-400' : finalScore >= 50 ? 'text-yellow-400' : 'text-red-400'} />
                <span className={`text-xl font-black ${finalScore >= 80 ? 'text-emerald-400' : finalScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {finalScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Left: Timeline */}
        <div className="w-1/3 min-w-[320px] max-w-[400px] flex flex-col gap-4 overflow-y-auto pr-2">
          {questionsAsked.map((q, i) => {
            const resp = responses.find(r => r.questionId === q._id);
            const isSelected = selectedIndex === i;
            const hasAnswered = !!resp;

            return (
              <div
                key={q._id}
                onClick={() => setSelectedIndex(i)}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                  ? 'bg-[#12002b]/80 border-[#7B2CBF] shadow-[0_0_20px_rgba(123,44,191,0.15)]'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                  }`}
              >
                {/* Connecting Line (except first) */}
                {i > 0 && (
                  <div className="absolute top-0 left-9 -translate-x-1/2 -translate-y-full h-4 border-l-2 border-dashed border-neutral-700" />
                )}

                <div className="flex gap-4 items-start relative z-10">
                  {/* Icon / Number */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isSelected ? 'bg-gradient-to-br from-[#7B2CBF] to-[#9D4EDD] text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                    {i + 1}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-sm mb-1 truncate ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                      {q.title}
                    </h4>

                    <div className="flex gap-2 flex-wrap mb-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${DIFFICULTY_CONFIG[q.difficulty].color} ${DIFFICULTY_CONFIG[q.difficulty].bg} ${DIFFICULTY_CONFIG[q.difficulty].border}`}>
                        {q.difficulty.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-neutral-800 text-neutral-400">
                        {CATEGORY_CONFIG[q.category]?.label || q.category}
                      </span>
                    </div>

                    {/* Result */}
                    {hasAnswered ? (
                      <div className={`flex items-center gap-2 text-xs font-semibold ${resp.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {resp.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        {resp.passed ? 'Passed (100%)' : `Failed (${resp.score}%)`}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
                        <Clock size={14} /> Skipped / Pending
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Code Viewer */}
        <div className="flex-1 flex flex-col bg-[#0a001a]/40 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
          {selectedQuestion ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg text-white">Q{selectedIndex + 1}: {selectedQuestion.title}</h3>

                {selectedResponse && (
                  <Badge variant={selectedResponse.passed ? 'success' : 'error'} className="px-3 py-1">
                    Score: {selectedResponse.score}%
                  </Badge>
                )}
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-hidden relative">
                {!selectedResponse ? (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-500 flex-col gap-2">
                    <Code2 size={32} className="opacity-20" />
                    <p>No code submitted for this question.</p>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    value={selectedResponse.submittedCode}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: '"JetBrains Mono", Consolas, monospace',
                      wordWrap: 'on',
                      padding: { top: 16, bottom: 16 }
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500">
              Select a question to view code
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdaptiveResultReview;
