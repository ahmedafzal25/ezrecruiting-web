
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Common Fields
  name: { type: String, required: true }, // Full name
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['ADMIN', 'organization', 'RECRUITER', 'CANDIDATE', 'INTERVIEWER', 'freelancer'],
    default: 'CANDIDATE'
  },

  // Freelancer / Interviewer specifics embedded directly
  skills: [String],
  hourlyRate: { type: Number },
  bio: { type: String },
  averageRating: { type: Number, default: 0 },
  experience: [{
    designation: { type: String, required: true },
    company: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String }, // empty indicates "Present"
    work: { type: String }
  }],
  projects: [{
    title: { type: String, required: true },
    role: { type: String },
    link: { type: String },
    description: { type: String }
  }],

  // Organization Link (For Org Admin & Recruiters)
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },

  // Profile Link
  profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },

  // Freelancer Approval Status
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: function () {
      return this.role === 'INTERVIEWER' ? 'PENDING' : 'APPROVED';
    }
  },

  profilePicture: { type: String, default: null },
  resumeUrl: { type: String }, // Store resume URL directly on User model
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
