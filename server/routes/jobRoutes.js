const express = require('express');
const router = express.Router();
const { getJobs, getJobById, createJob, applyJob, getMyJobs, updateApplicationStatus, getMyReceivedApplications, delegateJobToFreelancer } = require('../controllers/jobController');
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, getJobs); // Public but reads user if logged in
router.get('/my-jobs', protect, authorize('RECRUITER'), getMyJobs);
router.get('/applications/received', protect, authorize('RECRUITER', 'INTERVIEWER', 'freelancer'), getMyReceivedApplications);
router.get('/:id', getJobById); // Public
router.post('/', protect, authorize('RECRUITER', 'organization'), createJob);
router.post('/:id/apply', protect, authorize('CANDIDATE'), applyJob);
router.post('/:jobId/delegate', protect, authorize('RECRUITER'), delegateJobToFreelancer);
router.put('/applications/:id/status', protect, authorize('RECRUITER', 'INTERVIEWER', 'freelancer'), updateApplicationStatus);

module.exports = router;
