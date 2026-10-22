import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Award, Bell, Briefcase, CalendarClock, Clock, Phone, UserPlus, Users, XCircle } from "lucide-react";
import api from "../api/client";
import { showDesktopAlert } from "./desktopAlerts";

export const TYPE_ICON = {
  drive_new: Briefcase, drive_update: CalendarClock, drive_deadline: Clock, drive_cancelled: XCircle,
  application: Users, status: Award, student_joined: UserPlus, system: Bell,
};

export function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Tell the bell that something changed (the notifications page calls this after marking or deleting). */
export const refreshBell = () => window.dispatchEvent(new Event("notifications:changed"));

export default function NotificationBell({ listPath }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [sum, setSum] = useState({ unread: 0, items: [], needsPhone: false });
  const box = useRef(null);
  const seen = useRef(null); // ids we have already shown, so only genuinely new ones pop up

  const load = useCallback(() => {
    api.get("/notifications/summary").then((r) => {
      setSum(r.data);
      if (seen.current) { // not on the very first load, or old notifications would all pop up at once
        r.data.items.filter((n) => !n.read && !seen.current.has(n._id)).forEach((n) => showDesktopAlert(n, (x) => x.link && nav(x.link)));
      }
      seen.current = new Set([...(seen.current || []), ...r.data.items.map((n) => n._id)]);
    }).catch(() => {}); // a failed poll shouldn't bother anyone
  }, [nav]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000); // also runs in background tabs so pop-ups still arrive
    window.addEventListener("notifications:changed", load);
    window.addEventListener("focus", load);
    return () => { clearInterval(timer); window.removeEventListener("notifications:changed", load); window.removeEventListener("focus", load); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) { await api.put(`/notifications/${n._id}/read`).catch(() => {}); load(); }
    if (n.link) nav(n.link);
  }
  async function readAll() {
    await api.put("/notifications/read-all").catch(() => {});
    load();
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}
        aria-label={sum.unread ? `Notifications, ${sum.unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
      >
        <Bell size={19} aria-hidden="true" />
        {sum.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold leading-none text-white ring-2 ring-side">
            {sum.unread > 99 ? "99+" : sum.unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="cp-pop cp-modal absolute right-0 top-12 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white text-ink shadow-[0_20px_40px_-12px_rgba(16,40,28,.35)] md:left-0 md:right-auto">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-bold">Notifications</p>
            <button onClick={readAll} disabled={!sum.unread} className="text-xs font-semibold text-brand disabled:text-ink-soft disabled:opacity-60">Mark all read</button>
          </div>

          {sum.needsPhone && (
            <Link to={listPath} onClick={() => setOpen(false)} className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-2.5 text-xs font-semibold text-warn">
              <Phone size={13} aria-hidden="true" /> Add your phone number to get SMS alerts
            </Link>
          )}

          {!sum.items.length ? (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">You're all caught up.</p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto">
              {sum.items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <li key={n._id}>
                    <button onClick={() => openItem(n)} className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-mint ${n.read ? "" : "bg-brand-soft/40"}`}>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={15} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                        {n.message && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{n.message}</span>}
                        <span className="mt-1 block text-[11px] text-ink-soft">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link to={listPath} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-mint">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}