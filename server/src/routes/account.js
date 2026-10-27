import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { normalizePhone } from "../services/sms.service.js";
import { deleteStudentAccount } from "../services/accountDeletion.service.js";

/**
 * Account settings that both students and officers share: name, phone, profile picture and password.
 * (Student academic details live in /api/profile; officer job details in /api/officer/profile.)
 */
const router = Router();
router.use(protect);

const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: "Too many password attempts. Try again in a few minutes." } });

const AVATAR_RX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const accountSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  phone: z.string().trim().max(20).refine((v) => !v || normalizePhone(v), "Enter a valid phone number (10 digits, or start with + and your country code)").optional(),
  // "" removes the picture
  avatar: z.string().max(250000, "That picture is too large").refine((v) => v === "" || AVATAR_RX.test(v), "Use a JPG, PNG or WebP picture").optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
});

async function view(user) {
  const u = await User.findById(user._id).select("name email role phone avatar createdAt").lean();
  const phone = u.role === "student"
    ? (await StudentProfile.findOne({ user: u._id }).select("phone").lean())?.phone || u.phone || ""
    : u.phone || "";
  return { id: u._id, name: u.name, email: u.email, role: u.role, phone, avatar: u.avatar || "", createdAt: u.createdAt };
}

router.get("/", asyncHandler(async (req, res) => res.json(await view(req.user))));

router.put("/", validate(accountSchema), asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const set = {};
  if (name !== undefined) set.name = name;
  if (avatar !== undefined) set.avatar = avatar;
  if (phone !== undefined) {
    const value = phone ? normalizePhone(phone) : "";
    set.phone = value;
    // alerts go to the number on the student profile, so keep the two in step
    if (req.user.role === "student") await StudentProfile.updateOne({ user: req.user._id }, { phone: value }, { upsert: true });
  }
  if (Object.keys(set).length) await User.updateOne({ _id: req.user._id }, set);
  res.json(await view(req.user));
}));

router.put("/password", passwordLimiter, validate(passwordSchema), asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id); // req.user has no passwordHash
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  if (await bcrypt.compare(req.body.newPassword, u.passwordHash)) throw new HttpError(400, "New password must be different from the current one");
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await u.save();
  res.json({ ok: true });
}));

const deleteSchema = z.object({ password: z.string().min(1, "Enter your password to confirm") });

// A student can delete their own account (officers cannot, so the placement cell is never left without one).
router.delete("/", passwordLimiter, validate(deleteSchema), asyncHandler(async (req, res) => {
  if (req.user.role !== "student") throw new HttpError(403, "Only student accounts can be deleted here");
  const u = await User.findById(req.user._id);
  if (!(await bcrypt.compare(req.body.password, u.passwordHash))) throw new HttpError(400, "Password is incorrect");
  await deleteStudentAccount(req.user._id, { by: "self" });
  res.json({ ok: true, message: "Your account has been deleted. A confirmation was sent to your email." });
}));

export default router;
