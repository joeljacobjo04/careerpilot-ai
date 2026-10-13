import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { alertsPermission, dismissPrompt, promptDismissed, requestAlerts } from "./desktopAlerts";

/** One-time banner asking to turn on browser alerts. Browsers only allow the permission request after a click. */
export default function DesktopAlertsPrompt() {
  const [hidden, setHidden] = useState(() => alertsPermission() !== "default" || promptDismissed());
  if (hidden) return null;

  const close = () => { dismissPrompt(); setHidden(true); };
  async function turnOn() { await requestAlerts(); setHidden(true); }

  return (
    <div role="region" aria-label="Desktop alerts" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft/60 px-4 py-3 text-sm">
      <BellRing size={18} className="shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-medium">Get a pop-up when there's a new drive or an update, while CareerPilot is open in your browser.</p>
      <button onClick={turnOn} className="rounded-lg bg-side-active px-3.5 py-1.5 font-semibold text-side-ink shadow-sm hover:brightness-95">Turn on alerts</button>
      <button onClick={close} aria-label="Not now" className="rounded-md p-1.5 text-ink-soft hover:bg-white/60"><X size={16} aria-hidden="true" /></button>
    </div>
  );
}
