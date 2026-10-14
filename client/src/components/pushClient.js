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

async function subscribeDevice() {
  const { data } = await api.get("/notifications/push/config");
  if (!data.configured) return { ok: false, reason: "not_configured" };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(data.publicKey) });
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
