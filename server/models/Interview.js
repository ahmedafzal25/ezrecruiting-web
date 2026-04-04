
const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  scheduledTime: { type: Date, required: true },
  meetingId: { type: String, unique: true, required: true },
  status: {
    type: String,
    default: 'Pending',
    enum: ['Pending', 'Accepted', 'Rejected', 'Scheduled', 'InProgress', 'Completed', 'Cancelled']
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Paid'],
    default: 'Unpaid'
  },
  notes: { type: String, default: '' },
  proctorLog: [{
    type: { type: String, enum: ['tab_switch', 'copy', 'paste', 'gaze', 'face_lost'] },
    detail: String,
    timestamp: Date,
  }],
  feedback: {
    technicalScore: { type: Number, min: 0, max: 100 },
    communicationScore: { type: Number, min: 0, max: 100 },
    detailedFeedback: { type: String },
    recommendation: { type: String, enum: ['Strong Hire', 'Hire', 'No Hire'] }
  },
  // ── AI Post-Interview Evaluation ──────────────────────────────────────
  codingTestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSession' },
  codingTestConducted: { type: Boolean, default: false },
  interviewerRemarks: { type: String, default: '' },
  aiEvaluation: {
    suitabilityScore: { type: Number, min: 0, max: 100 },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    redFlags: [{ type: String }],
    codingScore: { type: Number, default: 0 },
    evaluatedAt: { type: Date },
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Interview', interviewSchema);

