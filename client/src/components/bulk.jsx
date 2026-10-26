import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, Mail, MessageSquare, Send, Smartphone, X } from "lucide-react";
import api, { errMsg } from "../api/client";
import { Input, Textarea } from "./ui";
import { useConfirm, useToast } from "./Feedback";
import { Btn } from "./officerUi";

/* ------------------------------------------------------------------ *
 *  Tools for acting on a group of rows:
 *    useSelection   which rows are ticked (or "everyone matching the filters")
 *    Checkbox       tick box with an "in between" state for the header
 *    SelectBanner   "Select all 87 matching students" strip
 *    BulkBar        floating bar with the actions for the ticked rows
 *    NotifyModal    write a message and send it to a group of students
 * ------------------------------------------------------------------ */

export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  const [all, setAll] = useState(false); // every record that matches the current filters, not just the ticked ones

  const toggle = useCallback((id) => {
    setAll(false);
    setIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const setMany = useCallback((list, on) => {
    setAll(false);
    setIds((prev) => { const next = new Set(prev); list.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; });
  }, []);
  const clear = useCallback(() => { setIds(new Set()); setAll(false); }, []);

  return useMemo(() => ({ ids, all, has: (id) => all || ids.has(id), toggle, setMany, clear, selectAll: () => setAll(true), size: ids.size }), [ids, all, toggle, setMany, clear]);
}

export function Checkbox({ checked, indeterminate = false, onChange, label, className = "" }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate && !checked; }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} className={`h-5 w-5 cursor-pointer rounded accent-[#15803d] md:h-4 md:w-4 ${className}`} />;
}

/** Shown when every row on the page is ticked but more rows match the filters */
export function SelectBanner({ pageCount, total, all, noun = "student", onSelectAll, onClear }) {
  if (!pageCount || total <= pageCount) return null;
  const plural = (n) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  if (all) {
    return (
      <p className="mb-3 rounded-xl bg-brand-soft px-4 py-2.5 text-center text-sm" role="status">
        All <b>{plural(total)}</b> matching your filters are selected. <button type="button" onClick={onClear} className="ml-1 font-bold text-brand hover:underline">Clear selection</button>
      </p>
    );
  }
  return (
    <p className="mb-3 rounded-xl bg-brand-soft px-4 py-2.5 text-center text-sm" role="status">
      {plural(pageCount)} on this page {pageCount === 1 ? "is" : "are"} selected. <button type="button" onClick={onSelectAll} className="ml-1 font-bold text-brand hover:underline">Select all {plural(total)} matching your filters</button>
    </p>
  );
}

export function BulkBar({ label, onClear, children }) {
  return (
    <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto mt-5 w-full rounded-2xl border border-brand/20 bg-white p-3 shadow-pop animate-slide-up sm:w-fit sm:px-4" role="region" aria-label="Actions for selected rows">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 sm:flex-nowrap sm:justify-center">
        <span className="text-sm font-bold">{label}</span>
        <button type="button" onClick={onClear} className="order-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-ink-soft transition hover:bg-paper hover:text-ink sm:order-3"><X size={14} aria-hidden="true" /> Clear</button>
        <div className="order-3 flex w-full flex-wrap gap-2 sm:order-2 sm:w-auto sm:flex-nowrap [&>*]:min-h-11 [&>*]:flex-1 sm:[&>*]:min-h-0 sm:[&>*]:flex-none">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- notify ---------------- */
const TEMPLATES = [
  ["Complete profile", "Please complete your profile", "Add your CGPA, department and skills so we can show the drives you are eligible for.", "/profile"],
  ["Resume check", "Run your resume check", "Use the ATS resume check and fix its suggestions before the next drive.", "/ats"],
  ["Aptitude practice", "Practise the aptitude test", "Take an aptitude practice test this week to raise your readiness score.", "/aptitude"],
  ["Mock interview", "Try a mock interview", "Practise with the proctored mock interview to get ready for upcoming rounds.", "/interview"],
  ["Drive reminder", "Placement drive: apply soon", "Registration for an open drive is closing. Check your eligibility and apply.", "/drives"],
];
const LINKS = [["", "No link"], ["/drives", "Placement drives"], ["/profile", "My profile"], ["/resume", "Resume builder"], ["/ats", "ATS resume check"], ["/aptitude", "Aptitude test"], ["/interview", "Mock interview"], ["/skill-gap", "Skill gap"], ["/careers", "Career suggestions"]];

/**
 * payload    who to send to, in the shape the server expects: { ids } | { userIds } | { filters } | { driveId }
 * audiences  optional [[value, label, hint]] choices (for drive reminders); the chosen one is sent as `audience`
 * heading    optional line shown under the title, such as the drive name
 */
export function NotifyModal({ open, onClose, payload, audiences, heading, onSent }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: "", message: "", link: "", email: false, sms: false });
  const [audience, setAudience] = useState(audiences?.[0]?.[0] || "");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const titleRef = useRef(null);

  const body = useMemo(() => ({ ...payload, ...(audience ? { audience } : {}) }), [payload, audience]);
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    if (!open) return undefined;
    setPreview(null); setError("");
    let live = true;
    api.post("/officer/notify/preview", body).then((r) => live && setPreview(r.data)).catch((e) => live && setError(errMsg(e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bodyKey]);

  useEffect(() => {
    if (!open) return undefined;
    titleRef.current?.focus();
    const key = (e) => e.key === "Escape" && !sending && onClose();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [open, sending, onClose]);

  if (!open) return null;
  const count = preview?.count ?? 0;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ready = form.title.trim().length >= 3 && count > 0 && !sending;

  async function send() {
    setError("");
    if (form.sms || count > 100) {
      const ok = await confirm({
        title: `Send to ${count} student${count === 1 ? "" : "s"}?`,
        message: `${form.sms ? "Text messages are sent to every student who has a phone number saved and SMS alerts on. " : ""}You can't take a message back once it is sent.`,
        confirmText: "Send now",
      });
      if (!ok) return;
    }
    setSending(true);
    try {
      const { data } = await api.post("/officer/notify", { ...body, ...form });
      toast(`Notification sent to ${data.sent} student${data.sent === 1 ? "" : "s"}`);
      setForm({ title: "", message: "", link: "", email: false, sms: false });
      onSent?.(data.sent);
      onClose();
    } catch (e) { setError(errMsg(e)); } finally { setSending(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/50 backdrop-blur-[2px] animate-fade sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="notify-title" className="cp-modal flex max-h-[94dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-pop animate-slide-up sm:max-h-[90dvh] sm:rounded-3xl sm:animate-pop">
        <div className="flex shrink-0 items-start gap-3 border-b border-line p-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><BellRing size={20} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="notify-title" className="text-lg font-bold leading-tight">Notify students</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{heading || "Send a message that shows up in their notification bell."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Close" className="rounded-lg p-1.5 text-ink-soft transition hover:bg-paper hover:text-ink"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {audiences && (
            <div role="radiogroup" aria-label="Who should get it" className="grid gap-2 sm:grid-cols-3">
              {audiences.map(([v, label, hint]) => (
                <button key={v} type="button" role="radio" aria-checked={audience === v} onClick={() => setAudience(v)}
                  className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-brand ${audience === v ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40"}`}>
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${preview && count === 0 ? "bg-warn-soft text-warn" : "bg-mint"}`} role="status">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white px-2 text-base font-extrabold text-brand-dark shadow-sm">{preview ? count : "\u2026"}</span>
            <p className="min-w-0">
              {!preview ? "Counting who will get this..." : count === 0 ? "No students in this group yet." : (
                <><b>{count} student{count === 1 ? "" : "s"}</b> will be notified{preview.sample.length > 0 && <span className="text-ink-soft"> &middot; {preview.sample.join(", ")}{count > preview.sample.length ? ` and ${count - preview.sample.length} more` : ""}</span>}</>
              )}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Start from a template</p>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
              {TEMPLATES.map(([name, title, message, link]) => (
                <button key={name} type="button" onClick={() => setForm({ ...form, title, message, link })}
                  className="shrink-0 whitespace-nowrap rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand/40 hover:text-ink sm:px-3 sm:py-1">{name}</button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm font-semibold text-ink/90">Title <span className="text-xs font-normal text-ink-soft">{form.title.length}/120</span></span>
            <Input ref={titleRef} value={form.title} onChange={set("title")} maxLength={120} placeholder="e.g. Infosys drive: register by Friday" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm font-semibold text-ink/90">Message <span className="text-xs font-normal text-ink-soft">{form.message.length}/400</span></span>
            <Textarea rows={3} value={form.message} onChange={set("message")} maxLength={400} placeholder="Add the details students need (optional)" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink/90">Open this page when tapped</span>
              <select value={form.link} onChange={set("link")} className="cp-input w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink hover:border-brand/40 focus:border-brand">
                {LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-ink/90">Also send by</legend>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-ink-soft"><Smartphone size={15} aria-hidden="true" /> In-app and phone alerts <span className="text-xs">(always)</span></p>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} className="h-5 w-5 accent-[#15803d] sm:h-4 sm:w-4" /><Mail size={15} className="text-ink-soft" aria-hidden="true" /> Email</label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.sms} onChange={(e) => setForm({ ...form, sms: e.target.checked })} className="h-5 w-5 accent-[#15803d] sm:h-4 sm:w-4" /><MessageSquare size={15} className="text-ink-soft" aria-hidden="true" /> SMS</label>
              </div>
            </fieldset>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">How it will look</p>
            <div className="flex items-start gap-3 rounded-xl border border-line bg-brand-soft/40 px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><BellRing size={15} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="break-words text-sm font-bold">{form.title.trim() || "Your title appears here"}</p>
                {form.message.trim() && <p className="mt-0.5 break-words text-sm text-ink-soft">{form.message.trim()}</p>}
                <p className="mt-1 text-xs text-ink-soft">just now</p>
              </div>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl border border-bad/20 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{error}</p>}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:p-5">
          <Btn variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={sending}>Cancel</Btn>
          <Btn className="w-full sm:w-auto" onClick={send} disabled={!ready}><Send size={15} aria-hidden="true" /> {sending ? "Sending..." : count ? `Send to ${count} student${count === 1 ? "" : "s"}` : "Send"}</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
