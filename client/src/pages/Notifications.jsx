import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2 } from "lucide-react";
import api, { errMsg } from "../api/client";
import { ErrorBox, Field, Input, Spinner } from "../components/ui";
import { Btn, OfficerHeader, Panel } from "../components/officerUi";
import { TYPE_ICON, refreshBell, timeAgo } from "../components/NotificationBell";
import { disablePush, enablePush, pushStatus, runChecks, sendTestPush } from "../components/pushClient";

const STATUS_TEXT = {
  on: "On. This device gets alerts in its notification panel, even when CareerPilot is closed.",
  off: "Off. Turn on to get new drives and updates in this device's notification panel.",
  "granted-no-sub": "Allowed in this browser, but this device isn't registered for push yet.",
  denied: "Blocked in this browser. Allow Notifications for this site in the browser's site settings (the lock icon beside the address bar), then reload.",
  insecure: "Phone alerts need a secure address. Open CareerPilot on https:// (or on localhost on a computer).",
  unsupported: "This browser can't receive push alerts. On iPhone/iPad: open the site in Safari, tap Share, then Add to Home Screen, open CareerPilot from the Home Screen, and turn alerts on there.",
};
const ERROR_TEXT = {
  not_configured: "Push isn't set up on the server yet (the admin needs to add the VAPID keys). You'll still get pop-ups while the app is open.",
  denied: "Permission was blocked.", default: "No problem, you can turn it on later.", error: "Couldn't turn alerts on. Please try again.",
  insecure: STATUS_TEXT.insecure, unsupported: STATUS_TEXT.unsupported,
};

function DeviceAlerts() {
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useCallback(() => pushStatus().then(setStatus), []);
  useEffect(() => {
    check();
    window.addEventListener("push:changed", check); // e.g. the banner above turned alerts on
    return () => window.removeEventListener("push:changed", check);
  }, [check]);

  async function turnOn() {
    setBusy(true); setNote("");
    const r = await enablePush();
    if (!r.ok) setNote(ERROR_TEXT[r.reason] || ERROR_TEXT.error);
    await check(); setBusy(false);
  }
  async function turnOff() { setBusy(true); await disablePush(); await check(); setBusy(false); }

  const [test, setTest] = useState(null);
  const [checks, setChecks] = useState(null);
  async function runTest() {
    setBusy(true); setTest(null);
    try { setTest(await sendTestPush()); } catch (e) { setTest({ ok: false, text: errMsg(e) }); }
    setBusy(false);
  }
  async function repair() { setBusy(true); await disablePush(); await enablePush(); await check(); setTest(null); setBusy(false); }

  if (!status) return null;
  return (
    <Panel>
      <h2 className="font-bold">Phone &amp; browser alerts</h2>
      <p className="mb-3 mt-1 text-xs text-ink-soft">{STATUS_TEXT[status]}</p>
      {(status === "off" || status === "granted-no-sub") && <Btn onClick={turnOn} disabled={busy}>Turn on alerts</Btn>}
      {status === "on" && <Btn variant="outline" onClick={turnOff} disabled={busy}>Turn off on this device</Btn>}
      {note && <p role="status" className="mt-3 text-xs text-warn">{note}</p>}
      {status === "on" && <Btn variant="outline" className="ml-2" onClick={runTest} disabled={busy}>Send test notification</Btn>}
      {test && (
        <div role="status" className={`mt-3 rounded-lg px-3 py-2 text-xs ${test.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          <p>{test.text}</p>
          {test.repair && <button onClick={repair} disabled={busy} className="mt-1.5 font-bold underline">Fix it now</button>}
        </div>
      )}
      <details className="mt-3 text-xs" onToggle={(e) => e.target.open && runChecks().then(setChecks)}>
        <summary className="cursor-pointer font-semibold text-brand">Not getting alerts? Run checks</summary>
        {!checks ? <p className="mt-2 text-ink-soft">Checking...</p> : (
          <ul className="mt-2 space-y-2">
            {checks.map((c) => (
              <li key={c.label}>
                <span className={`font-bold ${c.ok ? "text-ok" : "text-bad"}`}>{c.ok ? "\u2713" : "\u2717"}</span> {c.label}
                {!c.ok && <span className="mt-0.5 block text-ink-soft">{c.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </details>
      <p className="mt-3 text-[11px] text-ink-soft">Alerts are set up per device, so turn them on once on your phone and once on your computer.</p>
    </Panel>
  );
}

function Settings() {
  const [s, setS] = useState(null);
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState(true);
  const [mail, setMail] = useState(true);
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/notifications/settings").then((r) => { setS(r.data); setPhone(r.data.phone); setSms(r.data.smsAlerts); setMail(r.data.emailAlerts); })
      .catch((e) => setMsg({ ok: "", err: errMsg(e) }));
  }, []);

  async function save(e) {
    e.preventDefault();
    setMsg({ ok: "", err: "" }); setBusy(true);
    try {
      const r = await api.put("/notifications/settings", { phone, smsAlerts: sms, emailAlerts: mail });
      setS(r.data); setPhone(r.data.phone); setSms(r.data.smsAlerts); setMail(r.data.emailAlerts);
      setMsg({ ok: "Saved.", err: "" });
      refreshBell(); // the "add your phone number" hint in the bell may no longer apply
    } catch (x) { setMsg({ ok: "", err: errMsg(x) }); } finally { setBusy(false); }
  }

  if (!s) return <Panel><Spinner /></Panel>;
  return (
    <Panel>
      <h2 className="font-bold">SMS alerts</h2>
      <p className="mb-4 mt-1 text-xs text-ink-soft">Get important updates by text message as well as in the app.</p>
      <form onSubmit={save} className="space-y-4">
        <Field label="Mobile number" hint="10 digits, or start with + and your country code.">
          <Input type="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#15803d]" />
          <span><span className="font-semibold">Send me SMS alerts</span><span className="block text-xs text-ink-soft">New drives, deadline reminders and application status updates.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#15803d]" />
          <span><span className="font-semibold">Send me email alerts</span><span className="block text-xs text-ink-soft">Sent to the email address you signed up with.</span></span>
        </label>
        {!s.emailConfigured && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Email sending isn't switched on for this server yet, so you'll get in-app notifications only.</p>
        )}
        {!s.smsConfigured && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">SMS sending isn't switched on for this server yet, so you'll get in-app notifications only. Your number is saved for when it is.</p>
        )}
        {msg.ok && <p role="status" className="text-sm font-semibold text-ok">{msg.ok}</p>}
        <ErrorBox>{msg.err}</ErrorBox>
        <Btn type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Btn>
      </form>
    </Panel>
  );
}

export default function Notifications() {
  const nav = useNavigate();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setData((await api.get("/notifications", { params: { filter, page } })).data); setError(""); }
    catch (e) { setError(errMsg(e)); }
  }, [filter, page]);
  useEffect(() => { load(); }, [load]);

  const changed = async () => { await load(); refreshBell(); };
  async function open(n) {
    if (!n.read) await api.put(`/notifications/${n._id}/read`).catch(() => {});
    refreshBell();
    if (n.link) nav(n.link); else load();
  }
  const readAll = async () => { await api.put("/notifications/read-all"); changed(); };
  const remove = async (n) => { await api.delete(`/notifications/${n._id}`); changed(); };

  return (
    <>
      <OfficerHeader
        title="Notifications" subtitle="Drive updates, applications and status changes."
        action={<Btn variant="outline" onClick={readAll} disabled={!data?.unread}><Check size={14} aria-hidden="true" /> Mark all read</Btn>}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-3 flex gap-2" role="tablist">
            {[["all", "All"], ["unread", `Unread${data?.unread ? ` (${data.unread})` : ""}`]].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={filter === k} onClick={() => { setFilter(k); setPage(1); }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filter === k ? "bg-side-active text-side-ink" : "border border-line bg-white text-ink-soft hover:bg-mint"}`}>
                {label}
              </button>
            ))}
          </div>

          <ErrorBox>{error}</ErrorBox>
          {!data && !error ? <Spinner /> : data && (
            <Panel className="!p-0 overflow-hidden">
              {!data.items.length ? (
                <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-ink-soft">
                  <Bell size={26} aria-hidden="true" />
                  <p className="text-sm">{filter === "unread" ? "No unread notifications." : "Nothing here yet. New drives and updates will show up here."}</p>
                </div>
              ) : (
                <ul>
                  {data.items.map((n) => {
                    const Icon = TYPE_ICON[n.type] || Bell;
                    return (
                      <li key={n._id} className={`flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0 ${n.read ? "" : "bg-brand-soft/40"}`}>
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={16} aria-hidden="true" /></span>
                        <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                          <span className={`block text-sm ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                          {n.message && <span className="mt-0.5 block text-sm text-ink-soft">{n.message}</span>}
                          <span className="mt-1 block text-xs text-ink-soft">{timeAgo(n.createdAt)}</span>
                        </button>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                        <button onClick={() => remove(n)} aria-label={`Delete: ${n.title}`} className="rounded-md p-1.5 text-ink-soft transition hover:bg-bad-soft hover:text-bad"><Trash2 size={15} aria-hidden="true" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}

          {data?.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
              <Btn variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Btn>
              <span>Page {data.page} of {data.pages}</span>
              <Btn variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Btn>
            </div>
          )}
        </div>
        <div className="space-y-5"><DeviceAlerts /><Settings /></div>
      </div>
    </>
  );
}
