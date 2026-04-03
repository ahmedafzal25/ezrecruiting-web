const mongoose = require('mongoose');

/**
 * FreelancerService
 * A "gig" that an INTERVIEWER/freelancer publishes to the marketplace.
 * Recruiters browse these and book them directly for a specific candidate + job.
 */
const freelancerServiceSchema = new mongoose.Schema({
    freelancerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        required: true,
        maxlength: 2000,
    },
    skills: {
        type: [String],
        default: [],
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    // Duration of the interview session in minutes (e.g. 30, 45, 60)
    durationMinutes: {
        type: Number,
        default: 60,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('FreelancerService', freelancerServiceSchema);
