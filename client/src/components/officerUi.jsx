import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

/* ---------- buttons ---------- */
const BTN = {
  // bright mint button used for the main action ("Create new drive", "Update", "Edit")
  bright: "cp-btn-primary text-white",
  // dark button used on the Add Company form
  dark: "bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white shadow-[0_8px_18px_-8px_rgba(15,23,42,.7)] hover:-translate-y-px hover:brightness-110",
  outline: "border border-line bg-white text-ink hover:-translate-y-px hover:border-brand/40 hover:bg-mint hover:shadow-md",
  dangerOutline: "border border-line bg-white text-bad hover:-translate-y-px hover:border-bad/40 hover:bg-bad-soft",
};
export const btnCls = (variant = "bright", extra = "") =>
  `inline-flex min-h-10 items-center justify-center gap-2 cp-press rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${extra}`;

export const Btn = ({ variant = "bright", className = "", ...props }) => (
  <button className={btnCls(variant, className)} {...props} />
);
export const BtnLink = ({ variant = "bright", className = "", ...props }) => (
  <Link className={btnCls(variant, className)} {...props} />
);

/* ---------- surfaces ---------- */
export const Panel = ({ className = "", children, hover = false }) => (
  <div className={`cp-card rounded-2xl p-5 ${hover ? "cp-card-hover" : ""} ${className}`}>
    {children}
  </div>
);

export const OfficerHeader = ({ title, subtitle, action, center = false }) => (
  <div className={`cp-page mb-6 flex flex-wrap items-start justify-between gap-3 ${center ? "justify-center text-center" : ""}`}>
    <div className="min-w-0">
      <h1 className="cp-title-grad text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const BackLink = ({ to, children }) => (
  <Link to={to} className="group mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition hover:gap-2.5 hover:underline">
    <span aria-hidden="true">&larr;</span> {children}
  </Link>
);

/* ---------- small pieces ---------- */
const PILL = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-paper text-ink-soft",
};
const DOT = { ok: "bg-ok", warn: "bg-[#d99a1c]", bad: "bg-bad", neutral: "bg-ink-soft" };

/** Pill with a leading dot: "• In Progress", "• Open", "• Needs Attention" */
export const Pill = ({ tone = "neutral", children }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tone]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]} ${tone === "bad" ? "cp-pulse-dot" : ""}`} aria-hidden="true" />
    {children}
  </span>
);

export const Meter = ({ value = 0, color, className = "" }) => (
  <div className={`h-2 w-full overflow-hidden rounded-full bg-[#eef5f0] ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="cp-bar-fill h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
  </div>
);

/** Small uppercase label above a value (used on detail cards) */
export const Fact = ({ label, children }) => (
  <Panel className="!p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-brand/80">{label}</p>
    <div className="mt-1 text-lg font-bold">{children}</div>
  </Panel>
);

export const LogoTile = ({ company, size = 40 }) => (
  <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-soft to-white text-brand ring-1 ring-brand/10 cp-icon-tile" style={{ width: size, height: size }}>
    {company?.logo
      ? <img src={company.logo} alt="" className="h-full w-full object-contain bg-white" />
      : <Building2 size={size * 0.5} aria-hidden="true" />}
  </span>
);

/* ---------- readiness status (same thresholds as the dashboard: 75 / 45) ---------- */
export const readinessTone = (v) => (v >= 75 ? "ok" : v >= 45 ? "warn" : "bad");
export const readinessLabel = (v) => (v >= 75 ? "On Track" : v >= 45 ? "In Progress" : "Needs Attention");
export const readinessColor = (v) => (v >= 75 ? "#22b45f" : v >= 45 ? "#e9a62a" : "#e0483f");

/* ---------- drive helpers ---------- */
export const isOpen = (d) => d.status !== "completed";
export const fmtDate = (d, fallback = "TBA") =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : fallback;

/** Registration status as the officer sees it: the DB value "registered" is shown as "Applied" */
export const APPLICANT_STATUSES = [
  ["registered", "Applied"], ["shortlisted", "Shortlisted"], ["selected", "Selected"], ["rejected", "Rejected"],
];
export const statusLabel = (v) => APPLICANT_STATUSES.find(([k]) => k === v)?.[1] || v;
