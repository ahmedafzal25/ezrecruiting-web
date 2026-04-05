const Job = require('../models/Job');
const Application = require('../models/Application');

// @desc    Get all jobs with filters
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
    try {
        const { title, location, type, minSalary, skill } = req.query;

        let query = { status: 'Active' };

        // Exclude jobs the candidate has already applied for
        if (req.user && req.user.role === 'CANDIDATE') {
            const appliedJobs = await Application.find({ candidate: req.user._id || req.user.id }).select('job');
            const appliedJobIds = appliedJobs.map(app => app.job);
            if (appliedJobIds.length > 0) {
                query._id = { $nin: appliedJobIds };
            }
        }

        if (title) {
            query.title = { $regex: title, $options: 'i' };
        }

        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }

        if (type) {
            query.type = type;
        }

        if (skill) {
            query.skills = { $in: [new RegExp(skill, 'i')] };
        }

        // Note: Salary filtering is tricky with string. Skipping complex range for now.

        const jobs = await Job.find(query).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('postedBy', 'name email companyName');
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get jobs posted by current user (Recruiter)
// @route   GET /api/jobs/my-jobs
// @access  Private
exports.getMyJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ postedBy: req.user.id })
            .populate('applicants', 'name email profilePicture headline skills experience resume')
            .sort({ createdAt: -1 })
            .lean();

        const jobsWithCounts = await Promise.all(jobs.map(async (job) => {
            const count = await Application.countDocuments({ job: job._id });
            return {
                ...job,
                applicantCount: count
            };
        }));

        res.json(jobsWithCounts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a job
// @route   POST /api/jobs
// @access  Private (Recruiter/Admin)
exports.createJob = async (req, res) => {
    try {
        const { title, description, requirements, company, location, type, salary, skills } = req.body;

        const job = new Job({
            title,
            description,
            requirements,
            company: company || (req.user.organization ? 'Organization' : 'Company'), // Fallback
            location,
            type,
            salary,
            skills,
            skills,
            postedBy: req.user.id // Ensure this is matching the Recruiter's ID
        });

        await job.save();
        res.status(201).json(job);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Apply to a job
// @route   POST /api/jobs/:id/apply
// @access  Private (Candidate)
exports.applyJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ message: 'Job not found' });

        // Check if already applied
        const existingApplication = await Application.findOne({
            job: job._id,
            candidate: req.user.id
        });

        if (existingApplication) {
            return res.status(400).json({ message: 'Already applied to this job' });
        }

        // Get user resume from profile (optional snapshot)
        const User = require('../models/User');
        const Profile = require('../models/Profile');

        const user = await User.findById(req.user.id).populate('profile');
        let profileData = {};

        if (user.profile) {
            // If profile is populated (it might be just an ID if not fully populated by User find, but here we used populate)
            // Ideally we need to fetch Profile document if population fails or is partial, but let's assume valid.
            // Actually, wait, user.profile in User model is ref. 
            // We need to ensuring we have the profile document.
            if (user.profile._id) {
                // It's likely an object now due to populate
                profileData = user.profile;
            } else {
                // Fallback if populate didn't work as expected or if it's just an ID
                profileData = await Profile.findById(user.profile);
            }
        }

        const application = new Application({
            job: job._id,
            candidate: req.user.id,
            resume: user.resumeUrl || (profileData ? profileData.resume : null),
            experience: profileData ? profileData.experience : [],
            education: profileData ? profileData.education : [],
            skills: profileData ? profileData.skills : []
        });

        await application.save();

        // Add to Job applicants
        job.applicants.push(req.user.id);
        await job.save();

        res.status(201).json({ message: 'Application submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update application status
// @route   PUT /api/jobs/applications/:id/status
// @access  Private (Recruiter)
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const application = await Application.findById(req.params.id).populate('job');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Verify that the user owns the job
        // We need to check if application.job.postedBy equals req.user.id
        // However, we populated 'job', so job is an object.
        // We assume job was populated. If not, we'd need to fetch it.
        // Wait, I populated it above.

        // Check ownership: Either the Recruiter who posted it, OR the Freelancer who accepted the delegation
        const isRecruiter = application.job.postedBy?.toString() === req.user.id;
        const isDelegatedFreelancer = application.job.delegatedFreelancerId?.toString() === req.user.id && application.job.delegationStatus === 'accepted';

        if (!isRecruiter && !isDelegatedFreelancer) {
            return res.status(401).json({ message: 'Not authorized to update this pipeline' });
        }

        application.status = status;
        await application.save();

        res.json(application);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get applications received for jobs posted by current user OR delegated to current user
// @route   GET /api/jobs/applications/received
// @access  Private (Recruiter / Interviewer)
exports.getMyReceivedApplications = async (req, res) => {
    try {
        // 1. Branch query based on role
        const isFreelancer = req.user.role === 'freelancer' || req.user.role === 'INTERVIEWER';
        const jobQuery = isFreelancer 
            ? { delegatedFreelancerId: req.user.id, delegationStatus: 'accepted' }
            : { postedBy: req.user.id, status: 'Active' }; // Recruiters only see active (non-closed) jobs

        const jobs = await Job.find(jobQuery).select('_id');
        const jobIds = jobs.map(job => job._id);

        // 2. Find applications for these jobs
        // 2. Find applications for these jobs
        const applications = await Application.find({ job: { $in: jobIds } })
            .populate({
                path: 'candidate',
                select: 'name email profilePicture headline resumeUrl', // Select only fields that exist on User
                populate: { path: 'profile' } // Get full profile data (experience, etc.) from here
            })
            .populate('job', 'title')
            .sort({ appliedAt: -1 })
            .lean();

        // Attach external AI test and interview results so the Freelancer can package them
        const Interview = require('../models/Interview');
        const TestSession = require('../models/TestSession');

        for (let app of applications) {
            if (!app.candidate) continue;

            const interview = await Interview.findOne({
                jobId: app.job._id,
                candidateId: app.candidate._id,
                status: 'Completed'
            }).sort({ createdAt: -1 }).lean();

            if (interview) {
                app.aiInterviewReport = interview.aiEvaluation || null;
                app.aiAnalysis = interview.feedback ? interview.feedback.detailedFeedback : null;
            }

            const testSession = await TestSession.findOne({
                jobId: app.job._id,
                candidateId: app.candidate._id,
                status: 'completed'
            }).populate('responses.questionId', 'title category').sort({ completedAt: -1 }).lean();

            if (testSession) {
                app.codingTestResults = {
                    finalScore: testSession.finalScore,
                    difficultyReached: testSession.currentDifficulty,
                    responses: testSession.responses.map(r => ({
                        question: r.questionId?.title || 'Unknown',
                        category: r.questionId?.category || 'Unknown',
                        passed: r.passed,
                        score: r.score
                    }))
                };
            }
        }

        res.json(applications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT-BASED DELEGATION
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Delegate a job pipeline to a freelancer
// @route   POST /api/jobs/:jobId/delegate
// @access  Private (Recruiter — must own the job)
exports.delegateJobToFreelancer = async (req, res) => {
    try {
        const { freelancerId } = req.body;

        if (!freelancerId) {
            return res.status(400).json({ message: 'freelancerId is required' });
        }

        const job = await Job.findById(req.params.jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Verify ownership — only the recruiter who posted this job can delegate it
        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized — you do not own this job' });
        }

        // Prevent re-delegation if already pending or accepted
        if (job.delegationStatus === 'pending' || job.delegationStatus === 'accepted') {
            return res.status(400).json({
                message: `Job is already ${job.delegationStatus} for delegation`
            });
        }

        // Verify the freelancer exists and has the right role
        const User = require('../models/User');
        const freelancer = await User.findById(freelancerId);
        if (!freelancer) {
            return res.status(404).json({ message: 'Freelancer not found' });
        }
        if (freelancer.role !== 'freelancer' && freelancer.role !== 'INTERVIEWER') {
            return res.status(400).json({ message: 'Target user is not a freelancer' });
        }

        // Update delegation fields
        job.delegatedFreelancerId = freelancerId;
        job.delegationStatus = 'pending';
        await job.save();

        // Return the updated job with populated freelancer info
        const updatedJob = await Job.findById(job._id)
            .populate('postedBy', 'name email')
            .populate('delegatedFreelancerId', 'name email profilePicture');

        res.json({ message: 'Job delegated successfully', job: updatedJob });
    } catch (err) {
        console.error('delegateJobToFreelancer error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all delegated jobs in 'reviewing' state for the recruiter
// @route   GET /api/jobs/delegations/reviewing
// @access  Private (Recruiter)
exports.getReviewingDelegations = async (req, res) => {
    try {
        const jobs = await Job.find({
            postedBy: req.user.id,
            delegationStatus: 'reviewing'
        })
            .populate('delegatedFreelancerId', 'name email profilePicture')
            .populate({
                path: 'proposedCandidateId',
                select: 'name email profilePicture resumeUrl',
                populate: { path: 'profile' }
            })
            .sort({ createdAt: -1 })
            .lean();

        res.json(jobs);
    } catch (err) {
        console.error('getReviewingDelegations error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve a proposed hire from a delegated freelancer
// @route   PUT /api/jobs/delegations/:jobId/approve
// @access  Private (Recruiter — must own the job)
exports.approveDelegatedHire = async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized — you do not own this job' });
        }

        if (job.delegationStatus !== 'reviewing') {
            return res.status(400).json({ message: `Cannot approve — delegation status is '${job.delegationStatus}'` });
        }

        // Mark as completed
        job.delegationStatus = 'completed';
        job.status = 'Closed';
        await job.save();

        // Update the Application status to 'Hired' for the proposed candidate
        const applicationModel = require('../models/Application');
        if (job.proposedCandidateId) {
            await applicationModel.findOneAndUpdate(
                { job: job._id, candidate: job.proposedCandidateId },
                { status: 'Hired' }
            );
            // Reject all OTHER applicants for this job (bulk update)
            await applicationModel.updateMany(
                { job: job._id, candidate: { $ne: job.proposedCandidateId }, status: { $ne: 'Hired' } },
                { status: 'Rejected' }
            );
        }

        // Notify the freelancer
        const Message = require('../models/Message');
        if (job.delegatedFreelancerId) {
            await Message.create({
                senderId: req.user._id,
                receiverId: job.delegatedFreelancerId,
                content: `Great news! The recruiter approved your proposed candidate for the "${job.title}" role. The project is now complete.`
            });
        }

        res.json({ message: 'Hire approved successfully. Job closed.', job });
    } catch (err) {
        console.error('approveDelegatedHire error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all hired candidates from the recruiter's closed jobs
// @route   GET /api/jobs/hirings/new
// @access  Private (Recruiter)
exports.getNewHirings = async (req, res) => {
    try {
        // Find closed jobs posted by this recruiter that have a hired candidate
        const closedJobs = await Job.find({
            postedBy: req.user.id,
            status: 'Closed',
            proposedCandidateId: { $ne: null }
        })
            .populate('proposedCandidateId', 'name email profilePicture headline profile')
            .populate('delegatedFreelancerId', 'name email profilePicture')
            .sort({ updatedAt: -1 })
            .lean();

        // Shape the data into a clean hiring record
        const hirings = closedJobs.map(job => ({
            jobId: job._id,
            jobTitle: job.title,
            company: job.company,
            closedAt: job.updatedAt || job.createdAt,
            candidate: job.proposedCandidateId,
            recommendedBy: job.delegatedFreelancerId,
            freelancerReport: job.freelancerFinalReport || '',
            aiSummary: job.aiEvaluationSummary || {},
        }));

        res.json(hirings);
    } catch (err) {
        console.error('getNewHirings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all closed/past jobs for the recruiter
// @route   GET /api/jobs/past-jobs
// @access  Private (Recruiter)
exports.getPastJobs = async (req, res) => {
    try {
        const jobs = await Job.find({
            postedBy: req.user.id,
            status: 'Closed'
        })
            .populate('proposedCandidateId', 'name email profilePicture')
            .sort({ updatedAt: -1 })
            .lean();

        res.json(jobs);
    } catch (err) {
        console.error('getPastJobs error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
