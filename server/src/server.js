import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startReminderJob } from "./services/reminders.js";
import { smsConfigured } from "./services/sms.service.js";
import { pushConfigured } from "./services/push.service.js";
import { emailConfigured } from "./services/email.service.js";
import { syncOptionsFromProfiles } from "./services/options.service.js";
import { purgeOrphanedStudentData } from "./services/accountDeletion.service.js";

for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in server/.env (copy .env.example)`);
    process.exit(1);
  }
}
if (!process.env.GROQ_API_KEY) console.warn("GROQ_API_KEY not set: AI features will return 503 until you add it.");

const port = process.env.PORT || 5000;
connectDB()
  .then(async () => {
    // bring departments, batches and programmes students already typed into the officer-managed lists
    const added = await syncOptionsFromProfiles().catch((e) => { console.error("Could not sync drop-down lists:", e.message); return 0; });
    if (added) console.log(`Drop-down lists: added ${added} existing value${added === 1 ? "" : "s"} from student profiles.`);
    // student records left behind by deleted accounts would inflate the student counts
    const purged = await purgeOrphanedStudentData().catch((e) => { console.error("Could not clean up orphaned student data:", e.message); return 0; });
    if (purged) console.log(`Cleaned up ${purged} student record${purged === 1 ? "" : "s"} whose account no longer exists.`);
  })
  .then(() => app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    startReminderJob(); // 24-hour deadline reminders
    if (!pushConfigured()) console.warn("VAPID keys not set: phone push notifications are off. Run `npm run vapid` and add the keys to server/.env.");
    if (!emailConfigured()) console.warn(process.env.NODE_ENV === "production"
      ? "Brevo email is not configured: registration is blocked because verification codes cannot be sent."
      : "Brevo email not configured: registration codes are printed in this console instead of being emailed.");
    if (!smsConfigured()) console.warn("Twilio not configured: SMS alerts are logged only. In-app notifications still work.");
  }))
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
