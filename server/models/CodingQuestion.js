const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema(
    {
        // required: true rejects empty strings in Mongoose, but empty stdin is valid
        // (e.g. a "Hello World" program takes no input).
        // Use a custom validator that only rejects null / undefined.
        input: {
            type: String,
            validate: {
                validator: (v) => v !== null && v !== undefined,
                message: 'input must be a string (empty string is allowed)',
            },
            default: '',
        },
        expectedOutput: { type: String, required: true },
    },
    { _id: false } // No separate _id needed for sub-documents
);

const codingQuestionSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    starterCode: { type: String, required: true },
    functionName: { type: String, required: true },
    difficulty: {
        type: String,
        enum: ['very_easy', 'easy', 'medium', 'hard'],
        required: true,
    },
    category: {
        type: String,
        enum: ['basics', 'oop', 'dsa'],
        required: true,
    },
    // Shown to the candidate during the test
    visibleTestCases: {
        type: [testCaseSchema],
        default: [],
    },
    // Used internally for scoring; never exposed to the candidate
    hiddenTestCases: {
        type: [testCaseSchema],
        default: [],
    },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
