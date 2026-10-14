import { Router } from "express";
import { z } from "zod";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import PushSubscription from "../models/PushSubscription.js";
import { normalizePhone, smsConfigured } from "../services/sms.service.js";
import { publicKey, pushConfigured } from "../services/push.service.js";

const router = Router();
router.use(protect); // students and officers each see only their own

const mine = (req) => ({ user: req.user._id });

// where this person's phone number lives: the student profile for students, the user for officers
async function readPhone(user) {
  if (user.role === "student") return (await StudentProfile.findOne({ user: user._id }).select("phone").lean())?.phone || "";
  return (await User.findById(user._id).select("phone").lean())?.phone || "";
}

// Small payload for the bell in the sidebar (polled every 30s)
router.get("/summary", asyncHandler(async (req, res) => {
  const [unread, items, phone] = await Promise.all([
    Notification.countDocuments({ ...mine(req), read: false }),
    Notification.find(mine(req)).sort("-createdAt").limit(6).lean(),
    readPhone(req.user),
  ]);
  res.json({ unread, items, needsPhone: !normalizePhone(phone) });
}));

router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const filter = { ...mine(req), ...(req.query.filter === "unread" ? { read: false } : {}) };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...mine(req), read: false }),
  ]);
  res.json({ items, total, unread, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

// ----- phone + SMS preferences -----
const phoneRule = z.string().trim().max(20).refine((v) => !v || normalizePhone(v),
  "Enter a valid phone number (10 digits, or start with + and your country code)");
const settingsSchema = z.object({ phone: phoneRule.optional(), smsAlerts: z.boolean().optional() });

router.get("/settings", asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select("smsAlerts").lean();
  res.json({ phone: await readPhone(req.user), smsAlerts: u?.smsAlerts !== false, smsConfigured: smsConfigured() });
}));

router.put("/settings", validate(settingsSchema), asyncHandler(async (req, res) => {
  const { phone, smsAlerts } = req.body;
  if (phone !== undefined) {
    const value = phone ? normalizePhone(phone) : "";
    if (req.user.role === "student") await StudentProfile.updateOne({ user: req.user._id }, { phone: value });
    else await User.updateOne({ _id: req.user._id }, { phone: value });
  }
  if (smsAlerts !== undefined) await User.updateOne({ _id: req.user._id }, { smsAlerts });
  const u = await User.findById(req.user._id).select("smsAlerts").lean();
  res.json({ phone: await readPhone(req.user), smsAlerts: u?.smsAlerts !== false, smsConfigured: smsConfigured() });
}));

// ----- push (phone / browser notification panel) -----
router.get("/push/config", (req, res) => res.json({ configured: pushConfigured(), publicKey: publicKey() }));

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
}).passthrough();

// Upsert by endpoint: if someone else signs in on the same phone, the device moves to the new account
router.post("/push/subscribe", validate(subscribeSchema), asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;
  await PushSubscription.findOneAndUpdate({ endpoint }, { user: req.user._id, endpoint, keys, userAgent: (req.get("user-agent") || "").slice(0, 200) }, { upsert: true });
  res.json({ ok: true });
}));

router.post("/push/unsubscribe", validate(z.object({ endpoint: z.string().max(1000) })), asyncHandler(async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user._id });
  res.json({ ok: true });
}));

// ----- mark read / delete -----
router.put("/read-all", asyncHandler(async (req, res) => {
  await Notification.updateMany({ ...mine(req), read: false }, { read: true });
  res.json({ ok: true });
}));

router.put("/:id/read", asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, ...mine(req) }, { read: true }, { new: true });
  if (!n) throw new HttpError(404, "Notification not found");
  res.json(n);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, ...mine(req) });
  if (!n) throw new HttpError(404, "Notification not found");
  res.json({ ok: true });
}));

export default router;
