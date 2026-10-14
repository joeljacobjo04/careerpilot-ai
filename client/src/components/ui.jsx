import { useEffect } from "react";

export const Card = ({ className = "", children, ...rest }) => (
  <div className={`rounded-2xl border border-line bg-white p-5 shadow-card ${className}`} {...rest}>{children}</div>
);

export const Button = ({ variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "bg-brand text-white shadow-sm hover:bg-brand-dark",
    ghost: "border border-line bg-white text-ink hover:bg-mint",
    danger: "bg-bad text-white hover:opacity-90",
    dangerGhost: "border border-line bg-white text-bad hover:border-bad/40 hover:bg-bad-soft",
  }[variant];
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
};

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition placeholder:text-ink-soft/60 hover:border-ink-soft/40 focus:border-brand focus:outline-2 focus:outline-brand/25 disabled:bg-paper disabled:text-ink-soft";

export const Field = ({ label, hint, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-sm font-semibold">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
  </label>
);
export const Input = ({ className = "", ...props }) => <input className={`${inputCls} ${className}`} {...props} />;
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
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
};

export const scoreColor = (v) => (v >= 70 ? "var(--color-ok)" : v >= 40 ? "var(--color-warn)" : "var(--color-bad)");

export function ScoreRing({ value = 0, size = 160, label = "", color, children }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${label} ${v} out of 100`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color || scoreColor(v)} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset .8s ease" }}
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
  <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, value)}%`, background: color || scoreColor(value) }} />
  </div>
);

export const Spinner = ({ text = "Loading..." }) => (
  <div className="flex items-center gap-3 py-10 text-sm text-ink-soft" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
    {text}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{children}</p> : null;

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Empty = ({ children, icon: Icon }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink-soft">
    {Icon && <Icon size={26} className="text-ink-soft/70" aria-hidden="true" />}
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
    className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-side-active font-bold text-side-ink ${className}`}
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
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${value === id ? "bg-ink text-white shadow-sm" : "border border-line bg-white text-ink-soft hover:text-ink"}`}>
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
