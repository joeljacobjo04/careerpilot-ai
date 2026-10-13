import Notification from "../models/Notification.js";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { normalizePhone, sendSms } from "./sms.service.js";

/**
 * Mongo filter for the students a drive is open to. A missing CGPA counts as 0 and a missing backlog
 * count as 0, which is how registration treats them (a plain $gte would skip students with no CGPA at all).
 */
export const eligibleFilter = (e = {}) => {
  const f = { backlogs: { $not: { $gt: e.maxBacklogs ?? 0 } } };
  if ((e.minCgpa || 0) > 0) f.cgpa = { $gte: e.minCgpa };
  if (e.departments?.length) f.department = { $in: e.departments };
  return f;
};

/** "yes" = eligible, "no" = ruled out by the data we have, "unsure" = profile too incomplete to tell. */
export function classify(p, e = {}) {
  const min = e.minCgpa || 0;
  const departments = e.departments || [];
  if ((p.backlogs ?? 0) > (e.maxBacklogs ?? 0)) return "no";
  if (p.cgpa != null && p.cgpa < min) return "no";
  if (departments.length && p.department && !departments.includes(p.department)) return "no";
  if ((p.cgpa == null && min > 0) || (departments.length && !p.department)) return "unsure";
  return "yes";
}

/** Split students into those eligible for a drive and those whose profile is too incomplete to tell. */
export async function audienceFor(eligibility, { exclude = [] } = {}) {
  const skip = new Set(exclude.map(String));
  const profiles = await StudentProfile.find().select("user cgpa backlogs department").lean();
  const out = { yes: [], unsure: [] };
  for (const p of profiles) {
    if (skip.has(String(p.user))) continue;
    const c = classify(p, eligibility);
    if (c !== "no") out[c].push(p.user);
  }
  return out;
}

export const eligibleUserIds = async (eligibility, opts) => (await audienceFor(eligibility, opts)).yes;

export async function officerIds() {
  return (await User.find({ role: "officer" }).select("_id").lean()).map((u) => u._id);
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

/** "Infosys - Software Engineer". The drive's company must be populated. */
export const driveLabel = (d) => `${d.company?.name || "Company"} - ${d.role}`;

export const closesWithinDay = (deadline, now = new Date()) =>
  !!deadline && new Date(deadline) > now && new Date(deadline) - now <= 24 * 60 * 60 * 1000;

async function deliverSms(ids, text) {
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("role phone smsAlerts").lean(),
    StudentProfile.find({ user: { $in: ids } }).select("user phone").lean(),
  ]);
  const studentPhone = new Map(profiles.map((p) => [String(p.user), p.phone]));
  const numbers = users
    .filter((u) => u.smsAlerts !== false)
    .map((u) => normalizePhone(u.role === "student" ? studentPhone.get(String(u._id)) : u.phone))
    .filter(Boolean);

  const unique = [...new Set(numbers)];
  for (let i = 0; i < unique.length; i += 5) { // small batches so we don't hammer the provider
    const results = await Promise.allSettled(unique.slice(i, i + 5).map((n) => sendSms(n, text)));
    results.filter((r) => r.status === "rejected").forEach((r) => console.error("[sms]", r.reason.message));
  }
}

/**
 * Create an in-app notification for each user and (unless sms:false) text the ones who have a valid
 * number and haven't switched SMS off. Returns how many in-app notifications were created.
 */
export async function notify(userIds, { type, title, message = "", link, sms = true }) {
  const ids = [...new Set((userIds || []).map(String))];
  if (!ids.length) return 0;
  await Notification.insertMany(ids.map((user) => ({ user, type, title, message, link })));
  if (sms) deliverSms(ids, `CareerPilot: ${title}. ${message}`.slice(0, 300)).catch((e) => console.error("[sms]", e.message));
  return ids.length;
}

/** Same as notify, but never throws. A failed notification must not fail the request that triggered it. */
export const notifySafe = (userIds, payload) =>
  notify(userIds, payload).catch((e) => console.error("[notify]", e.message));
