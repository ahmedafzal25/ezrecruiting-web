const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 (Sun) to 6 (Sat)
  startTime: { type: String, required: true }, // e.g., '09:00'
  endTime: { type: String, required: true }, // e.g., '17:00'
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
