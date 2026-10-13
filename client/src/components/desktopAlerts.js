// Thin wrapper around the browser Notification API ("desktop alerts").
// These appear while CareerPilot is open in a browser tab, including a background tab.
export const alertsSupported = () => typeof window !== "undefined" && "Notification" in window;
export const alertsPermission = () => (alertsSupported() ? Notification.permission : "unsupported"); // default | granted | denied

export async function requestAlerts() {
  if (!alertsSupported()) return "unsupported";
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

export function showDesktopAlert(n, onOpen) {
  if (alertsPermission() !== "granted") return;
  try {
    const popup = new Notification(n.title, { body: n.message || "", tag: n._id }); // same tag = no duplicates across tabs
    popup.onclick = () => { window.focus(); popup.close(); onOpen?.(n); };
  } catch { /* some browsers only allow notifications from a service worker; skip quietly */ }
}

const DISMISSED = "cp_desktop_alerts_dismissed";
export const promptDismissed = () => localStorage.getItem(DISMISSED) === "1";
export const dismissPrompt = () => localStorage.setItem(DISMISSED, "1");
