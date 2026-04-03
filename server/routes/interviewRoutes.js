
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Interview = require('../models/Interview');
const Message = require('../models/Message');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getEligibleCandidates } = require('../controllers/interviewController');

// ============================
// Interview Routes
// ============================

// Schedule an Interview (Recruiter only)
router.post('/schedule', protect, authorize('RECRUITER'), async (req, res) => {
    try {
        const { candidateId, recruiterId, interviewerId, jobId, scheduledTime, notes, isDirectBooking } = req.body;

        const scheduledDate = new Date(scheduledTime);
        if (scheduledDate < new Date()) {
            return res.status(400).json({ message: 'Interview cannot be scheduled in the past' });
        }

        // If it's a direct booking by recruiter to interviewer
        const interviewData = {
            recruiterId: req.user._id,
            candidateId: candidateId || req.user._id, // Fallback if not specified
            jobId: jobId || undefined,
            interviewerId: interviewerId || undefined,
            scheduledTime: new Date(scheduledTime),
            notes: notes || '',
        };

        // If it's an interviewer booking request, status is Pending and meetingId is generated later
        // For standard candidate interviews scheduling, meetingId is generated
        if (isDirectBooking) {
            interviewData.status = 'Pending';
            interviewData.meetingId = `temp-${uuidv4()}`; // Temporary ID until accepted
        } else {
            interviewData.meetingId = uuidv4();
            interviewData.status = 'Scheduled';
        }

        const newInterview = new Interview(interviewData);

        await newInterview.save();

        const populated = await Interview.findById(newInterview._id)
            .populate('candidateId', 'name email profilePicture')
            .populate('recruiterId', 'name email profilePicture')
            .populate('interviewerId', 'name email profilePicture')
            .populate('jobId', 'title company');

        res.status(201).json(populated);
    } catch (error) {
        console.error("Scheduling Error Stack:", error);
        res.status(500).json({ message: "Failed to schedule", error: error.message });
    }
});

// Get My Interviews (For Candidate, Recruiter, and Interviewer)
router.get('/my-interviews', protect, async (req, res) => {
    try {
        let query = {};
        const role = req.user.role;

        if (role === 'RECRUITER') {
            query = { recruiterId: req.user._id };
        } else if (role === 'CANDIDATE') {
            query = { candidateId: req.user._id };
        } else {
            // Interviewer or other roles — show interviews they're involved in
            // When a recruiter books an interviewer, they pass the interviewer as candidateId (or they might pass a real candidate and the interviewer is assigned).
            // Let's broaden the query so that if the logged-in user is the candidateId, recruiterId, OR if we had an interviewerId field. 
            // In our `POST /schedule` logic, direct bookings set candidateId = interviewer.
            query = {
                $or: [
                    { recruiterId: req.user._id },
                    { candidateId: req.user._id },
                    { interviewerId: req.user._id }
                ],
            };
        }

        const interviews = await Interview.find(query)
            .populate('candidateId', 'name firstName lastName email profilePicture')
            .populate('recruiterId', 'name firstName lastName email profilePicture companyName')
            .populate('interviewerId', 'name firstName lastName email profilePicture')
            .populate('jobId', 'title company')
            .sort({ scheduledTime: -1 });

        res.json(interviews);
    } catch (err) {
        console.error('Fetch interviews error:', err);
        res.status(500).json({ message: 'Failed to fetch interviews' });
    }
});

// Get Eligible Candidates for scheduling (Recruiter only)
// IMPORTANT: This must be defined BEFORE the /:id wildcard route below.
router.get('/eligible-candidates', protect, authorize('RECRUITER'), getEligibleCandidates);

// Get Single Interview (Room validation — checks user is a participant)
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        // Search by _id or meetingId
        let interview = await Interview.findOne({
            $or: [
                ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []),
                { meetingId: id },
            ],
        })
            .populate('candidateId', 'name email profilePicture')
            .populate('recruiterId', 'name email profilePicture')
            .populate('interviewerId', 'name email profilePicture')
            .populate('jobId', 'title company');

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Validate the logged-in user is a participant
        const userId = req.user._id.toString();
        const isRecruiter = interview.recruiterId?._id?.toString() === userId;
        const isCandidate = interview.candidateId?._id?.toString() === userId;
        const isInterviewer = interview.interviewerId?._id?.toString() === userId || interview.interviewerId?.toString() === userId;
        const isAdmin = req.user.role === 'ADMIN';

        console.log(`[Interview /:id] userId=${userId} role=${req.user.role} isRecruiter=${isRecruiter} isInterviewer=${isInterviewer} isCandidate=${isCandidate}`);
        console.log(`[Interview /:id] recruiterId=${interview.recruiterId?._id} interviewerId=${interview.interviewerId?._id || interview.interviewerId}`);

        if (!isRecruiter && !isCandidate && !isInterviewer && !isAdmin) {
            return res.status(403).json({ message: 'You are not authorized to join this interview' });
        }

        // Compute host status authoritatively on the server
        const isUserHost = isRecruiter || isInterviewer || isAdmin;

        console.log(`[Interview /:id] → isUserHost=${isUserHost}`);

        res.json({ ...interview.toObject(), isUserHost });
    } catch (err) {
        console.error('Fetch interview error:', err);
        res.status(500).json({ message: 'Failed to fetch interview' });
    }
});

// Update Interview Status
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Accepted', 'Rejected', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Allow Interviewer (interviewerId in this context) to update status to Accepted/Rejected
        const userId = req.user._id.toString();
        const isRecruiter = interview.recruiterId.toString() === userId;
        const isCandidate = interview.candidateId.toString() === userId;
        const isInterviewer = interview.interviewerId?.toString() === userId;

        if (!isRecruiter && !isCandidate && !isInterviewer && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to update this interview' });
        }

        interview.status = status;

        // If accepted by an interviewer, schedule it and generate a meeting ID
        if (status === 'Accepted' && interview.meetingId.startsWith('temp-')) {
            interview.status = 'Scheduled';
            interview.meetingId = uuidv4();
        }

        await interview.save();

        const populated = await Interview.findById(interview._id)
            .populate('candidateId', 'name email profilePicture')
            .populate('recruiterId', 'name email profilePicture')
            .populate('interviewerId', 'name email profilePicture')
            .populate('jobId', 'title company');

        res.json(populated);
    } catch (err) {
        console.error('Update interview status error:', err);
        res.status(500).json({ message: 'Failed to update interview status' });
    }
});

// Delete Interview
router.delete('/:id', protect, authorize('RECRUITER'), async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        if (interview.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to delete this interview' });
        }

        await Interview.deleteOne({ _id: interview._id });
        res.json({ message: 'Interview deleted successfully' });
    } catch (err) {
        console.error('Delete interview error:', err);
        res.status(500).json({ message: 'Failed to delete interview' });
    }
});

// Submit Interview Feedback
router.post('/:id/feedback', protect, authorize('freelancer', 'INTERVIEWER', 'ADMIN', 'RECRUITER'), async (req, res) => {
    try {
        const { technicalScore, communicationScore, detailedFeedback, recommendation } = req.body;
        
        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Validate user is the assigned interviewer or recruiter
        const userId = req.user._id.toString();
        const isInterviewer = interview.interviewerId?.toString() === userId || interview.interviewerId?.toString() === req.user._id;
        const isRecruiter = interview.recruiterId.toString() === userId;

        if (!isInterviewer && !isRecruiter && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to submit feedback for this interview' });
        }

        interview.feedback = {
            technicalScore: Number(technicalScore),
            communicationScore: Number(communicationScore),
            detailedFeedback,
            recommendation
        };
        interview.status = 'Completed';

        await interview.save();
        
        res.json(interview);
    } catch (err) {
        console.error('Submit feedback error:', err);
        res.status(500).json({ message: 'Failed to submit feedback' });
    }
});

// ============================
// Message Routes
// ============================

// Send a Message
router.post('/message', protect, async (req, res) => {
    try {
        const { receiverId, content } = req.body;

        const newMessage = new Message({
            senderId: req.user._id,
            receiverId,
            content,
        });

        await newMessage.save();
        res.json(newMessage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// Get Messages (Inbox)
router.get('/my-messages', protect, async (req, res) => {
    try {
        const messages = await Message.find({ receiverId: req.user._id })
            .populate('senderId', 'name role avatar companyName')
            .sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});


// ============================
// Proctor Log — Retrieve proctoring events (Recruiter / Admin)
// ============================
router.get('/:id/proctor-log', protect, async (req, res) => {
    try {
        console.log(`[Proctor-Log] GET request for interview ${req.params.id} by user ${req.user._id}`);

        const interview = await Interview.findById(req.params.id)
            .populate('candidateId', 'name email')
            .populate('recruiterId', 'name email');

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Only recruiter, interviewer, or admin may view the proctor log
        const userId = req.user._id.toString();
        const isRecruiter = interview.recruiterId?._id?.toString() === userId;
        const isInterviewer = interview.interviewerId?.toString() === userId;
        const isAdmin = req.user.role === 'ADMIN';

        if (!isRecruiter && !isInterviewer && !isAdmin) {
            return res.status(403).json({ message: 'Only the recruiter, interviewer, or admin may view proctor logs' });
        }

        console.log(`[Proctor-Log] Returning ${interview.proctorLog?.length || 0} events for interview ${req.params.id}`);
        res.json({
            interviewId: interview._id,
            candidateName: interview.candidateId?.name || 'Unknown',
            totalEvents: interview.proctorLog?.length || 0,
            events: interview.proctorLog || [],
        });
    } catch (err) {
        console.error('[Proctor-Log] Error retrieving proctor log:', err);
        res.status(500).json({ message: 'Failed to retrieve proctor log' });
    }
});

// ============================
// Proctor Log — Persist proctoring events
// ============================
router.post('/:id/proctor-log', protect, async (req, res) => {
    try {
        const { events } = req.body;
        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({ message: 'No events provided' });
        }

        console.log(`[Proctor-Log] Received ${events.length} events for interview ${req.params.id}`);

        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Validate user is a participant
        const userId = req.user._id.toString();
        const isParticipant =
            interview.recruiterId.toString() === userId ||
            interview.candidateId.toString() === userId ||
            (interview.interviewerId && interview.interviewerId.toString() === userId);

        if (!isParticipant && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized for this interview' });
        }

        // Map and push events
        const mappedEvents = events.map(e => ({
            type: e.type,
            detail: e.detail,
            timestamp: new Date(e.timestamp),
        }));

        interview.proctorLog.push(...mappedEvents);
        await interview.save();

        console.log(`[Proctor-Log] Saved ${mappedEvents.length} events. Total: ${interview.proctorLog.length}`);
        res.json({ saved: mappedEvents.length, total: interview.proctorLog.length });
    } catch (err) {
        console.error('[Proctor-Log] Error saving proctor log:', err);
        res.status(500).json({ message: 'Failed to save proctor log' });
    }
});

module.exports = router;
