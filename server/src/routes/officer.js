import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import Company from "../models/Company.js";
import PlacementDrive from "../models/PlacementDrive.js";
import SkillGapReport from "../models/SkillGapReport.js";
import InterviewSession from "../models/InterviewSession.js";
import SavedResume from "../models/SavedResume.js";
import AptitudeAttempt from "../models/AptitudeAttempt.js";
import Option, { OPTION_TYPES, keyOf } from "../models/Option.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { readinessBreakdown } from "../services/readiness.service.js";
import { audienceFor, notify } from "../services/notify.service.js";
import { listWithLegacy } from "../services/options.service.js";

const router = Router();
router.use(protect, authorize("officer"));

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rxOf = (s) => new RegExp(escapeRx(String(s).trim()), "i");
const rxExact = (s) => new RegExp(`^${escapeRx(String(s).trim())}$`, "i");
// "pick several" filters arrive joined with | (CSE|ECE)
const multi = (v) => String(v || "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 30);
const csvList = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15);
const numOrNull = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const bounds = (min, max) => {
  const o = {}, lo = numOrNull(min), hi = numOrNull(max);
  if (lo != null) o.$gte = lo;
  if (hi != null) o.$lte = hi;
  return Object.keys(o).length ? o : null;
};
const cleanList = (a) => [...new Set((a || []).filter(Boolean).map((x) => String(x).trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
// "at least this level": Intermediate also matches Advanced
const SKILL_LEVELS = { Beginner: ["Beginner", "Intermediate", "Advanced"], Intermediate: ["Intermediate", "Advanced"], Advanced: ["Advanced"] };
const STUDENT_SORT = {
  readiness_desc: { "readiness.score": -1 }, readiness_asc: { "readiness.score": 1 },
  cgpa_desc: { cgpa: -1 }, cgpa_asc: { cgpa: 1 }, ats_desc: { "latestAtsScore.score": -1 },
  newest: { createdAt: -1 }, dept: { department: 1, "readiness.score": -1 },
};
const sortOf = (key) => ({ ...(STUDENT_SORT[key] || STUDENT_SORT.readiness_desc), _id: 1 }); // _id keeps paging stable

// Who has applied / been selected in any drive (one pass over the drives)
async function placementSets() {
  const rows = await PlacementDrive.aggregate([
    { $unwind: "$registeredStudents" },
    { $group: { _id: "$registeredStudents.student", statuses: { $addToSet: "$registeredStudents.status" } } },
  ]);
  const placed = new Set(), inProcess = new Set(), applied = new Set();
  for (const r of rows) {
    const id = String(r._id);
    applied.add(id);
    if (r.statuses.includes("selected")) placed.add(id);
    else if (r.statuses.some((x) => x === "registered" || x === "shortlisted")) inProcess.add(id);
  }
  return { placed, inProcess, applied };
}
const placementOf = (sets, userId) => {
  const id = String(userId);
  return sets.placed.has(id) ? "placed" : sets.inProcess.has(id) ? "in_process" : sets.applied.has(id) ? "not_selected" : "not_applied";
};

// Drives only apply to some departments (empty list = everyone)
const deptClause = (dept) => ({ $or: [{ "eligibility.departments": { $size: 0 } }, { "eligibility.departments": dept }, { "eligibility.departments": { $exists: false } }] });

// Drive filters shared by the analytics page and the drives report
function driveFilterFrom(q) {
  const f = {};
  if (q.company && mongoose.isValidObjectId(q.company)) f.company = q.company;
  if (q.from || q.to) {
    f.date = {};
    if (q.from) f.date.$gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) f.date.$lte = new Date(`${q.to}T23:59:59.999Z`);
  }
  if (q.dept) Object.assign(f, deptClause(q.dept));
  return f;
}

async function filterOptions() {
  const [lists, companies] = await Promise.all([listWithLegacy(), Company.find().select("name").sort("name").lean()]);
  return { departments: lists.departments, batches: lists.batches, programs: lists.programs, programsByDepartment: lists.programsByDepartment, generalPrograms: lists.generalPrograms, companies: companies.map((c) => ({ _id: c._id, name: c.name })) };
}

/**
 * Every filter the officer can use on the Students page (all optional):
 *  search, dept, batch, program (programme), role (target role), location, placement and band (each may hold several values joined with |), minCgpa/maxCgpa, backlogs (none|has|le1|le2),
 *  skills (comma list) + skillMatch (any|all) + skillLevel, experience (none|any|2plus), expRole,
 *  band values on_track|in_progress|needs_attention, minReadiness/maxReadiness, ats (checked|not_checked), minAts/maxAts,
 *  placement (placed|in_process|not_placed|not_applied), resume|interview|aptitude (yes/no or done/none)
 */
async function studentQuery(q) {
  const and = [];
  // each of these can hold several values; a student matches when they have any one of them
  const depts = multi(q.dept), batches = multi(q.batch), programs = multi(q.program), roles = multi(q.role), locations = multi(q.location);
  if (depts.length) and.push({ department: { $in: depts } });
  if (batches.length) and.push({ batch: { $in: batches } });
  if (programs.length) and.push({ program: { $in: programs } });
  if (roles.length) and.push({ targetRole: { $in: roles.map(rxExact) } });
  if (locations.length) and.push({ location: { $in: locations.map(rxExact) } });

  const cg = bounds(q.minCgpa, q.maxCgpa);
  if (cg) and.push({ cgpa: cg });
  const noBacklogs = (n) => ({ $or: [{ backlogs: { $lte: n } }, { backlogs: { $exists: false } }] });
  if (q.backlogs === "none") and.push(noBacklogs(0));
  else if (q.backlogs === "le1") and.push(noBacklogs(1));
  else if (q.backlogs === "le2") and.push(noBacklogs(2));
  else if (q.backlogs === "has") and.push({ backlogs: { $gte: 1 } });

  const rd = bounds(q.minReadiness, q.maxReadiness);
  if (rd) and.push({ "readiness.score": rd });
  const bandClause = (b) => (b === "on_track" ? { "readiness.score": { $gte: ON_TRACK } }
    : b === "in_progress" ? { "readiness.score": { $gte: IN_PROGRESS, $lt: ON_TRACK } }
    : b === "needs_attention" ? { $or: [{ "readiness.score": { $lt: IN_PROGRESS } }, { "readiness.score": { $exists: false } }] } : null);
  const bands = multi(q.band).map(bandClause).filter(Boolean);
  if (bands.length) and.push(bands.length === 1 ? bands[0] : { $or: bands });

  if (q.ats === "checked") and.push({ "latestAtsScore.score": { $exists: true } });
  else if (q.ats === "not_checked") and.push({ "latestAtsScore.score": { $exists: false } });
  const at = bounds(q.minAts, q.maxAts);
  if (at) and.push({ "latestAtsScore.score": at });

  // skills: any of them (default) or all of them, optionally at a minimum level
  const skills = csvList(q.skills);
  const levels = SKILL_LEVELS[q.skillLevel];
  const elem = (name) => ({ skills: { $elemMatch: { ...(name ? { name: rxOf(name) } : {}), ...(levels ? { level: { $in: levels } } : {}) } } });
  if (skills.length) { const parts = skills.map(elem); and.push(q.skillMatch === "all" ? { $and: parts } : { $or: parts }); }
  else if (levels) and.push(elem(""));

  if (q.experience === "none") and.push({ $or: [{ experience: { $exists: false } }, { experience: { $size: 0 } }] });
  else if (q.experience === "any") and.push({ "experience.0": { $exists: true } });
  else if (q.experience === "2plus") and.push({ "experience.1": { $exists: true } });
  if (q.expRole) { const rx = rxOf(q.expRole); and.push({ experience: { $elemMatch: { $or: [{ role: rx }, { company: rx }] } } }); }

  const placements = multi(q.placement);
  if (placements.length) {
    const sets = await placementSets();
    const clauseOf = (p) => (p === "placed" ? { user: { $in: [...sets.placed] } }
      : p === "in_process" ? { user: { $in: [...sets.inProcess] } }
      : p === "not_placed" ? { user: { $nin: [...sets.placed] } }
      : p === "not_applied" ? { user: { $nin: [...sets.applied] } } : null);
    const clauses = placements.map(clauseOf).filter(Boolean);
    if (clauses.length) and.push(clauses.length === 1 ? clauses[0] : { $or: clauses });
  }
  const has = (flag, ids) => and.push({ user: flag ? { $in: ids } : { $nin: ids } });
  if (q.resume) has(q.resume === "yes", await SavedResume.distinct("user"));
  if (q.interview) has(q.interview === "done", await InterviewSession.distinct("student", { status: "completed" }));
  if (q.aptitude) has(q.aptitude === "done", await AptitudeAttempt.distinct("student"));

  if (q.search) {
    const rx = rxOf(q.search);
    const users = await User.find({ role: "student", $or: [{ name: rx }, { email: rx }] }).select("_id");
    and.push({ $or: [{ user: { $in: users.map((u) => u._id) } }, { rollNo: rx }, { phone: rx }] });
  }
  return and.length ? { $and: and } : {};
}

// Thresholds used on the dashboard and the student pages: 75+ on track, 45-74 in progress, below 45 needs attention
const ON_TRACK = 75;
const IN_PROGRESS = 45;
const DAY = 24 * 60 * 60 * 1000;

// ---------- the signed-in officer's own profile ----------
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  designation: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, "Phone can only contain digits, spaces, + ( ) and -").optional(),
  institution: z.string().trim().max(120).optional(),
  officeLocation: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
});
const officerView = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  designation: u.designation || "", phone: u.phone || "", institution: u.institution || "",
  officeLocation: u.officeLocation || "", bio: u.bio || "", createdAt: u.createdAt,
});

router.get("/profile", asyncHandler(async (req, res) => res.json(officerView(req.user))));

router.put("/profile", validate(profileSchema), asyncHandler(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true }).select("-passwordHash");
  res.json(officerView(u));
}));

router.put("/password", validate(passwordSchema), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id); // req.user has no passwordHash, so load the full document
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  if (await bcrypt.compare(req.body.newPassword, u.passwordHash)) throw new HttpError(400, "New password must be different from the current one");
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await u.save();
  res.json({ ok: true });
}));

router.get("/dashboard", asyncHandler(async (req, res) => {
  const now = new Date();
  const dept = String(req.query.dept || "");
  const days = Number(req.query.range) || 0; // 0 = all time; otherwise drives created in the last N days

  const profiles = await StudentProfile.find(dept ? { department: dept } : {}).select("user readiness.score").lean();
  const userIds = profiles.map((p) => p.user);
  const userSet = new Set(userIds.map(String));

  const driveFilter = dept ? deptClause(dept) : {};
  if (days) driveFilter.createdAt = { $gte: new Date(now.getTime() - days * DAY) };

  const [drives, gaps, lists] = await Promise.all([
    PlacementDrive.find(driveFilter).select("status date deadline registeredStudents.student registeredStudents.status").lean(),
    SkillGapReport.aggregate([
      ...(dept ? [{ $match: { student: { $in: userIds } } }] : []),
      { $sort: { createdAt: -1 } },
      { $group: { _id: { student: "$student", role: "$targetRole" }, missing: { $first: "$missing" } } }, // latest report per student and role
      { $unwind: "$missing" },
      { $group: { _id: "$missing", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 },
    ]),
    listWithLegacy(),
  ]);

  const scores = profiles.map((p) => p.readiness?.score || 0);
  const onTrack = scores.filter((v) => v >= ON_TRACK).length;
  const needsAttention = scores.filter((v) => v < IN_PROGRESS).length;
  const active = drives.filter((d) => d.status !== "completed");
  const closingThisWeek = active.filter((d) => {
    const close = d.deadline || d.date;
    return close && close >= now && close - now <= 7 * DAY;
  }).length;
  const placementsConfirmed = drives.reduce((n, d) => n + (d.registeredStudents || []).filter((r) => r.status === "selected" && (!dept || userSet.has(String(r.student)))).length, 0);

  res.json({
    students: scores.length,
    avgReadiness: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    onTrack, needsAttention,
    inProgress: scores.length - onTrack - needsAttention,
    activeDrives: active.length, closingThisWeek, totalDrives: drives.length, placementsConfirmed,
    skillGaps: gaps.map((g) => ({ skill: g._id, students: g.count, action: `Run a workshop on ${g._id}` })),
    options: { departments: lists.departments },
  });
}));

router.get("/students", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const filter = await studentQuery(req.query);
  const [items, total, overall, sets, lists, roles, locations, skillRows, expRoles] = await Promise.all([
    StudentProfile.find(filter).populate("user", "name email")
      .select("user rollNo department program batch cgpa backlogs location targetRole readiness skills experience latestAtsScore")
      .sort(sortOf(req.query.sort)).skip((page - 1) * limit).limit(limit).lean(),
    StudentProfile.countDocuments(filter),
    StudentProfile.estimatedDocumentCount(),
    placementSets(),
    listWithLegacy(), StudentProfile.distinct("targetRole"), StudentProfile.distinct("location"),
    StudentProfile.aggregate([
      { $unwind: "$skills" },
      { $group: { _id: { $toLower: "$skills.name" }, name: { $first: "$skills.name" }, n: { $sum: 1 } } },
      { $sort: { n: -1 } }, { $limit: 120 },
    ]),
    StudentProfile.distinct("experience.role"),
  ]);
  res.json({
    items: items.map(({ skills = [], experience = [], ...p }) => ({
      ...p, skillCount: skills.length, skills: skills.slice(0, 4).map((x) => x.name),
      experienceCount: experience.length, placement: placementOf(sets, p.user?._id),
    })),
    total, overall, page, pages: Math.ceil(total / limit),
    departments: lists.departments, // kept for older callers
    // choices for the filter drop-downs (always the full list, not narrowed by the current filters)
    options: {
      departments: lists.departments, batches: lists.batches, programs: lists.programs, programsByDepartment: lists.programsByDepartment, generalPrograms: lists.generalPrograms, roles: cleanList(roles), locations: cleanList(locations),
      skills: skillRows.map((r) => r.name), experienceRoles: cleanList(expRoles).slice(0, 100),
    },
  });
}));

// ---------- choices for the drive form (departments and batches that exist in the student data) ----------
router.get("/options", asyncHandler(async (req, res) => res.json(await filterOptions())));

// ---------- the drop-down lists students pick from (departments, batches, programmes) ----------
// Programmes belong to a department ("B.Tech" under Computer Science). A programme with no department is open to everyone.
const typeSchema = z.enum(Object.keys(OPTION_TYPES));
const addListSchema = z.object({
  type: typeSchema,
  // one value, or several at once (the page splits "2026, 2027, 2028" for you)
  values: z.array(z.string().trim().min(1).max(80)).min(1, "Type at least one value").max(50),
  department: z.string().trim().max(80).optional().default(""), // programmes only; "" = every department
});
const renameListSchema = z.object({ value: z.string().trim().min(1, "Type a name").max(80) });
const tidy = (v) => String(v).trim().replace(/\s+/g, " ");
const byText = (a, b) => a.value.localeCompare(b.value, undefined, { numeric: true });

// Students who have this programme: those of its department, or (for an all-department programme) those whose
// department has no programme of the same name of its own.
async function programUsers(row) {
  if (row.department) return { program: row.value, department: row.department };
  const own = await Option.find({ type: "program", key: row.key, department: { $ne: "" } }).distinct("department");
  return { program: row.value, department: { $nin: own } };
}

// every list with how many students use each value
router.get("/lists", asyncHandler(async (req, res) => {
  const [rows, ...usage] = await Promise.all([
    Option.find().select("type value key department").lean(),
    ...Object.values(OPTION_TYPES).map((m) => (m.field === "program"
      ? StudentProfile.aggregate([{ $match: { program: { $nin: [null, ""] } } }, { $group: { _id: { d: "$department", s: "$program" }, n: { $sum: 1 } } }])
      : StudentProfile.aggregate([{ $match: { [m.field]: { $nin: [null, ""] } } }, { $group: { _id: `$${m.field}`, n: { $sum: 1 } } }]))),
  ]);
  const out = {};
  Object.entries(OPTION_TYPES).forEach(([type, meta], i) => {
    const mine = rows.filter((r) => r.type === type);
    let count;
    if (type === "program") {
      const pairs = new Map(usage[i].map((u) => [`${keyOf(u._id.d || "")}|${keyOf(u._id.s)}`, u.n]));
      const specific = new Set(mine.filter((r) => r.department).map((r) => `${keyOf(r.department)}|${r.key}`));
      count = (r) => (r.department
        ? pairs.get(`${keyOf(r.department)}|${r.key}`) || 0
        : [...pairs].filter(([k]) => k.endsWith(`|${r.key}`) && !specific.has(k)).reduce((n, [, v]) => n + v, 0));
    } else {
      const used = new Map(usage[i].map((u) => [keyOf(u._id), u.n]));
      count = (r) => used.get(r.key ?? keyOf(r.value)) || 0;
    }
    const items = mine.sort(byText).map((r) => ({ _id: r._id, value: r.value, department: r.department || "", students: count(r) }));
    out[type] = { label: meta.label, items: type === "batch" ? items.reverse() : items };
  });
  res.json(out);
}));

router.post("/lists", validate(addListSchema), asyncHandler(async (req, res) => {
  const { type, values } = req.body;
  let department = "";
  if (type === "program" && req.body.department) {
    const d = await Option.findOne({ type: "department", key: keyOf(req.body.department) }).select("value").lean();
    if (!d) throw new HttpError(400, `"${req.body.department}" is not in the Departments list. Add the department first.`);
    department = d.value;
  }
  const added = [], skipped = [];
  const seen = new Set();
  for (const raw of values) {
    const value = tidy(raw), key = keyOf(value);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = await Option.updateOne({ type, department, key }, { $setOnInsert: { type, value, key, department, createdBy: req.user._id } }, { upsert: true });
    (r.upsertedCount ? added : skipped).push(value);
  }
  res.status(added.length ? 201 : 200).json({ added, skipped });
}));

// Renaming also updates every student and drive that uses the old name
router.put("/lists/:id", validate(renameListSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "Unknown item");
  const row = await Option.findById(req.params.id);
  if (!row) throw new HttpError(404, "Item not found");
  const meta = OPTION_TYPES[row.type];
  const value = tidy(req.body.value), key = keyOf(value);
  if (key !== row.key && (await Option.exists({ type: row.type, department: row.department || "", key }))) throw new HttpError(409, `"${value}" is already in the list`);
  const old = row.value, oldKey = row.key, department = row.department || "";
  const studentFilter = row.type === "program" ? await programUsers(row) : { [meta.field]: old };
  row.value = value; row.key = key;
  await row.save();
  if (old !== value) {
    await StudentProfile.updateMany(studentFilter, { $set: { [meta.field]: value } });
    if (row.type === "department") await Option.updateMany({ type: "program", department: old }, { $set: { department: value } }); // its programmes follow
    if (meta.driveField) await PlacementDrive.updateMany({ [meta.driveField]: old }, { $set: { [`${meta.driveField}.$[e]`]: value } }, { arrayFilters: [{ e: old }] });
  }
  res.json({ _id: row._id, value, department });
}));

// A value that students still use cannot be removed (rename it instead, or move the students first)
router.delete("/lists/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "Unknown item");
  const row = await Option.findById(req.params.id);
  if (!row) throw new HttpError(404, "Item not found");
  const meta = OPTION_TYPES[row.type];
  const inUse = await StudentProfile.countDocuments(row.type === "program" ? await programUsers(row) : { [meta.field]: row.value });
  if (inUse) throw new HttpError(409, `${inUse} student${inUse === 1 ? " uses" : "s use"} "${row.value}", so it cannot be removed. Rename it instead.`);
  if (row.type === "department") {
    const programs = await Option.countDocuments({ type: "program", department: row.value });
    if (programs) throw new HttpError(409, `${row.value} still has ${programs} programme${programs === 1 ? "" : "s"}. Remove ${programs === 1 ? "it" : "them"} first.`);
  }
  await row.deleteOne();
  res.json({ ok: true });
}));

// How many students a drive's eligibility rules would reach (shown live while the officer edits the drive)
const eligibilitySchema = z.object({
  minCgpa: z.coerce.number().min(0).max(10).default(0),
  maxBacklogs: z.coerce.number().min(0).default(0),
  departments: z.array(z.string().trim()).default([]),
  batches: z.array(z.string().trim()).default([]),
});
router.post("/eligible-count", validate(eligibilitySchema), asyncHandler(async (req, res) => {
  const [{ yes, unsure }, total] = await Promise.all([audienceFor(req.body), StudentProfile.estimatedDocumentCount()]);
  res.json({ eligible: yes.length, unsure: unsure.length, total });
}));

// ---------- send a message to a chosen group of students ----------
// Who gets it is described one of four ways: `ids` (student profile ids ticked on the Students page),
// `userIds` (e.g. ticked applicants), `filters` (everyone matching the Students page filters) or `driveId` + `audience`.
const recipientShape = z.object({
  ids: z.array(z.string()).max(5000).optional(),
  userIds: z.array(z.string()).max(5000).optional(),
  filters: z.record(z.string()).optional(),
  driveId: z.string().optional(),
  audience: z.enum(["eligible", "not_applied", "applicants"]).default("eligible"),
});
const previewSchema = recipientShape.extend({ title: z.string().optional() });
const notifySchema = recipientShape.extend({
  title: z.string().trim().min(3, "Add a short title").max(120),
  message: z.string().trim().max(400).default(""),
  link: z.string().trim().max(80).regex(/^(\/[A-Za-z0-9\-_/]*)?$/, "Link must be a page inside the app").default(""),
  sms: z.boolean().default(false),
  email: z.boolean().default(false),
});

async function resolveRecipients(b) {
  const valid = (a) => (a || []).filter((x) => mongoose.isValidObjectId(x));
  let userIds;
  if (b.driveId) {
    if (!mongoose.isValidObjectId(b.driveId)) throw new HttpError(400, "Unknown drive");
    const drive = await PlacementDrive.findById(b.driveId).lean();
    if (!drive) throw new HttpError(404, "Drive not found");
    const applied = new Set((drive.registeredStudents || []).map((r) => String(r.student)));
    if (b.audience === "applicants") userIds = [...applied];
    else {
      const { yes } = await audienceFor(drive.eligibility || {});
      userIds = b.audience === "not_applied" ? yes.filter((id) => !applied.has(String(id))) : yes;
    }
  } else if (b.userIds?.length) {
    userIds = (await User.find({ _id: { $in: valid(b.userIds) }, role: "student" }).select("_id").lean()).map((u) => u._id);
  } else if (b.ids?.length || b.filters) {
    const filter = b.ids?.length ? { _id: { $in: valid(b.ids) } } : await studentQuery(b.filters);
    userIds = (await StudentProfile.find(filter).select("user").limit(5000).lean()).map((p) => p.user);
  } else throw new HttpError(400, "Choose who to notify");
  return [...new Set(userIds.map(String))];
}

router.post("/notify/preview", validate(previewSchema), asyncHandler(async (req, res) => {
  const ids = await resolveRecipients(req.body);
  const sample = ids.length ? await User.find({ _id: { $in: ids.slice(0, 4) } }).select("name").lean() : [];
  res.json({ count: ids.length, sample: sample.map((u) => u.name) });
}));

router.post("/notify", validate(notifySchema), asyncHandler(async (req, res) => {
  const ids = await resolveRecipients(req.body);
  if (!ids.length) throw new HttpError(400, "No students match this group, so nothing was sent");
  const { title, message, link, sms, email } = req.body;
  const sent = await notify(ids, { type: "announcement", title, message, link: link || undefined, sms, email });
  res.json({ sent });
}));

router.get("/students/:id", asyncHandler(async (req, res) => {
  const p = await StudentProfile.findById(req.params.id).populate("user", "name email").lean();
  if (!p) throw new HttpError(404, "Student not found");
  const breakdown = await readinessBreakdown(p.user._id, p);
  res.json({
    _id: p._id, name: p.user.name, email: p.user.email,
    rollNo: p.rollNo, department: p.department, program: p.program, batch: p.batch, cgpa: p.cgpa, backlogs: p.backlogs,
    phone: p.phone, location: p.location, links: p.links || {}, targetRole: p.targetRole,
    skills: p.skills || [], readiness: p.readiness?.score || 0, breakdown,
  });
}));

router.get("/analytics", asyncHandler(async (req, res) => {
  // filters (all optional): dept, batch (students) and company, from/to (drive date)
  const { dept, batch } = req.query;
  const profileFilter = {};
  if (dept) profileFilter.department = dept;
  if (batch) profileFilter.batch = batch;
  const scoped = !!(dept || batch);

  const [profiles, drives, options] = await Promise.all([
    StudentProfile.find(profileFilter).select("user department cgpa readiness.score").lean(),
    PlacementDrive.find(driveFilterFrom(req.query)).populate("company", "name").select("title company status registeredStudents.student registeredStudents.status").lean(),
    filterOptions(),
  ]);
  const userIds = profiles.map((p) => p.user);
  const userSet = new Set(userIds.map(String));
  const regsOf = (d) => (d.registeredStudents || []).filter((r) => !scoped || userSet.has(String(r.student)));
  const onlyThese = scoped ? [{ $match: { student: { $in: userIds } } }] : [];

  const [missing, interviews] = await Promise.all([
    SkillGapReport.aggregate([
      ...onlyThese,
      { $sort: { createdAt: -1 } },
      { $group: { _id: { student: "$student", role: "$targetRole" }, missing: { $first: "$missing" } } }, // latest report per student and role
      { $unwind: "$missing" },
      { $group: { _id: "$missing", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]),
    InterviewSession.aggregate([...onlyThese, { $group: { _id: "$status", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } }]),
  ]);

  // headline numbers, plus which students have at least one selection (placed)
  const statusCount = { registered: 0, shortlisted: 0, selected: 0, rejected: 0 };
  const placedIds = new Set();
  for (const d of drives) for (const r of regsOf(d)) {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    if (r.status === "selected") placedIds.add(String(r.student));
  }
  const withCgpa = profiles.filter((p) => p.cgpa != null);
  const applications = Object.values(statusCount).reduce((a, b) => a + b, 0);
  const kpis = {
    students: profiles.length,
    avgReadiness: profiles.length ? Math.round(profiles.reduce((n, p) => n + (p.readiness?.score || 0), 0) / profiles.length) : 0,
    avgCgpa: withCgpa.length ? Math.round((withCgpa.reduce((n, p) => n + p.cgpa, 0) / withCgpa.length) * 100) / 100 : null,
    totalDrives: drives.length,
    openDrives: drives.filter((d) => d.status !== "completed").length,
    applications,
    shortlisted: statusCount.shortlisted,
    selected: statusCount.selected,
    placedStudents: [...placedIds].filter((id) => userSet.has(id)).length,
    placementRate: profiles.length ? Math.round(([...placedIds].filter((id) => userSet.has(id)).length / profiles.length) * 100) : 0,
  };

  // per department
  const byDeptMap = new Map();
  for (const p of profiles) {
    if (!p.department) continue;
    const e = byDeptMap.get(p.department) || { scoreSum: 0, students: 0, cgpaSum: 0, cgpaN: 0, placed: 0 };
    e.scoreSum += p.readiness?.score || 0; e.students += 1;
    if (p.cgpa != null) { e.cgpaSum += p.cgpa; e.cgpaN += 1; }
    if (placedIds.has(String(p.user))) e.placed += 1;
    byDeptMap.set(p.department, e);
  }
  const departmentReadiness = [...byDeptMap.entries()].map(([department, e]) => ({
    department, avg: Math.round(e.scoreSum / e.students), students: e.students, placed: e.placed,
    avgCgpa: e.cgpaN ? Math.round((e.cgpaSum / e.cgpaN) * 100) / 100 : null,
  })).sort((a, b) => b.avg - a.avg);

  const edges = [[0, 20, "0-19"], [20, 40, "20-39"], [40, 60, "40-59"], [60, 80, "60-79"], [80, 101, "80-100"]];
  const readinessDistribution = profiles.length
    ? edges.map(([lo, hi, range]) => ({ range, count: profiles.filter((p) => { const v = p.readiness?.score || 0; return v >= lo && v < hi; }).length }))
    : [];

  const driveFunnel = drives.map((d) => {
    const regs = regsOf(d);
    const company = d.company?.name;
    return {
      title: d.title, company, registered: regs.length,
      shortlisted: regs.filter((r) => r.status === "shortlisted" || r.status === "selected").length,
      selected: regs.filter((r) => r.status === "selected").length,
      name: `${company || "Company"} - ${d.title}`.slice(0, 40),
    };
  }).filter((d) => !scoped || d.registered > 0).sort((a, b) => b.registered - a.registered).slice(0, 8);

  res.json({
    readinessDistribution, kpis,
    applicationStatus: Object.entries(statusCount).map(([status, count]) => ({ status, count })),
    departmentReadiness, driveFunnel,
    topMissingSkills: missing.map((m) => ({ skill: m._id, students: m.count })),
    interviews: interviews.map((i) => ({ status: i._id, count: i.count, avgScore: i.avgScore ? Math.round(i.avgScore * 10) / 10 : null })),
    options,
  });
}));

router.get("/export/students.csv", asyncHandler(async (req, res) => {
  const [items, sets] = await Promise.all([
    StudentProfile.find(await studentQuery(req.query)).populate("user", "name email").sort(sortOf(req.query.sort)).lean(),
    placementSets(),
  ]);
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const PLACEMENT = { placed: "Placed", in_process: "In process", not_selected: "Not selected", not_applied: "Not applied" };
  const header = ["Name", "Email", "Phone", "Roll No", "Department", "Programme", "Batch", "CGPA", "Backlogs", "Location", "Target Role", "Skills", "Experience entries", "Readiness", "ATS Score", "Placement"];
  const rows = items.map((p) => [
    p.user?.name, p.user?.email, p.phone, p.rollNo, p.department, p.program, p.batch, p.cgpa, p.backlogs, p.location, p.targetRole,
    (p.skills || []).map((x) => x.name).join("; "), (p.experience || []).length, p.readiness?.score, p.latestAtsScore?.score, PLACEMENT[placementOf(sets, p.user?._id)],
  ].map(cell).join(","));
  res.set({ "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="students.csv"' });
  res.send([header.join(","), ...rows].join("\n"));
}));

// One row per drive: how many applied, were shortlisted and selected
router.get("/export/drives.csv", asyncHandler(async (req, res) => {
  const drives = await PlacementDrive.find(driveFilterFrom(req.query)).populate("company", "name").sort("-date").lean();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const header = ["Company", "Role", "Drive date", "Register by", "Status", "Package", "Min CGPA", "Max backlogs", "Applied", "Shortlisted", "Selected", "Rejected"];
  const count = (d, st) => (d.registeredStudents || []).filter((r) => r.status === st).length;
  const rows = drives.map((d) => [d.company?.name, d.role, day(d.date), day(d.deadline), d.status, d.package, d.eligibility?.minCgpa, d.eligibility?.maxBacklogs,
    (d.registeredStudents || []).length, count(d, "shortlisted"), count(d, "selected"), count(d, "rejected")].map(cell).join(","));
  res.set({ "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="drives-report.csv"' });
  res.send([header.join(","), ...rows].join("\n"));
}));

export default router;
