import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { protect, signToken } from "../middleware/auth.js";
import { normalizePhone } from "../services/sms.service.js";
import { notifySafe, officerIds } from "../services/notify.service.js";
import { appUrl, emailConfigured, sendPasswordChangedEmail, sendPasswordResetEmail } from "../services/email.service.js";

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

// ---------- forgot / reset password (by email) ----------
const RESET_MINUTES = 30;
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: { message: "Too many reset requests. Try again in a few minutes." } });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: "Too many attempts. Try again in a few minutes." } });

const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

// Always answers the same way, so nobody can use this to find out which emails have accounts.
router.post("/forgot-password", forgotLimiter, validate(forgotSchema), asyncHandler(async (req, res) => {
  const reply = { message: "If an account exists for that email, a reset link is on its way. It is valid for 30 minutes." };
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = sha256(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await user.save();
    const link = `/reset-password?token=${token}`;
    // sent in the background so the response time does not reveal whether the account exists
    sendPasswordResetEmail(user.email, link, RESET_MINUTES)
      .then((r) => {
        // no email provider set up: in development print the link so the flow can still be tested
        if (!r.sent && !emailConfigured() && process.env.NODE_ENV !== "production") console.log(`[dev] password reset link for ${user.email}: ${appUrl(link)}`);
      })
      .catch((e) => console.error("[auth] reset email failed:", e.message));
  }
  res.json(reply);
}));

router.post("/reset-password", resetLimiter, validate(resetSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetTokenExpires: { $gt: new Date() } }).select("+resetTokenHash +resetTokenExpires");
  if (!user) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.passwordChangedAt = new Date();
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  sendPasswordChangedEmail(user.email).catch((e) => console.error("[auth] password-changed email failed:", e.message));
  res.json({ ok: true, message: "Password updated. You can sign in now." });
}));

router.get("/me", protect, asyncHandler(async (req, res) => res.json({ user: await publicUser(req.user) })));

export default router;
