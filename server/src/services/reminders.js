import PlacementDrive from "../models/PlacementDrive.js";
import { driveLabel, eligibleUserIds, fmtDate, notify } from "./notify.service.js";

const HALF_HOUR = 30 * 60 * 1000;

/** Remind eligible students who haven't applied yet, once, when a drive's deadline is under 24 hours away. */
export async function sendDeadlineReminders(now = new Date()) {
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due = await PlacementDrive.find({
    status: { $ne: "completed" }, deadline: { $gt: now, $lte: soon }, deadlineReminderSent: { $ne: true },
  }).populate("company", "name");

  for (const drive of due) {
    // claim the drive first, so two server instances can't both send the reminder
    const claimed = await PlacementDrive.findOneAndUpdate(
      { _id: drive._id, deadlineReminderSent: { $ne: true } }, { deadlineReminderSent: true });
    if (!claimed) continue;
    const ids = await eligibleUserIds(drive.eligibility, { exclude: drive.registeredStudents.map((r) => r.student) });
    await notify(ids, {
      type: "drive_deadline", title: `Closing soon: ${driveLabel(drive)}`,
      message: `Registration closes ${fmtDate(drive.deadline)}. Apply before then.`, link: "/drives",
    });
  }
  return due.length;
}

export function startReminderJob() {
  const run = () => sendDeadlineReminders().catch((e) => console.error("[reminders]", e.message));
  setTimeout(run, 15_000);
  const timer = setInterval(run, HALF_HOUR);
  timer.unref?.();
  return timer;
}
