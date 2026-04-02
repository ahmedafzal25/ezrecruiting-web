const FreelancerService = require('../models/FreelancerService');
const InterviewGig = require('../models/InterviewGig'); // legacy — kept for old gig routes
const Interview = require('../models/Interview');
const Message = require('../models/Message');
const User = require('../models/User');
const Availability = require('../models/Availability');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE MARKETPLACE — Freelancer Side
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Create a new service listing
// @route   POST /api/freelancers/services
// @access  Private (freelancer | INTERVIEWER)
exports.createService = async (req, res) => {
  try {
    const { title, description, skills, price, durationMinutes } = req.body;
    if (!title || !description || price === undefined) {
      return res.status(400).json({ message: 'title, description, and price are required' });
    }

    const service = await FreelancerService.create({
      freelancerId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      skills: Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(Boolean),
      price: Number(price),
      durationMinutes: Number(durationMinutes) || 60,
    });

    res.status(201).json(service);
  } catch (error) {
    console.error('createService error:', error);
    res.status(500).json({ message: 'Failed to create service', error: error.message });
  }
};

// @desc    Get all services published by current freelancer
// @route   GET /api/freelancers/services
// @access  Private (freelancer | INTERVIEWER)
exports.getMyServices = async (req, res) => {
  try {
    const services = await FreelancerService.find({ freelancerId: req.user._id }).sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error('getMyServices error:', error);
    res.status(500).json({ message: 'Failed to fetch services', error: error.message });
  }
};

// @desc    Update a service listing
// @route   PUT /api/freelancers/services/:serviceId
// @access  Private (freelancer | INTERVIEWER — must own service)
exports.updateService = async (req, res) => {
  try {
    const service = await FreelancerService.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });
    if (service.freelancerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this service' });
    }

    const { title, description, skills, price, durationMinutes, isActive } = req.body;
    if (title !== undefined)           service.title = title.trim();
    if (description !== undefined)     service.description = description.trim();
    if (skills !== undefined)          service.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
    if (price !== undefined)           service.price = Number(price);
    if (durationMinutes !== undefined) service.durationMinutes = Number(durationMinutes);
    if (isActive !== undefined)        service.isActive = Boolean(isActive);

    await service.save();
    res.json(service);
  } catch (error) {
    console.error('updateService error:', error);
    res.status(500).json({ message: 'Failed to update service', error: error.message });
  }
};

// @desc    Delete a service listing
// @route   DELETE /api/freelancers/services/:serviceId
// @access  Private (freelancer | INTERVIEWER — must own service)
exports.deleteService = async (req, res) => {
  try {
    const service = await FreelancerService.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });
    if (service.freelancerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this service' });
    }
    await service.deleteOne();
    res.json({ message: 'Service deleted' });
  } catch (error) {
    console.error('deleteService error:', error);
    res.status(500).json({ message: 'Failed to delete service', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING REQUESTS — Accept / Reject
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Accept a booking request
// @route   PUT /api/freelancers/requests/:id/accept
// @access  Private (freelancer | INTERVIEWER)
exports.acceptRequest = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name')
      .populate('recruiterId', 'name');

    if (!interview) return res.status(404).json({ message: 'Request not found' });
    
    // Ensure the current user is the assigned interviewer
    if (interview.interviewerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }

    interview.status = 'Scheduled';
    if (interview.meetingId.startsWith('temp-')) {
        interview.meetingId = uuidv4();
    }
    await interview.save();

    // Send a system message/notification to the recruiter
    const candidateName = interview.candidateId?.name || 'the candidate';
    await Message.create({
      senderId: req.user._id,
      receiverId: interview.recruiterId._id,
      content: `Freelancer ${req.user.name} accepted your interview request for ${candidateName}.`
    });

    res.json({ message: 'Request accepted successfully', interview });
  } catch (error) {
    console.error('acceptRequest error:', error);
    res.status(500).json({ message: 'Failed to accept request', error: error.message });
  }
};

// @desc    Reject a booking request
// @route   PUT /api/freelancers/requests/:id/reject
// @access  Private (freelancer | INTERVIEWER)
exports.rejectRequest = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('candidateId', 'name')
      .populate('recruiterId', 'name');

    if (!interview) return res.status(404).json({ message: 'Request not found' });

    if (interview.interviewerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }

    interview.status = 'Rejected';
    await interview.save();

    const candidateName = interview.candidateId?.name || 'the candidate';
    await Message.create({
      senderId: req.user._id,
      receiverId: interview.recruiterId._id,
      content: `Freelancer ${req.user.name} declined your interview request for ${candidateName}.`
    });

    res.json({ message: 'Request rejected successfully', interview });
  } catch (error) {
    console.error('rejectRequest error:', error);
    res.status(500).json({ message: 'Failed to reject request', error: error.message });
  }
};


// @desc    Get all open interview request gigs
// @route   GET /api/freelancers/gigs/open
// @access  Private (Freelancer / Interviewer)
exports.getOpenGigs = async (req, res) => {
  try {
    const gigs = await InterviewGig.find({ status: 'open' })
      .populate('jobId', 'title company location')
      .populate('recruiterId', 'name firstName lastName companyName profilePicture')
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

// @desc    Update freelancer profile (bio, skills, rate)
// @route   PUT /api/freelancers/profile
// @access  Private (Freelancer)
exports.updateProfile = async (req, res) => {
  try {
    const { bio, skills, hourlyRate, experience, projects } = req.body;
    
    // Double-Validate Experience dates
    if (experience && Array.isArray(experience)) {
      for (const exp of experience) {
        if (exp.startDate) {
          if (new Date(exp.startDate) > new Date()) {
            return res.status(400).json({ message: 'Start date cannot be in the future.' });
          }
          if (exp.endDate && new Date(exp.endDate) < new Date(exp.startDate)) {
            return res.status(400).json({ message: 'End date cannot be before the start date.' });
          }
        }
      }
    }

    // Build update object dynamically
    const updateFields = { bio, skills, hourlyRate };
    if (experience !== undefined) updateFields.experience = experience;
    if (projects !== undefined) updateFields.projects = projects;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true }
    ).select('-password');
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

// @desc    Update freelancer availability
// @route   POST /api/freelancers/availability
// @access  Private (Freelancer)
exports.updateAvailability = async (req, res) => {
  try {
    const { timeSlots } = req.body; // Array of { dayOfWeek, startTime, endTime }

    // Clear old availability
    await Availability.deleteMany({ freelancerId: req.user._id });

    // Insert new slots
    const newSlots = timeSlots.map(slot => ({
      ...slot,
      freelancerId: req.user._id
    }));

    if (newSlots.length > 0) {
      await Availability.insertMany(newSlots);
    }

    res.json({ message: 'Availability updated successfully' });
  } catch (error) {
    console.error('updateAvailability error:', error);
    res.status(500).json({ message: 'Failed to update availability', error: error.message });
  }
};

// @desc    Get freelancer availability
// @route   GET /api/freelancers/availability
// @access  Private (Freelancer)
exports.getAvailability = async (req, res) => {
  try {
    const slots = await Availability.find({ freelancerId: req.user._id });
    res.json(slots);
  } catch (error) {
    console.error('getAvailability error:', error);
    res.status(500).json({ message: 'Failed to fetch availability', error: error.message });
  }
};

