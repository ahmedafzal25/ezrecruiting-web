const express = require('express');
const router = express.Router();
const { getOpenGigs, acceptGig } = require('../controllers/freelancerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get all open gigs
router.get('/gigs/open', protect, authorize('freelancer', 'INTERVIEWER'), getOpenGigs);

// Accept a gig
router.post('/gigs/accept/:gigId', protect, authorize('freelancer', 'INTERVIEWER'), acceptGig);

module.exports = router;
