import { Router } from "express";
import { z } from "zod";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import AptitudeAttempt from "../models/AptitudeAttempt.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { refreshReadiness } from "../services/readiness.service.js";
import { askJSON } from "../services/groq.service.js";

const router = Router();
router.use(protect, authorize("student"));

const submitSchema = z.object({
  answers: z.array(z.object({ id: z.string().min(1), choice: z.number().int().min(-1).max(3) })).min(1).max(30),
});

/* ---------------- AI question generation ---------------- */

const CATEGORIES = ["quantitative", "logical", "verbal"];

const generatedSchema = z.object({
  questions: z.array(z.object({
    category: z.enum(CATEGORIES),
    question: z.string().min(10).max(500),
    options: z.array(z.string().min(1).max(200)).length(4),
    answerIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(600),
  })).min(1),
});

const TOPICS = {
  quantitative: ["percentages", "profit and loss", "time and work", "speed and distance", "ratios", "simple and compound interest", "averages", "number series", "permutations", "probability"],
  logical: ["blood relations", "seating arrangement", "syllogisms", "coding-decoding", "direction sense", "pattern series", "statement and conclusion", "puzzles"],
  verbal: ["synonyms", "antonyms", "sentence correction", "fill in the blanks", "reading comprehension (short passage)", "idioms", "one-word substitution", "error spotting"],
};
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

/** Generate fresh questions with the LLM and store them so /submit can grade them. */
async function generateQuestions(count) {
  const q = Math.ceil(count * 0.4);
  const l = Math.ceil(count * 0.3);
  const v = Math.max(1, count - q - l);
  const plan = [
    `${q} quantitative (topics: ${pick(TOPICS.quantitative, 3).join(", ")})`,
    `${l} logical (topics: ${pick(TOPICS.logical, 3).join(", ")})`,
    `${v} verbal (topics: ${pick(TOPICS.verbal, 3).join(", ")})`,
  ].join("; ");

  const out = await askJSON({
    system:
      "You write placement-test aptitude questions for engineering graduates. " +
      "Every question must be self-contained, unambiguous and have exactly one correct option. " +
      "Double-check all calculations before answering. Vary the position of the correct answer.",
    user:
      `Create ${count} multiple-choice questions: ${plan}.\n` +
      `Return JSON: {"questions":[{"category":"quantitative|logical|verbal","question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"short working"}]}\n` +
      `Rules: exactly 4 distinct options, answerIndex is 0-3, medium difficulty, every question must have a short explanation. Do not include option letters in the option text. Variation seed: ${Date.now()}`,
    schema: generatedSchema,
    temperature: 0.8,
  });

  const clean = out.questions.filter((x) => new Set(x.options.map((o) => o.trim().toLowerCase())).size === 4);
  const saved = [];
  for (const x of clean) {
    // upsert on the unique `question` field so repeats never throw
    const doc = await AptitudeQuestion.findOneAndUpdate(
      { question: x.question.trim() },
      { $setOnInsert: { ...x, question: x.question.trim() } },
      { upsert: true, new: true }
    );
    saved.push(doc);
  }
  return saved.slice(0, count);
}

/* ---------------- Routes ---------------- */

// AI-generated questions WITHOUT the answers or explanations.
router.get("/questions", asyncHandler(async (req, res) => {
  const count = Math.min(20, Math.max(5, Number(req.query.count) || 10));
  let docs = [];

  try {
    docs = await generateQuestions(count);
  } catch (err) {
    console.warn("AI question generation failed, using stored questions:", err.message);
  }

  // Top up from the stored bank if the AI returned too few (or failed)
  if (docs.length < count) {
    const have = docs.map((d) => d._id);
    const extra = await AptitudeQuestion.aggregate([
      { $match: { _id: { $nin: have } } },
      { $sample: { size: count - docs.length } },
    ]);
    docs = [...docs, ...extra];
  }
  if (!docs.length) throw new HttpError(503, "Could not generate aptitude questions. Check GROQ_API_KEY and try again.");

  const questions = docs.map((d) => {
    const o = d.toObject ? d.toObject() : d;
    const { answerIndex, explanation, ...safe } = o; // never send answers to the client
    return safe;
  });
  res.json({ questions });
}));

router.post("/submit", validate(submitSchema), asyncHandler(async (req, res) => {
  const unique = [...new Map(req.body.answers.map((a) => [a.id, a])).values()];
  const found = await AptitudeQuestion.find({ _id: { $in: unique.map((a) => a.id) } });
  const byId = new Map(found.map((q) => [String(q._id), q]));

  let correct = 0;
  const review = [];
  for (const a of unique) {
    const q = byId.get(a.id);
    if (!q) continue;
    const ok = a.choice === q.answerIndex;
    if (ok) correct++;
    review.push({ id: q._id, category: q.category, question: q.question, options: q.options, choice: a.choice, answerIndex: q.answerIndex, explanation: q.explanation, correct: ok });
  }
  if (!review.length) throw new HttpError(400, "No valid questions were submitted");

  const percent = Math.round((correct / review.length) * 100);
  await AptitudeAttempt.create({ student: req.user._id, total: review.length, correct, percent });
  refreshReadiness(req.user._id);
  res.json({ total: review.length, correct, percent, review });
}));

router.get("/history", asyncHandler(async (req, res) =>
  res.json(await AptitudeAttempt.find({ student: req.user._id }).sort("-createdAt").limit(60).select("total correct percent createdAt"))));

export default router;