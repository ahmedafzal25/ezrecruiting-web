const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  startSession,
  getNextQuestion,
  submitAnswer,
  getResult,
  getSessionByCandidateAndJob,
  endSession
} = require('../controllers/codingTestController');

// ── Host roles — any user who can conduct an interview ──────────────────────
// These include the original recruiter, org admins, and hired freelancers/interviewers.
const HOST_ROLES = ['RECRUITER', 'ADMIN', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'];

// ── Test Execution Routes ───────────────────────────────────────────────────

// Start a new test session for a job (host initiates on behalf of candidate)
// POST /api/coding-test/start
router.post('/start', protect, authorize('CANDIDATE', 'RECRUITER', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'), startSession);

// Fetch the next question for an active session (or create one automatically)
// GET /api/coding-test/next-question?jobId=...
router.get('/next-question', protect, authorize('CANDIDATE', 'RECRUITER', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'), require('../controllers/codingTestController').getNextQuestionAuto);

// Fetch the next question for an active session (Legacy / by sessionId)
// GET /api/coding-test/:sessionId/next
router.get('/:sessionId/next', protect, authorize('CANDIDATE', 'RECRUITER', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'), getNextQuestion);

// Submit code for the current question
// POST /api/coding-test/:sessionId/submit
router.post('/:sessionId/submit', protect, authorize('CANDIDATE', 'RECRUITER', 'ORG_ADMIN', 'organization', 'INTERVIEWER', 'freelancer'), submitAnswer);

// End a test session manually (host roles only)
// POST /api/coding-test/:sessionId/end
router.post('/:sessionId/end', protect, authorize(...HOST_ROLES), endSession);

// ── Shared Route (candidate + recruiter + admin) ──────────────────────────────

// Get full session result by Session ID
// GET /api/coding-test/:sessionId/result
router.get('/:sessionId/result', protect, getResult);

// Get full session result by Job + Candidate
// GET /api/coding-test/job/:jobId/candidate/:candidateId
router.get('/job/:jobId/candidate/:candidateId', protect, getSessionByCandidateAndJob);

module.exports = router;
