import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import StudentProfile from "../models/StudentProfile.js";
import SavedResume from "../models/SavedResume.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { askJSON, asData } from "../services/groq.service.js";
import { htmlToPdf } from "../services/pdf.service.js";
import {
  renderResumeHtml, TEMPLATES, TEMPLATE_INFO, PRESETS, FONTS, DEFAULT_TITLES, SECTION_IDS, STYLE_SCHEMA, normalizeStyle, normalizeLayout,
} from "../utils/resumeTemplate.js";

const router = Router();
router.use(protect, authorize("student"));

// AI calls are expensive; preview and PDF are cheap, so they get a much higher limit (live preview calls it often).
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, message: { message: "Too many AI requests. Wait a moment." } });
const renderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, message: { message: "Too many preview requests. Slow down a little." } });

const aiSchema = z.object({
  summary: z.string().default(""),
  experience: z.array(z.object({ id: z.coerce.number(), bullets: z.array(z.string()).default([]) })).default([]),
  projects: z.array(z.object({ title: z.string(), bullets: z.array(z.string()).default([]) })).default([]),
  skills: z.record(z.array(z.string())).default({}),
});

// Text fields may be missing or null (e.g. a profile field that was never filled in)
const text = (max) => z.string().max(max).nullish().transform((v) => v ?? undefined);
const optional = (schema) => schema.nullish().transform((v) => v ?? undefined);

const template = z.enum(TEMPLATES).catch("professional").default("professional");
const styleField = optional(z.record(z.any()));
const layoutField = optional(z.record(z.any()));

const resumeBody = z.object({
  // an unknown template name falls back to "professional" instead of failing the request
  template,
  style: styleField,
  layout: layoutField,
  resume: z.object({
    name: z.string().max(120),
    headline: text(120),
    email: text(120),
    phone: text(40),
    location: text(120),
    links: optional(z.object({ github: text(300), linkedin: text(300), portfolio: text(300) }).partial()),
    summary: text(2000),
    experience: optional(z.array(z.any()).max(15)),
    education: optional(z.array(z.any()).max(10)),
    skills: optional(z.record(z.array(z.string()))),
    projects: optional(z.array(z.any()).max(12)),
    certifications: optional(z.array(z.any()).max(15)),
    languages: optional(z.array(z.any()).max(10)),
  }),
});

const customizeBody = z.object({
  prompt: z.string().trim().min(3).max(500),
  template,
  style: styleField,
  layout: layoutField,
});

const rewriteBody = z.object({
  kind: z.enum(["summary", "bullets"]),
  text: z.string().trim().min(1).max(3000),
  instruction: z.string().trim().min(2).max(300),
});

// everything the editor needs to build its controls
const editorMeta = () => ({
  presets: PRESETS,
  templates: TEMPLATES.map((id) => ({ id, ...TEMPLATE_INFO[id] })),
  fonts: Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label })),
  sections: DEFAULT_TITLES,
});

const lines = (text = "") => String(text).split("\n").map((l) => l.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);

/* ---------------------------- generate ---------------------------- */

router.post("/generate", aiLimiter, asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();
  const hasContent = profile && (profile.skills?.length || profile.projects?.length || profile.experience?.length || profile.education?.length);
  if (!hasContent) throw new HttpError(400, "Add a few skills, a project, an experience or an education entry to your profile first. Even a little is enough, the AI will expand it.");

  const experience = profile.experience || [];
  const facts = {
    headline: profile.headline || profile.targetRole,
    targetRole: profile.targetRole,
    skills: (profile.skills || []).map((s) => `${s.name} (${s.level})`),
    experience: experience.map((e, id) => ({ id, role: e.role, company: e.company, start: e.start, end: e.end, points: lines(e.description) })),
    projects: (profile.projects || []).map((p) => ({ title: p.title, description: p.description, techStack: p.techStack })),
    education: profile.education,
    certifications: (profile.certifications || []).map((c) => c.title),
    languages: (profile.languages || []).map((l) => l.name),
  };

  const ai = await askJSON({
    system: `You are an expert resume writer. You turn thin, rough profile notes into a full, polished, professional resume that fills a page well, even when the student gave very little detail.
FACTS RULES (strict): Use only the employers, job titles, dates, education, certifications and tools given in the input. Never invent employers, titles, dates, degrees, awards or tools that are not listed. Never invent numbers, percentages or metrics (no "improved speed by 40%").
EXPANSION RULES: You MAY elaborate on what the listed work normally involves, using the listed tools and the project description, so each entry reads as a complete, specific achievement. For example a project "Library Management System" built with React, Node.js and MongoDB can mention designing the database schema, building REST APIs, creating responsive interfaces and testing the features, because that is what such a project involves. Write in the language of results and responsibilities (what was built, how, with what, for whom). Vary the opening verbs and never repeat a bullet.
Return JSON:
{
  "summary": "4-5 sentence professional summary, no first-person pronouns. Cover the field or headline, education status, the strongest skills and tools, the kind of work done (projects or experience) and the kind of role being targeted.",
  "experience": [{"id": <the id number from the input>, "bullets": ["4-6 bullets, each 12-25 words, starting with a strong action verb, rewritten and expanded from that entry's points and its role"]}],
  "projects": [{"title": "must match the input title exactly", "bullets": ["3-4 bullets, each 12-25 words, starting with a strong action verb: what was built, the features, the tools used, the outcome"]}],
  "skills": {"<Group name>": ["skill"]}
}
SKILLS: make 3-4 groups that suit the person's field (for example "Programming Languages", "Frameworks and Libraries", "Tools and Platforms", "Design Skills"). Put every skill from the input into exactly one group, and add no tools or technologies that are not in the input. You may add a final group named "Professional Strengths" with 3-5 general strengths that fit the role (for example "Problem Solving", "Team Collaboration", "Communication"). Never list spoken languages as skills.`,
    user: asData("student_facts", JSON.stringify(facts), 9000),
    schema: aiSchema,
    temperature: 0.5,
  });

  const projectBullets = new Map(ai.projects.map((p) => [p.title.toLowerCase(), p.bullets]));
  const experienceBullets = new Map(ai.experience.map((e) => [e.id, e.bullets]));

  const resume = {
    name: req.user.name,
    headline: profile.headline || profile.targetRole || "",
    email: req.user.email,
    phone: profile.phone,
    location: profile.location,
    links: profile.links || {},
    summary: ai.summary,
    experience: experience.map((e, i) => ({
      role: e.role,
      company: e.company,
      location: e.location,
      start: e.start,
      end: e.end,
      bullets: experienceBullets.get(i)?.length ? experienceBullets.get(i) : lines(e.description),
    })),
    projects: (profile.projects || []).map((p) => ({
      title: p.title,
      techStack: p.techStack,
      bullets: projectBullets.get(p.title.toLowerCase()) || (p.description ? [p.description] : []),
    })),
    education: profile.education || [],
    skills: ai.skills,
    certifications: profile.certifications || [],
    languages: (profile.languages || []).map((l) => ({ name: l.name, proficiency: l.proficiency })),
  };

  res.json({
    resume,
    html: renderResumeHtml(resume, "professional"),
    meta: editorMeta(),
  });
}));

/* ------------------- saved resume (survives refresh) -------------------- */

// Load the resume this student last worked on (content + design), or { saved: false }.
router.get("/saved", renderLimiter, asyncHandler(async (req, res) => {
  const doc = await SavedResume.findOne({ user: req.user._id }).lean();
  if (!doc) return res.json({ saved: false });
  res.json({
    saved: true,
    resume: doc.resume,
    template: doc.template,
    style: doc.style,
    layout: doc.layout,
    updatedAt: doc.updatedAt,
    html: renderResumeHtml(doc.resume, doc.template, { style: doc.style, layout: doc.layout }),
    meta: editorMeta(),
  });
}));

// Save (create or replace) the current resume. The editor calls this automatically after every change.
router.put("/saved", renderLimiter, validate(resumeBody), asyncHandler(async (req, res) => {
  const { resume, template: tpl, style, layout } = req.body;
  const update = { template: tpl, resume };
  if (style) update.style = style;
  if (layout) update.layout = layout;
  const doc = await SavedResume.findOneAndUpdate(
    { user: req.user._id },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ ok: true, updatedAt: doc.updatedAt });
}));

/* ------------------------ preview / pdf --------------------------- */

const render = (body) => renderResumeHtml(body.resume, body.template, { style: body.style, layout: body.layout });

router.post("/preview", renderLimiter, validate(resumeBody), (req, res) => res.json({ html: render(req.body) }));

router.post("/pdf", renderLimiter, validate(resumeBody), asyncHandler(async (req, res) => {
  let pdf;
  try {
    pdf = await htmlToPdf(render(req.body));
  } catch (err) {
    console.error("PDF generation failed:", err);
    throw new HttpError(500, `The PDF engine failed: ${err.message}. If Chrome is missing, run "npx puppeteer browsers install chrome" inside the server folder, then restart the server.`);
  }
  const person = String(req.body.resume?.name || "").trim().replace(/[\\/:*?"<>|\r\n]+/g, "").replace(/\s+/g, "_");
  const fileName = `${person || "My"}_Resume.pdf`;
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  });
  res.send(pdf);
}));

/* --------------- AI: change the look with a sentence -------------- */

const customizeSchema = z.object({
  style: z.record(z.any()).default({}),
  layout: z.object({
    order: z.array(z.string()).optional(),
    hidden: z.array(z.string()).optional(),
    titles: z.record(z.string()).optional(),
  }).partial().default({}),
  message: z.string().default("Applied your changes."),
});

router.post("/customize", aiLimiter, validate(customizeBody), asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  const currentStyle = normalizeStyle(req.body.style, req.body.template);
  const currentLayout = normalizeLayout(req.body.layout);

  const ai = await askJSON({
    system: `You are a resume layout assistant. The user describes how they want their resume to LOOK. Translate the request into changes to a style object and a layout object.
Return JSON: {"style": {only the keys that must change}, "layout": {optional "order": [all section ids in the new order], "hidden": [section ids to hide], "titles": {"<section id>": "new heading text"}}, "message": "one short sentence saying what you changed"}

Allowed style keys and values (use exactly these):
${JSON.stringify({ options: STYLE_SCHEMA.options, ranges: "numbers between [min, max]: " + JSON.stringify(STYLE_SCHEMA.ranges), colors: STYLE_SCHEMA.colors + " must be 6-digit hex such as #1a56db. Convert colour names to a suitable hex." })}
Section ids: ${SECTION_IDS.join(", ")}.

Guidance:
- Change only what was asked. Leave everything else out of "style".
- "compact" or "fit on one page": lower fontSize, lineHeight, sectionGap, itemGap and pagePadding.
- "ATS friendly" or "simple": headerStyle plain, headingStyle plain or caps, skillsStyle list or inline, bulletStyle disc, a standard font such as helvetica or times.
- "bigger" or "smaller" text: adjust fontSize by about 1pt.
- You can NOT change the wording or facts in the resume or add information. If asked to, change nothing and say so in "message".`,
    user: `${asData("current_settings", JSON.stringify({ style: currentStyle, layout: currentLayout }), 3000)}\n${asData("user_request", prompt, 500)}`,
    schema: customizeSchema,
    temperature: 0.2,
  });

  const style = normalizeStyle({ ...currentStyle, ...ai.style }, req.body.template);
  const layout = normalizeLayout({
    order: ai.layout.order ?? currentLayout.order,
    hidden: ai.layout.hidden ?? currentLayout.hidden,
    titles: { ...currentLayout.titles, ...(ai.layout.titles || {}) },
  });

  const changed =
    Object.keys(style).filter((k) => style[k] !== currentStyle[k]).length +
    (JSON.stringify(layout) !== JSON.stringify(currentLayout) ? 1 : 0);

  res.json({ style, layout, changed, message: ai.message });
}));

/* --------------- AI: rewrite one block of text -------------------- */

router.post("/rewrite", aiLimiter, validate(rewriteBody), asyncHandler(async (req, res) => {
  const { kind, text: original, instruction } = req.body;
  const out = await askJSON({
    system: `You edit resume text. Apply the user's instruction to the text. Use ONLY facts that are already in the text; never invent employers, tools, numbers, dates or achievements.
${kind === "summary"
      ? "The text is a professional summary: return one paragraph, no first-person pronouns."
      : "The text is a list of resume bullet points, one per line: return one bullet per line, each starting with a strong action verb, with no bullet symbols or numbering."}
Return JSON: {"text": "the rewritten text"}`,
    user: `${asData("text", original, 3000)}\n${asData("instruction", instruction, 300)}`,
    schema: z.object({ text: z.string().min(1) }),
    temperature: 0.5,
  });
  res.json({ text: out.text.trim() });
}));

export default router;