import { Router } from "express";
import { z } from "zod";
import JobRole from "../models/JobRole.js";
import StudentProfile from "../models/StudentProfile.js";
import SkillGapReport from "../models/SkillGapReport.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { askJSON, asData } from "../services/groq.service.js";
import { matchSkills } from "../services/skillMatch.js";
import { refreshReadiness } from "../services/readiness.service.js";

const router = Router();
router.use(protect, authorize("student"));

const pathSchema = z.object({
  learningPath: z.array(z.object({
    order: z.coerce.number().default(0),
    skill: z.string(),
    why: z.string().default(""),
    resources: z.array(z.string()).default([]),
    estimatedTime: z.string().default(""),
  })).default([]),
});

// Suggestions for the "type a role" box. Any role can be typed, these are just shortcuts.
router.get("/roles", asyncHandler(async (req, res) =>
  res.json(await JobRole.find().select("title category description").sort("title"))));

const escapeRx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const titleCase = (t) => t.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

const generatedRoleSchema = z.object({
  isJobRole: z.boolean().default(true),
  category: z.string().default(""),
  description: z.string().default(""),
  requiredSkills: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    weight: z.coerce.number().min(1).max(3).default(1),
  })).max(15).default([]),
});

/**
 * Find the role the student typed. Known roles are matched ignoring case; an unknown role is generated once by the AI
 * (a realistic list of required skills) and saved so the next student gets the same list.
 */
async function resolveRole({ roleId, role: typed }) {
  if (roleId) {
    const found = await JobRole.findById(roleId);
    if (!found) throw new HttpError(404, "Job role not found");
    return { role: found, generated: false };
  }
  const name = String(typed || "").replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new HttpError(400, "Type the role you are aiming for, for example Cloud Engineer");
  const known = await JobRole.findOne({ title: new RegExp(`^${escapeRx(name)}$`, "i") });
  if (known) return { role: known, generated: false };

  const ai = await askJSON({
    system: `You are a hiring expert. A student typed the job role they want. Decide whether it is a real job role, and if so list the skills an entry-level candidate needs.
Return JSON: {"isJobRole": true, "category": "e.g. Software, Data, Design, Business", "description": "one sentence", "requiredSkills": [{"name": "short skill name", "weight": 1-3}]}
Use 8 to 12 skills. Weight 3 = essential, 2 = important, 1 = nice to have. Use common short names such as "JavaScript", "SQL", "Figma". If the text is not a job role, return {"isJobRole": false}.`,
    user: asData("role_text", name, 120),
    schema: generatedRoleSchema,
  });
  if (!ai.isJobRole || !ai.requiredSkills.length) throw new HttpError(400, `"${name}" doesn't look like a job role. Try something like Data Analyst or Android Developer.`);

  const title = titleCase(name).slice(0, 80);
  // upsert so two students typing the same new role at the same moment don't collide
  const saved = await JobRole.findOneAndUpdate(
    { title: new RegExp(`^${escapeRx(title)}$`, "i") },
    { $setOnInsert: { title, category: ai.category, description: ai.description, requiredSkills: ai.requiredSkills, source: "ai" } },
    { upsert: true, new: true },
  );
  return { role: saved, generated: saved.source === "ai" };
}

router.post("/analyze", validate(z.object({ roleId: z.string().min(1).optional(), role: z.string().trim().max(80).optional() })
  .refine((b) => b.roleId || b.role, "Type a role to analyse")), asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id });
  if (!profile) throw new HttpError(400, "Complete your profile first");
  const { role, generated } = await resolveRole(req.body);

  const { matched, missing, matchPercent } = matchSkills(profile, role.requiredSkills);

  let learningPath = [];
  if (missing.length) {
    const ai = await askJSON({
      system: `You are a career mentor. Build a learning path for a student to become a ${role.title}.
Return JSON: {"learningPath": [{"order": 1, "skill": "", "why": "one sentence", "resources": ["free course / doc / project idea"], "estimatedTime": "e.g. 2 weeks"}]}
Order skills logically (foundations first). One entry per missing skill.`,
      user: `${asData("student_data", JSON.stringify({ knownSkills: matched, missingSkills: missing }))}`,
      schema: pathSchema,
    });
    learningPath = ai.learningPath;
  }

  const report = await SkillGapReport.create({
    student: req.user._id, targetRole: role.title, matchPercent, matched, missing, learningPath,
  });
  refreshReadiness(req.user._id);
  res.json({ ...report.toObject(), generatedRole: generated });
}));

router.get("/history", asyncHandler(async (req, res) =>
  res.json(await SkillGapReport.find({ student: req.user._id }).sort("-createdAt").limit(60))));

export default router;
