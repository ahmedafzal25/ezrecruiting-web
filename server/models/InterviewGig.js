const mongoose = require('mongoose');

const interviewGigSchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // Optional, maybe gig without strict job
  requiredSkills: [{ type: String }],
  status: {
    type: String,
    enum: ['open', 'assigned', 'completed'],
    default: 'open'
  },
  assignedFreelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposedDate: { type: Date, required: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InterviewGig', interviewGigSchema);
