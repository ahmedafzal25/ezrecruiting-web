const InterviewGig = require('../models/InterviewGig');
const Interview = require('../models/Interview');
const { v4: uuidv4 } = require('uuid');

// @desc    Get all open interview request gigs
// @route   GET /api/freelancers/gigs/open
// @access  Private (Freelancer / Interviewer)
exports.getOpenGigs = async (req, res) => {
  try {
    const gigs = await InterviewGig.find({ status: 'open' })
      .populate('jobId', 'title company location')
      .populate('recruiterId', 'name companyName profilePicture')
      .populate('candidateId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(gigs);
  } catch (error) {
    console.error('getOpenGigs error:', error);
    res.status(500).json({ message: 'Failed to fetch open gigs', error: error.message });
  }
};

// @desc    Accept an open gig and auto-schedule the interview
// @route   POST /api/freelancers/gigs/accept/:gigId
// @access  Private (Freelancer / Interviewer)
exports.acceptGig = async (req, res) => {
  try {
    const { gigId } = req.params;
    
    // Find and lock the gig
    const gig = await InterviewGig.findById(gigId);
    if (!gig) return res.status(404).json({ message: 'Gig not found' });
    if (gig.status !== 'open') return res.status(400).json({ message: 'This gig has already been assigned or closed.' });

    // Assign to freelancer
    gig.status = 'assigned';
    gig.assignedFreelancerId = req.user._id;
    await gig.save();

    // Generate WebRTC meeting
    const newInterview = new Interview({
      recruiterId: gig.recruiterId,
      candidateId: gig.candidateId,
      jobId: gig.jobId,
      interviewerId: req.user._id,
      scheduledTime: gig.proposedDate,
      notes: gig.notes || 'Interview assigned via Freelancer Gig Board.',
      meetingId: uuidv4(),
      status: 'Scheduled'
    });

    await newInterview.save();
    
    res.json({ message: 'Gig accepted successfully', gig, interview: newInterview });
  } catch (error) {
    console.error('acceptGig error:', error);
    res.status(500).json({ message: 'Failed to accept gig', error: error.message });
  }
};
