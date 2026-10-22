import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const Card = ({ className = "", children, ...rest }) => (
  <div className={`cp-card cp-card-hover rounded-2xl p-5 ${className}`} {...rest}>{children}</div>
);

export const Button = ({ variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "cp-btn-primary text-white",
    ghost: "border border-line bg-white text-ink hover:-translate-y-px hover:border-brand/40 hover:bg-mint hover:shadow-md",
    danger: "bg-gradient-to-br from-[#e0483f] to-[#c73a3a] text-white shadow-[0_8px_18px_-8px_rgba(199,58,58,.7)] hover:-translate-y-px hover:brightness-105",
    dangerGhost: "border border-line bg-white text-bad hover:-translate-y-px hover:border-bad/40 hover:bg-bad-soft",
  }[variant];
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 cp-press rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
};

const inputCls =
  "cp-input w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 hover:border-brand/40 focus:border-brand focus:bg-white disabled:bg-paper disabled:text-ink-soft";

export const Field = ({ label, hint, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-sm font-semibold text-ink/90">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
  </label>
);
export const Input = ({ className = "", ...props }) => <input className={`${inputCls} ${className}`} {...props} />;
/** Password box with a show/hide eye button. */
export function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <Input type={show ? "text" : "password"} className={`!pr-11 ${className}`} {...props} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
        {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </span>
  );
}
export const Textarea = ({ className = "", ...props }) => <textarea className={`${inputCls} min-h-24 ${className}`} {...props} />;
export const Select = ({ children, className = "", ...props }) => <select className={`${inputCls} ${className}`} {...props}>{children}</select>;

export const Badge = ({ tone = "neutral", children }) => {
  const tones = {
    neutral: "bg-paper text-ink-soft",
    brand: "bg-brand-soft text-brand-dark",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/5 ${tones[tone]}`}>{children}</span>;
};

export const scoreColor = (v) => (v >= 70 ? "var(--color-ok)" : v >= 40 ? "var(--color-warn)" : "var(--color-bad)");

export function ScoreRing({ value = 0, size = 160, label = "", color, children }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${label} ${v} out of 100`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" opacity=".8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color || scoreColor(v)} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)", filter: `drop-shadow(0 0 6px ${color || scoreColor(v)}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children || (
          <>
            <span className="text-4xl font-extrabold leading-none">{Math.round(v)}</span>
            {label && <span className="mt-1 text-xs font-semibold text-ink-soft">{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export const Bar = ({ value = 0, color }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-paper shadow-inner">
    <div className="cp-bar-fill h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, value)}%`, background: color || scoreColor(value) }} />
  </div>
);

export const Spinner = ({ text = "Loading..." }) => (
  <div className="flex items-center gap-3 py-10 text-sm text-ink-soft" role="status">
    <span className="cp-spinner h-5 w-5 rounded-full border-[2.5px] border-brand-soft border-t-brand" />
    {text}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? <p role="alert" className="cp-shake rounded-xl border border-bad/20 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{children}</p> : null;

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="cp-page mb-6 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0 border-l-4 border-bar pl-3.5">
      <h1 className="cp-title-grad text-2xl font-extrabold tracking-tight md:text-[1.75rem]">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Empty = ({ children, icon: Icon }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand/30 bg-white/70 p-8 text-center text-sm text-ink-soft">
    {Icon && <span className="cp-float-a flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon size={24} aria-hidden="true" /></span>}
    <div>{children}</div>
  </div>
);

export const List = ({ items = [], tone = "text-ink" }) => (
  <ul className={`list-disc space-y-1 pl-5 text-sm ${tone}`}>
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ul>
);

/** Round profile picture, or the person's initials when there is no picture. */
const initialsOf = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
export const Avatar = ({ name, src, size = 40, className = "" }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#86efac] to-side-active font-bold text-side-ink ring-2 ring-white/70 ${className}`}
    style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
  >
    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
  </span>
);

/** Pill-style tab bar that scrolls sideways on phones. */
export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div className={`no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 ${className}`} role="tablist">
      {tabs.map((t) => {
        const [id, label, count] = Array.isArray(t) ? t : [t, t];
        return (
          <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${value === id ? "bg-gradient-to-br from-[#16a34a] to-[#0f5f2d] text-white shadow-[0_8px_18px_-8px_rgba(21,128,61,.7)]" : "border border-line bg-white text-ink-soft hover:-translate-y-px hover:border-brand/40 hover:text-ink"}`}>
            {label}
            {count != null && <span className={`rounded-full px-1.5 text-[11px] ${value === id ? "bg-white/20" : "bg-paper"}`}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Small hook: warn before the browser tab closes while there is unsaved work. */
export function useUnsavedWarning(active) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active]);
}
