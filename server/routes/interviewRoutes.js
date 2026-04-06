
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Interview = require('../models/Interview');
const TestSession = require('../models/TestSession');
const Message = require('../models/Message');
const Job = require('../models/Job');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getEligibleCandidates } = require('../controllers/interviewController');

// AI Service URL from environment
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';


// ============================
// Interview Routes
// ============================

// Schedule an Interview
router.post('/schedule', protect, authorize('RECRUITER', 'INTERVIEWER', 'freelancer'), async (req, res) => {
    try {
        const { candidateId, recruiterId, interviewerId, jobId, scheduledTime, notes, isDirectBooking } = req.body;

        const scheduledDate = new Date(scheduledTime);
        if (scheduledDate < new Date()) {
            return res.status(400).json({ message: 'Interview cannot be scheduled in the past' });
        }

        let targetRecruiterId = req.user._id;

        if (jobId) {
            const job = await Job.findById(jobId);
            if (!job) {
                return res.status(404).json({ message: 'Job not found' });
            }

            const isOwner = job.postedBy && job.postedBy.toString() === req.user._id.toString();
            const isDelegated = job.delegatedFreelancerId && job.delegatedFreelancerId.toString() === req.user._id.toString();

            if (!isOwner && !isDelegated && req.user.role !== 'ADMIN') {
                return res.status(403).json({ message: 'Not authorized to schedule for this job' });
            }

            targetRecruiterId = job.postedBy;
        } else if (req.user.role === 'freelancer' || req.user.role === 'INTERVIEWER') {
            return res.status(400).json({ message: 'Job ID is required for delegated scheduling' });
        }

        if (!candidateId && !isDirectBooking) {
            return res.status(400).json({ message: 'candidateId is required' });
        }

        const isFreelancer = req.user.role === 'freelancer' || req.user.role === 'INTERVIEWER';

        // If it's a direct booking by recruiter to interviewer
        const interviewData = {
            recruiterId: targetRecruiterId,
            candidateId: candidateId, // Strict explicitly required
            jobId: jobId || undefined,
            interviewerId: isFreelancer ? req.user._id : (interviewerId || undefined),
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
            .populate('jobId', 'title company status delegationStatus')
            .sort({ scheduledTime: -1 });

        const now = new Date();
        const activeInterviews = [];
        const pastInterviews = [];

        interviews.forEach((interview) => {
            const isPastTime = new Date(interview.scheduledTime) < now;
            const isJobClosed = interview.jobId?.status === 'Closed' || interview.jobId?.delegationStatus === 'completed';
            const isStatusTerminal = ['Completed', 'Cancelled'].includes(interview.status);

            if (isPastTime || isJobClosed || isStatusTerminal) {
                pastInterviews.push(interview);
            } else {
                activeInterviews.push(interview);
            }
        });

        res.json({ activeInterviews, pastInterviews });
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

// Cancel Interview (Soft Delete — sets status to Cancelled, record persists)
router.delete('/:id', protect, authorize('RECRUITER'), async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        if (interview.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Not authorized to cancel this interview' });
        }

        // Soft delete — preserve the record, move it to history
        interview.status = 'Cancelled';
        await interview.save();

        console.log(`[Interview] Soft-cancelled interview ${interview._id} by ${req.user.name}`);
        res.json({ message: 'Interview cancelled successfully', interview });
    } catch (err) {
        console.error('Cancel interview error:', err);
        res.status(500).json({ message: 'Failed to cancel interview' });
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

// Get Conversations (grouped by contact with latest message + unread count)
router.get('/conversations', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Get all messages involving this user (sent or received)
        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }]
        })
            .populate('senderId', 'name role profilePicture')
            .populate('receiverId', 'name role profilePicture')
            .sort({ createdAt: -1 });

        // Group by contact
        const conversationMap = new Map();
        for (const msg of messages) {
            const contactId = msg.senderId._id.toString() === userId.toString()
                ? msg.receiverId._id.toString()
                : msg.senderId._id.toString();

            if (!conversationMap.has(contactId)) {
                const contact = msg.senderId._id.toString() === userId.toString()
                    ? msg.receiverId
                    : msg.senderId;

                conversationMap.set(contactId, {
                    contact,
                    lastMessage: msg,
                    unreadCount: 0
                });
            }

            // Count unread messages FROM this contact
            if (
                msg.receiverId._id.toString() === userId.toString() &&
                msg.senderId._id.toString() === contactId &&
                !msg.isRead
            ) {
                conversationMap.get(contactId).unreadCount++;
            }
        }

        const conversations = Array.from(conversationMap.values());
        res.json(conversations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch conversations' });
    }
});

// Get full message history between current user and a specific user
router.get('/messages/:userId', protect, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const otherUserId = req.params.userId;

        const messages = await Message.find({
            $or: [
                { senderId: currentUserId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: currentUserId }
            ]
        })
            .populate('senderId', 'name role profilePicture')
            .populate('receiverId', 'name role profilePicture')
            .sort({ createdAt: 1 }); // oldest first for chat view

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// Mark all messages from a specific user as read
router.put('/messages/read/:userId', protect, async (req, res) => {
    try {
        await Message.updateMany(
            { senderId: req.params.userId, receiverId: req.user._id, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'Messages marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to mark messages as read' });
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

// ============================
// Helper: Build red flags from a proctorLog array (rule-based, no LLM)
// ============================
function buildRedFlagsFromLog(proctorLog = []) {
    const counts = {};
    for (const e of proctorLog) {
        counts[e.type] = (counts[e.type] || 0) + 1;
    }

    const flags = [];

    if (counts.tab_switch > 0) {
        flags.push(
            `Candidate switched browser tabs ${counts.tab_switch} time(s) during the interview — potential use of external resources.`
        );
    }
    if (counts.copy > 0 || counts.paste > 0) {
        const c = counts.copy || 0;
        const p = counts.paste || 0;
        flags.push(
            `Clipboard activity detected: ${c} copy and ${p} paste event(s) — may indicate code was sourced externally.`
        );
    }
    if (counts.face_lost > 0) {
        flags.push(
            `Camera presence lost ${counts.face_lost} time(s) — candidate may have left the screen or covered the webcam.`
        );
    }
    if (counts.gaze > 0) {
        flags.push(
            `Off-screen gaze detected ${counts.gaze} time(s) — candidate's attention appeared to divert from the screen.`
        );
    }
    if (counts.screenshot > 0) {
        flags.push(
            `Screenshot attempt detected ${counts.screenshot} time(s) — candidate may have tried to capture interview content.`
        );
    }

    return flags;
}

// ============================
// Complete Interview — AI Report Pipeline (Phase 2 Coordinator)
// ============================
router.post('/:id/complete', protect, async (req, res) => {
    try {
        const { interviewerRemarks } = req.body;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[Complete] 🚀 Starting interview completion for ${req.params.id}`);
        console.log(`[Complete]   Triggered by: ${req.user.name} (${req.user.role})`);
        console.log(`[Complete]   Remarks length: ${(interviewerRemarks || '').length} chars`);

        // ── Step 1: Fetch and validate interview ────────────────────────────
        const interview = await Interview.findById(req.params.id)
            .populate('candidateId', 'name email')
            .populate('recruiterId', 'name email')
            .populate('interviewerId', 'name email')
            .populate('jobId', 'title company');

        if (!interview) {
            console.log(`[Complete] ❌ Interview not found: ${req.params.id}`);
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Validate the user is a host (recruiter, interviewer, or admin)
        const userId = req.user._id.toString();
        const isRecruiter = interview.recruiterId?._id?.toString() === userId;
        const isInterviewer = interview.interviewerId?._id?.toString() === userId;
        const isAdmin = req.user.role === 'ADMIN';

        if (!isRecruiter && !isInterviewer && !isAdmin) {
            console.log(`[Complete] ❌ Unauthorized: ${userId} is not a host for this interview`);
            return res.status(403).json({ message: 'Only the host (recruiter/interviewer) can complete this interview' });
        }

        console.log(`[Complete]   Candidate: ${interview.candidateId?.name || 'Unknown'}`);
        console.log(`[Complete]   Job: ${interview.jobId?.title || 'No job linked'}`);
        console.log(`[Complete]   Current status: ${interview.status}`);

        // ── Step 2: End any active coding test session ──────────────────────
        let codingScore = 0;
        let codingTestConducted = interview.codingTestConducted || false;
        let candidateCode = '';

        // Accept sessionId directly from the frontend (most reliable path)
        const { codingTestSessionId } = req.body;

        // Strategy 1: Use the sessionId from the request body or the interview document
        const directSessionId = codingTestSessionId || interview.codingTestSessionId;
        let testSession = null;

        if (directSessionId) {
            console.log(`[Complete] 🔍 Looking up coding test session by direct ID: ${directSessionId}`);
            testSession = await TestSession.findById(directSessionId);
        }

        // Strategy 2: Fallback to candidate+job lookup
        if (!testSession && interview.jobId?._id && interview.candidateId?._id) {
            console.log(`[Complete] 🔍 Falling back to candidate+job lookup...`);
            testSession = await TestSession.findOne({
                candidateId: interview.candidateId._id,
                jobId: interview.jobId._id,
            }).sort({ startedAt: -1 });
        }

        if (testSession) {
            codingTestConducted = true;
            console.log(`[Complete]   Found test session: ${testSession._id} (status: ${testSession.status})`);
            console.log(`[Complete]   Responses: ${testSession.responses.length}`);

            // Log individual response scores for debugging
            testSession.responses.forEach((r, i) => {
                console.log(`[Complete]     Response ${i + 1}: score=${r.score}, passed=${r.passed}`);
            });

            if (testSession.status === 'in_progress') {
                // Finalize the session — compute score from responses so far
                const totalScore = testSession.responses.reduce((sum, r) => sum + (r.score || 0), 0);
                testSession.finalScore = testSession.responses.length > 0
                    ? Math.round(totalScore / testSession.responses.length)
                    : 0;
                testSession.status = 'completed';
                testSession.completedAt = new Date();
                await testSession.save();

                console.log(`[Complete]   ✅ Coding test finalized. Score: ${testSession.finalScore}% (${testSession.responses.length} questions answered, total raw: ${totalScore})`);
            } else {
                console.log(`[Complete]   Coding test already completed. Score: ${testSession.finalScore}%`);
            }

            codingScore = testSession.finalScore || 0;
            interview.codingTestSessionId = testSession._id;
            interview.codingTestConducted = true;

            // Gather ALL submitted code for the AI (not just the last response)
            candidateCode = testSession.responses
                .map((r, i) => `// --- Question ${i + 1} (score: ${r.score}%) ---\n${r.submittedCode || '// No code submitted'}`)
                .join('\n\n');

            console.log(`[Complete]   Total candidate code: ${candidateCode.length} chars from ${testSession.responses.length} responses`);
        } else {
            console.log(`[Complete]   ⚠️ No coding test session found. Checked: directId=${directSessionId || 'none'}, jobId=${interview.jobId?._id || 'none'}`);
            codingTestConducted = false;
        }

        // ── Step 3: Build AI payload ────────────────────────────────────────
        const aiPayload = {
            interviewId: interview._id.toString(),
            candidateCode: candidateCode,
            codingScore: codingScore,
            codingTestConducted: codingTestConducted,
            proctorEvents: (interview.proctorLog || []).map(e => ({
                type: e.type,
                detail: e.detail || '',
                timestamp: e.timestamp ? e.timestamp.toISOString() : '',
            })),
            interviewerNotes: interviewerRemarks || interview.notes || '',
        };

        console.log(`[Complete] 📦 AI Payload built — ${aiPayload.proctorEvents.length} proctor events, code: ${aiPayload.candidateCode.length} chars`);

        // ── Step 4: Save interview as Completed + aiGenerating immediately ──
        // This lets the client navigate right away without waiting for AI.
        interview.interviewerRemarks = interviewerRemarks || '';
        interview.status = 'Completed';
        interview.aiGenerating = true;
        interview.codingTestConducted = codingTestConducted;

        await interview.save();
        console.log(`[Complete] 💾 Interview ${req.params.id} saved as Completed (AI generating in background)`);

        // ── Step 5: Respond immediately to client ────────────────────────────
        const populated = await Interview.findById(interview._id)
            .populate('candidateId', 'name email profilePicture')
            .populate('recruiterId', 'name email profilePicture')
            .populate('interviewerId', 'name email profilePicture')
            .populate('jobId', 'title company');

        res.json(populated);

        // ── Step 6: Fire-and-forget — AI evaluation runs in background ───────
        // IMPORTANT: No 'await' here — this runs after the response is sent.
        (async () => {
            console.log(`[Complete-BG] 🤖 Starting background AI evaluation for ${req.params.id}...`);
            let aiResult = null;

            try {
                const aiAbort = new AbortController();
                const aiTimeout = setTimeout(() => aiAbort.abort(), 10 * 60 * 1000); // 10 min max

                const aiResponse = await fetch(`${AI_SERVICE_URL}/api/ai/evaluate-interview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiPayload),
                    signal: aiAbort.signal,
                });

                clearTimeout(aiTimeout);

                if (!aiResponse.ok) {
                    const errText = await aiResponse.text();
                    throw new Error(`AI Service responded with ${aiResponse.status}: ${errText}`);
                }

                aiResult = await aiResponse.json();
                console.log(`[Complete-BG] ✅ AI evaluation done. Score: ${aiResult.suitabilityScore}, RedFlags: ${aiResult.redFlags?.length || 0}`);

            } catch (aiError) {
                console.error(`[Complete-BG] ⚠️ AI evaluation failed:`, aiError.message);
                // Fallback evaluation
                aiResult = {
                    suitabilityScore: codingTestConducted ? Math.max(codingScore, 10) : 50,
                    strengths: ['Interview completed successfully', 'Candidate demonstrated technical engagement'],
                    weaknesses: ['AI detailed analysis unavailable — evaluation generated from metrics'],
                    redFlags: [],
                };
            }

            // ── Generate red flags straight from the DB proctorLog ────────────
            // Re-fetch the latest proctorLog so we catch any events flushed
            // by the candidate AFTER the initial /complete call.
            
            // Give candidate's flushLogs() a 2.5s buffer to finish saving to DB
            await new Promise(r => setTimeout(r, 2500));
            
            let finalRedFlags = [];
            try {
                const freshInterview = await Interview.findById(interview._id).select('proctorLog');
                const freshLog = freshInterview?.proctorLog || [];
                finalRedFlags = buildRedFlagsFromLog(freshLog);
                console.log(`[Complete-BG] 🚩 Red flags generated from DB log: ${finalRedFlags.length} (log has ${freshLog.length} events)`);
            } catch (rfErr) {
                // Fallback: use the log we had at /complete time
                finalRedFlags = buildRedFlagsFromLog(interview.proctorLog || []);
                console.warn(`[Complete-BG] ⚠️ Could not re-fetch log, using snapshot: ${finalRedFlags.length} flags`);
            }

            // Patch the interview record with AI results + authoritative red flags
            try {
                await Interview.findByIdAndUpdate(interview._id, {
                    aiEvaluation: {
                        suitabilityScore: aiResult.suitabilityScore,
                        strengths: aiResult.strengths || [],
                        weaknesses: aiResult.weaknesses || [],
                        redFlags: finalRedFlags,          // Always from proctorLog, never from LLM
                        codingScore: codingScore,
                        evaluatedAt: new Date(),
                    },
                    aiGenerating: false,
                });
                console.log(`[Complete-BG] 💾 Interview ${req.params.id} updated. aiGenerating=false, redFlags=${finalRedFlags.length}`);
                console.log(`${'='.repeat(60)}\n`);
            } catch (saveErr) {
                console.error(`[Complete-BG] ❌ Failed to save AI evaluation:`, saveErr.message);
            }
        })();
    } catch (err) {
        console.error('[Complete] ❌ Error completing interview:', err);
        res.status(500).json({ message: 'Failed to complete interview', error: err.message });
    }
});

// ============================
// Messaging Routes
// ============================

// GET /api/interviews/conversations — Get conversations grouped by contact
router.get('/conversations', protect, async (req, res) => {
    try {
        const userId = req.user._id.toString();

        // Find all messages involving this user
        const messages = await Message.find({
            $or: [{ senderId: userId }, { receiverId: userId }]
        })
        .sort({ createdAt: -1 })
        .populate('senderId', 'name role profilePicture')
        .populate('receiverId', 'name role profilePicture');

        // Group by the other person
        const conversationMap = {};
        for (const msg of messages) {
            const otherId = msg.senderId._id.toString() === userId
                ? msg.receiverId._id.toString()
                : msg.senderId._id.toString();

            if (!conversationMap[otherId]) {
                const otherUser = msg.senderId._id.toString() === userId
                    ? msg.receiverId
                    : msg.senderId;

                conversationMap[otherId] = {
                    contact: {
                        _id: otherUser._id,
                        name: otherUser.name,
                        role: otherUser.role,
                        profilePicture: otherUser.profilePicture,
                    },
                    lastMessage: {
                        content: msg.content,
                        createdAt: msg.createdAt,
                        senderId: { _id: msg.senderId._id.toString() },
                    },
                    unreadCount: 0,
                };
            }

            // Count unread messages from the other person
            if (msg.senderId._id.toString() !== userId && !msg.isRead) {
                conversationMap[otherId].unreadCount += 1;
            }
        }

        const conversations = Object.values(conversationMap);
        res.json(conversations);
    } catch (err) {
        console.error('[Conversations] Error:', err);
        res.status(500).json({ message: 'Failed to load conversations' });
    }
});

// GET /api/interviews/messages/:userId — Get full chat history with a user
router.get('/messages/:userId', protect, async (req, res) => {
    try {
        const myId = req.user._id;
        const otherId = req.params.userId;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: otherId },
                { senderId: otherId, receiverId: myId },
            ]
        })
        .sort({ createdAt: 1 })
        .populate('senderId', 'name profilePicture')
        .populate('receiverId', 'name');

        res.json(messages);
    } catch (err) {
        console.error('[Messages] Error:', err);
        res.status(500).json({ message: 'Failed to load messages' });
    }
});

// PUT /api/interviews/messages/read/:userId — Mark all messages from userId as read
router.put('/messages/read/:userId', protect, async (req, res) => {
    try {
        await Message.updateMany(
            { senderId: req.params.userId, receiverId: req.user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[MarkRead] Error:', err);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
});

// POST /api/interviews/message — Send a new message
router.post('/message', protect, async (req, res) => {
    try {
        const { receiverId, content } = req.body;

        if (!receiverId || !content?.trim()) {
            return res.status(400).json({ message: 'receiverId and content are required' });
        }

        const message = await Message.create({
            senderId: req.user._id,
            receiverId,
            content: content.trim(),
        });

        const populated = await Message.findById(message._id)
            .populate('senderId', 'name profilePicture')
            .populate('receiverId', 'name');

        res.status(201).json(populated);
    } catch (err) {
        console.error('[SendMessage] Error:', err);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

module.exports = router;

