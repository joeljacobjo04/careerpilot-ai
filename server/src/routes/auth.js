import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { protect, signToken } from "../middleware/auth.js";
import { normalizePhone } from "../services/sms.service.js";
import { notifySafe, officerIds } from "../services/notify.service.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  // NEW: required, so placement alerts can reach people by SMS
  phone: z.string().trim().min(1, "Phone number is required").max(20)
    .refine((v) => normalizePhone(v), "Enter a valid phone number (10 digits, or start with + and your country code)"),
  role: z.enum(["student", "officer"]).default("student"),
  inviteCode: z.string().optional(),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

const publicUser = async (u) => {
  const base = { id: u._id, name: u.name, email: u.email, role: u.role, avatar: u.avatar || "" };
  if (u.role === "student") {
    const p = await StudentProfile.findOne({ user: u._id }).select("department").lean();
    base.department = p?.department || "";
  }
  return base;
};

router.post("/register", validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, role, inviteCode } = req.body;
  const phone = normalizePhone(req.body.phone);
  // Officers cannot self-register without the institution's invite code.
  if (role === "officer" && (!process.env.OFFICER_INVITE_CODE || inviteCode !== process.env.OFFICER_INVITE_CODE)) {
    throw new HttpError(403, "A valid officer invite code is required");
  }
  if (await User.findOne({ email: email.toLowerCase() })) throw new HttpError(409, "An account with this email already exists");

  const user = await User.create({ name, email, role, phone, passwordHash: await bcrypt.hash(password, 12) });
  if (role === "student") {
    await StudentProfile.create({ user: user._id, phone });
    // let the placement cell know a new student joined (in-app only)
    officerIds().then((ids) => notifySafe(ids, { type: "student_joined", title: `New student: ${name}`, message: "A student just created an account.", link: "/officer/students", sms: false })).catch(() => {});
  }
  res.status(201).json({ token: signToken(user), user: await publicUser(user) });
}));

router.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw new HttpError(401, "Incorrect email or password");
  res.json({ token: signToken(user), user: await publicUser(user) });
}));

router.get("/me", protect, asyncHandler(async (req, res) => res.json({ user: await publicUser(req.user) })));

export default router;
