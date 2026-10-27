import mongoose from "mongoose";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import SavedResume from "../models/SavedResume.js";
import InterviewSession from "../models/InterviewSession.js";
import AptitudeAttempt from "../models/AptitudeAttempt.js";
import SkillGapReport from "../models/SkillGapReport.js";
import ReadinessSnapshot from "../models/ReadinessSnapshot.js";
import CareerRecommendation from "../models/CareerRecommendation.js";
import DashboardSuggestion from "../models/DashboardSuggestion.js";
import Notification from "../models/Notification.js";
import PushSubscription from "../models/PushSubscription.js";
import PlacementDrive from "../models/PlacementDrive.js";
import EmailOtp from "../models/EmailOtp.js";
import { normalizePhone, sendSms } from "./sms.service.js";
import { sendAccountDeletedEmail } from "./email.service.js";
import { pushNotifications } from "./push.service.js";
import { notifySafe, officerIds } from "./notify.service.js";

/** Everything a student owns, keyed by the field that points at the user. */
const STUDENT_DATA = [
  [StudentProfile, "user"], [SavedResume, "user"], [Notification, "user"], [PushSubscription, "user"],
  [InterviewSession, "student"], [AptitudeAttempt, "student"], [SkillGapReport, "student"],
  [ReadinessSnapshot, "student"], [CareerRecommendation, "student"], [DashboardSuggestion, "student"],
];

/** Remove every record that belongs to these users (the User documents themselves are removed by the caller). */
async function removeStudentData(userIds) {
  if (!userIds.length) return;
  await Promise.all(STUDENT_DATA.map(([Model, field]) => Model.deleteMany({ [field]: { $in: userIds } })));
  // take them out of every drive's applicant list, so applicant counts and reports stay correct
  await PlacementDrive.updateMany(
    { "registeredStudents.student": { $in: userIds } },
    { $pull: { registeredStudents: { student: { $in: userIds } } } },
  );
}

/**
 * Tell the student their account is gone. Email, SMS and phone/browser push are all tried and none of them can
 * stop the deletion: an in-app notification would be pointless because the account no longer exists to read it.
 * Must run BEFORE the data is deleted (it needs the phone number and push subscriptions).
 */
async function tellStudent({ user, phone, byOfficer }) {
  const title = "Your CareerPilot account has been deleted";
  const message = byOfficer
    ? "Your account and all of its data were deleted by your placement officer. If you think this was a mistake, please contact your placement cell."
    : "As you requested, your account and all of its data have been deleted. You can register again at any time.";

  const jobs = [
    sendAccountDeletedEmail(user.email, { name: user.name, byOfficer }),
    pushNotifications([{ _id: new mongoose.Types.ObjectId(), user: user._id, title, message, link: "/" }]),
  ];
  const number = normalizePhone(phone || user.phone);
  if (number) jobs.push(sendSms(number, `CareerPilot: ${title}. ${message}`.slice(0, 300)));

  const results = await Promise.allSettled(jobs);
  const names = ["email", "push", "sms"];
  results.forEach((r, i) => { if (r.status === "rejected") console.error(`[account-delete] ${names[i] || "notice"} failed:`, r.reason?.message); });
}

/**
 * Permanently delete a student's account and everything linked to it, after notifying them by email, SMS and push.
 * `by` is "self" (the student did it) or "officer" (a placement officer did it).
 */
export async function deleteStudentAccount(userId, { by = "self", officerName } = {}) {
  const user = await User.findById(userId).select("name email phone role").lean();
  if (!user) return { deleted: false };
  if (user.role !== "student") throw new Error("Only student accounts can be deleted here");
  const profile = await StudentProfile.findOne({ user: user._id }).select("phone").lean();

  await tellStudent({ user, phone: profile?.phone, byOfficer: by === "officer" });
  await removeStudentData([user._id]);
  await EmailOtp.deleteMany({ email: user.email });
  await User.deleteOne({ _id: user._id });

  // let the placement cell know when a student leaves on their own
  if (by === "self") {
    officerIds()
      .then((ids) => notifySafe(ids, { type: "system", title: `Student left: ${user.name}`, message: "This student deleted their own account.", link: "/officer/students", sms: false, email: false }))
      .catch(() => {});
  }
  console.log(`[account-delete] ${user.email} deleted by ${by}${officerName ? ` (${officerName})` : ""}`);
  return { deleted: true, name: user.name, email: user.email };
}

/**
 * Housekeeping that runs when the server starts: student records whose user no longer exists (left behind by older
 * versions) are removed, so department / programme / batch counts and dashboards only ever count real students.
 */
export async function purgeOrphanedStudentData() {
  const orphans = await StudentProfile.aggregate([
    { $lookup: { from: User.collection.name, localField: "user", foreignField: "_id", as: "u" } },
    { $match: { "u.0": { $exists: false } } },
    { $project: { user: 1 } },
  ]);
  if (!orphans.length) return 0;
  const ids = orphans.map((o) => o.user);
  await removeStudentData(ids);
  return orphans.length;
}
