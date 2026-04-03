const User = require('../models/User');

// @desc    Get Freelancer Public Profile
// @route   GET /api/recruiter/freelancers/:id
// @access  Private (Recruiter/Org roles)
exports.getFreelancerPublicProfile = async (req, res) => {
    try {
        const freelancer = await User.findById(req.params.id)
            .select('-password -email -balance -role');

        if (!freelancer) {
            return res.status(404).json({ message: 'Freelancer not found' });
        }

        // Security layer: ensure the freelancer is approved before showing their profile explicitly
        if (freelancer.approvalStatus !== 'APPROVED') {
            return res.status(403).json({ message: 'This freelancer profile is not currently active.' });
        }

        res.json(freelancer);
    } catch (error) {
        console.error('[RecruiterController] getFreelancer error:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};
