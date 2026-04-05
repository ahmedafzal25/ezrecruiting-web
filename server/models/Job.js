const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: String },
    company: { type: String, required: true },
    location: { type: String, required: true },
    type: {
        type: String,
        enum: ['Full-time', 'Contract', 'Part-time', 'Remote'],
        default: 'Full-time'
    },
    salary: { type: String },
    skills: [String],
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
        type: String,
        enum: ['Active', 'Closed'],
        default: 'Active'
    },
    // ── Project-Based Delegation ──────────────────────────────────────────────
    delegatedFreelancerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    delegationStatus: {
        type: String,
        enum: ['none', 'pending', 'accepted', 'reviewing', 'completed'],
        default: 'none'
    },
    proposedCandidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    freelancerFinalReport: { type: String, default: '' },
    aiEvaluationSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
