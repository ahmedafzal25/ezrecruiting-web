/**
 * Adaptive Engine Utility — Category-Aware Progression
 *
 * Progression map:
 * ┌─────────────────────────┬────────────────────────────────────────┐
 * │ Current state           │ Next target                            │
 * ├─────────────────────────┼────────────────────────────────────────┤
 * │ (start / Q1)            │ easy   / any                           │
 * ├─────────────────────────┼────────────────────────────────────────┤
 * │ very_easy  PASSED       │ easy   / any                           │
 * │ easy       PASSED       │ medium / oop                           │
 * │ medium     PASSED       │ hard   / dsa                           │
 * │ hard       PASSED       │ hard   / dsa  (ceiling)                │
 * ├─────────────────────────┼────────────────────────────────────────┤
 * │ very_easy  FAILED       │ very_easy / any  (floor)               │
 * │ easy       FAILED       │ very_easy / any                        │
 * │ medium     FAILED       │ easy   / any                           │
 * │ hard       FAILED       │ medium / oop                           │
 * └─────────────────────────┴────────────────────────────────────────┘
 */

const CodingQuestion = require('../models/CodingQuestion');

// ── Progression lookup table ──────────────────────────────────────────────────
// Key: `${difficulty}:${passed}`  →  Value: { difficulty, category }
// category: null = any category
const PROGRESSION = {
  // Passed states (promote)
  'very_easy:true':  { difficulty: 'easy',      category: null    },
  'easy:true':       { difficulty: 'medium',     category: 'oop'   },
  'medium:true':     { difficulty: 'hard',       category: 'dsa'   },
  'hard:true':       { difficulty: 'hard',       category: 'dsa'   }, // ceiling

  // Failed states (demote)
  'very_easy:false': { difficulty: 'very_easy',  category: null    }, // floor
  'easy:false':      { difficulty: 'very_easy',  category: null    },
  'medium:false':    { difficulty: 'easy',        category: null    },
  'hard:false':      { difficulty: 'medium',      category: 'oop'   },
};

/**
 * Returns the { difficulty, category } for the next question.
 *
 * @param {string}  currentDifficulty  — difficulty of the question just answered
 * @param {boolean} lastPassed         — whether that question was passed
 * @returns {{ difficulty: string, category: string|null }}
 */
const getNextTarget = (currentDifficulty, lastPassed) => {
  const key = `${currentDifficulty}:${lastPassed}`;
  return PROGRESSION[key] ?? { difficulty: 'easy', category: null };
};

/**
 * Fetches a single random question the candidate hasn't seen yet,
 * using the target difficulty and category.
 *
 * Fallback cascade (so the pool never feels exhausted too soon):
 *   1. Exact match: { difficulty, category, _id $nin excludeIds }
 *   2. Relax category (same difficulty, any category)
 *   3. Any unseen question from the whole collection
 *
 * @param {string}        difficulty   — target difficulty
 * @param {string|null}   category     — target category (null = any)
 * @param {ObjectId[]}    excludeIds   — IDs already shown to candidate
 * @returns {Promise<CodingQuestion|null>}
 */
const pickQuestion = async (difficulty, category, excludeIds = []) => {
  const notSeen = { _id: { $nin: excludeIds } };

  // ── Tier 1: exact difficulty + exact category ─────────────────────────────
  const tier1Filter = { ...notSeen, difficulty };
  if (category) tier1Filter.category = category;

  let [question] = await CodingQuestion.aggregate([
    { $match: tier1Filter },
    { $sample: { size: 1 } },
  ]);
  if (question) return question;

  // ── Tier 2: relax category — same difficulty, any category ───────────────
  if (category) {
    let [q2] = await CodingQuestion.aggregate([
      { $match: { ...notSeen, difficulty } },
      { $sample: { size: 1 } },
    ]);
    if (q2) return q2;
  }

  // ── Tier 3: relax difficulty — any unseen question ───────────────────────
  let [q3] = await CodingQuestion.aggregate([
    { $match: notSeen },
    { $sample: { size: 1 } },
  ]);

  return q3 || null; // null = question bank exhausted for this candidate
};

module.exports = { getNextTarget, pickQuestion };
