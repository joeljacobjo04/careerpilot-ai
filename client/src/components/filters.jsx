import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Check, ChevronDown, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Input, Select } from "./ui";
import { Btn } from "./officerUi";

/* ------------------------------------------------------------------ *
 *  Shared filter kit used by every list page.
 *
 *  useUrlFilters   keeps every filter in the page address (?dept=CSE&minCgpa=7), so a filtered
 *                  view survives a refresh and can be shared. Also gives `query` and `apply`
 *                  for saved views.
 *  FilterBar       one tidy card: quick filters, search + main filters, a grouped
 *                  "More filters" panel, the result count and removable chips.
 *  inputs          SearchBox, SelectFilter, RangeFilter, DateRangeFilter, TagInput, ChipPicker
 *  extras          QuickFilters (one-tap segments), SavedViews (remember a filter), FilterGroup
 *  helpers         makeChips, rangeChips, downloadCsv, parseLpa, inRange, list helpers
 * ------------------------------------------------------------------ */

/** Filters stored in the URL. `defaults` must be a constant object (declared outside the component). */
export function useUrlFilters(defaults) {
  const [sp, setSp] = useSearchParams();
  const defRef = useRef(defaults);
  const key = sp.toString();

  const values = useMemo(() => {
    const d = defRef.current;
    return Object.fromEntries(Object.keys(d).map((k) => [k, sp.get(k) ?? d[k]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** The filters that are switched on, as a query string (the page number is left out). Used by saved views. */
  const query = useMemo(() => {
    const d = defRef.current;
    const out = new URLSearchParams();
    for (const k of Object.keys(d)) if (k !== "page" && values[k] !== d[k] && values[k] !== "") out.set(k, values[k]);
    return out.toString();
  }, [values]);

  /** set({ dept: "CSE", minCgpa: "7" }). Any change except `page` itself sends the list back to page 1. */
  const set = useCallback((patch) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      const d = defRef.current;
      const resetPage = "page" in d && !("page" in patch);
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v == null || v === d[k]) next.delete(k); else next.set(k, String(v));
      }
      if (resetPage) next.delete("page");
      return next;
    }, { replace: true });
  }, [setSp]);

  /** Back to the defaults. `keep` lists filter names that stay as they are (for example the active tab). */
  const reset = useCallback((keep = []) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const k of Object.keys(defRef.current)) if (!keep.includes(k)) next.delete(k);
      return next;
    }, { replace: true });
  }, [setSp]);

  /** Replace the filters with a saved query string */
  const apply = useCallback((qs) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const k of Object.keys(defRef.current)) next.delete(k);
      new URLSearchParams(qs).forEach((v, k) => { if (k in defRef.current) next.set(k, v); });
      return next;
    }, { replace: true });
  }, [setSp]);

  return { values, set, reset, apply, query };
}

/* ---------------- phone support ---------------- */
export function useMediaQuery(query) {
  const read = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
/** true on tablets and computers; false on phones, where filters open in a bottom sheet instead */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");

// Sheets can open on top of each other (a drop-down inside the filter sheet). Only the top one closes on Esc.
const sheetStack = [];
let scrollLocks = 0;

/** Bottom sheet for phones: slides up, scrolls inside, stays above the page, closes on the backdrop or Esc. */
export function Sheet({ open, onClose, title, children, footer, z = 90 }) {
  const id = useRef({});
  useEffect(() => {
    if (!open) return undefined;
    const me = id.current;
    sheetStack.push(me);
    scrollLocks += 1;
    document.body.style.overflow = "hidden";
    const key = (e) => { if (e.key === "Escape" && sheetStack[sheetStack.length - 1] === me) onClose(); };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      sheetStack.splice(sheetStack.indexOf(me), 1);
      scrollLocks -= 1;
      if (!scrollLocks) document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center bg-ink/50 backdrop-blur-[2px] animate-fade" style={{ zIndex: z }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="cp-modal flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-pop animate-slide-up">
        <div className="shrink-0 px-5 pt-2.5">
          <span className="mx-auto mb-2.5 block h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 pb-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink"><X size={20} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- helpers ---------------- */
export const toList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
export const fromList = (a) => a.join(",");
/** "Pick several" filters keep their values joined with | (for example CSE|ECE) */
export const toMulti = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);
export const fromMulti = (a) => a.join("|");
/** Drop empty values before sending filters to the server */
export const cleanParams = (obj, drop = []) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== "" && v != null && !drop.includes(k)));
const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/** true when `v` is inside [min, max]. Empty bounds are ignored. A missing value fails any bound that is set. */
export function inRange(v, min, max) {
  const lo = num(min), hi = num(max);
  if (lo == null && hi == null) return true;
  if (v == null || Number.isNaN(Number(v))) return false;
  return (lo == null || v >= lo) && (hi == null || v <= hi);
}

/** Dates from <input type="date"> are YYYY-MM-DD. Compare on whole days. */
export function inDateRange(date, from, to) {
  if (!from && !to) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

/** "6-9 LPA" -> { lo: 6, hi: 9 }.  "12 LPA" -> { lo: 12, hi: 12 }.  Nothing numeric -> null */
export function parseLpa(text) {
  const nums = String(text || "").replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!nums) return null;
  const v = nums.map(Number);
  return { lo: Math.min(...v), hi: Math.max(...v) };
}
/** Does a package string overlap the chosen range (in LPA)? */
export function packageInRange(text, min, max) {
  const lo = num(min), hi = num(max);
  if (lo == null && hi == null) return true;
  const p = parseLpa(text);
  if (!p) return false;
  return (hi == null || p.lo <= hi) && (lo == null || p.hi >= lo);
}

/** Download rows as a CSV file (opens fine in Excel, including non-English text) */
export function downloadCsv(filename, header, rows) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

/**
 * Chips for every filter that differs from its default.
 * defs: [{ key, label, format?(value), multi? }]  ->  [{ key, label, value, text, onRemove }]
 */
export function makeChips(values, defaults, set, defs) {
  const out = [];
  for (const { key, label, format, multi } of defs) {
    const v = values[key];
    if (v === defaults[key] || v === "" || v == null) continue;
    if (key === "skills") {
      // one chip per skill, so each can be removed on its own
      for (const s of toList(v)) out.push({ key: `skills:${s}`, label, value: s, text: `${label}: ${s}`, onRemove: () => set({ skills: fromList(toList(v).filter((x) => x !== s)) }) });
      continue;
    }
    if (multi) {
      // one chip per ticked value (several departments, batches...), each removable on its own
      for (const item of toMulti(v)) {
        const shown = format ? format(item) : item;
        out.push({ key: `${key}:${item}`, label, value: shown, text: `${label}: ${shown}`, onRemove: () => set({ [key]: fromMulti(toMulti(v).filter((x) => x !== item)) }) });
      }
      continue;
    }
    const shown = format ? format(v) : v;
    out.push({ key, label, value: shown, text: `${label}: ${shown}`, onRemove: () => set({ [key]: defaults[key] }) });
  }
  return out;
}

/** Range text for a chip: "7 - 9", "7+", "up to 9" */
export const rangeText = (lo, hi, suffix = "") => (lo && hi ? `${lo} - ${hi}${suffix}` : lo ? `${lo}+${suffix}` : `up to ${hi}${suffix}`);
/** One chip for a min/max pair (removing it clears both) */
export function rangeChips(values, set, defaults, { label, minKey, maxKey, suffix = "" }) {
  const lo = values[minKey], hi = values[maxKey];
  if (!lo && !hi) return [];
  const value = rangeText(lo, hi, suffix);
  return [{ key: `${minKey}${maxKey}`, label, value, text: `${label}: ${value}`, onRemove: () => set({ [minKey]: defaults[minKey], [maxKey]: defaults[maxKey] }) }];
}

/* ---------------- inputs ---------------- */
export const FilterField = ({ label, children, className = "", hint }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>}
  </label>
);

/** Search box that waits for a short pause in typing before it tells the page (so servers are not hit on every key) */
export function SearchBox({ value, onChange, placeholder = "Search...", label = "Search", title = "Search", delay = 300, className = "min-w-60 flex-1" }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]); // follows "Clear all"
  useEffect(() => {
    if (text === value) return undefined;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <FilterField label={title} className={className}>
      <span className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
        <Input className="!pl-10 !pr-9" placeholder={placeholder} aria-label={label} value={text} onChange={(e) => setText(e.target.value)} />
        {text && (
          <button type="button" onClick={() => { setText(""); onChange(""); }} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-soft transition hover:bg-paper hover:text-ink">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </span>
    </FilterField>
  );
}

/** options: ["CSE", "ECE"] or [["open", "Open"], ["closed", "Closed"]] */
export function SelectFilter({ label, value, onChange, options = [], anyLabel = "Any", className = "w-full sm:w-44", hideAny = false }) {
  return (
    <FilterField label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {!hideAny && <option value="">{anyLabel}</option>}
        {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
      </Select>
    </FilterField>
  );
}

export function RangeFilter({ label, min, max, onMin, onMax, step = "any", lo = 0, hi, className = "", minPlaceholder = "Min", maxPlaceholder = "Max" }) {
  return (
    <FilterField label={label} className={className}>
      <div className="flex items-center gap-2">
        <Input type="number" inputMode="decimal" step={step} min={lo} max={hi} placeholder={minPlaceholder} value={min} onChange={(e) => onMin(e.target.value)} aria-label={`${label} minimum`} />
        <span className="text-ink-soft" aria-hidden="true">&ndash;</span>
        <Input type="number" inputMode="decimal" step={step} min={lo} max={hi} placeholder={maxPlaceholder} value={max} onChange={(e) => onMax(e.target.value)} aria-label={`${label} maximum`} />
      </div>
    </FilterField>
  );
}

export function DateRangeFilter({ label, from, to, onFrom, onTo, className = "" }) {
  return (
    <FilterField label={label} className={className}>
      <div className="flex flex-col gap-2 min-[440px]:flex-row min-[440px]:items-center">
        <Input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} aria-label={`${label} from`} />
        <span className="hidden text-ink-soft min-[440px]:inline" aria-hidden="true">&ndash;</span>
        <Input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} aria-label={`${label} to`} />
      </div>
    </FilterField>
  );
}

/**
 * Drop-down where any number of options can be ticked (for example several departments at once).
 * `value` is the ticked values joined with | ; nothing ticked means "any".
 * options: ["CSE", "ECE"] or [["placed", "Placed"], ["in_process", "In process"]]
 * On computers it opens a list under the button; on phones it opens a bottom sheet with bigger rows.
 */
export function MultiSelect({ label, value, onChange, options = [], anyLabel = "Any", className = "w-full sm:w-44", searchable }) {
  const picked = toMulti(value);
  const opts = useMemo(() => options.map((o) => (Array.isArray(o) ? o : [o, o])), [options]);
  const nameOf = (v) => opts.find(([k]) => k === v)?.[1] || v;
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const box = useRef(null);
  const showSearch = searchable ?? opts.length > 7;
  const close = useCallback(() => { setOpen(false); setText(""); }, []);

  useEffect(() => {
    if (!open || !desktop) return undefined;
    const off = (e) => !box.current?.contains(e.target) && close();
    const esc = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open, desktop, close]);

  const toggle = (v) => onChange(fromMulti(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]));
  const shownOpts = text ? opts.filter(([, l]) => l.toLowerCase().includes(text.toLowerCase())) : opts;
  const summary = picked.length ? nameOf(picked[0]) : anyLabel;

  const body = (
    <>
      {showSearch && (
        <div className="relative mb-2">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <Input className="!pl-8" placeholder={`Find ${label.toLowerCase()}`} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Find ${label}`} />
        </div>
      )}
      <div className="mb-1 flex items-center justify-between px-1.5 text-xs">
        <span className="font-semibold text-ink-soft">{picked.length ? `${picked.length} selected` : "None selected = any"}</span>
        <span className="flex gap-4">
          <button type="button" onClick={() => onChange(fromMulti([...new Set([...picked, ...shownOpts.map(([k]) => k)])]))} className="py-1 font-bold text-brand hover:underline">Select all</button>
          <button type="button" onClick={() => onChange("")} disabled={!picked.length} className="py-1 font-bold text-brand hover:underline disabled:opacity-40 disabled:no-underline">Clear</button>
        </span>
      </div>
      <ul role="listbox" aria-multiselectable="true" aria-label={label} className={desktop ? "max-h-60 overflow-y-auto" : ""}>
        {!shownOpts.length && <li className="px-3 py-3 text-sm text-ink-soft">{opts.length ? "Nothing matches that" : "Nothing to choose from yet"}</li>}
        {shownOpts.map(([v, l]) => {
          const on = picked.includes(v);
          return (
            <li key={v} role="option" aria-selected={on}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-3 text-base transition hover:bg-mint md:py-2 md:text-sm ${on ? "bg-brand-soft/50 font-semibold" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(v)} className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#15803d] md:h-4 md:w-4" />
                <span className="min-w-0 truncate">{l}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <div className={`relative min-w-0 ${className}`} ref={box}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${picked.length ? picked.map(nameOf).join(", ") : anyLabel}`}
        className={`cp-input flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white/90 px-3.5 py-2 text-left text-sm hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${picked.length ? "border-brand/40 text-ink" : "border-line text-ink-soft"}`}>
        <span className="truncate">{summary}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {picked.length > 1 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">+{picked.length - 1}</span>}
          <ChevronDown size={14} className={`text-ink-soft transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>

      {open && desktop && (
        <div className="cp-pop cp-modal absolute left-0 top-full z-40 mt-1.5 w-64 min-w-full max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-2 shadow-pop">{body}</div>
      )}
      {!desktop && (
        <Sheet open={open} onClose={close} title={label} z={95}
          footer={<Btn className="w-full" onClick={close}>{picked.length ? `Done (${picked.length} selected)` : "Done"}</Btn>}>
          {body}
        </Sheet>
      )}
    </div>
  );
}

/** Type a value and press Enter (or pick a suggestion) to add it. Used for skills. */
export function TagInput({ label, values, onChange, suggestions = [], placeholder = "Type and press Enter", className = "" }) {
  const [text, setText] = useState("");
  const listId = useMemo(() => `tags-${Math.random().toString(36).slice(2, 8)}`, []);
  const has = (v) => values.some((x) => x.toLowerCase() === v.toLowerCase());

  function add(raw) {
    const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !has(s));
    if (parts.length) onChange([...values, ...parts]);
    setText("");
  }
  function onInput(e) {
    const v = e.target.value;
    // picking an entry from the suggestion list adds it straight away
    if (v && suggestions.some((s) => s.toLowerCase() === v.toLowerCase()) && [undefined, "insertReplacementText"].includes(e.nativeEvent?.inputType)) return add(v);
    if (v.endsWith(",")) return add(v);
    setText(v);
  }

  return (
    <FilterField label={label} className={className}>
      <Input list={listId} value={text} placeholder={placeholder} autoComplete="off" onChange={onInput} aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (text.trim()) add(text); }
          if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)} />
      <datalist id={listId}>{suggestions.filter((s) => !has(s)).slice(0, 80).map((s) => <option key={s} value={s} />)}</datalist>
      {values.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-white/70"><X size={11} aria-hidden="true" /></button>
            </span>
          ))}
        </span>
      )}
    </FilterField>
  );
}

/**
 * Pick any number of values by tapping chips (used to choose who a drive is open to).
 * Nothing picked means "everyone". `allowCustom` lets the officer type a value that no student has yet.
 */
export function ChipPicker({ label, hint, options = [], values, onChange, allowCustom = false, placeholder = "Add another...", emptyText = "Nothing to pick yet" }) {
  const [text, setText] = useState("");
  const all = useMemo(() => [...new Set([...options, ...values])], [options, values]);
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  function add() {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  }
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink/90">{label}</span>
        <span className="text-xs font-semibold text-ink-soft">{values.length ? `${values.length} selected` : "Everyone"}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {all.length === 0 && <span className="text-xs text-ink-soft">{emptyText}</span>}
        {all.map((v) => {
          const on = values.includes(v);
          return (
            <button key={v} type="button" onClick={() => toggle(v)} aria-pressed={on}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${on ? "border-brand bg-brand text-white shadow-sm" : "border-line bg-white text-ink-soft hover:border-brand/40 hover:text-ink"}`}>
              {on && <Check size={12} aria-hidden="true" />}{v}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className="mt-2 flex max-w-xs gap-2">
          <Input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} aria-label={`Add ${label}`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" onClick={add} disabled={!text.trim()} aria-label={`Add ${label}`}
            className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-3 text-ink-soft transition hover:border-brand/40 hover:text-brand disabled:opacity-40"><Plus size={16} aria-hidden="true" /></button>
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/* ---------------- quick filters & saved views ---------------- */
/** One-tap segments, for example "Needs attention". items: [{ label, patch: { band: "needs_attention" } }] */
export function QuickFilters({ items, values, defaults, set }) {
  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Quick filters">
      <span className="mr-1 hidden shrink-0 text-[11px] font-bold uppercase tracking-wider text-ink-soft sm:inline">Quick filters</span>
      {items.map(({ label, patch }) => {
        const active = Object.entries(patch).every(([k, v]) => values[k] === v);
        return (
          <button key={label} type="button" aria-pressed={active}
            onClick={() => set(active ? Object.fromEntries(Object.keys(patch).map((k) => [k, defaults[k]])) : patch)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-3 sm:py-1 ${active ? "border-brand bg-brand text-white shadow-sm" : "border-line bg-white text-ink-soft hover:border-brand/40 hover:text-ink"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Remember a combination of filters under a name (kept in this browser) and bring it back with one tap. */
export function SavedViews({ storageKey, query, onApply }) {
  const key = `cp:views:${storageKey}`;
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState([]);
  const [name, setName] = useState("");
  const box = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    try { setViews(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setViews([]); }
  }, [key]);
  useEffect(() => {
    if (!open || !desktop) return undefined;
    const off = (e) => !box.current?.contains(e.target) && close();
    const esc = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open, desktop, close]);

  const persist = (next) => {
    setViews(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked: the view just won't be remembered */ }
  };
  function save() {
    const n = name.trim().slice(0, 40);
    if (!n || !query) return;
    persist([{ id: Date.now(), name: n, qs: query }, ...views.filter((v) => v.name.toLowerCase() !== n.toLowerCase())].slice(0, 12));
    setName("");
  }

  const body = (
    <>
      {!views.length ? <p className="mb-3 rounded-lg bg-paper px-3 py-2.5 text-sm text-ink-soft">Nothing saved yet. Set some filters, give them a name below and they will be one tap away next time.</p> : (
        <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
          {views.map((v) => (
            <li key={v.id} className="flex items-center gap-1">
              <button type="button" onClick={() => { onApply(v.qs); close(); }} className="min-w-0 flex-1 truncate rounded-lg px-3 py-3 text-left text-base font-semibold transition hover:bg-mint md:py-2 md:text-sm">{v.name}</button>
              <button type="button" onClick={() => persist(views.filter((x) => x.id !== v.id))} aria-label={`Delete saved view ${v.name}`} className="rounded-md p-3 text-ink-soft transition hover:bg-bad-soft hover:text-bad md:p-2"><Trash2 size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-semibold text-ink-soft">{query ? "Save the filters you have on now" : "Switch on some filters to save them"}</p>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSE 2026 ready" maxLength={40} disabled={!query} aria-label="Name for this view"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
          <Btn onClick={save} disabled={!query || !name.trim()}>Save</Btn>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand/40 hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-10 sm:w-auto">
        <Bookmark size={15} aria-hidden="true" /> Saved views
        {views.length > 0 && <span className="rounded-full bg-paper px-1.5 text-[11px] font-bold text-ink-soft">{views.length}</span>}
      </button>
      {open && desktop && (
        <div className="cp-pop cp-modal absolute right-0 top-12 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3 shadow-pop">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Your saved views</p>
          {body}
        </div>
      )}
      {!desktop && <Sheet open={open} onClose={close} title="Saved views" z={95}>{body}</Sheet>}
    </div>
  );
}

/* ---------------- layout ---------------- */
/** A titled block inside the "More filters" panel */
export const FilterGroup = ({ title, children, cols = 1, className = "" }) => (
  <fieldset className={`min-w-0 rounded-xl border border-line bg-white/80 p-3.5 ${className}`}>
    {title && <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-dark">{title}</legend>}
    <div className={`grid gap-3 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
  </fieldset>
);

/**
 * quick      <QuickFilters .../> row shown first
 * search     the SearchBox
 * children   main filters shown in the first row
 * more       FilterGroup blocks inside the collapsible panel
 * moreCount  how many of those are active (shown on the button; opens the panel on load when > 0)
 * chips      from makeChips()
 * summary    text such as "24 of 120 students"
 * actions    secondary controls (Sort, Saved views). On phones they move inside the Filters sheet.
 * primary    the main button (Notify, Export). Always visible, also on phones.
 *
 * Computers: everything sits in one card, with a collapsible "More filters" panel.
 * Phones: search + a "Filters" button; the filters open in a bottom sheet so the list stays on screen.
 */
export function FilterBar({ quick, search, children, more, moreCount = 0, chips = [], onClear, summary, actions, primary, className = "mb-5" }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(moreCount > 0);
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  const activeCount = chips.filter((c) => !/^search$/i.test(c.label || "")).length;
  const hasControls = !!(children || more || actions);

  const chipButtons = chips.map((c) => (
    <button key={c.key} type="button" onClick={c.onRemove} aria-label={`Remove filter ${c.text}`}
      className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand/20 bg-brand-soft/70 py-1.5 pl-3 pr-2 text-xs transition hover:border-brand/50 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:py-1">
      {c.label && <span className="text-ink-soft">{c.label}</span>}
      <b className="text-brand-dark">{c.value ?? c.text}</b>
      <X size={13} className="text-ink-soft transition group-hover:text-bad" aria-hidden="true" />
    </button>
  ));
  const clearButton = chips.length > 0 && (
    <button type="button" onClick={onClear} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-brand transition hover:bg-brand-soft sm:py-1">
      <RotateCcw size={12} aria-hidden="true" /> Clear all
    </button>
  );

  return (
    <section aria-label="Filters" className={`cp-card relative z-20 rounded-2xl p-3.5 sm:p-4 ${className}`}>
      {quick && <div className="mb-3.5">{quick}</div>}

      {desktop ? (
        <>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
            {search}
            {children}
            {more && (
              <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${open || moreCount ? "border-brand/40 bg-brand-soft" : "border-line bg-white hover:bg-mint"}`}>
                <SlidersHorizontal size={15} aria-hidden="true" /> More filters
                {moreCount > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{moreCount}</span>}
                <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            )}
            {(actions || primary) && <div className="ml-auto flex flex-wrap items-end gap-2">{actions}{primary}</div>}
          </div>
          {more && open && (
            <div className="cp-pop mt-4 grid items-start gap-4 border-t border-line pt-4 md:grid-cols-2 xl:grid-cols-3">{more}</div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {search}
          {(hasControls || primary) && (
            <div className="flex gap-2">
              {hasControls && (
                <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog"
                  className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-ink transition active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${activeCount ? "border-brand/40 bg-brand-soft" : "border-line bg-white"}`}>
                  <SlidersHorizontal size={16} aria-hidden="true" /> Filters
                  {activeCount > 0 && <span className="rounded-full bg-brand px-2 text-xs font-bold text-white">{activeCount}</span>}
                </button>
              )}
              {primary && <div className="flex [&>*]:min-h-11">{primary}</div>}
            </div>
          )}
          <Sheet open={sheet} onClose={closeSheet} title="Filters" z={90}
            footer={
              <div className="flex gap-2">
                <Btn variant="outline" onClick={onClear} disabled={!chips.length}><RotateCcw size={14} aria-hidden="true" /> Clear all</Btn>
                <Btn className="flex-1" onClick={closeSheet}>{summary ? `Show results` : "Done"}</Btn>
              </div>
            }>
            {summary && <p className="mb-4 rounded-xl bg-mint px-3.5 py-2.5 text-sm font-bold" role="status">{summary}</p>}
            <div className="space-y-5">
              {actions && <div className="grid gap-3">{actions}</div>}
              {children && <div className="grid gap-3 min-[420px]:grid-cols-2">{children}</div>}
              {more && <div className="grid gap-4">{more}</div>}
            </div>
          </Sheet>
        </div>
      )}

      {(chips.length > 0 || summary) && (
        <div className="mt-3.5 border-t border-line pt-3 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {summary && <p className="mb-2 font-bold text-ink sm:mb-0 sm:mr-1" role="status">{summary}</p>}
          {chips.length > 0 && (
            <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {!desktop && clearButton}
              {chipButtons}
              {desktop && clearButton}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** "Showing 12 of 40 drives" */
export const countText = (shown, total, noun) => (shown === total ? `${total} ${noun}${total === 1 ? "" : "s"}` : `${shown} of ${total} ${noun}${total === 1 ? "" : "s"}`);

/* ---------------- shared choices ---------------- */
export const JOB_TYPES = [["full_time", "Full-time"], ["internship", "Internship"], ["internship_ppo", "Internship + PPO"]];
export const jobTypeLabel = (v) => JOB_TYPES.find(([k]) => k === (v || "full_time"))?.[1] || "Full-time";
/** unique, sorted, non-empty strings */
export const uniq = (arr) => [...new Set((arr || []).filter(Boolean).map((x) => String(x).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const DAY_MS = 86400000;
/** "closing" filter shared by the drive pages: 7 / 30 = closes within that many days, passed, none = no deadline */
export function closingMatches(deadline, mode, isOpenNow = true) {
  if (!mode) return true;
  if (mode === "none") return !deadline;
  if (!deadline) return false;
  const ms = new Date(deadline).getTime() - Date.now();
  if (mode === "passed") return ms < 0;
  return isOpenNow && ms >= 0 && ms <= Number(mode) * DAY_MS;
}
