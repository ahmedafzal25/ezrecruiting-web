import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Code2, CheckCircle, XCircle, ChevronRight, Clock, Trophy,
  AlertTriangle, Terminal, Zap, BookOpen, Loader2, BarChart3,
  ArrowRight, RefreshCw, Play, Send
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useTheme } from '../components/ThemeContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface TestCase {
  input: string;
  expectedOutput: string;
}

interface Question {
  _id: string;
  title: string;
  description: string;
  difficulty: 'very_easy' | 'easy' | 'medium' | 'hard';
  category: 'basics' | 'oop' | 'dsa';
  visibleTestCases: TestCase[];
}

interface VisibleCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  errorType: string | null;
}

interface HiddenSummary {
  total: number;
  passed: number;
  failed: number;
}

interface SubmitResponse {
  passed: boolean;
  score: number;
  visibleTestResults: VisibleCaseResult[];
  hiddenTestSummary: HiddenSummary;
  nextDifficulty: string;
  nextCategory: string | null;
  questionNumber: number;
  totalQuestions: number;
  sessionComplete: boolean;
  finalScore?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  very_easy: { label: 'Very Easy', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  easy:      { label: 'Easy',      color: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/30'   },
  medium:    { label: 'Medium',    color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30'  },
  hard:      { label: 'Hard',      color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30'     },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  basics: { label: 'Python Basics', icon: '🐍' },
  oop:    { label: 'OOP',           icon: '🏗️' },
  dsa:    { label: 'DSA',           icon: '🧠' },
};

// No fixed question limit — questions continue until the recruiter ends the test

const STARTER_CODE = `# Write your Python code here
# Read input using: input()
# Print output using: print()

`;

// ── CodingAssessment Component ─────────────────────────────────────────────────
const CodingAssessment: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // ── Core State ────────────────────────────────────────────────────────────
  const [actualSessionId, setActualSessionId]   = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [code, setCode]                       = useState<string>(STARTER_CODE);
  const [consoleOutput, setConsoleOutput]      = useState<string>('🖥️ Console output will appear here after you submit your code.\n');
  const [isEvaluating, setIsEvaluating]        = useState(false);
  const [questionNumber, setQuestionNumber]    = useState(1);
  const [sessionComplete, setSessionComplete]  = useState(false);
  const [finalScore, setFinalScore]            = useState<number | null>(null);
  const [loading, setLoading]                  = useState(true);
  const [error, setError]                      = useState('');
  const [lastResult, setLastResult]            = useState<SubmitResponse | null>(null);
  const [advancing, setAdvancing]              = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer
  const [elapsed, setElapsed]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prevent double-submit
  const submittedIds = useRef<Set<string>>(new Set());
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !sessionComplete && !error) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, sessionComplete, error]);

  const formatTime = (s: number) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // ── Auto-scroll console ───────────────────────────────────────────────────
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleOutput]);

  const hasFetchedOnce = useRef(false);

  // ── Lifecycle: Load first question on mount ───────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID / Job ID provided in the URL.');
      setLoading(false);
      return;
    }
    if (!hasFetchedOnce.current) {
      hasFetchedOnce.current = true;
      fetchNextQuestion();
    }
  }, [sessionId]);

  const fetchNextQuestion = async (isAutoAdvance = false) => {
    try {
      if (!isAutoAdvance) setLoading(true);
      else setAdvancing(true);

      const targetSessionId = actualSessionId || sessionId;
      const endpoint = actualSessionId ? `/coding-test/${actualSessionId}/next` : `/coding-test/next-question?jobId=${targetSessionId}`;
      const res = await apiRequest(endpoint, 'GET');

      if (res.sessionId && !actualSessionId) {
        setActualSessionId(res.sessionId);
      }

      if (res.done) {
        setSessionComplete(true);
        setFinalScore(res.finalScore ?? 0);
        setLoading(false);
        setAdvancing(false);
        return;
      }

      setCurrentQuestion(res.question);
      setQuestionNumber(res.questionNumber);
      setCode(STARTER_CODE);
      setLastResult(null);
      setConsoleOutput('🖥️ Console output will appear here after you submit your code.\n');
      setLoading(false);
      setAdvancing(false);
    } catch (err: any) {
      if (!isAutoAdvance) {
        setError(err?.message || 'Failed to load question. Please try again.');
        setLoading(false);
      } else {
        setConsoleOutput(prev => prev + `\n❌ Failed to load next question: ${err?.message || 'Unknown error'}\n`);
        setAdvancing(false);
      }
    }
  };

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); };
  }, []);

  // ── Submit Handler ────────────────────────────────────────────────────────
  const handleRunCode = useCallback(async () => {
    const targetSessionId = actualSessionId || sessionId;
    if (!targetSessionId || !currentQuestion || isEvaluating) return;
    if (submittedIds.current.has(currentQuestion._id)) return;

    setIsEvaluating(true);
    setConsoleOutput('⏳ Running your code against test cases...\n');

    try {
      const res: SubmitResponse = await apiRequest(
        `/coding-test/${targetSessionId}/submit`,
        'POST',
        { questionId: currentQuestion._id, submittedCode: code }
      );

      submittedIds.current.add(currentQuestion._id);
      setLastResult(res);

      // Build rich console output
      let output = '';
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      output += `  ${res.passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}  —  Score: ${res.score}%\n`;
      output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Visible test results
      res.visibleTestResults.forEach((r, i) => {
        const icon = r.passed ? '✅' : '❌';
        output += `${icon} Test Case ${i + 1}:\n`;
        output += `   Input:    ${r.input || '(no input)'}\n`;
        output += `   Expected: ${r.expectedOutput}\n`;
        output += `   Got:      ${r.actualOutput || '(no output)'}\n`;
        if (r.errorType) output += `   Error:    ${r.errorType}\n`;
        output += '\n';
      });

      // Hidden test summary
      output += `🔒 Hidden Tests: ${res.hiddenTestSummary.passed}/${res.hiddenTestSummary.total} passed\n`;

      if (res.sessionComplete) {
        output += `\n🏆 TEST COMPLETE — Final Score: ${res.finalScore ?? res.score}%\n`;
        output += `   Redirecting to results...\n`;
        setSessionComplete(true);
        setFinalScore(res.finalScore ?? res.score);
      } else {
        if (res.nextDifficulty) {
          output += `\n⚡ Next question difficulty: ${res.nextDifficulty.replace('_', ' ')}\n`;
        }
        output += `   ⏳ Loading next question in 3 seconds...\n`;

        // Auto-advance to next question after 3 seconds
        autoAdvanceTimer.current = setTimeout(() => {
          fetchNextQuestion(true);
        }, 3000);
      }

      setConsoleOutput(output);
    } catch (err: any) {
      setConsoleOutput(`❌ Submission Error:\n${err?.message || 'Something went wrong. Please try again.'}\n`);
    } finally {
      setIsEvaluating(false);
    }
  }, [sessionId, currentQuestion, code, isEvaluating]);

  // ── Skip to next question immediately ──────────────────────────────────────
  const handleSkipToNext = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    fetchNextQuestion(true);
  };

  // ── Keyboard: Ctrl+Enter ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !sessionComplete && !lastResult) {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRunCode, sessionComplete, lastResult]);

  // ── Difficulty badge helper ───────────────────────────────────────────────
  const DiffBadge = ({ diff }: { diff: string }) => {
    const cfg = DIFFICULTY_CONFIG[diff] || DIFFICULTY_CONFIG.easy;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
        {cfg.label}
      </span>
    );
  };

  const CatBadge = ({ cat }: { cat: string }) => {
    const cfg = CATEGORY_CONFIG[cat] || { label: cat, icon: '📝' };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/20 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
        <span>{cfg.icon}</span> {cfg.label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Loading
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center gap-6 ${isDark ? 'bg-[#07000F]' : 'bg-[#F3EEFF]'}`}>
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-[#7B2CBF]/30 flex items-center justify-center">
            <Code2 size={36} className="text-[#7B2CBF]" />
          </div>
          <div className="absolute inset-0 rounded-full border-t-2 border-[#9D4EDD] animate-spin" />
        </div>
        <div className="text-center">
          <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>Loading Coding Assessment</h2>
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Preparing your question…</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Fallback UI (Not Loading, No Error, currentQuestion is null)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!loading && !currentQuestion && !sessionComplete && !error) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center gap-6 px-4 ${isDark ? 'bg-[#07000F]' : 'bg-[#F3EEFF]'}`}>
        <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Code2 size={32} className="text-[#9D4EDD]" />
        </div>
        <div className="text-center max-w-md">
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>Ready to Code?</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>
            Click beneath to fetch your first question and begin the assessment.
          </p>
          <button
            onClick={() => fetchNextQuestion()}
            className="px-6 py-2.5 bg-[#7B2CBF] hover:bg-[#9D4EDD] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Start Test
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Error
  // ═══════════════════════════════════════════════════════════════════════════
  if (error) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center gap-6 px-4 ${isDark ? 'bg-[#07000F]' : 'bg-[#F3EEFF]'}`}>
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <div className="text-center max-w-md">
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>Something Went Wrong</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-[#7B2CBF] hover:bg-[#9D4EDD] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Completed
  // ═══════════════════════════════════════════════════════════════════════════
  if (sessionComplete) {
    const score = finalScore ?? 0;
    const grade = score >= 80 ? { label: 'Excellent', color: 'text-emerald-400' }
                : score >= 60 ? { label: 'Good',      color: 'text-yellow-400'  }
                : score >= 40 ? { label: 'Fair',       color: 'text-orange-400'  }
                :               { label: 'Needs Work', color: 'text-red-400'     };

    return (
      <div className={`h-screen flex flex-col items-center justify-center px-4 py-12 ${isDark ? 'bg-[#07000F]' : 'bg-[#F3EEFF]'}`}>
        {/* Score ring */}
        <div className="relative w-44 h-44 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(123,44,191,0.15)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="url(#scoreGradCA)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - score / 100)}`}
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <defs>
              <linearGradient id="scoreGradCA" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7B2CBF" />
                <stop offset="100%" stopColor="#9D4EDD" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Trophy size={20} className="text-[#9D4EDD] mb-0.5" />
            <span className={`text-4xl font-black ${grade.color}`}>{score}%</span>
            <span className="text-xs text-neutral-500 font-medium">{grade.label}</span>
          </div>
        </div>

        <div className="text-center max-w-md mb-10">
          <h1 className={`text-3xl font-black mb-2 ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>
            <span className="bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] bg-clip-text text-transparent">
              Test Complete!
            </span>
          </h1>
          <p className={isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}>
            You answered {questionNumber} adaptive questions. Your final score has been submitted.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10 w-full max-w-sm">
          {[
            { label: 'Final Score', value: `${score}%`,           icon: <BarChart3 size={18} /> },
            { label: 'Questions',   value: `${questionNumber}`,    icon: <BookOpen size={18} /> },
            { label: 'Grade',       value: grade.label,            icon: <Trophy size={18} />   },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-4 text-center backdrop-blur-sm border ${isDark ? 'bg-[#0D0117]/80 border-neutral-800/50' : 'bg-white/80 border-purple-200/50'}`}>
              <div className="text-[#9D4EDD] flex justify-center mb-1">{item.icon}</div>
              <div className={`font-bold text-lg leading-tight ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>{item.value}</div>
              <div className={`text-xs mt-0.5 ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>{item.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate(-1)}
          className="px-8 py-3 bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] hover:from-[#9D4EDD] hover:to-[#7B2CBF] text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-purple-900/40 hover:shadow-purple-700/50"
        >
          Return to Interview
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Main Split-Screen IDE
  // ═══════════════════════════════════════════════════════════════════════════
  const hasSubmitted = lastResult !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }} className={isDark ? 'bg-[#07000F] text-white' : 'bg-[#F3EEFF] text-[#1a0033]'}>

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header
        className={`border-b backdrop-blur-md ${isDark ? 'border-neutral-800/80 bg-[#0D0117]/90' : 'border-purple-200 bg-white/90'}`}
        style={{ flexShrink: 0, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#7B2CBF] to-[#9D4EDD] flex items-center justify-center">
            <Code2 size={14} className="text-white" />
          </div>
          <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>Coding Assessment</span>
        </div>

        {/* Center: Question counter */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono whitespace-nowrap ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>
            Question {questionNumber}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'text-neutral-600 bg-neutral-800/60' : 'text-purple-600 bg-purple-100'}`}>
            Continuous Mode
          </span>
          {advancing && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#9D4EDD]">
              <Loader2 size={11} className="animate-spin" />
              Loading next…
            </div>
          )}
        </div>

        {/* Right: Difficulty + Timer */}
        <div className="flex items-center gap-4">
          {currentQuestion && <DiffBadge diff={currentQuestion.difficulty} />}
          <div className={`flex items-center gap-1.5 text-sm font-mono ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>
            <Clock size={14} />
            {formatTime(elapsed)}
          </div>
        </div>
      </header>

      {/* ── Split-Screen Body ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL — Question (50%) */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          className={`border-r ${isDark ? 'border-neutral-800/60 bg-[#0a001a]/40' : 'border-purple-200 bg-white/60'}`}
        >
          {/* Question header */}
          <div className={`px-6 pt-5 pb-4 border-b ${isDark ? 'border-neutral-800/40' : 'border-purple-200/40'}`} style={{ flexShrink: 0 }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className={`text-lg font-bold leading-snug ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>
                {currentQuestion?.title || 'Loading...'}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentQuestion && <DiffBadge diff={currentQuestion.difficulty} />}
              {currentQuestion && <CatBadge cat={currentQuestion.category} />}
            </div>
          </div>

          {/* Scrollable question body */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="px-6 py-5 space-y-6">

            {/* Description */}
            {currentQuestion && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={14} className="text-[#9D4EDD]" />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Problem</span>
                </div>
                <div className={`text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4 border ${isDark ? 'text-neutral-300 bg-[#0D0117]/60 border-neutral-800/50' : 'text-[#1a0033] bg-purple-50 border-purple-200/50'}`}>
                  {currentQuestion.description}
                </div>
              </div>
            )}

            {/* Visible Test Cases */}
            {currentQuestion && currentQuestion.visibleTestCases.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Terminal size={14} className="text-[#9D4EDD]" />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Examples</span>
                </div>
                <div className="space-y-3">
                  {currentQuestion.visibleTestCases.map((tc, i) => (
                    <div key={i} className={`rounded-xl border overflow-hidden ${isDark ? 'border-neutral-800/50' : 'border-purple-200/50'}`}>
                      <div className={`grid grid-cols-2 divide-x ${isDark ? 'divide-neutral-800/50' : 'divide-purple-200/50'}`}>
                        <div className="p-3">
                          <p className={`text-[10px] font-semibold uppercase mb-1.5 ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>Input</p>
                          <pre className={`text-xs font-mono whitespace-pre-wrap break-all ${isDark ? 'text-neutral-300' : 'text-[#1a0033]'}`}>
                            {tc.input || '(no input)'}
                          </pre>
                        </div>
                        <div className={`p-3 ${isDark ? '' : 'bg-purple-50/30'}`}>
                          <p className={`text-[10px] font-semibold uppercase mb-1.5 ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>Expected Output</p>
                          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all">
                            {tc.expectedOutput}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result feedback (if submitted) */}
            {hasSubmitted && lastResult && (
              <div className="space-y-4 pt-2">
                {/* Verdict banner */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  lastResult.passed
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}>
                  {lastResult.passed ? <CheckCircle size={22} /> : <XCircle size={22} />}
                  <div>
                    <p className="font-bold text-base">
                      {lastResult.passed ? 'All Tests Passed!' : 'Some Tests Failed'}
                    </p>
                    <p className="text-xs opacity-75">Score: {lastResult.score}%</p>
                  </div>
                  <span className="ml-auto text-2xl font-black">{lastResult.score}%</span>
                </div>

                {/* Hidden tests bar */}
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#0D0117]/60 border-neutral-800/50' : 'bg-white/80 border-purple-200/50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Hidden Tests</p>
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-purple-100'}`}>
                      <div
                        className="h-full bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] rounded-full transition-all duration-700"
                        style={{ width: `${(lastResult.hiddenTestSummary.passed / lastResult.hiddenTestSummary.total) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono whitespace-nowrap ${isDark ? 'text-white' : 'text-[#1a0033]'}`}>
                      {lastResult.hiddenTestSummary.passed}/{lastResult.hiddenTestSummary.total}
                    </span>
                  </div>
                </div>

                {/* Next difficulty hint */}
                {lastResult.nextDifficulty && !lastResult.sessionComplete && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    <Zap size={13} />
                    <span>
                      Next question: <strong>{lastResult.nextDifficulty.replace('_', ' ')}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL — Editor + Console (50%) */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Editor toolbar */}
          <div
            className={`border-b ${isDark ? 'border-neutral-800/60 bg-[#0a001a]/20' : 'border-purple-200 bg-purple-50/60'}`}
            style={{ flexShrink: 0, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className={`ml-2 text-xs font-mono ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>solution.py</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'text-neutral-600 bg-neutral-800/60' : 'text-purple-600 bg-purple-100'}`}>Python 3</span>
              <span className={`text-[10px] ${isDark ? 'text-neutral-600' : 'text-purple-500'}`}>Ctrl+Enter to submit</span>
            </div>
          </div>

          {/* Monaco Editor — 70% of right panel */}
          <div style={{ flex: 7, overflow: 'hidden', minHeight: 0 }}>
            <Editor
              height="100%"
              defaultLanguage="python"
              language="python"
              value={code}
              onChange={(val) => setCode(val ?? '')}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                wordWrap: 'on',
                readOnly: hasSubmitted,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                renderLineHighlight: 'line',
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {/* Console Output — 30% of right panel */}
          <div
            className={`border-t ${isDark ? 'border-neutral-800/60' : 'border-purple-200'}`}
            style={{ flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
          >
            {/* Console header */}
            <div
              className={`border-b ${isDark ? 'bg-[#0D0117]/80 border-neutral-800/40' : 'bg-purple-50 border-purple-200/40'}`}
              style={{ flexShrink: 0, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Terminal size={13} className={isDark ? 'text-neutral-500' : 'text-[#6b46a0]'} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-[#6b46a0]'}`}>Console</span>
              {isEvaluating && <Loader2 size={13} className="text-[#9D4EDD] animate-spin ml-auto" />}
            </div>

            {/* Console body */}
            <div
              className={isDark ? 'bg-[#0a0a0a]' : 'bg-white'}
              style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace', fontSize: '12px' }}
            >
              <pre className={`whitespace-pre-wrap break-all leading-relaxed m-0 ${isDark ? 'text-neutral-300' : 'text-[#1a0033]'}`}>
                {consoleOutput}
              </pre>
              <div ref={consoleEndRef} />
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div
            className={`border-t ${isDark ? 'border-neutral-800/60 bg-[#0D0117]/60' : 'border-purple-200 bg-purple-50/60'}`}
            style={{ flexShrink: 0, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
          >
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-neutral-500' : 'text-[#6b46a0]'}`}>
              <RefreshCw size={12} />
              <span>Auto-saved</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Submit button (visible when not yet submitted) */}
              {!hasSubmitted && (
                <button
                  onClick={handleRunCode}
                  disabled={isEvaluating || !code.trim() || code.trim() === STARTER_CODE.trim()}
                  id="submit-code-btn"
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#7B2CBF] to-[#9D4EDD] hover:from-[#9D4EDD] hover:to-[#7B2CBF] text-white rounded-lg font-semibold text-sm transition-all duration-300 shadow-md shadow-purple-900/30 hover:shadow-purple-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isEvaluating
                    ? <><Loader2 size={16} className="animate-spin" /> Running Tests…</>
                    : <><Send size={16} /> Submit &amp; Continue</>}
                </button>
              )}

              {/* Skip wait — load next question immediately */}
              {hasSubmitted && !lastResult?.sessionComplete && (
                <button
                  onClick={handleSkipToNext}
                  disabled={advancing}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-purple-100 hover:bg-purple-200 text-[#1a0033]'}`}
                >
                  {advancing
                    ? <><Loader2 size={16} className="animate-spin" /> Loading…</>
                    : <><ArrowRight size={16} /> Skip to Next</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingAssessment;
