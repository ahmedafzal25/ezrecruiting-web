/**
 * Coding Test Controller
 * Handles the adaptive Python coding test lifecycle.
 */

const fs            = require('fs');
const os            = require('os');
const path          = require('path');
const { execSync }  = require('child_process');

const TestSession    = require('../models/TestSession');
const CodingQuestion = require('../models/CodingQuestion');
const { getNextTarget, pickQuestion } = require('../utils/adaptiveEngine');

// Roles that can conduct/manage an interview session (mirrors codingTestRoutes.js)
const HOST_ROLES = ['RECRUITER', 'ADMIN', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'];

// ── Configuration ─────────────────────────────────────────────────────────────
// No fixed question limit — the test continues until the recruiter ends it.
const MAX_QUESTIONS    = 999; // Practically infinite
const EXEC_TIMEOUT_MS  = 5000; // Python execution timeout (ms)

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a raw stderr/message string into a user-friendly error type.
 * @param {string} errText
 * @returns {'SyntaxError'|'Timeout'|'RuntimeError'}
 */
const classifyError = (errText = '') => {
  if (errText.includes('SyntaxError'))      return 'SyntaxError';
  if (errText.includes('ETIMEDOUT') ||
      errText.includes('spawnSync') ||
      errText.includes('SIGTERM'))           return 'Timeout';
  return 'RuntimeError';
};

/**
 * Runs a single already-written python script against ONE set of stdin/stdout.
 * The file must already exist at `tmpFile`.
 *
 * @param {string} tmpFile       — absolute path to the already-written .py file
 * @param {string} input         — stdin string to feed
 * @param {string} expectedOutput— expected stdout (trimmed comparison)
 * @returns {{ passed: boolean, actualOutput: string, errorType: string|null }}
 */
const runOneCase = (tmpFile, input, expectedOutput) => {
  try {
    const actualOutput = execSync(
      `python "${tmpFile}"`,
      {
        input:    input || '',
        timeout:  EXEC_TIMEOUT_MS,
        encoding: 'utf8',
        stdio:    ['pipe', 'pipe', 'pipe'],
      },
    ).trim();

    const isMatch = actualOutput.trim() === expectedOutput.trim();

    return {
      passed:      isMatch,
      actualOutput,
      errorType:   null,
    };
  } catch (err) {
    const errText = (err.stderr || '') + (err.message || '');
    return {
      passed:      false,
      actualOutput: (err.stderr || err.message || 'Execution error').trimEnd(),
      errorType:   classifyError(errText),
    };
  }
};

/**
 * Writes `code` to a unique temp file, executes it against every test case,
 * then deletes the file. Returns per-case result objects.
 *
 * @param {string} code
 * @param {{ input: string, expectedOutput: string }[]} testCases
 * @returns {{ passed: boolean, actualOutput: string, errorType: string|null }[]}
 */
const runAllTestCases = (code, testCases) => {
  const tmpFile = path.join(
    os.tmpdir(),
    `procruit_${Date.now()}_${Math.random().toString(36).slice(2)}.py`,
  );

  try {
    fs.writeFileSync(tmpFile, code, 'utf8');

    // Fast-fail on SyntaxError: run once with empty input to catch before looping
    let syntaxErrorText = null;
    try {
      execSync(`python -m py_compile "${tmpFile}"`, {
        timeout:  3000,
        encoding: 'utf8',
        stdio:    ['pipe', 'pipe', 'pipe'],
      });
    } catch (syntaxErr) {
      syntaxErrorText = (syntaxErr.stderr || syntaxErr.message || '').trimEnd();
    }

    if (syntaxErrorText) {
      // All cases fail with the same SyntaxError message
      return testCases.map(() => ({
        passed:      false,
        actualOutput: syntaxErrorText,
        errorType:   'SyntaxError',
      }));
    }

    // Run each test case independently against the same file
    return testCases.map(tc => runOneCase(tmpFile, tc.input, tc.expectedOutput));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* already deleted — ignore */ }
  }
};

/**
 * Asynchronous wrapper to execute Python code for a single input
 * (Used for the new dynamic scoring continuous loop)
 */
const executePython = (code, input) => {
  return new Promise((resolve) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `procruit_exec_${Date.now()}_${Math.random().toString(36).slice(2)}.py`
    );
    try {
      fs.writeFileSync(tmpFile, code, 'utf8');
      const actualOutput = execSync(`python "${tmpFile}"`, {
        input: input || '',
        timeout: EXEC_TIMEOUT_MS,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      resolve(actualOutput);
    } catch (err) {
      resolve((err.stderr || err.message || '').trimEnd());
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Logic Analyzer
// ─────────────────────────────────────────────────────────────────────────────
const analyzeCodeWithAI = async (code, testScore) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[CodingTest] No AI API Key found. Returning default AI score.");
      return { 
        logicScore: testScore, 
        accuracyFeedback: 'AI analysis unavailable (Missing API Key)', 
        efficiencyFeedback: 'AI analysis unavailable' 
      };
    }

    const prompt = `Analyze this Python code. The candidate scored ${testScore}% on the basic test cases. Evaluate the code's time complexity, logic accuracy, and readability. Provide a JSON response with: 'logicScore' (0-100), 'accuracyFeedback', and 'efficiencyFeedback'.\n\nCode:\n${code}`;

    if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY) {
      // Gemini
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      if (!data.candidates || !data.candidates[0]) throw new Error("Invalid Gemini response");
      const resultText = data.candidates[0].content.parts[0].text;
      return JSON.parse(resultText);
    } else {
      // OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: "json_object" },
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      if (!data.choices || !data.choices[0]) throw new Error("Invalid OpenAI response");
      return JSON.parse(data.choices[0].message.content);
    }
  } catch (err) {
    console.error("[CodingTest] AI Analysis error:", err);
    return { 
      logicScore: testScore, 
      accuracyFeedback: 'Error during AI analysis', 
      efficiencyFeedback: 'Error during AI analysis' 
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: strip hidden test cases before sending question to client
// ─────────────────────────────────────────────────────────────────────────────
const sanitizeQuestion = (q) => {
  const obj = q.toObject ? q.toObject() : { ...q };
  delete obj.hiddenTestCases;
  return obj;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/start
// Body: { jobId }
// Auth: CANDIDATE only
// ─────────────────────────────────────────────────────────────────────────────
const startSession = async (req, res) => {
  try {
    const { jobId, candidateId: bodyCandidateId } = req.body;
    let candidateId = req.user._id;

    // Allow recruiters to start tests on behalf of a candidate
    if (req.user.role !== 'CANDIDATE' && req.user.role !== 'candidate' && bodyCandidateId) {
      candidateId = bodyCandidateId;
    }

    if (!jobId) {
      return res.status(400).json({ message: 'jobId is required' });
    }

    // Prevent duplicate in-progress sessions for the same candidate + job
    const existing = await TestSession.findOne({ candidateId, jobId, status: 'in_progress' });
    if (existing) {
      // Rather than erroring, seamlessly resume the test
      const lastQuestionId = existing.questionsAsked[existing.questionsAsked.length - 1];
      const currentQuestion = await CodingQuestion.findById(lastQuestionId);
      
      return res.status(200).json({
        sessionId: existing._id,
        questionNumber: existing.questionsAsked.length,
        totalQuestions: MAX_QUESTIONS,
        currentDifficulty: existing.currentDifficulty,
        question: currentQuestion ? sanitizeQuestion(currentQuestion) : null,
      });
    }

    // Pick the first question at default difficulty (easy)
    const firstQuestion = await pickQuestion('easy', null, []);
    if (!firstQuestion) {
      return res.status(503).json({ message: 'No questions available. Please contact support.' });
    }

    const session = await TestSession.create({
      candidateId,
      jobId,
      currentDifficulty: 'easy',
      questionsAsked: [firstQuestion._id],
      responses: [],
      status: 'in_progress',
    });

    return res.status(201).json({
      sessionId: session._id,
      questionNumber: 1,
      totalQuestions: MAX_QUESTIONS,
      currentDifficulty: session.currentDifficulty,
      question: sanitizeQuestion(firstQuestion),
    });
  } catch (err) {
    console.error('[CodingTest] startSession error:', err);
    return res.status(500).json({ message: 'Failed to start test session' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/next-question?jobId=...
// Auth: CANDIDATE 
// Auto-creates a session if one doesn't exist for the candidate and job.
// ─────────────────────────────────────────────────────────────────────────────
const getNextQuestionAuto = async (req, res) => {
  try {
    const { jobId } = req.query;
    const candidateId = req.user._id;

    if (!jobId) return res.status(400).json({ message: 'jobId is required' });

    let session = await TestSession.findOne({ candidateId, jobId, status: 'in_progress' });

    if (!session) {
      // Auto-create
      const firstQuestion = await pickQuestion('easy', null, []);
      if (!firstQuestion) {
        return res.status(503).json({ message: 'No questions available.' });
      }
      session = await TestSession.create({
        candidateId,
        jobId,
        currentDifficulty: 'easy',
        questionsAsked: [firstQuestion._id],
        responses: [],
        status: 'in_progress',
      });
      return res.json({
        sessionId: session._id,
        questionNumber: 1,
        currentDifficulty: 'easy',
        currentCategory: null,
        question: sanitizeQuestion(firstQuestion),
      });
    }

    // Session exists. Process next question logic.
    if (session.responses.length === 0) {
      const q = await CodingQuestion.findById(session.questionsAsked[0]);
      return res.json({
        sessionId: session._id,
        questionNumber: 1,
        currentDifficulty: session.currentDifficulty,
        currentCategory: session.currentCategory,
        question: sanitizeQuestion(q),
      });
    }

    let targetDifficulty = session.currentDifficulty;
    let targetCategory   = session.currentCategory || null;

    const lastResponse = session.responses[session.responses.length - 1];
    const target = getNextTarget(session.currentDifficulty, lastResponse.passed);
    targetDifficulty = target.difficulty;
    targetCategory   = target.category;

    session.currentDifficulty = targetDifficulty;
    session.currentCategory   = targetCategory;

    const question = await pickQuestion(targetDifficulty, targetCategory, session.questionsAsked);

    if (!question) {
      const totalScore = session.responses.reduce((sum, r) => sum + (r.score || 0), 0);
      session.finalScore  = session.responses.length > 0
        ? Math.round(totalScore / session.responses.length)
        : 0;
      session.status      = 'completed';
      session.completedAt = new Date();
      await session.save();
      return res.json({ done: true, finalScore: session.finalScore, sessionId: session._id });
    }

    session.questionsAsked.push(question._id);
    await session.save();

    return res.json({
      sessionId: session._id,
      questionNumber: session.responses.length + 1,
      currentDifficulty: targetDifficulty,
      currentCategory: targetCategory,
      question: sanitizeQuestion(question),
    });
  } catch (err) {
    console.error('[CodingTest] getNextQuestionAuto error:', err);
    return res.status(500).json({ message: 'Failed to fetch next question' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:sessionId/next
// Auth: CANDIDATE (must own session)
//
// Adaptive progression logic:
//   • Q1 is always served by startSession (easy / any).
//   • Subsequent calls read the last response to determine
//     the next {difficulty, category} target via getNextTarget.
// ─────────────────────────────────────────────────────────────────────────────
const getNextQuestion = async (req, res) => {
  try {
    const session = await TestSession.findById(req.params.sessionId);

    if (!session) return res.status(404).json({ message: 'Session not found' });
    const isCandidate = (req.user.role === 'CANDIDATE' || req.user.role === 'candidate');
    if (isCandidate && session.candidateId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your session' });
    }
    if (session.status === 'completed') {
      return res.json({ done: true, sessionId: session._id, finalScore: session.finalScore });
    }

    // ── Guard: session already completed (by recruiter or bank exhaustion) ───
    // (No fixed question limit — the recruiter ends the test manually.)

    // ── Determine the adaptive target ────────────────────────────────────────
    // If no answers yet, Q1 was already served by startSession — this
    // call is asking for Q2+, so base the target on the last response.
    let targetDifficulty = session.currentDifficulty;
    let targetCategory   = session.currentCategory || null;

    if (session.responses.length > 0) {
      const lastResponse = session.responses[session.responses.length - 1];
      const target = getNextTarget(session.currentDifficulty, lastResponse.passed);
      targetDifficulty = target.difficulty;
      targetCategory   = target.category;

      // Persist the updated target on the session for submitAnswer to reference
      session.currentDifficulty = targetDifficulty;
      session.currentCategory   = targetCategory;
    }

    console.log(
      `[Adaptive] Q${session.responses.length + 1}: ` +
      `last=${session.currentDifficulty} → next=${targetDifficulty}/${targetCategory ?? 'any'}`
    );

    // ── Fetch random unseen question for this target ─────────────────────────
    const question = await pickQuestion(
      targetDifficulty,
      targetCategory,
      session.questionsAsked
    );

    if (!question) {
      // Bank exhausted for this candidate — finalise session gracefully
      const totalScore = session.responses.reduce((sum, r) => sum + (r.score || 0), 0);
      session.finalScore  = session.responses.length > 0
        ? Math.round(totalScore / session.responses.length)
        : 0;
      session.status      = 'completed';
      session.completedAt = new Date();
      await session.save();
      return res.json({ done: true, finalScore: session.finalScore, sessionId: session._id });
    }

    // Track this question so it is never repeated
    session.questionsAsked.push(question._id);
    await session.save();

    return res.json({
      questionNumber:    session.responses.length + 1,
      currentDifficulty: targetDifficulty,
      currentCategory:   targetCategory,
      question:          sanitizeQuestion(question),
    });
  } catch (err) {
    console.error('[CodingTest] getNextQuestion error:', err);
    return res.status(500).json({ message: 'Failed to fetch next question' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/:sessionId/submit
// Body: { questionId, submittedCode }
// Auth: CANDIDATE (must own session)
//
// Execution model (dual-pass):
//   Pass 1 — run against visibleTestCases (results returned to client).
//   Pass 2 — run against hiddenTestCases  (results used for scoring only;
//             actual outputs NEVER leave the server).
//
// Scoring: score = (hiddenPassed / hiddenTotal) * 100
// Pass:    all hidden test cases must pass (score === 100)
// ─────────────────────────────────────────────────────────────────────────────
const submitAnswer = async (req, res) => {
  try {
    const { questionId, submittedCode } = req.body;

    // ── Input validation ─────────────────────────────────────────────────
    if (!questionId || typeof submittedCode !== 'string' || submittedCode.trim() === '') {
      return res.status(400).json({ message: 'questionId and non-empty submittedCode are required' });
    }

    // ── Session guards ──────────────────────────────────────────────────
    const session = await TestSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const isCandidate = (req.user.role === 'CANDIDATE' || req.user.role === 'candidate');
    if (isCandidate && session.candidateId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your session' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ message: 'Session is already completed' });
    }

    // Verify question belongs to this session
    const questionBelongs = session.questionsAsked.some(id => id.toString() === questionId);
    if (!questionBelongs) {
      return res.status(400).json({ message: 'This question is not part of your session' });
    }

    // Prevent double-submission
    const alreadySubmitted = session.responses.some(r => r.questionId.toString() === questionId);
    if (alreadySubmitted) {
      return res.status(400).json({ message: 'You have already submitted an answer for this question' });
    }

    // ── Fetch question (server-side, with hidden cases) ───────────────────
    const question = await CodingQuestion.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    console.log(`[CodingTest] Running submission for question "${question.title}" ` +
      `(${question.difficulty}/${question.category}) — ` +
      `${question.visibleTestCases.length} visible, ${question.hiddenTestCases.length} hidden`);

    // ── PASS 1 & 2: All test cases combined (scoring) ─────────────────────────
    const allTestCases = [...question.visibleTestCases, ...question.hiddenTestCases];
    let passedCases = 0;
    const totalCases = allTestCases.length;
    
    const visibleResultsForClient = [];
    const hiddenTotal = question.hiddenTestCases.length;
    let hiddenPassed = 0;
    let currentIndex = 0;

    // Loop through all cases. DO NOT use 'break' or 'return' inside the loop.
    for (const tc of allTestCases) {
        // Construct temporary Python string that combines code with a hidden execution block
        const functionCall = `print(${question.functionName}(${tc.input}))`;
        const executableCode = `${submittedCode}\n\n${functionCall}`;
        
        // Run without any stdin payload
        const output = await executePython(executableCode);
        const isMatch = output.trim() === tc.expectedOutput.trim();
        
        if (isMatch) {
            passedCases++;
            if (currentIndex >= question.visibleTestCases.length) hiddenPassed++;
        }

        if (currentIndex < question.visibleTestCases.length) {
             visibleResultsForClient.push({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                actualOutput: output.trim(),
                passed: isMatch,
                errorType: isMatch ? null : classifyError(output),
            });
        }
        currentIndex++;
    }

    const testCaseScore = totalCases > 0 ? (passedCases / totalCases) * 100 : 0; // Exact percentage

    // Score = percentage of all test cases passed for dynamic grading
    const testScore = Math.round(testCaseScore);
    // "Pass" logic is up to interpretation, traditionally 100%
    const passed = passedCases === totalCases && totalCases > 0;

    // AI Logic Analysis
    const aiAnalysis = await analyzeCodeWithAI(submittedCode, testScore);
    const logicScore = Number(aiAnalysis.logicScore) || testScore;
    
    // Final Blended Score (70% automated, 30% AI)
    const finalScoreMix = Math.round((testScore * 0.7) + (logicScore * 0.3));

    // Hidden summary (counts only, no actual output)
    const hiddenSummaryForClient = {
      total:  hiddenTotal,
      passed: hiddenPassed,
      failed: hiddenTotal - hiddenPassed,
    };

    console.log('[CodingTest] Original Test Score: ' + testScore + '%, AI Logic Score: ' + logicScore + '%, Final Blended Score: ' + finalScoreMix + '%');

    // ── Persist response & update adaptive state ───────────────────────────
    session.responses.push({ 
      questionId, 
      submittedCode, 
      passed, 
      score: finalScoreMix, 
      aiAnalysis 
    });

    // Feed pass/fail into the adaptive engine to prepare the next target
    const nextTarget = getNextTarget(session.currentDifficulty, passed);
    session.currentDifficulty = nextTarget.difficulty;
    session.currentCategory   = nextTarget.category;

    // No auto-complete — the recruiter ends the test manually via POST /:sessionId/end
    let finalScore = null;

    await session.save();

    // ── Build response ───────────────────────────────────────────────────
    return res.json({
      // Overall verdict
      passed,
      score: finalScoreMix,
      aiAnalysis,

      // Visible test case results — full detail for the candidate
      visibleTestResults: visibleResultsForClient,

      // Hidden test case summary — counts only, never actual outputs
      hiddenTestSummary: hiddenSummaryForClient,

      // Adaptive engine output
      nextDifficulty:  nextTarget.difficulty,
      nextCategory:    nextTarget.category,

      // Progress metadata
      questionNumber:  session.responses.length,
      sessionComplete: session.status === 'completed',
      ...(finalScore !== null ? { finalScore } : {}),
    });
  } catch (err) {
    console.error('[CodingTest] submitAnswer error:', err);
    return res.status(500).json({ message: 'Failed to submit answer' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:sessionId/result
// Auth: CANDIDATE (own session) or RECRUITER / ADMIN
// ─────────────────────────────────────────────────────────────────────────────
const getResult = async (req, res) => {
  try {
    const session = await TestSession.findById(req.params.sessionId)
      .populate('candidateId', 'name email')
      .populate('jobId', 'title company')
      .populate('questionsAsked', 'title difficulty category');

    if (!session) return res.status(404).json({ message: 'Session not found' });

    const userId = req.user._id.toString();
    const role   = req.user.role;

    const isOwner      = session.candidateId?._id?.toString() === userId;
    const isPrivileged = HOST_ROLES.includes(role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'Not authorized to view this result' });
    }

    return res.json(session);
  } catch (err) {
    console.error('[CodingTest] getResult error:', err);
    return res.status(500).json({ message: 'Failed to retrieve result' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/job/:jobId/candidate/:candidateId
// Auth: RECRUITER / ADMIN / organization
// ─────────────────────────────────────────────────────────────────────────────
const getSessionByCandidateAndJob = async (req, res) => {
  try {
    const { jobId, candidateId } = req.params;
    const session = await TestSession.findOne({ jobId, candidateId })
      .populate('candidateId', 'name email')
      .populate('jobId', 'title company')
      .populate('questionsAsked', 'title difficulty category');

    if (!session) return res.status(404).json({ message: 'No test session found for this candidate' });

    // Validate role
    const role = req.user.role;
    const isPrivileged = HOST_ROLES.includes(role);
    if (!isPrivileged) return res.status(403).json({ message: 'Not authorized' });

    return res.json(session);
  } catch (err) {
    console.error('[CodingTest] getSession error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/:sessionId/end
// Auth: RECRUITER / ADMIN / organization (only host can end the test)
//
// Manually ends a coding test session. Computes the final score from all
// responses submitted so far and marks the session as completed.
// ─────────────────────────────────────────────────────────────────────────────
const endSession = async (req, res) => {
  try {
    const session = await TestSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Only host roles can end a session (recruiter, org admin, or assigned interviewer/freelancer)
    const role = req.user.role;
    const isPrivileged = HOST_ROLES.includes(role);
    if (!isPrivileged) {
      return res.status(403).json({ message: 'Only a host (recruiter, admin, or assigned interviewer) can end a test session' });
    }

    if (session.status === 'completed') {
      return res.json({
        message: 'Session is already completed',
        sessionId: session._id,
        finalScore: session.finalScore,
        totalAnswered: session.responses.length,
      });
    }

    // Compute final score from all submitted responses
    const totalScore = session.responses.reduce((sum, r) => sum + (r.score || 0), 0);
    session.finalScore  = session.responses.length > 0
      ? Math.round(totalScore / session.responses.length)
      : 0;
    session.status      = 'completed';
    session.completedAt = new Date();
    await session.save();

    console.log(`[CodingTest] Session ${session._id} ended by ${role}. ` +
      `Final score: ${session.finalScore}% (${session.responses.length} questions answered)`);

    return res.json({
      message: 'Test session ended successfully',
      sessionId: session._id,
      finalScore: session.finalScore,
      totalAnswered: session.responses.length,
    });
  } catch (err) {
    console.error('[CodingTest] endSession error:', err);
    return res.status(500).json({ message: 'Failed to end session' });
  }
};

module.exports = { startSession, getNextQuestion, getNextQuestionAuto, submitAnswer, getResult, getSessionByCandidateAndJob, endSession };
