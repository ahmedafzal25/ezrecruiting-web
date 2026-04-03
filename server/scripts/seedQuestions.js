const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CodingQuestion = require('../models/CodingQuestion');

dotenv.config({ path: '../.env' }); // Load env variables

const leetCodeStyleQuestions = [
    {
        title: "Warehouse Inventory Match",
        description: "Alice is managing a large warehouse. She has a target total weight of items to ship and a list of individual item weights. She needs to know the exact indices of two items that add up perfectly to her target weight.\n\nDo not use print() or read inputs. Just complete the function and return the indices as a list.\n\nExample:\nWeights: [2, 7, 11, 15]\nTarget: 9\nOutput: [0, 1]",
        difficulty: "easy",
        category: "basics",
        starterCode: "def find_items(weights, target):\n    # Write your code here\n    pass",
        functionName: "find_items",
        visibleTestCases: [
            { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
            { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" }
        ],
        hiddenTestCases: [
            { input: "[3, 3], 6", expectedOutput: "[0, 1]" },
            { input: "[10, 20, 30, 40, 50], 90", expectedOutput: "[3, 4]" }
        ]
    },
    {
        title: "Spaceship Trajectory",
        description: "A spaceship needs to calculate if its current trajectory reading is a perfect palindrome. The navigation system provides a string `s`. Return `True` if it reads the same forwards and backwards (ignoring spaces and case), or `False` otherwise.\n\nDo not use print() or read inputs. Just complete the function and return the boolean result.\n\nExample:\nInput: 'racecar'\nOutput: True",
        difficulty: "medium",
        category: "basics",
        starterCode: "def check_trajectory(s):\n    # Write your code here\n    pass",
        functionName: "check_trajectory",
        visibleTestCases: [
            { input: "'racecar'", expectedOutput: "True" },
            { input: "'hello orbit'", expectedOutput: "False" }
        ],
        hiddenTestCases: [
            { input: "'A man a plan a canal Panama'", expectedOutput: "True" },
            { input: "' '", expectedOutput: "True" }
        ]
    },
    {
        title: "Energy Grid Optimization",
        description: "The city's central energy grid is failing! You are given an array of power surges (`nums`). You need to find the contiguous subarray that contains the maximum power sum and return that sum to stabilize the grid.\n\nDo not use print() or read inputs. Just complete the function and return the integer sum.\n\nExample:\nInput: [-2, 1, -3, 4, -1, 2, 1, -5, 4]\nOutput: 6",
        difficulty: "hard",
        category: "dsa",
        starterCode: "def max_power_surge(nums):\n    # Write your code here\n    pass",
        functionName: "max_power_surge",
        visibleTestCases: [
            { input: "[-2, 1, -3, 4, -1, 2, 1, -5, 4]", expectedOutput: "6" },
            { input: "[1]", expectedOutput: "1" }
        ],
        hiddenTestCases: [
            { input: "[5, 4, -1, 7, 8]", expectedOutput: "23" },
            { input: "[-1, -2, -3, -4]", expectedOutput: "-1" }
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
