import { Router } from "express";
import { z } from "zod";
import PlacementDrive from "../models/PlacementDrive.js";
import StudentProfile from "../models/StudentProfile.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { closesWithinDay, driveLabel, audienceFor, eligibleFilter, fmtDate, notifySafe, officerIds } from "../services/notify.service.js";

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

router.post("/", authorize("officer"), validate(driveSchema), asyncHandler(async (req, res) => {
  // if the deadline is already under 24h away, the announcement below doubles as the reminder
  const drive = await PlacementDrive.create({ ...req.body, createdBy: req.user._id, deadlineReminderSent: closesWithinDay(req.body.deadline) });

  // Announce to students, then report how many were told so the officer can see it worked.
  // notified: null means the announcement failed (the drive itself was still created).
  let notified = 0;
  if (drive.status !== "completed") {
    await drive.populate("company", "name");
    const { yes, unsure } = await audienceFor(drive.eligibility);
    const parts = [`${drive.role} at ${drive.company?.name}.`, drive.date && `Drive date: ${fmtDate(drive.date)}.`, drive.deadline && `Register by ${fmtDate(drive.deadline)}.`].filter(Boolean).join(" ");
    const base = { type: "drive_new", title: `New drive: ${driveLabel(drive)}`, link: "/drives" };
    const sent = await Promise.all([
      notifySafe(yes, { ...base, message: parts }),
      // students with no CGPA or department yet: tell them, and nudge them to finish their profile
      notifySafe(unsure, { ...base, message: `${parts} Complete your profile (CGPA and department) to check your eligibility.` }),
    ]);
    notified = sent.includes(undefined) ? null : sent[0] + sent[1];
    console.log(`[notify] new drive "${driveLabel(drive)}": ${yes.length} eligible + ${unsure.length} incomplete-profile student(s)${notified === null ? " (FAILED, see error above)" : ""}`);
  }
  res.status(201).json({ ...drive.toObject(), notified });
}));

const ts = (x) => (x ? new Date(x).getTime() : null);

router.put("/:id", authorize("officer"), validate(driveSchema), asyncHandler(async (req, res) => {
  const before = await PlacementDrive.findById(req.params.id).lean();
  if (!before) throw new HttpError(404, "Drive not found");
  const deadlineChanged = ts(before.deadline) !== ts(req.body.deadline);
  const body = deadlineChanged ? { ...req.body, deadlineReminderSent: closesWithinDay(req.body.deadline) } : req.body;

  const d = await PlacementDrive.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).populate("company", "name");
  res.json(d);

  const changes = [];
  if (ts(before.date) !== ts(d.date)) changes.push(`Drive date is now ${fmtDate(d.date) || "to be announced"}.`);
  if (deadlineChanged) changes.push(`Registration deadline is now ${fmtDate(d.deadline) || "not set"}.`);
  const closed = before.status !== "completed" && d.status === "completed";
  const registered = d.registeredStudents.map((r) => r.student);
  if (closed) notifySafe(registered, { type: "drive_update", title: `Drive closed: ${driveLabel(d)}`, message: "This drive has been marked as closed.", link: "/drives" });
  else if (changes.length) notifySafe(registered, { type: "drive_update", title: `Drive updated: ${driveLabel(d)}`, message: changes.join(" "), link: "/drives" });
}));

router.delete("/:id", authorize("officer"), asyncHandler(async (req, res) => {
  const d = await PlacementDrive.findByIdAndDelete(req.params.id).populate("company", "name");
  res.json({ ok: true });
  if (d) notifySafe(d.registeredStudents.map((r) => r.student), { type: "drive_cancelled", title: `Drive cancelled: ${driveLabel(d)}`, message: "This drive has been removed by the placement cell.", link: "/drives" });
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
    .select("user rollNo department cgpa readiness phone");
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
    const previous = entry.status;
    entry.status = req.body.status;
    await drive.save();
    res.json({ ok: true });

    if (previous !== entry.status && entry.status !== "registered") {
      await drive.populate("company", "name");
      const label = driveLabel(drive);
      const text = {
        shortlisted: { title: `You're shortlisted for ${label}`, message: "Check the drive page for the next steps.", sms: true },
        selected: { title: `Congratulations! You're selected for ${label}`, message: "Your placement officer will share the next steps.", sms: true },
        rejected: { title: `Update on ${label}`, message: "You were not selected for this drive. More drives are on the way.", sms: false }, // not sent by SMS on purpose
      }[entry.status];
      notifySafe([entry.student], { type: "status", link: "/drives", ...text });
    }
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

  (async () => {
    await drive.populate("company", "name");
    const label = driveLabel(drive);
    await notifySafe([req.user._id], { type: "application", title: `Application submitted: ${label}`, message: "You'll be notified when your status changes.", link: "/drives", sms: false });
    await notifySafe(await officerIds(), { type: "application", title: `${req.user.name} applied to ${label}`, message: `${drive.registeredStudents.length} applicant(s) so far.`, link: `/officer/drives/${drive._id}/applicants`, sms: false });
  })().catch((e) => console.error("[notify]", e.message));
}));

export default router;
