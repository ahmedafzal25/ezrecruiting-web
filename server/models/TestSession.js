const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
    {
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CodingQuestion',
            required: true,
        },
        submittedCode: { type: String, default: '' },
        passed: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
    },
    { _id: false }
);

const testSessionSchema = new mongoose.Schema({
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    // All question IDs that have already been presented — prevents repeats
    questionsAsked: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CodingQuestion',
        },
    ],
    // One entry per answered question
    responses: {
        type: [responseSchema],
        default: [],
    },
    // Tracks the adaptive engine's current difficulty bracket
    currentDifficulty: {
        type: String,
        enum: ['very_easy', 'easy', 'medium', 'hard'],
        default: 'easy',
    },
    // Tracks the adaptive engine's preferred category for the next question
    // null means 'any category' (used at the start and after failures)
    currentCategory: {
        type: String,
        enum: ['basics', 'oop', 'dsa', null],
        default: null,
    },
    status: {
        type: String,
        enum: ['in_progress', 'completed'],
        default: 'in_progress',
    },
    finalScore: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
});

module.exports = mongoose.model('TestSession', testSessionSchema);
