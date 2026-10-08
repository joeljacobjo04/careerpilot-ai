import { Router } from "express";
import { z } from "zod";
import PlacementDrive from "../models/PlacementDrive.js";
import StudentProfile from "../models/StudentProfile.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(protect);

const driveSchema = z.object({
  company: z.string().min(1),
  title: z.string().trim().min(2).max(140),
  role: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1500).optional(),
  location: z.string().trim().max(100).optional(),
  package: z.string().trim().max(60).optional(),
  date: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  eligibility: z.object({
    minCgpa: z.coerce.number().min(0).max(10).default(0),
    maxBacklogs: z.coerce.number().min(0).default(0),
    departments: z.array(z.string().trim()).default([]),
  }).default({}),
  rounds: z.array(z.string().trim()).default([]),
  status: z.enum(["upcoming", "ongoing", "completed"]).default("upcoming"),
});

const eligibleFilter = (e) => {
  const f = { cgpa: { $gte: e.minCgpa || 0 }, backlogs: { $lte: e.maxBacklogs ?? 0 } };
  if (e.departments?.length) f.department = { $in: e.departments };
  return f;
};

// Both roles can list drives. Students only get their own registration status.
router.get("/", asyncHandler(async (req, res) => {
  const drives = await PlacementDrive.find().populate("company", "name industry").sort("-date").lean();
  if (req.user.role === "officer") {
    return res.json(drives.map((d) => ({ ...d, registeredCount: d.registeredStudents.length })));
  }
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();
  res.json(drives.map(({ registeredStudents, ...d }) => {
    const mine = registeredStudents.find((r) => String(r.student) === String(req.user._id));
    const e = d.eligibility || {};
    const eligible = !!profile && (profile.cgpa ?? 0) >= (e.minCgpa || 0) && (profile.backlogs ?? 0) <= (e.maxBacklogs ?? 0) &&
      (!e.departments?.length || e.departments.includes(profile.department));
    return { ...d, registeredCount: registeredStudents.length, myStatus: mine?.status || null, eligible };
  }));
}));

// Officer detail view of one drive (company populated, with applicant counts)
router.get("/:id", authorize("officer"), asyncHandler(async (req, res) => {
  const d = await PlacementDrive.findById(req.params.id).populate("company", "name industry").lean();
  if (!d) throw new HttpError(404, "Drive not found");
  const regs = d.registeredStudents || [];
  res.json({
    ...d, registeredStudents: undefined,
    registeredCount: regs.length,
    shortlistedCount: regs.filter((r) => r.status === "shortlisted").length,
    selectedCount: regs.filter((r) => r.status === "selected").length,
  });
}));

router.post("/", authorize("officer"), validate(driveSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await PlacementDrive.create({ ...req.body, createdBy: req.user._id }))));

router.put("/:id", authorize("officer"), validate(driveSchema), asyncHandler(async (req, res) => {
  const d = await PlacementDrive.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!d) throw new HttpError(404, "Drive not found");
  res.json(d);
}));

router.delete("/:id", authorize("officer"), asyncHandler(async (req, res) => {
  await PlacementDrive.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

router.get("/:id/eligible-students", authorize("officer"), asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findById(req.params.id);
  if (!drive) throw new HttpError(404, "Drive not found");
  const students = await StudentProfile.find(eligibleFilter(drive.eligibility))
    .populate("user", "name email").select("user rollNo department cgpa backlogs readiness").sort("-readiness.score").limit(200);
  res.json(students);
}));

router.get("/:id/registrations", authorize("officer"), asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findById(req.params.id).populate("registeredStudents.student", "name email");
  if (!drive) throw new HttpError(404, "Drive not found");
  const profiles = await StudentProfile.find({ user: { $in: drive.registeredStudents.map((r) => r.student?._id) } })
    .select("user rollNo department cgpa readiness");
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));
  res.json(drive.registeredStudents.map((r) => ({
    student: r.student, status: r.status, registeredAt: r.registeredAt, profile: byUser.get(String(r.student?._id)) || null,
  })));
}));

router.put("/:id/registrations/:studentId", authorize("officer"),
  validate(z.object({ status: z.enum(["registered", "shortlisted", "selected", "rejected"]) })),
  asyncHandler(async (req, res) => {
    const drive = await PlacementDrive.findById(req.params.id);
    const entry = drive?.registeredStudents.find((r) => String(r.student) === req.params.studentId);
    if (!entry) throw new HttpError(404, "Registration not found");
    entry.status = req.body.status;
    await drive.save();
    res.json({ ok: true });
  }));

router.post("/:id/register", authorize("student"), asyncHandler(async (req, res) => {
  const [drive, profile] = await Promise.all([
    PlacementDrive.findById(req.params.id),
    StudentProfile.findOne({ user: req.user._id }),
  ]);
  if (!drive) throw new HttpError(404, "Drive not found");
  if (drive.status === "completed") throw new HttpError(400, "This drive has closed");
  if (drive.deadline && drive.deadline < new Date()) throw new HttpError(400, "The registration deadline has passed");
  if (drive.registeredStudents.some((r) => String(r.student) === String(req.user._id))) throw new HttpError(409, "Already registered");

  const e = drive.eligibility;
  if ((profile?.cgpa ?? 0) < e.minCgpa) throw new HttpError(403, `Minimum CGPA is ${e.minCgpa}`);
  if ((profile?.backlogs ?? 0) > e.maxBacklogs) throw new HttpError(403, `Maximum ${e.maxBacklogs} backlogs allowed`);
  if (e.departments.length && !e.departments.includes(profile?.department)) throw new HttpError(403, "Your department is not eligible");

  drive.registeredStudents.push({ student: req.user._id });
  await drive.save();
  res.json({ ok: true });
}));

export default router;
