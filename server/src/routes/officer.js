import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import Company from "../models/Company.js";
import PlacementDrive from "../models/PlacementDrive.js";
import SkillGapReport from "../models/SkillGapReport.js";
import InterviewSession from "../models/InterviewSession.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { readinessBreakdown } from "../services/readiness.service.js";

const router = Router();
router.use(protect, authorize("officer"));

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function studentQuery(q) {
  const filter = {};
  if (q.dept) filter.department = q.dept;
  if (q.minReadiness) filter["readiness.score"] = { $gte: Number(q.minReadiness) };
  if (q.search) {
    const rx = new RegExp(escapeRx(String(q.search)), "i");
    const users = await User.find({ role: "student", $or: [{ name: rx }, { email: rx }] }).select("_id");
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { rollNo: rx }];
  }
  return filter;
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
  const [profiles, drives, gaps] = await Promise.all([
    StudentProfile.find().select("readiness.score").lean(),
    PlacementDrive.find().select("status date deadline registeredStudents.status").lean(),
    SkillGapReport.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: { student: "$student", role: "$targetRole" }, missing: { $first: "$missing" } } }, // latest report per student and role
      { $unwind: "$missing" },
      { $group: { _id: "$missing", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 },
    ]),
  ]);

  const scores = profiles.map((p) => p.readiness?.score || 0);
  const onTrack = scores.filter((v) => v >= ON_TRACK).length;
  const needsAttention = scores.filter((v) => v < IN_PROGRESS).length;
  const active = drives.filter((d) => d.status !== "completed");
  const closingThisWeek = active.filter((d) => {
    const close = d.deadline || d.date;
    return close && close >= now && close - now <= 7 * DAY;
  }).length;
  const placementsConfirmed = drives.reduce((n, d) => n + (d.registeredStudents || []).filter((r) => r.status === "selected").length, 0);

  res.json({
    students: scores.length,
    avgReadiness: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    onTrack, needsAttention,
    inProgress: scores.length - onTrack - needsAttention,
    activeDrives: active.length, closingThisWeek, totalDrives: drives.length, placementsConfirmed,
    skillGaps: gaps.map((g) => ({ skill: g._id, students: g.count, action: `Run a workshop on ${g._id}` })),
  });
}));

router.get("/students", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const filter = await studentQuery(req.query);
  const [items, total, departments] = await Promise.all([
    StudentProfile.find(filter).populate("user", "name email")
      .select("user rollNo department batch cgpa backlogs targetRole readiness skills latestAtsScore")
      .sort("-readiness.score").skip((page - 1) * limit).limit(limit).lean(),
    StudentProfile.countDocuments(filter),
    StudentProfile.distinct("department"),
  ]);
  res.json({
    items: items.map((p) => ({ ...p, skillCount: p.skills?.length || 0, skills: undefined })),
    total, page, pages: Math.ceil(total / limit), departments: departments.filter(Boolean),
  });
}));

router.get("/students/:id", asyncHandler(async (req, res) => {
  const p = await StudentProfile.findById(req.params.id).populate("user", "name email").lean();
  if (!p) throw new HttpError(404, "Student not found");
  const breakdown = await readinessBreakdown(p.user._id, p);
  res.json({
    _id: p._id, name: p.user.name, email: p.user.email,
    rollNo: p.rollNo, department: p.department, batch: p.batch, cgpa: p.cgpa, backlogs: p.backlogs,
    phone: p.phone, location: p.location, links: p.links || {}, targetRole: p.targetRole,
    skills: p.skills || [], readiness: p.readiness?.score || 0, breakdown,
  });
}));

router.get("/analytics", asyncHandler(async (req, res) => {
  const [histogram, byDept, driveStats, missing, interviews] = await Promise.all([
    StudentProfile.aggregate([
      { $bucket: { groupBy: { $ifNull: ["$readiness.score", 0] }, boundaries: [0, 20, 40, 60, 80, 101], default: "other", output: { count: { $sum: 1 } } } },
    ]),
    StudentProfile.aggregate([
      { $match: { department: { $exists: true, $ne: "" } } },
      { $group: { _id: "$department", avg: { $avg: "$readiness.score" }, students: { $sum: 1 } } },
      { $sort: { avg: -1 } },
    ]),
    PlacementDrive.aggregate([
      { $lookup: { from: "companies", localField: "company", foreignField: "_id", as: "co" } },
      { $project: {
          title: 1, company: { $arrayElemAt: ["$co.name", 0] },
          registered: { $size: "$registeredStudents" },
          shortlisted: { $size: { $filter: { input: "$registeredStudents", as: "r", cond: { $in: ["$$r.status", ["shortlisted", "selected"]] } } } },
          selected: { $size: { $filter: { input: "$registeredStudents", as: "r", cond: { $eq: ["$$r.status", "selected"] } } } },
      } },
      { $sort: { registered: -1 } }, { $limit: 8 },
    ]),
    SkillGapReport.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: { student: "$student", role: "$targetRole" }, missing: { $first: "$missing" } } }, // latest report per student and role
      { $unwind: "$missing" },
      { $group: { _id: "$missing", count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 },
    ]),
    InterviewSession.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } },
    ]),
  ]);

  const labels = { 0: "0-19", 20: "20-39", 40: "40-59", 60: "60-79", 80: "80-100" };
  res.json({
    readinessDistribution: histogram.filter((b) => b._id !== "other").map((b) => ({ range: labels[b._id], count: b.count })),
    departmentReadiness: byDept.map((d) => ({ department: d._id, avg: Math.round(d.avg || 0), students: d.students })),
    driveFunnel: driveStats,
    topMissingSkills: missing.map((m) => ({ skill: m._id, students: m.count })),
    interviews: interviews.map((i) => ({ status: i._id, count: i.count, avgScore: i.avgScore ? Math.round(i.avgScore * 10) / 10 : null })),
  });
}));

router.get("/export/students.csv", asyncHandler(async (req, res) => {
  const items = await StudentProfile.find(await studentQuery(req.query)).populate("user", "name email").sort("-readiness.score").lean();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Name", "Email", "Roll No", "Department", "Batch", "CGPA", "Backlogs", "Target Role", "Readiness", "ATS Score"];
  const rows = items.map((p) => [p.user?.name, p.user?.email, p.rollNo, p.department, p.batch, p.cgpa, p.backlogs, p.targetRole, p.readiness?.score, p.latestAtsScore?.score].map(cell).join(","));
  res.set({ "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="students.csv"' });
  res.send([header.join(","), ...rows].join("\n"));
}));

export default router;