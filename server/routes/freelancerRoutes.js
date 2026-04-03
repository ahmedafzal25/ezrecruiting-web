const express = require('express');
const router = express.Router();
const {
    getOpenGigs,
    acceptGig,
    updateProfile,
    updateAvailability,
    getAvailability,
    // Service marketplace
    createService,
    getMyServices,
    updateService,
    deleteService,
    // Booking requests
    acceptRequest,
    rejectRequest,
    // Project-based delegation
    getMyDelegatedJobs,
    acceptDelegation,
    rejectDelegation,
    proposeHire,
} = require('../controllers/freelancerController');
const { protect, authorize } = require('../middleware/authMiddleware');

const FREELANCER_ROLES = ['freelancer', 'INTERVIEWER'];

// ── Service Marketplace (Freelancer publishes services) ───────────────────────
router.get('/services',               protect, authorize(...FREELANCER_ROLES), getMyServices);
router.post('/services',              protect, authorize(...FREELANCER_ROLES), createService);
router.put('/services/:serviceId',    protect, authorize(...FREELANCER_ROLES), updateService);
router.delete('/services/:serviceId', protect, authorize(...FREELANCER_ROLES), deleteService);

// ── Booking Requests (Accept/Reject) ───────────────────────────────────────────
router.put('/requests/:id/accept',    protect, authorize(...FREELANCER_ROLES), acceptRequest);
router.put('/requests/:id/reject',    protect, authorize(...FREELANCER_ROLES), rejectRequest);

// ── Project-Based Delegation (Fetch / Accept / Reject / Propose) ───────────────────────
router.get('/delegations',                    protect, authorize(...FREELANCER_ROLES), getMyDelegatedJobs);
router.put('/delegations/:jobId/accept',  protect, authorize(...FREELANCER_ROLES), acceptDelegation);
router.put('/delegations/:jobId/reject',  protect, authorize(...FREELANCER_ROLES), rejectDelegation);
router.post('/delegations/:jobId/propose/:candidateId', protect, authorize(...FREELANCER_ROLES), proposeHire);

// ── Legacy Gig Board ─────────────────────────────────────────────────────────
router.get('/gigs/open',              protect, authorize(...FREELANCER_ROLES), getOpenGigs);
router.post('/gigs/accept/:gigId',    protect, authorize(...FREELANCER_ROLES), acceptGig);

// ── Profile & Availability ───────────────────────────────────────────────────
router.put('/profile',    protect, authorize(...FREELANCER_ROLES), updateProfile);
router.get('/availability',  protect, authorize(...FREELANCER_ROLES), getAvailability);
router.post('/availability', protect, authorize(...FREELANCER_ROLES), updateAvailability);

module.exports = router;

