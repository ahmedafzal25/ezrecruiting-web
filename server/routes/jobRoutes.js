const express = require('express');
const router = express.Router();
const { getJobs, getJobById, createJob, applyJob, getMyJobs, updateApplicationStatus, getMyReceivedApplications, delegateJobToFreelancer, getReviewingDelegations, approveDelegatedHire, getNewHirings, getPastJobs } = require('../controllers/jobController');
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, getJobs); // Public but reads user if logged in
router.get('/my-jobs', protect, authorize('RECRUITER'), getMyJobs);
router.get('/applications/received', protect, authorize('RECRUITER', 'INTERVIEWER', 'freelancer'), getMyReceivedApplications);

// ── Project-Based Delegation: Recruiter Review ─────────────────────────────────
router.get('/delegations/reviewing', protect, authorize('RECRUITER'), getReviewingDelegations);
router.put('/delegations/:jobId/approve', protect, authorize('RECRUITER'), approveDelegatedHire);

// ── New Hirings & Past Jobs — must be BEFORE the :id wildcard ─────────────────
router.get('/hirings/new', protect, authorize('RECRUITER'), getNewHirings);
router.get('/past-jobs', protect, authorize('RECRUITER'), getPastJobs);

router.get('/:id', getJobById); // Public — must stay LAST to avoid shadowing named routes
router.post('/', protect, authorize('RECRUITER', 'organization'), createJob);
router.post('/:id/apply', protect, authorize('CANDIDATE'), applyJob);
router.post('/:jobId/delegate', protect, authorize('RECRUITER'), delegateJobToFreelancer);
router.put('/applications/:id/status', protect, authorize('RECRUITER', 'INTERVIEWER', 'freelancer'), updateApplicationStatus);

module.exports = router;

