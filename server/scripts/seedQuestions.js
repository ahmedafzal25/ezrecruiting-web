const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CodingQuestion = require('../models/CodingQuestion');

dotenv.config({ path: '../.env' }); // Load env variables

const leetCodeStyleQuestions = [
    // --- VERY EASY ---
    {
        title: "Add Two Numbers",
        description: "Given two integers `a` and `b` separated by a space on a single line, return their sum.\n\nExample 1:\nInput: 2 3\nOutput: 5\n\nConstraints:\n- -10^4 <= a, b <= 10^4",
        difficulty: "very_easy",
        category: "basics",
        visibleTestCases: [
            { input: "2 3", expectedOutput: "5" },
            { input: "-1 1", expectedOutput: "0" }
        ],
        hiddenTestCases: [
            { input: "100 250", expectedOutput: "350" },
            { input: "-50 -50", expectedOutput: "-100" },
            { input: "0 0", expectedOutput: "0" }
        ]
    },
    {
        title: "Find Maximum Element",
        description: "Given an array of integers `nums` on a single line separated by spaces, return the maximum element.\n\nExample 1:\nInput: 1 5 3 9 2\nOutput: 9\n\nConstraints:\n- 1 <= nums.length <= 10^4\n- -10^4 <= nums[i] <= 10^4",
        difficulty: "very_easy",
        category: "basics",
        visibleTestCases: [
            { input: "1 5 3 9 2", expectedOutput: "9" },
            { input: "-5 -1 -10", expectedOutput: "-1" }
        ],
        hiddenTestCases: [
            { input: "42", expectedOutput: "42" },
            { input: "10 10 10", expectedOutput: "10" },
            { input: "0 -5 12 3", expectedOutput: "12" }
        ]
    },

    // --- EASY ---
    {
        title: "Two Sum",
        description: "Given an array of integers `nums` and an integer `target`. The first line contains the space-separated elements of `nums`. The second line contains the integer `target`. Return the indices of the two numbers such that they add up to `target`, space-separated.\n\nExample 1:\nInput:\n2 7 11 15\n9\nOutput:\n0 1\n\nConstraints:\n- 2 <= nums.length <= 10^4\n- Exactly one valid answer exists.",
        difficulty: "easy",
        category: "basics",
        visibleTestCases: [
            { input: "2 7 11 15\n9", expectedOutput: "0 1" },
            { input: "3 2 4\n6", expectedOutput: "1 2" }
        ],
        hiddenTestCases: [
            { input: "3 3\n6", expectedOutput: "0 1" },
            { input: "-1 -2 -3 -4 -5\n-8", expectedOutput: "2 4" }
        ]
    },
    {
        title: "Valid Palindrome",
        description: "Given a string `s`, return `true` if it is a palindrome, or `false` otherwise. Ignore spaces and case.\n\nExample 1:\nInput: racecar\nOutput: true\n\nConstraints:\n- 1 <= s.length <= 2 * 10^5",
        difficulty: "easy",
        category: "basics",
        visibleTestCases: [
            { input: "racecar", expectedOutput: "true" },
            { input: "hello", expectedOutput: "false" }
        ],
        hiddenTestCases: [
            { input: "A man a plan a canal Panama", expectedOutput: "true" },
            { input: " ", expectedOutput: "true" },
            { input: "0P", expectedOutput: "false" }
        ]
    },
    {
        title: "Rectangle Area",
        description: "Given the `width` and `height` of a rectangle separated by a space on the first line, print its area.\n\nExample 1:\nInput: 5 4\nOutput: 20\n\nConstraints:\n- 1 <= width, height <= 10^4",
        difficulty: "easy",
        category: "oop",
        visibleTestCases: [
            { input: "5 4", expectedOutput: "20" },
            { input: "10 10", expectedOutput: "100" }
        ],
        hiddenTestCases: [
            { input: "1 1", expectedOutput: "1" },
            { input: "99 2", expectedOutput: "198" }
        ]
    },
    {
        title: "Reverse String",
        description: "Given a string `s`, reverse it and print the reversed string.\n\nExample 1:\nInput: hello\nOutput: olleh\n\nConstraints:\n- 1 <= s.length <= 10^5",
        difficulty: "easy",
        category: "basics",
        visibleTestCases: [
            { input: "hello", expectedOutput: "olleh" },
            { input: "world", expectedOutput: "dlrow" }
        ],
        hiddenTestCases: [
            { input: "a", expectedOutput: "a" },
            { input: "reverser", expectedOutput: "resrever" }
        ]
    },

    // --- MEDIUM ---
    {
        title: "Maximum Subarray",
        description: "Given an integer array `nums` separated by spaces on a single line, find the contiguous subarray with the largest sum, and print that sum.\n\nExample 1:\nInput: -2 1 -3 4 -1 2 1 -5 4\nOutput: 6\n\nConstraints:\n- 1 <= nums.length <= 10^5\n- -10^4 <= nums[i] <= 10^4",
        difficulty: "medium",
        category: "dsa",
        visibleTestCases: [
            { input: "-2 1 -3 4 -1 2 1 -5 4", expectedOutput: "6" },
            { input: "1", expectedOutput: "1" }
        ],
        hiddenTestCases: [
            { input: "5 4 -1 7 8", expectedOutput: "23" },
            { input: "-1 -2 -3 -4", expectedOutput: "-1" }
        ]
    },
    {
        title: "Valid Parentheses",
        description: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Print `true` or `false`.\n\nExample 1:\nInput: ()[]{}\nOutput: true\n\nConstraints:\n- 1 <= s.length <= 10^4",
        difficulty: "medium",
        category: "dsa",
        visibleTestCases: [
            { input: "()[]{}", expectedOutput: "true" },
            { input: "(]", expectedOutput: "false" }
        ],
        hiddenTestCases: [
            { input: "{[]}", expectedOutput: "true" },
            { input: "([)]", expectedOutput: "false" },
            { input: "((", expectedOutput: "false" }
        ]
    },
    {
        title: "Fibonacci Number",
        description: "The Fibonacci numbers form a sequence where each number is the sum of the two preceding ones, starting from 0 and 1. Given an integer `n`, calculate `F(n)` and print it.\n\nExample 1:\nInput: 4\nOutput: 3\n\nConstraints:\n- 0 <= n <= 30",
        difficulty: "medium",
        category: "basics",
        visibleTestCases: [
            { input: "4", expectedOutput: "3" },
            { input: "2", expectedOutput: "1" }
        ],
        hiddenTestCases: [
            { input: "0", expectedOutput: "0" },
            { input: "10", expectedOutput: "55" },
            { input: "30", expectedOutput: "832040" }
        ]
    },
    {
        title: "Circle Area Estimation",
        description: "The input provides a single integer `r`, the radius of a circle. Print the area of the circle rounded down to the nearest integer. Use 3.14159 for Pi.\n\nExample 1:\nInput: 5\nOutput: 78\n\nConstraints:\n- 1 <= r <= 10^4",
        difficulty: "medium",
        category: "oop",
        visibleTestCases: [
            { input: "5", expectedOutput: "78" },
            { input: "10", expectedOutput: "314" }
        ],
        hiddenTestCases: [
            { input: "1", expectedOutput: "3" },
            { input: "100", expectedOutput: "31415" }
        ]
    },

    // --- HARD ---
    {
        title: "Merge Intervals",
        description: "Given an array of intervals where each interval is represented by two integers separated by a comma, and intervals are separated by spaces. Merge all overlapping intervals and print them in the same format.\n\nExample 1:\nInput: 1,3 2,6 8,10 15,18\nOutput: 1,6 8,10 15,18\n\nConstraints:\n- 1 <= intervals.length <= 10^4",
        difficulty: "hard",
        category: "dsa",
        visibleTestCases: [
            { input: "1,3 2,6 8,10 15,18", expectedOutput: "1,6 8,10 15,18" },
            { input: "1,4 4,5", expectedOutput: "1,5" }
        ],
        hiddenTestCases: [
            { input: "1,4 2,3", expectedOutput: "1,4" },
            { input: "1,10 2,3 4,5 6,7 8,9", expectedOutput: "1,10" }
        ]
    },
    {
        title: "Find Minimum in Rotated Sorted Array",
        description: "Suppose an array of length `n` sorted in ascending order is rotated between 1 and `n` times. Given the sorted rotated array `nums` of unique elements separated by spaces, print the minimum element.\n\nExample 1:\nInput: 3 4 5 1 2\nOutput: 1\n\nConstraints:\n- 1 <= nums.length <= 5000\n- All integers in nums are unique",
        difficulty: "hard",
        category: "dsa",
        visibleTestCases: [
            { input: "3 4 5 1 2", expectedOutput: "1" },
            { input: "4 5 6 7 0 1 2", expectedOutput: "0" }
        ],
        hiddenTestCases: [
            { input: "11 13 15 17", expectedOutput: "11" },
            { input: "2 1", expectedOutput: "1" }
        ]
    }
];

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/procruit_db');

        console.log('Connected to Database. Clearing old coding questions...');
        await CodingQuestion.deleteMany({});
        
        console.log('Seeding 12 LeetCode-style questions...');
        await CodingQuestion.insertMany(leetCodeStyleQuestions);

        console.log('✅ Successfully seeded new coding questions!');
        process.exit();
    } catch (error) {
        console.error('❌ Failed to seed the database:', error);
        process.exit(1);
    }
};

seedDatabase();
