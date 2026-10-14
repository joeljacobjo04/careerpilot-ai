// Phone / browser push: registers the service worker and subscribes this device so the server can push to it.
import api from "../api/client";

const FLAG = "cp_push";       // "1" while this device is subscribed
const OPTED_OUT = "cp_push_off"; // set when the person turns alerts off on purpose, so we don't quietly turn them back on

export const pushSupported = () =>
  typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushIsOn = () => localStorage.getItem(FLAG) === "1";

const toUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function subscribeDevice() {
  const { data } = await api.get("/notifications/push/config");
  if (!data.configured) return { ok: false, reason: "not_configured" };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = toUint8(data.publicKey);
  let sub = await reg.pushManager.getSubscription();
  // a subscription made with a different key pair is rejected by the push service: drop it and start fresh
  const old = sub?.options?.applicationServerKey;
  if (sub && old && !sameBytes(new Uint8Array(old), key)) { await sub.unsubscribe(); sub = null; }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  await api.post("/notifications/push/subscribe", sub.toJSON()); // ties this device to whoever is signed in
  localStorage.setItem(FLAG, "1");
  localStorage.removeItem(OPTED_OUT);
  return { ok: true };
}

const changed = () => window.dispatchEvent(new Event("push:changed")); // lets any status display on the page refresh itself

/** Called from a button click (browsers only show the permission dialog after a click). */
export async function enablePush() {
  const result = await enableInner();
  changed();
  return result;
}

async function enableInner() {
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission }; // "denied" or "default"
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  try { return await subscribeDevice(); }
  catch (e) {
    // a subscription made with an older key pair can't be reused: drop it and try once more
    if (e?.name === "InvalidStateError") {
      const reg = await navigator.serviceWorker.getRegistration();
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      try { return await subscribeDevice(); } catch { /* fall through */ }
    }
    return { ok: false, reason: "error" };
  }
}

/** Runs when the app opens: if alerts are already allowed, quietly link this device to the signed-in account. */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== "granted" || localStorage.getItem(OPTED_OUT) === "1") return;
    await subscribeDevice();
  } catch { /* offline, or push isn't configured on the server: nothing to do */ }
}

/** remember=true: the person turned alerts off. remember=false: just signing out, so the next person can use this device. */
export async function disablePush({ remember = true } = {}) {
  try {
    const reg = pushSupported() ? await navigator.serviceWorker.getRegistration() : null;
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post("/notifications/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } finally {
    localStorage.removeItem(FLAG);
    if (remember) localStorage.setItem(OPTED_OUT, "1");
    changed();
  }
}

/** off | on | granted-no-sub | denied | insecure | unsupported */
export async function pushStatus() {
  if (typeof window === "undefined" || !("Notification" in window)) return window?.isSecureContext === false ? "insecure" : "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "off";
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? "on" : "granted-no-sub";
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

/** Step-by-step checks, so a person can see exactly where push is failing. */
export async function runChecks() {
  const out = [];
  const add = (label, ok, hint) => out.push({ label, ok, hint: ok ? "" : hint });

  add("Secure address (https or localhost)", window.isSecureContext,
    "Phones only allow push on https://. Open the app through an https address (tunnel or deployed site), not http://192.168...");
  if (isIos()) add("Opened from the Home Screen (iPhone/iPad)", isInstalled(),
    "On iPhone, push works only in the installed app: Safari > Share > Add to Home Screen, then open CareerPilot from the Home Screen icon.");
  add("Browser supports push", pushSupported(), "Use Chrome, Edge, Firefox or Samsung Internet on Android (not a private tab).");
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  add("Notification permission allowed", perm === "granted",
    perm === "denied" ? "Blocked. In the browser's site settings (lock icon by the address bar), set Notifications to Allow, then reload."
      : "Not allowed yet. Tap \"Turn on alerts\" and choose Allow.");

  let local = false;
  try { const reg = pushSupported() ? await navigator.serviceWorker.getRegistration() : null; local = !!(await reg?.pushManager.getSubscription()); } catch { /* ignore */ }
  add("This device is subscribed", local, "Tap \"Turn on alerts\". If you already did, turn alerts off and on again.");

  try {
    const { data } = await api.get("/notifications/push/config");
    add("Server has push keys (VAPID)", data.configured, "Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to server/.env (run `npm run vapid` in server/), then restart the server.");
    add("Server knows this device", data.devices > 0, "The server has no device saved for your account. Turn alerts off and on again on this phone.");
  } catch { add("Can reach the server", false, "The app couldn't reach the server. Is it running?"); }
  return out;
}

/** Ask the server to push a test message to this account's devices. */
export async function sendTestPush() {
  const { data } = await api.post("/notifications/push/test");
  if (!data.configured) return { ok: false, text: "The server has no push keys yet. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to server/.env and restart it." };
  if (!data.devices) return { ok: false, text: "The server has no device registered for your account. Turn alerts off and on again on this phone." };
  if (data.delivered) {
    const extra = data.failures.length ? ` (${data.failures.length} other device(s) failed.)` : "";
    return { ok: true, text: `Sent to ${data.delivered} device(s).${extra} It should appear in the notification panel within a few seconds. If it doesn't, the push worked and the phone is hiding it: allow notifications for your browser in the phone's settings, turn off Do Not Disturb, and set the browser's battery use to Unrestricted.` };
  }
  const f = data.failures[0] || {};
  if (f.status === 401 || f.status === 403) return { ok: false, text: `The push service rejected the server's keys (HTTP ${f.status}). This happens when the keys changed after this phone subscribed. Turn alerts off and on again on this phone.`, repair: true };
  if (f.status === 404 || f.status === 410) return { ok: false, text: "This device's subscription had expired, so it was removed. Turn alerts on again.", repair: true };
  return { ok: false, text: `The push service refused the message (HTTP ${f.status || "?"}${f.detail ? `: ${f.detail}` : ""}). Check the server terminal for a [push] line.` };
}
