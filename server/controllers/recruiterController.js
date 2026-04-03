const User = require('../models/User');

// @desc    Get Freelancer Public Profile
// @route   GET /api/recruiter/freelancers/:id
// @access  Private (Recruiter/Org roles)
exports.getFreelancerPublicProfile = async (req, res) => {
    try {
        const freelancer = await User.findById(req.params.id)
            .select('-password -email -balance');

        if (!freelancer) {
            return res.status(404).json({ message: 'Freelancer not found' });
        }

        // Security layer: ensure the user is actually a freelancer/interviewer
        if (freelancer.role !== 'freelancer' && freelancer.role !== 'INTERVIEWER') {
            return res.status(403).json({ message: 'Freelancer profile not found or inactive' });
        }

        // Strip role if needed, or simply return it
        res.json(freelancer);
    } catch (error) {
        console.error('[RecruiterController] getFreelancer error:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};
