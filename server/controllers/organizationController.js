const User = require('../models/User');
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Application = require('../models/Application');
const bcrypt = require('bcryptjs');

// @desc    Get all recruiters for the logged-in organization
// @route   GET /api/organization/recruiters
// @access  Private (organization only)
exports.getRecruiters = async (req, res) => {
    try {
        const orgUser = await User.findById(req.user.id);
        if (!orgUser.organization) {
            return res.status(400).json({ message: 'You do not belong to an organization' });
        }

        const recruiters = await User.find({
            organization: orgUser.organization,
            role: 'RECRUITER'
        }).select('-password').sort({ createdAt: -1 });

        res.json(recruiters);
    } catch (err) {
        console.error('getRecruiters error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Invite (create) a new recruiter under this organization
// @route   POST /api/organization/recruiters/invite
// @access  Private (organization only)
exports.inviteRecruiter = async (req, res) => {
    let { name, email, password } = req.body;
    email = email?.toLowerCase();

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const orgUser = await User.findById(req.user.id);
        if (!orgUser.organization) {
            return res.status(400).json({ message: 'You do not belong to an organization' });
        }

        // Check if email already taken
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'A user with this email already exists' });
        }

        // Hash password & create recruiter
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const recruiter = new User({
            name,
            email,
            password: hashedPassword,
            role: 'RECRUITER',
            organization: orgUser.organization
        });

        await recruiter.save();

        // Push into Organization.recruiters array
        await Organization.findByIdAndUpdate(orgUser.organization, {
            $push: { recruiters: recruiter._id }
        });

        // Return without password
        const safeRecruiter = recruiter.toObject();
        delete safeRecruiter.password;

        res.status(201).json(safeRecruiter);
    } catch (err) {
        console.error('inviteRecruiter error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Remove a recruiter from this organization
// @route   DELETE /api/organization/recruiters/:id
// @access  Private (organization only)
exports.removeRecruiter = async (req, res) => {
    try {
        const orgUser = await User.findById(req.user.id);
        if (!orgUser.organization) {
            return res.status(400).json({ message: 'You do not belong to an organization' });
        }

        const recruiter = await User.findById(req.params.id);
        if (!recruiter) {
            return res.status(404).json({ message: 'Recruiter not found' });
        }

        // Security: verify this recruiter belongs to the caller's organization
        if (recruiter.organization?.toString() !== orgUser.organization.toString()) {
            return res.status(403).json({ message: 'This recruiter does not belong to your organization' });
        }

        // Pull from Organization.recruiters array
        await Organization.findByIdAndUpdate(orgUser.organization, {
            $pull: { recruiters: recruiter._id }
        });

        // Delete the recruiter user
        await User.findByIdAndDelete(recruiter._id);

        res.json({ message: 'Recruiter removed successfully' });
    } catch (err) {
        console.error('removeRecruiter error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all jobs for this organization
// @route   GET /api/organization/jobs
// @access  Private (organization only)
exports.getOrgJobs = async (req, res) => {
    try {
        const orgUser = await User.findById(req.user.id);
        if (!orgUser.organization) {
            return res.status(400).json({ message: 'You do not belong to an organization' });
        }

        // Find all users (recruiters + org admins) that belong to this organization
        const teamUsers = await User.find({
            organization: orgUser.organization
        }).select('_id');
        const teamUserIds = teamUsers.map(u => u._id);

        // Fetch jobs where postedBy is in teamUserIds
        const jobs = await Job.find({ postedBy: { $in: teamUserIds } })
            .populate('postedBy', 'firstName lastName name email')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate applicantCount for each job
        const jobsWithStats = await Promise.all(
            jobs.map(async (job) => {
                const applicantCount = await Application.countDocuments({ job: job._id });
                return { ...job, applicantCount };
            })
        );

        res.json(jobsWithStats);
    } catch (err) {
        console.error('getOrgJobs error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
