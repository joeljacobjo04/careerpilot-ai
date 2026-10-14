/**
 * Web Push: shows notifications in the phone's / computer's notification panel even when the app is closed.
 * Needs a VAPID key pair in server/.env (generate one with `npm run vapid`):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:placement@yourcollege.edu)
 */
import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const publicKey = () => process.env.VAPID_PUBLIC_KEY || "";

let ready = false;
function init() {
  if (ready) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return (ready = true);
}

/** Push each saved notification (as returned by insertMany) to every device its user has registered. */
export async function pushNotifications(docs) {
  if (!docs?.length || !init()) return 0;
  const subs = await PushSubscription.find({ user: { $in: docs.map((d) => d.user) } }).lean();
  if (!subs.length) return 0;
  const byUser = new Map(docs.map((d) => [String(d.user), d]));

  let sent = 0;
  for (let i = 0; i < subs.length; i += 10) { // small batches
    await Promise.all(subs.slice(i, i + 10).map(async (sub) => {
      const n = byUser.get(String(sub.user));
      const payload = JSON.stringify({ title: n.title, body: (n.message || "").slice(0, 200), url: n.link || "/", tag: String(n._id) });
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
      } catch (err) {
        // 404/410 mean the device has unsubscribed or the app was uninstalled: forget it
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
        else console.error(`[push] failed (HTTP ${err.statusCode || "?"}): ${err.message} ${String(err.body || "").slice(0, 160)}`);
      }
    }));
  }
  return sent;
}

/**
 * Send a test notification to every device one user has registered, and report exactly what happened.
 * Used by the "Send test notification" button so a failure can be pinned to a specific step.
 */
export async function pushTest(userId) {
  if (!init()) return { configured: false, devices: 0, delivered: 0, failures: [] };
  const subs = await PushSubscription.find({ user: userId }).lean();
  const result = { configured: true, devices: subs.length, delivered: 0, failures: [] };
  const payload = JSON.stringify({ title: "CareerPilot test", body: "If you can see this, push notifications are working.", url: "/notifications", tag: `test-${Date.now()}` });

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 300, urgency: "high" });
      result.delivered++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
      result.failures.push({ status: err.statusCode || 0, service: new URL(sub.endpoint).host, detail: String(err.body || err.message || "").slice(0, 160) });
    }
  }));
  return result;
}
