import { Router } from "express";
import StudentProfile from "../models/StudentProfile.js";
import { protect, authorize } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { profileCompleteness, refreshReadiness } from "../services/readiness.service.js";
import { listManaged, resolveChoice, resolveProgram, programAllowed } from "../services/options.service.js";

const router = Router();
router.use(protect, authorize("student"));

// "experience" and "languages" are new list sections
const SECTIONS = ["skills", "certifications", "projects", "education", "experience", "languages"];
// "headline" and "location" are new editable fields
const EDITABLE = ["rollNo", "department", "program", "batch", "cgpa", "backlogs", "phone", "headline", "location", "links", "targetRole", "interests"];

// These fields are drop-downs: the value must be one the placement officer has added to the lists.
// (The programme is also a drop-down, but it depends on the department, so it is checked separately below.)
const CHOICES = ["department", "batch"];

const getProfile = (userId) =>
  StudentProfile.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true });

const respond = (res, profile) => res.json({ profile, completeness: profileCompleteness(profile) });

router.get("/", asyncHandler(async (req, res) => respond(res, await getProfile(req.user._id))));

// Choices for the Department, Programme and Batch drop-downs (managed by placement officers).
// Programmes come grouped by department: programsByDepartment[dept] plus generalPrograms (open to everyone).
router.get("/options", asyncHandler(async (req, res) => res.json(await listManaged())));

router.put("/", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user._id);
  const departmentBefore = profile.department;
  for (const key of EDITABLE) {
    if (req.body[key] === undefined || key === "program") continue;
    profile[key] = CHOICES.includes(key) ? await resolveChoice(key, req.body[key], profile[key]) : req.body[key];
  }
  if (req.body.program !== undefined) {
    // a programme must belong to the student's own department
    profile.program = await resolveProgram(req.body.program, profile.department, profile.program, departmentBefore);
  } else if (profile.program && profile.department !== departmentBefore && !(await programAllowed(profile.program, profile.department))) {
    profile.program = ""; // moved to another department: the old programme does not exist there
  }
  await profile.save();
  refreshReadiness(req.user._id);
  respond(res, profile);
}));

router.use("/:section", (req, res, next) =>
  SECTIONS.includes(req.params.section) ? next() : next(new HttpError(404, "Unknown profile section")));

router.post("/:section", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user._id);
  profile[req.params.section].push(req.body);
  await profile.save();
  refreshReadiness(req.user._id);
  respond(res, profile);
}));

router.put("/:section/:id", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user._id);
  const item = profile[req.params.section].id(req.params.id);
  if (!item) throw new HttpError(404, "Item not found");
  item.set(req.body);
  await profile.save();
  respond(res, profile);
}));

router.delete("/:section/:id", asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user._id);
  const item = profile[req.params.section].id(req.params.id);
  if (!item) throw new HttpError(404, "Item not found");
  item.deleteOne();
  await profile.save();
  refreshReadiness(req.user._id);
  respond(res, profile);
}));

export default router;