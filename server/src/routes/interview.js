import { Router } from "express";
import { z } from "zod";
import InterviewSession from "../models/InterviewSession.js";
import StudentProfile from "../models/StudentProfile.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { askJSON, asData } from "../services/groq.service.js";
import { refreshReadiness } from "../services/readiness.service.js";

const router = Router();
router.use(protect, authorize("student"));

// Violations that end the interview immediately.
const CRITICAL = new Set(["FULLSCREEN_EXIT", "TAB_SWITCH", "CAMERA_OFF", "PHONE_DETECTED", "BOOK_DETECTED", "MULTIPLE_PERSONS"]);
// Violations that only warn; the interview is cancelled once the limit is reached.
const WARNING = new Set(["COPY_PASTE", "DEVTOOLS_ATTEMPT", "NO_PERSON"]);
const WARNING_LIMIT = 3;

const startSchema = z.object({
  role: z.string().trim().min(2).max(80),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.coerce.number().int().min(3).max(10).default(5),
});
const answerSchema = z.object({ index: z.coerce.number().int().min(0), transcript: z.string().max(5000).default("") });
const violationSchema = z.object({ type: z.string().min(1).max(40) });

const questionsSchema = z.object({
  questions: z.array(z.object({
    text: z.string().min(5),
    type: z.string().default("technical"),
    expectedPoints: z.array(z.string()).default([]),
  })).min(1),
});
const scoreSchema = z.object({
  clarity: z.coerce.number().min(0).max(10),
  correctness: z.coerce.number().min(0).max(10),
  completeness: z.coerce.number().min(0).max(10),
  communication: z.coerce.number().min(0).max(10),
  feedback: z.string().default(""),
  improvement: z.string().default(""),
});
const summarySchema = z.object({
  text: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});

async function ownedSession(req) {
  const session = await InterviewSession.findOne({ _id: req.params.id, student: req.user._id });
  if (!session) throw new HttpError(404, "Interview not found");
  return session;
}
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

// ---- start -----------------------------------------------------------------
router.post("/start", validate(startSchema), asyncHandler(async (req, res) => {
  const { role, difficulty, count } = req.body;
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();

  const ai = await askJSON({
    system: `You are a senior interviewer running a ${difficulty} mock interview for a fresher applying as ${role}.
Return JSON: {"questions": [{"text": "one clear spoken-style question", "type": "technical|behavioral|project", "expectedPoints": ["3-5 key points a good answer covers"]}]}
Produce exactly ${count} questions: about 60% technical, 20% project-based (use the student's projects when provided), 20% behavioral. Keep every question under 35 words. No code-writing tasks (the answer is spoken).`,
    user: asData("student_context", JSON.stringify({
      skills: profile?.skills?.map((s) => s.name), projects: profile?.projects?.map((p) => p.title),
    })),
    schema: questionsSchema,
    temperature: 0.6,
  });

  const session = await InterviewSession.create({
    student: req.user._id, role, difficulty, questions: ai.questions.slice(0, count),
  });
  res.status(201).json({ id: session._id });
}));

// ---- read ------------------------------------------------------------------
router.get("/history", asyncHandler(async (req, res) =>
  res.json(await InterviewSession.find({ student: req.user._id }).sort("-createdAt").limit(60)
    .select("role difficulty status overallScore startedAt endedAt cancelReason"))));

router.get("/:id", asyncHandler(async (req, res) => {
  const s = await ownedSession(req);
  if (s.status === "in_progress") {
    // Never leak expectedPoints or scores while the interview is running.
    return res.json({
      id: s._id, role: s.role, difficulty: s.difficulty, status: s.status,
      total: s.questions.length,
      answeredCount: s.questions.filter((q) => q.answeredAt).length,
      questions: s.questions.map((q) => ({ text: q.text, type: q.type })),
    });
  }
  const obj = s.toObject();
  obj.questions = obj.questions.map(({ expectedPoints, ...q }) => q);
  res.json(obj);
}));

// ---- answer ----------------------------------------------------------------
router.post("/:id/answer", validate(answerSchema), asyncHandler(async (req, res) => {
  const s = await ownedSession(req);
  if (s.status !== "in_progress") throw new HttpError(409, `Interview is ${s.status}`);

  const { index, transcript } = req.body;
  const answeredCount = s.questions.filter((q) => q.answeredAt).length;
  if (index !== answeredCount) throw new HttpError(400, "Questions must be answered in order");

  const q = s.questions[index];
  let result;
  if (transcript.trim().split(/\s+/).filter(Boolean).length < 3) {
    result = { clarity: 0, correctness: 0, completeness: 0, communication: 0, feedback: "No meaningful answer was given.", improvement: "Try to speak for at least 20 to 30 seconds and cover the key points." };
  } else {
    result = await askJSON({
      system: `You are a fair but rigorous interviewer scoring a spoken answer (speech-to-text transcript, so ignore minor transcription errors).
Score each 0-10: clarity (structure, easy to follow), correctness (technical accuracy), completeness (covers the key points), communication (fluency, confidence, concise wording).
Return JSON: {"clarity":0,"correctness":0,"completeness":0,"communication":0,"feedback":"max 2 sentences","improvement":"one concrete tip"}`,
      user: `${asData("question", q.text, 500)}\n${asData("expected_points", q.expectedPoints.join("; "), 800)}\n${asData("candidate_answer", transcript, 4000)}`,
      schema: scoreSchema,
      temperature: 0.2,
    });
  }

  q.answerTranscript = transcript;
  q.scores = { clarity: result.clarity, correctness: result.correctness, completeness: result.completeness, communication: result.communication };
  q.feedback = result.feedback;
  q.improvement = result.improvement;
  q.answeredAt = new Date();
  await s.save();
  res.json({ scores: q.scores, feedback: q.feedback, improvement: q.improvement });
}));

// ---- violation -------------------------------------------------------------
router.post("/:id/violation", validate(violationSchema), asyncHandler(async (req, res) => {
  const s = await ownedSession(req);
  const { type } = req.body;
  if (!CRITICAL.has(type) && !WARNING.has(type)) throw new HttpError(400, "Unknown violation type");
  if (s.status !== "in_progress") return res.json({ status: s.status, cancelled: s.status === "cancelled", reason: s.cancelReason });

  s.violations.push({ type });
  const warnings = s.violations.filter((v) => WARNING.has(v.type)).length;
  const cancel = CRITICAL.has(type) || warnings >= WARNING_LIMIT;
  if (cancel) {
    s.status = "cancelled";
    s.cancelReason = CRITICAL.has(type) ? type : "TOO_MANY_WARNINGS";
    s.endedAt = new Date();
  }
  await s.save();
  res.json({ status: s.status, cancelled: cancel, reason: s.cancelReason, warnings, warningLimit: WARNING_LIMIT });
}));

// ---- finish ----------------------------------------------------------------
router.post("/:id/finish", asyncHandler(async (req, res) => {
  const s = await ownedSession(req);
  if (s.status !== "in_progress") throw new HttpError(409, `Interview is ${s.status}`);

  const perQuestion = s.questions.map((q) =>
    q.scores ? avg([q.scores.clarity, q.scores.correctness, q.scores.completeness, q.scores.communication]) : 0);
  s.overallScore = Math.round(avg(perQuestion) * 10) / 10;

  try {
    const digest = s.questions.map((q) => ({ question: q.text, scores: q.scores, feedback: q.feedback }));
    s.summary = await askJSON({
      system: `You are an interview coach. Summarise a mock interview for the candidate (second person, encouraging but honest).
Return JSON: {"text": "3-4 sentence overall assessment", "strengths": ["max 3"], "weaknesses": ["max 3"], "nextSteps": ["max 3 concrete actions"]}`,
      user: asData("interview_results", JSON.stringify({ role: s.role, overall: s.overallScore, digest })),
      schema: summarySchema,
    });
  } catch (e) {
    s.summary = { text: "Summary unavailable. Your per-question feedback is shown below.", strengths: [], weaknesses: [], nextSteps: [] };
  }

  s.status = "completed";
  s.endedAt = new Date();
  await s.save();
  refreshReadiness(req.user._id);
  res.json({ id: s._id, overallScore: s.overallScore });
}));

export default router;
