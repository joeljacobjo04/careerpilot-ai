import StudentProfile from "../models/StudentProfile.js";
import SkillGapReport from "../models/SkillGapReport.js";
import InterviewSession from "../models/InterviewSession.js";
import AptitudeAttempt from "../models/AptitudeAttempt.js";
import ReadinessSnapshot from "../models/ReadinessSnapshot.js";

export function profileCompleteness(p) {
  const part = (n, target, weight) => Math.min(n / target, 1) * weight;
  const flag = (v, weight) => (v ? weight : 0);
  const score =
    flag(p.rollNo, 5) + flag(p.department, 10) + flag(p.batch, 5) +
    flag(p.cgpa != null, 10) + flag(p.phone, 5) +
    flag(p.links?.github || p.links?.linkedin, 5) +
    flag(p.education?.length > 0, 10) +
    part(p.skills?.length || 0, 5, 15) +
    part(p.projects?.length || 0, 2, 15) +
    part(p.certifications?.length || 0, 1, 5) +
    flag(p.targetRole, 10) + flag(p.interests?.length > 0, 5);
  return Math.round(score);
}

/** Weight of each component in the final 0-100 readiness score. They add up to 1. */
export const WEIGHTS = { technical: 0.30, projects: 0.15, certifications: 0.10, aptitude: 0.15, communication: 0.15, academics: 0.15 };

export const statusFor = (score) => (score >= 85 ? "Placement ready" : score >= 40 ? "In progress" : "Just starting");

/**
 * technical      = skill match % for the target role (latest skill gap report)
 * projects       = 2 or more projects = 100%
 * certifications = 3 or more certifications = 100%
 * aptitude       = score of the latest aptitude test
 * communication  = average communication score across the last 3 completed mock interviews
 * academics      = CGPA x 10
 */
export async function computeReadiness(userId) {
  const profile = await StudentProfile.findOne({ user: userId });
  if (!profile) return null;

  const completeness = profileCompleteness(profile);

  const reportQuery = { student: userId };
  if (profile.targetRole) reportQuery.targetRole = profile.targetRole;
  const report = (await SkillGapReport.findOne(reportQuery).sort({ createdAt: -1 })) ||
    (await SkillGapReport.findOne({ student: userId }).sort({ createdAt: -1 }));

  const sessions = await InterviewSession.find({ student: userId, status: "completed" }).sort({ endedAt: -1 }).limit(3);
  const commScores = sessions.flatMap((s) => s.questions).filter((q) => q.answeredAt && q.scores).map((q) => q.scores.communication || 0);

  const aptitude = await AptitudeAttempt.findOne({ student: userId }).sort({ createdAt: -1 });

  const breakdown = {
    technical: report?.matchPercent ?? 0,
    certifications: Math.round(Math.min((profile.certifications?.length || 0) / 3, 1) * 100),
    projects: Math.round(Math.min((profile.projects?.length || 0) / 2, 1) * 100),
    aptitude: aptitude?.percent ?? 0,
    communication: commScores.length ? Math.round((commScores.reduce((a, b) => a + b, 0) / commScores.length) * 10) : 0,
    academics: profile.cgpa != null ? Math.round(Math.min(profile.cgpa, 10) * 10) : 0,
  };

  const score = Math.round(Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * breakdown[k], 0));
  profile.readiness = { score, updatedAt: new Date() };
  await profile.save();

  const last = await ReadinessSnapshot.findOne({ student: userId }).sort({ createdAt: -1 });
  if (!last || last.score !== score || last.completeness !== completeness) {
    await ReadinessSnapshot.create({ student: userId, score, completeness, breakdown });
  }

  return {
    score, status: statusFor(score), completeness, breakdown,
    flags: { skillGapRun: !!report, aptitudeTaken: !!aptitude, interviewsDone: sessions.length },
  };
}

/** Fire-and-forget wrapper: readiness must never break the main request. */
export const refreshReadiness = (userId) => computeReadiness(userId).catch((e) => console.error("readiness:", e.message));


/**
 * Read-only version of the breakdown used by computeReadiness.
 * The placement officer's student page calls this so that merely viewing a
 * student never writes to the database or creates a ReadinessSnapshot.
 */
export async function readinessBreakdown(userId, profile) {
  const reportQuery = { student: userId };
  if (profile.targetRole) reportQuery.targetRole = profile.targetRole;
  const report = (await SkillGapReport.findOne(reportQuery).sort({ createdAt: -1 })) ||
    (await SkillGapReport.findOne({ student: userId }).sort({ createdAt: -1 }));

  const sessions = await InterviewSession.find({ student: userId, status: "completed" }).sort({ endedAt: -1 }).limit(3);
  const commScores = sessions.flatMap((s) => s.questions).filter((q) => q.answeredAt && q.scores).map((q) => q.scores.communication || 0);
  const aptitude = await AptitudeAttempt.findOne({ student: userId }).sort({ createdAt: -1 });

  return {
    technical: report?.matchPercent ?? 0,
    certifications: Math.round(Math.min((profile.certifications?.length || 0) / 3, 1) * 100),
    projects: Math.round(Math.min((profile.projects?.length || 0) / 2, 1) * 100),
    aptitude: aptitude?.percent ?? 0,
    communication: commScores.length ? Math.round((commScores.reduce((a, b) => a + b, 0) / commScores.length) * 10) : 0,
    academics: profile.cgpa != null ? Math.round(Math.min(profile.cgpa, 10) * 10) : 0,
  };
}
