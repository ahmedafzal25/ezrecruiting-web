/**
 * Seed Script — Coding Questions
 * Run from the /server directory:
 *   node scripts/seedCodingQuestions.js
 */

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const CodingQuestion = require('../models/CodingQuestion');

const questions = [
  // ─────────────────────────────────────────────────────────────
  // VERY EASY — basics
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Print Hello World',
    difficulty: 'very_easy',
    category: 'basics',
    description:
      'Write a Python program that prints exactly: `Hello, World!`\n\nYour code should output the string on a single line.',
    visibleTestCases: [
      { input: '', expectedOutput: 'Hello, World!' },
    ],
    hiddenTestCases: [
      { input: '', expectedOutput: 'Hello, World!' },
      { input: '', expectedOutput: 'Hello, World!' },
      { input: '', expectedOutput: 'Hello, World!' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // VERY EASY — oop
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Simple Dog Class',
    difficulty: 'very_easy',
    category: 'oop',
    description:
      'Define a class `Dog` with a constructor that accepts `name` (string).\n' +
      'Add a method `speak()` that returns the string `"<name> says: Woof!"`.\n\n' +
      'Read a name from stdin, create a `Dog`, and print `dog.speak()`.',
    visibleTestCases: [
      { input: 'Buddy', expectedOutput: 'Buddy says: Woof!' },
    ],
    hiddenTestCases: [
      { input: 'Max',   expectedOutput: 'Max says: Woof!' },
      { input: 'Bella', expectedOutput: 'Bella says: Woof!' },
      { input: 'Rocky', expectedOutput: 'Rocky says: Woof!' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // VERY EASY — dsa
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Find the Maximum',
    difficulty: 'very_easy',
    category: 'dsa',
    description:
      'Given a list of integers on a single line separated by spaces, print the maximum value.\n\n' +
      'Example input: `3 1 4 1 5 9 2 6`\nExpected output: `9`',
    visibleTestCases: [
      { input: '3 1 4 1 5 9 2 6', expectedOutput: '9' },
      { input: '10 20 5',          expectedOutput: '20' },
    ],
    hiddenTestCases: [
      { input: '-3 -1 -7',         expectedOutput: '-1' },
      { input: '0 0 0',            expectedOutput: '0' },
      { input: '100',              expectedOutput: '100' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // EASY — basics
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Sum of Two Numbers',
    difficulty: 'easy',
    category: 'basics',
    description:
      'Read two integers from stdin (one per line) and print their sum.\n\n' +
      'Example:\nInput:\n```\n3\n5\n```\nOutput: `8`',
    visibleTestCases: [
      { input: '3\n5',   expectedOutput: '8' },
      { input: '10\n20', expectedOutput: '30' },
    ],
    hiddenTestCases: [
      { input: '-1\n1',     expectedOutput: '0' },
      { input: '0\n0',      expectedOutput: '0' },
      { input: '100\n200',  expectedOutput: '300' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // EASY — oop
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Rectangle Area & Perimeter',
    difficulty: 'easy',
    category: 'oop',
    description:
      'Create a class `Rectangle` with attributes `width` and `height`.\n' +
      'Add methods:\n- `area()` → returns width × height\n- `perimeter()` → returns 2×(width + height)\n\n' +
      'Read two integers (width then height) from stdin and print area and perimeter on separate lines.',
    visibleTestCases: [
      { input: '4\n5',  expectedOutput: '20\n18' },
      { input: '3\n3',  expectedOutput: '9\n12' },
    ],
    hiddenTestCases: [
      { input: '1\n1',   expectedOutput: '1\n4' },
      { input: '10\n2',  expectedOutput: '20\n24' },
      { input: '7\n8',   expectedOutput: '56\n30' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // EASY — dsa
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Reverse a List',
    difficulty: 'easy',
    category: 'dsa',
    description:
      'Given a list of integers on a single line separated by spaces, print them in reverse order, space-separated.\n\n' +
      'Example input: `1 2 3 4 5`\nExpected output: `5 4 3 2 1`',
    visibleTestCases: [
      { input: '1 2 3 4 5', expectedOutput: '5 4 3 2 1' },
      { input: '10 20 30',  expectedOutput: '30 20 10' },
    ],
    hiddenTestCases: [
      { input: '1',         expectedOutput: '1' },
      { input: '-1 0 1',   expectedOutput: '1 0 -1' },
      { input: '5 5 5',    expectedOutput: '5 5 5' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // MEDIUM — basics
  // ─────────────────────────────────────────────────────────────
  {
    title: 'FizzBuzz',
    difficulty: 'medium',
    category: 'basics',
    description:
      'Read an integer `N` from stdin. For each number from 1 to N (inclusive):\n' +
      '- Print `FizzBuzz` if divisible by both 3 and 5\n' +
      '- Print `Fizz` if divisible by 3 only\n' +
      '- Print `Buzz` if divisible by 5 only\n' +
      '- Otherwise print the number\n\nOne value per line.',
    visibleTestCases: [
      { input: '5',  expectedOutput: '1\n2\nFizz\n4\nBuzz' },
      { input: '15', expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz' },
    ],
    hiddenTestCases: [
      { input: '1',  expectedOutput: '1' },
      { input: '3',  expectedOutput: '1\n2\nFizz' },
      { input: '10', expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // MEDIUM — oop
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Bank Account Class',
    difficulty: 'medium',
    category: 'oop',
    description:
      'Implement a `BankAccount` class with:\n' +
      '- `__init__(owner, balance=0)` — initialises the account\n' +
      '- `deposit(amount)` — adds amount to balance, returns new balance\n' +
      '- `withdraw(amount)` — deducts if funds are sufficient; otherwise raises `ValueError("Insufficient funds")`\n' +
      '- `__str__()` — returns `"<owner>: $<balance>"`\n\n' +
      'Read commands from stdin:\n' +
      '- `DEPOSIT <amount>`\n' +
      '- `WITHDRAW <amount>`\n' +
      '- `PRINT`\n\n' +
      'First line is the owner name, second line is the starting balance.',
    visibleTestCases: [
      {
        input: 'Alice\n100\nDEPOSIT 50\nWITHDRAW 30\nPRINT',
        expectedOutput: 'Alice: $120',
      },
    ],
    hiddenTestCases: [
      {
        input: 'Bob\n0\nDEPOSIT 200\nPRINT',
        expectedOutput: 'Bob: $200',
      },
      {
        input: 'Carol\n50\nWITHDRAW 100\nPRINT',
        expectedOutput: 'Insufficient funds\nCarol: $50',
      },
      {
        input: 'Dave\n1000\nWITHDRAW 500\nWITHDRAW 500\nPRINT',
        expectedOutput: 'Dave: $0',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // MEDIUM — dsa
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Binary Search',
    difficulty: 'medium',
    category: 'dsa',
    description:
      'Given a **sorted** list of integers and a target value, implement binary search.\n\n' +
      'Input format:\n' +
      '- Line 1: space-separated sorted integers\n' +
      '- Line 2: target integer\n\n' +
      'Output the **0-based index** of the target, or `-1` if not found.',
    visibleTestCases: [
      { input: '1 3 5 7 9 11\n7',  expectedOutput: '3' },
      { input: '2 4 6 8 10\n5',    expectedOutput: '-1' },
    ],
    hiddenTestCases: [
      { input: '1\n1',             expectedOutput: '0' },
      { input: '1 2 3 4 5\n1',     expectedOutput: '0' },
      { input: '1 2 3 4 5\n5',     expectedOutput: '4' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // HARD — basics
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Regex Email Validator',
    difficulty: 'hard',
    category: 'basics',
    description:
      'Read N (first line) email addresses (one per line) and for each print `Valid` or `Invalid`.\n\n' +
      'An email is valid if it matches: `local@domain.tld` where:\n' +
      '- local: one or more alphanumeric chars, dots, underscores, or hyphens\n' +
      '- domain: one or more alphanumeric chars or hyphens\n' +
      '- tld: 2–6 alphabetic characters',
    visibleTestCases: [
      {
        input: '3\ntest@example.com\nbad@\nhello.world@mail.org',
        expectedOutput: 'Valid\nInvalid\nValid',
      },
    ],
    hiddenTestCases: [
      { input: '1\nuser_name@sub-domain.co.uk', expectedOutput: 'Valid' },
      { input: '1\n@nodomain.com',              expectedOutput: 'Invalid' },
      { input: '1\njust-text',                  expectedOutput: 'Invalid' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // HARD — oop
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Polymorphic Shape Calculator',
    difficulty: 'hard',
    category: 'oop',
    description:
      'Implement an abstract base class `Shape` with an abstract method `area()`.\n' +
      'Create two subclasses:\n' +
      '- `Circle(radius)` — area = π × r² (use math.pi, round to 2 dp)\n' +
      '- `Triangle(base, height)` — area = 0.5 × base × height\n\n' +
      'Read commands from stdin (one per line until EOF):\n' +
      '- `CIRCLE <radius>`\n' +
      '- `TRIANGLE <base> <height>`\n\n' +
      'For each, print the area.',
    visibleTestCases: [
      { input: 'CIRCLE 5\nTRIANGLE 6 4',  expectedOutput: '78.54\n12.0' },
    ],
    hiddenTestCases: [
      { input: 'CIRCLE 1',               expectedOutput: '3.14' },
      { input: 'TRIANGLE 3 4',           expectedOutput: '6.0' },
      { input: 'CIRCLE 0',               expectedOutput: '0.0' },
    ],
  },
  // ─────────────────────────────────────────────────────────────
  // HARD — dsa
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Longest Common Subsequence',
    difficulty: 'hard',
    category: 'dsa',
    description:
      'Given two strings on separate lines, compute the length of their **Longest Common Subsequence** using dynamic programming.\n\n' +
      'Example:\nInput:\n```\nABCBDAB\nBDCABA\n```\nOutput: `4`',
    visibleTestCases: [
      { input: 'ABCBDAB\nBDCABA', expectedOutput: '4' },
      { input: 'AGGTAB\nGXTXAYB', expectedOutput: '4' },
    ],
    hiddenTestCases: [
      { input: 'ABC\nABC',        expectedOutput: '3' },
      { input: 'ABC\nDEF',        expectedOutput: '0' },
      { input: 'A\nA',            expectedOutput: '1' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // Extra fills — ensure enough questions at medium/hard
  // ─────────────────────────────────────────────────────────────
  {
    title: 'Palindrome Check',
    difficulty: 'easy',
    category: 'basics',
    description:
      'Read a string from stdin and print `Yes` if it is a palindrome, `No` otherwise.\n' +
      'Ignore case and non-alphanumeric characters.',
    visibleTestCases: [
      { input: 'racecar',   expectedOutput: 'Yes' },
      { input: 'hello',     expectedOutput: 'No' },
    ],
    hiddenTestCases: [
      { input: 'A man a plan a canal Panama', expectedOutput: 'Yes' },
      { input: 'Was it a car or a cat I saw', expectedOutput: 'Yes' },
      { input: 'python',                       expectedOutput: 'No' },
    ],
  },
  {
    title: 'Count Word Frequencies',
    difficulty: 'medium',
    category: 'basics',
    description:
      'Read a sentence from stdin and print each unique word (lowercase) and its frequency, ' +
      'sorted alphabetically, one per line in the format `word: count`.',
    visibleTestCases: [
      { input: 'the cat sat on the mat', expectedOutput: 'cat: 1\nmat: 1\non: 1\nsat: 1\nthe: 2' },
    ],
    hiddenTestCases: [
      { input: 'hello hello world',       expectedOutput: 'hello: 2\nworld: 1' },
      { input: 'a',                        expectedOutput: 'a: 1' },
      { input: 'one two one two one',      expectedOutput: 'one: 3\ntwo: 2' },
    ],
  },
  {
    title: 'Stack Using List',
    difficulty: 'medium',
    category: 'dsa',
    description:
      'Implement a `Stack` class backed by a Python list with methods:\n' +
      '- `push(val)` — pushes value\n' +
      '- `pop()` — pops and returns top value (print `Empty` if empty)\n' +
      '- `peek()` — returns top without removal (print `Empty` if empty)\n' +
      '- `is_empty()` — returns True/False\n\n' +
      'Read commands from stdin until EOF:\n' +
      '- `PUSH <val>`\n- `POP`\n- `PEEK`',
    visibleTestCases: [
      { input: 'PUSH 1\nPUSH 2\nPEEK\nPOP\nPOP\nPOP', expectedOutput: '2\n2\n1\nEmpty' },
    ],
    hiddenTestCases: [
      { input: 'POP',                            expectedOutput: 'Empty' },
      { input: 'PUSH 5\nPOP',                    expectedOutput: '5' },
      { input: 'PUSH 1\nPUSH 2\nPUSH 3\nPEEK', expectedOutput: '3' },
    ],
  },
  {
    title: 'Merge Two Sorted Arrays',
    difficulty: 'hard',
    category: 'dsa',
    description:
      'Given two space-separated sorted arrays of integers (one per line), merge them into a single sorted array and print the result space-separated.\n\n' +
      'Do NOT use a built-in sort on the combined array — implement the merge step of merge sort.',
    visibleTestCases: [
      { input: '1 3 5 7\n2 4 6 8',    expectedOutput: '1 2 3 4 5 6 7 8' },
      { input: '1 2 3\n4 5 6',         expectedOutput: '1 2 3 4 5 6' },
    ],
    hiddenTestCases: [
      { input: '1\n2',                 expectedOutput: '1 2' },
      { input: '5 10 15\n1 2 3',       expectedOutput: '1 2 3 5 10 15' },
      { input: '1 1 1\n1 1 1',         expectedOutput: '1 1 1 1 1 1' },
    ],
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/procruit');
    console.log('MongoDB connected');

    await CodingQuestion.deleteMany({});
    console.log('Cleared existing CodingQuestion documents');

    const inserted = await CodingQuestion.insertMany(questions);
    console.log(`✅ Seeded ${inserted.length} coding questions`);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
