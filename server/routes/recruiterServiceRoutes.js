/**
 * Recruiter Service Marketplace Routes
 * GET  /api/recruiter/services          — browse all active freelancer services
 * POST /api/recruiter/services/:id/book — book a service → creates Interview document
 */
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const FreelancerService = require('../models/FreelancerService');
const Interview = require('../models/Interview');
const { v4: uuidv4 } = require('uuid');
const { getFreelancerPublicProfile } = require('../controllers/recruiterController');

const RECRUITER_ROLES = ['RECRUITER', 'organization', 'ORG_ADMIN', 'ADMIN'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/recruiter/services
// Browse all active freelancer service listings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services', protect, authorize(...RECRUITER_ROLES), async (req, res) => {
    try {
        const { skill, maxPrice, minPrice } = req.query;

        const filter = { isActive: true };
        if (skill) {
            // Case-insensitive partial skill match
            filter.skills = { $elemMatch: { $regex: skill, $options: 'i' } };
        }
        if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };
        if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };

        const services = await FreelancerService.find(filter)
            .populate('freelancerId', 'name profilePicture averageRating bio skills')
            .sort({ createdAt: -1 });

        res.json(services);
    } catch (error) {
        console.error('[RecruiterServices] browseServices error:', error);
        res.status(500).json({ message: 'Failed to fetch services', error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/recruiter/freelancers/:id
// Get a specific freelancer's public profile (read-only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/freelancers/:id', protect, authorize(...RECRUITER_ROLES), getFreelancerPublicProfile);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/recruiter/services/:serviceId/book
// Body: { candidateId, jobId, scheduledTime, notes }
// Logic: Creates an Interview document using the freelancer attached to the service.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/services/:serviceId/book', protect, authorize(...RECRUITER_ROLES), async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { candidateId, jobId, scheduledTime, notes } = req.body;

        if (!candidateId || !scheduledTime) {
            return res.status(400).json({ message: 'candidateId and scheduledTime are required' });
        }

        // Validate service exists and is active
        const service = await FreelancerService.findById(serviceId).populate('freelancerId', 'name');
        if (!service) return res.status(404).json({ message: 'Service not found' });
        if (!service.isActive) return res.status(400).json({ message: 'This service is no longer available' });

        // Validate scheduled time is in the future
        const scheduledDate = new Date(scheduledTime);
        if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            return res.status(400).json({ message: 'scheduledTime must be a valid future date' });
        }

        // Create the WebRTC interview room using the freelancer as the host interviewer
        const interview = await Interview.create({
            recruiterId:  req.user._id,           // The recruiter who booked
            candidateId,                          // The candidate being interviewed
            interviewerId: service.freelancerId,  // The freelancer who owns the service
            jobId:         jobId || undefined,
            scheduledTime: scheduledDate,
            meetingId:     `temp-${uuidv4()}`,    // Temporary ID until accepted
            status:        'Pending',
            notes: notes || `Booked via service: "${service.title}"`,
        });

        await interview.populate([
            { path: 'candidateId',  select: 'name email' },
            { path: 'interviewerId', select: 'name email profilePicture' },
            { path: 'jobId',        select: 'title company' },
        ]);

        console.log(`[RecruiterServices] Interview booking request ${interview._id} sent. ` +
            `Recruiter: ${req.user._id} | Freelancer: ${service.freelancerId._id} | Service: "${service.title}"`);

        res.status(201).json({
            message: 'Booking request sent to freelancer.',
            interview,
            service: { title: service.title, price: service.price },
        });
    } catch (error) {
        console.error('[RecruiterServices] bookService error:', error);
        res.status(500).json({ message: 'Failed to book service', error: error.message });
    }
});

module.exports = router;
