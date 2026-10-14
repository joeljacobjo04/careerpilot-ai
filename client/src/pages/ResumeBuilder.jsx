import { useEffect, useRef, useState } from "react";
import { FileText, Pencil, Eye } from "lucide-react";
import api, { errMsg } from "../api/client";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Tabs, Textarea } from "../components/ui";
import { useConfirm, useToast } from "../components/Feedback";

const STORE_KEY = "cp_resume_design";
const TABS = ["Content", "Design", "Sections", "AI & tips"];

const PROMPT_IDEAS = [
  "Make it compact so it fits on one page",
  "Use a dark blue color for headings and my name",
  "Center my name and make it bigger",
  "Make it ATS-friendly and simple",
  "Move Skills above Experience",
  "Hide Certifications and Languages",
  "Use a serif font with underlined headings",
  "Rename Skills to Technical Skills",
  "Show skills as pills",
  "Switch to a two-column layout with a sidebar",
];
const REWRITE_IDEAS = ["Make it shorter", "Make it more impactful", "Use simpler words", "Make it more formal"];

const HEADING_STYLES = [["plain", "Plain bold"], ["underline", "Underline"], ["caps", "UPPERCASE"], ["caps-underline", "UPPERCASE + underline"], ["bar", "Side bar"]];
const BULLETS = [["disc", "● Round"], ["circle", "○ Hollow"], ["square", "■ Square"], ["dash", "– Dash"], ["none", "No bullets"]];
const SKILL_STYLES = [["list", "Bulleted list"], ["inline", "Lines of text"], ["chips", "Pills"]];
const COLUMNS = [["single", "Single column"], ["sidebar-left", "Sidebar on the left"], ["sidebar-right", "Sidebar on the right"]];
const SEPARATORS = [["|", "|  (bar)"], ["•", "•  (bullet)"], ["·", "·  (dot)"], ["/", "/  (slash)"], ["-", "-  (dash)"]];

/* ---------------------------- helpers ---------------------------- */

function loadDesign() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { return null; }
}
function saveDesign(value) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// Build a complete layout, keeping any saved order / hidden sections / renamed headings.
function makeLayout(sections, saved) {
  const ids = Object.keys(sections);
  const order = [...new Set([...(saved?.order || []), ...ids])].filter((id) => ids.includes(id));
  return {
    order,
    hidden: (saved?.hidden || []).filter((id) => ids.includes(id)),
    titles: { ...sections, ...(saved?.titles || {}) },
  };
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOnWhite = (hex) => 1.05 / (luminance(hex) + 0.05);

function getTips(resume, style) {
  const tips = [];
  if (!resume.headline?.trim()) tips.push("Add a title under your name (for example your target role).");
  if (!resume.phone?.trim()) tips.push("Add a phone number so recruiters can reach you.");
  if (!resume.location?.trim()) tips.push("Add your city and state. Many recruiters filter by location.");
  const words = (resume.summary || "").trim().split(/\s+/).filter(Boolean).length;
  if (words && words < 30) tips.push(`Your summary is only ${words} words. Aim for about 40 to 80.`);
  if (words > 100) tips.push(`Your summary is ${words} words. Shorter (40 to 80 words) is easier to skim.`);
  for (const x of resume.experience || []) {
    const n = (x.bullets || []).filter((b) => b && b.trim()).length;
    if (n < 2) tips.push(`Add more points under "${x.role}" (it has ${n}). Aim for 3 to 5.`);
    if (n > 6) tips.push(`"${x.role}" has ${n} points. Keep the strongest 4 to 6.`);
  }
  if (contrastOnWhite(style.textColor) < 4.5) tips.push("Your text color is too light to read comfortably when printed. Choose a darker one.");
  if (contrastOnWhite(style.headingColor) < 3) tips.push("Your heading color is too light. Choose a darker one.");
  if (style.headerStyle === "banner" && contrastOnWhite(style.bannerColor) < 3) tips.push("White text on your banner color is hard to read. Choose a darker banner color.");
  if (style.fontSize < 9.5) tips.push("Text below 9.5pt is hard to read on paper.");
  if (style.fontSize > 12) tips.push("Text above 12pt may push your resume onto extra pages.");
  return tips;
}

/* -------------------- small reusable controls -------------------- */

const Group = ({ title, children }) => (
  <div className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
    {children}
  </div>
);

// label on the left, control on the right; on a narrow editor the control drops under the label instead of overflowing
const Row = ({ label, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
    <span className="text-sm font-semibold">{label}</span>
    <div className="max-w-full min-w-0">{children}</div>
  </div>
);

const Seg = ({ value, options, onChange, label }) => (
  <div role="group" aria-label={label} className="inline-flex max-w-full overflow-hidden rounded-xl border border-line">
    {options.map((o) => (
      <button type="button" key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        className={`whitespace-nowrap px-3 py-2 text-xs font-semibold transition ${value === o.value ? "bg-brand text-white" : "bg-white text-ink-soft hover:bg-paper"}`}>
        {o.label}
      </button>
    ))}
  </div>
);

const Slider = ({ label, value, min, max, step, unit = "", onChange }) => (
  <label className="block">
    <span className="mb-1 flex justify-between text-sm font-semibold">
      <span>{label}</span><span className="font-normal text-ink-soft">{value}{unit}</span>
    </span>
    <input type="range" className="w-full accent-brand" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

const ColorField = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 text-sm font-semibold">
    <span>{label}</span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs font-normal text-ink-soft">{value}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
    </span>
  </label>
);

const Pick = ({ value, options, onChange, label }) => (
  <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </Select>
);

// "Rewrite with AI" box that sits under a text field
function AiRewrite({ kind, getText, onResult }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previous, setPrevious] = useState(null);

  async function run(preset) {
    const instr = (preset ?? instruction).trim();
    const current = getText();
    if (!current.trim()) return setError("There is nothing to rewrite yet.");
    if (!instr) return setError("Tell the AI what to change, or pick one of the quick options.");
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/resume/rewrite", { kind, text: current, instruction: instr });
      setPrevious(current);
      onResult(data.text);
      setInstruction("");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md bg-paper p-2.5">
      <div className="flex flex-wrap gap-1.5">
        {REWRITE_IDEAS.map((idea) => (
          <button type="button" key={idea} disabled={busy} onClick={() => run(idea)}
            className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50">{idea}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} aria-label="Rewrite instruction"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          placeholder="Or type, e.g. make it sound more confident" />
        <Button type="button" variant="ghost" disabled={busy} onClick={() => run()}>{busy ? "..." : "Rewrite"}</Button>
      </div>
      {previous !== null && (
        <button type="button" className="text-xs font-semibold text-brand" onClick={() => { onResult(previous); setPrevious(null); }}>Undo last rewrite</button>
      )}
      <ErrorBox>{error}</ErrorBox>
    </div>
  );
}

// Comma separated skills. Changes are saved when you leave the field so typing commas feels natural.
function SkillGroup({ name, list, onChange }) {
  const [value, setValue] = useState(list.join(", "));
  const key = list.join("|");
  useEffect(() => { setValue(list.join(", ")); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={name} hint="Separate skills with commas.">
      <Input value={value} onChange={(e) => setValue(e.target.value)}
        onBlur={() => onChange(value.split(",").map((x) => x.trim()).filter(Boolean))} />
    </Field>
  );
}

/* ---------------------- template gallery + A4 preview ---------------------- */

// Tiny drawing of a template, built from its preset so it always matches the real look
function Thumb({ p }) {
  const side = p.columns !== "single";
  const bar = (w, color = "#d1d5db", h = 3) => <div className="rounded-full" style={{ width: w, height: h, background: color }} />;
  const block = (
    <>
      {bar("45%", p.headingColor, 4)}{bar("90%")}{bar("75%")}
      {bar("50%", p.headingColor, 4)}{bar("90%")}{bar("70%")}
      {bar("40%", p.headingColor, 4)}{bar("85%")}
    </>
  );
  return (
    <div className="relative h-[92px] w-[66px] shrink-0 overflow-hidden rounded border border-line bg-white shadow-sm">
      {side && <div className="absolute inset-y-0 w-[32%]" style={{ background: p.bannerColor, [p.columns === "sidebar-left" ? "left" : "right"]: 0 }} />}
      <div className="flex flex-col gap-[3px] p-1.5"
        style={{ paddingLeft: side && p.columns === "sidebar-left" ? "38%" : undefined, paddingRight: side && p.columns === "sidebar-right" ? "38%" : undefined,
          alignItems: !side && p.headerAlign === "center" ? "center" : "stretch" }}>
        {!side && (p.headerStyle === "banner"
          ? <div className="mb-1 h-4 w-full rounded-sm" style={{ background: p.bannerColor }} />
          : <div className="mb-1 flex flex-col gap-[2px]" style={{ alignItems: p.headerAlign === "center" ? "center" : "flex-start", width: "100%" }}>
              {bar("55%", p.nameColor, 5)}{bar("35%")}
              {p.headerRule !== "none" && <div className="mt-[1px] w-full" style={{ height: p.headerRule === "thick" ? 2 : 1, background: p.headingColor }} />}
            </div>)}
        {block}
      </div>
    </div>
  );
}

function TemplateGallery({ templates, presets, value, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Template">
      {templates.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onPick(t.id)}
          className={`flex gap-2.5 rounded-lg border p-2 text-left transition ${value === t.id ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-white hover:border-ink-soft"}`}>
          <Thumb p={presets[t.id]} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t.label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{t.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- A4 page preview ----------
// The resume is shown as real A4 sheets (794 x 1123 px at 96 dpi), one sheet per page, with the same margins the PDF uses.
// A hidden copy of the resume is measured, the page breaks are chosen so no line, bullet or job is cut in half,
// and each sheet shows its own slice. On narrow screens the sheets are scaled down so they always look like the PDF.
const PAGE_W = 794;
const PAGE_H = 1123;
const MM = 96 / 25.4;

function pageGeometry(style) {
  const cols = style.columns !== "single";
  const padX = cols ? 0 : Math.round(15 * MM);
  const padY = cols ? 0 : Math.round(13 * MM);
  return { cols, padX, padY, contentW: PAGE_W - padX * 2, pageH: PAGE_H - padY * 2 };
}

// Cancels the on-screen "paper on a grey desk" styling so the document is laid out exactly like the printed page
function withPrintLayout(html, style, g) {
  const pad = g.cols ? 0 : Number(style.pagePadding) || 0;
  const css = `@media screen{html,body{background:transparent!important}body{margin:0!important;padding:0!important;width:${g.contentW}px!important}` +
    `.page{width:auto!important;min-height:0!important;margin:0!important;box-shadow:none!important;background:none!important;padding:${pad}px!important}}`;
  return html.replace("</head>", `<style>${css}</style></head>`);
}

// Choose where each page ends: at the natural A4 height, pulled up if that would slice through a line, bullet or job
function computeBreaks(doc, total, pageH) {
  const blocks = [...doc.querySelectorAll("li, .item, p, h2, .c, .sk, .headline, .contact")]
    .map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + doc.defaultView.scrollY, bottom: r.bottom + doc.defaultView.scrollY, tag: el.tagName }; })
    .filter((b) => b.bottom - b.top > 0 && b.bottom - b.top < pageH * 0.8);
  const cuts = [0];
  let guard = 0;
  while (total - cuts[cuts.length - 1] > pageH && guard++ < 12) {
    const from = cuts[cuts.length - 1];
    let cut = from + pageH;
    for (let i = 0; i < 8; i++) {
      const hit = blocks.filter((b) => b.top < cut - 1 && b.bottom > cut + 1 && b.top > from + pageH * 0.3);
      const orphanHeading = blocks.find((b) => b.tag === "H2" && b.bottom <= cut && b.bottom > cut - 36 && b.top > from + pageH * 0.3);
      const next = Math.min(...hit.map((b) => b.top), orphanHeading ? orphanHeading.top : Infinity);
      if (!Number.isFinite(next)) break;
      cut = next;
    }
    cuts.push(cut);
  }
  return cuts.map((start, i) => ({ start, end: i + 1 < cuts.length ? cuts[i + 1] : total }));
}

function PagedPreview({ html, style }) {
  const box = useRef(null);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState(null); // { html, total, pages, geo, bg } of the last measured version
  const g = pageGeometry(style);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => { if (el.clientWidth > 100) setScale(Math.min(1, (el.clientWidth - 24) / PAGE_W)); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const doc = html ? withPrintLayout(html, style, g) : "";
  const sidebarBg = g.cols
    ? `linear-gradient(to ${style.columns === "sidebar-left" ? "right" : "left"},${style.bannerColor} 0,${style.bannerColor} 32%,#fff 32%,#fff 100%)`
    : "#fff";

  function measure(e) {
    const frame = e.currentTarget;
    const run = () => {
      const d = frame.contentDocument;
      if (!d?.body) return;
      const total = Math.max(d.documentElement.scrollHeight, d.body.scrollHeight, 1);
      const pages = computeBreaks(d, total, g.pageH);
      setView({ html: doc, total, pages, geo: g, bg: sidebarBg });
    };
    const fonts = frame.contentDocument?.fonts?.ready;
    fonts ? fonts.then(run, run) : run();
  }

  const v = view;
  return (
    <div ref={box} className="thin-scroll max-h-[85vh] min-h-[420px] overflow-auto rounded-2xl border border-line p-3" style={{ background: "#dfe4e8" }}>
      {/* hidden copy used only to measure the page breaks */}
      {doc && <iframe title="Measuring resume" aria-hidden="true" tabIndex={-1} sandbox="allow-same-origin" srcDoc={doc} onLoad={measure}
        style={{ position: "absolute", left: -99999, top: 0, width: g.contentW, height: 200, border: 0, visibility: "hidden" }} />}
      {!v ? <p className="p-6 text-center text-sm text-ink-soft">Preparing preview...</p> : (
        <div className="flex flex-col items-center gap-4">
          {v.pages.map((pg, i) => (
            <figure key={i} className="m-0">
              <div style={{ width: PAGE_W * scale, height: PAGE_H * scale }} className="overflow-hidden rounded-sm shadow-[0_2px_14px_rgba(0,0,0,.22)]">
                <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left", background: v.bg, position: "relative" }}>
                  <div style={{ position: "absolute", left: v.geo.padX, top: v.geo.padY, width: v.geo.contentW, height: Math.min(v.geo.pageH, pg.end - pg.start), overflow: "hidden" }}>
                    <iframe title={`Resume page ${i + 1}`} sandbox="allow-same-origin" srcDoc={v.html} tabIndex={-1}
                      style={{ width: v.geo.contentW, height: v.total, border: 0, transform: `translateY(-${pg.start}px)`, pointerEvents: "none", background: "transparent" }} />
                  </div>
                </div>
              </div>
              <figcaption className="mt-1.5 text-center text-xs font-semibold text-ink-soft">Page {i + 1} of {v.pages.length}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- page ------------------------------ */

export default function ResumeBuilder() {
  const confirm = useConfirm();
  const toast = useToast();
  const [mobileView, setMobileView] = useState("edit"); // phones show either the editor or the preview
  const [resume, setResume] = useState(null);
  const [html, setHtml] = useState("");
  const [meta, setMeta] = useState(null);
  const [template, setTemplate] = useState("professional");
  const [style, setStyle] = useState(null);
  const [layout, setLayout] = useState(null);
  const [tab, setTab] = useState("Content");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiNote, setAiNote] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true); // true while the saved resume is being fetched
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const requestId = useRef(0);
  const hydrated = useRef(false); // autosave stays off until the saved resume has been loaded
  const lastSaved = useRef(""); // JSON of what the server already has
  const pending = useRef(null); // changes not yet sent to the server

  /* ---- restore the saved resume after a refresh / new visit ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/resume/saved");
        if (cancelled) return;
        if (data.saved) {
          const tpl = data.meta.presets[data.template] ? data.template : "professional";
          const savedStyle = { ...data.meta.presets[tpl], ...(data.style || {}) };
          const savedLayout = makeLayout(data.meta.sections, data.layout);
          lastSaved.current = JSON.stringify({ template: tpl, resume: data.resume, style: savedStyle, layout: savedLayout });
          setResume(data.resume);
          setHtml(data.html);
          setMeta(data.meta);
          setTemplate(tpl);
          setStyle(savedStyle);
          setLayout(savedLayout);
          setSaveState("saved");
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) { hydrated.current = true; setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- autosave: store content + design on the server shortly after every change ---- */
  useEffect(() => {
    if (!hydrated.current || !resume || !style || !layout) return undefined;
    const payload = { template, resume, style, layout };
    const json = JSON.stringify(payload);
    if (json === lastSaved.current) return undefined;
    pending.current = { json, payload };
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        await api.put("/resume/saved", payload);
        lastSaved.current = json;
        if (pending.current?.json === json) pending.current = null;
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [loading, resume, template, style, layout]);

  // If you leave the page or refresh within the short delay above, send the last changes right away.
  useEffect(() => {
    const flush = () => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      try {
        fetch(`${import.meta.env.VITE_API_URL || "/api"}/resume/saved`, {
          method: "PUT",
          keepalive: true,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("cp_token")}` },
          body: JSON.stringify(p.payload),
        }).catch(() => {});
      } catch { /* nothing more we can do */ }
    };
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
  }, []);

  /* ---- generate ---- */
  async function generate() {
    if (resume) {
      const ok = await confirm({
        title: "Regenerate your resume content?",
        message: "The summary and bullet points will be rewritten from your profile. Any wording you edited by hand will be replaced. Your design choices are kept.",
        confirmText: "Regenerate",
      });
      if (!ok) return;
    }
    setBusy("generate"); setError("");
    try {
      const { data } = await api.post("/resume/generate");
      const saved = loadDesign();
      const tpl = style ? template : data.meta.presets[saved?.template] ? saved.template : "professional";
      setResume(data.resume);
      setHtml(data.html);
      setMeta(data.meta);
      setTemplate(tpl);
      // keep the design you already chose; otherwise restore your last saved design
      if (!style) setStyle({ ...data.meta.presets[tpl], ...(saved?.style || {}) });
      if (!layout) setLayout(makeLayout(data.meta.sections, saved?.layout));
      setHistory([]);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  }

  /* ---- live preview (waits until you stop changing things) ---- */
  useEffect(() => {
    if (!resume || !style || !layout) return undefined;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post("/resume/preview", { template, resume, style, layout });
        if (id === requestId.current) setHtml(data.html);
      } catch (e) { if (id === requestId.current) setError(errMsg(e)); }
    }, 500);
    return () => clearTimeout(timer);
  }, [resume, template, style, layout]);

  // remember your design for next time
  useEffect(() => { if (style && layout) saveDesign({ template, style, layout }); }, [template, style, layout]);

  /* ---- design helpers ---- */
  const setS = (key) => (value) => setStyle((s) => ({ ...s, [key]: value }));
  const snapshot = () => setHistory((h) => [...h.slice(-19), { template, style, layout }]);

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setTemplate(last.template); setStyle(last.style); setLayout(last.layout);
    setHistory((h) => h.slice(0, -1));
    setAiNote(null);
  }
  function applyPreset(name) { snapshot(); setTemplate(name); setStyle({ ...meta.presets[name] }); }
  async function resetDesign() {
    const ok = await confirm({ title: "Reset the design?", message: "Fonts, colors, spacing and the order and names of your sections go back to this template's defaults. You can undo this from the AI & tips tab.", confirmText: "Reset design", tone: "danger" });
    if (!ok) return;
    snapshot(); setStyle({ ...meta.presets[template] }); setLayout(makeLayout(meta.sections)); setAiNote(null); toast("Design reset");
  }

  async function applyAi(promptText = aiPrompt) {
    if (promptText.trim().length < 3) return;
    setBusy("ai"); setError(""); setAiNote(null);
    try {
      const { data } = await api.post("/resume/customize", { prompt: promptText, template, style, layout });
      if (data.changed > 0) { snapshot(); setStyle(data.style); setLayout(data.layout); }
      setAiNote({ text: data.message, changed: data.changed });
      if (data.changed > 0) setAiPrompt("");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  }

  /* ---- section helpers ---- */
  const moveSection = (i, dir) => setLayout((l) => {
    const order = [...l.order]; const j = i + dir;
    if (j < 0 || j >= order.length) return l;
    [order[i], order[j]] = [order[j], order[i]];
    return { ...l, order };
  });
  const toggleSection = (id) => setLayout((l) => ({ ...l, hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] }));
  const renameSection = (id, title) => setLayout((l) => ({ ...l, titles: { ...l.titles, [id]: title } }));

  /* ---- content helpers ---- */
  const setField = (key) => (e) => setResume((r) => ({ ...r, [key]: e.target.value }));
  const setBullets = (i, text) => setResume((r) => ({ ...r, experience: r.experience.map((x, n) => (n === i ? { ...x, bullets: text.split("\n") } : x)) }));
  const setSkillGroup = (group, list) => setResume((r) => ({ ...r, skills: { ...r.skills, [group]: list } }));

  /* ---- output ---- */
  async function download() {
    setBusy("pdf"); setError("");
    try {
      const res = await api.post("/resume/pdf", { template, resume, style, layout }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href: url, download: "resume.pdf" });
      a.click();
      URL.revokeObjectURL(url);
      toast("Resume downloaded");
    } catch (e) { setError("Could not create the PDF. " + (await pdfErrorMessage(e))); }
    finally { setBusy(""); }
  }

  // Backup that needs no server PDF engine: opens the browser's print dialog -> choose "Save as PDF"
  function printResume() {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.onload = () => {
      frame.contentWindow.onafterprint = () => frame.remove();
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  }

  const tips = resume && style ? getTips(resume, style) : [];

  return (
    <>
      <PageHeader
        title="AI resume builder"
        subtitle="Builds your resume from your profile, then lets you edit the content, design and sections, or just describe the look you want. It never invents experience, so check the wording before you send it."
        action={<Button onClick={generate} disabled={!!busy || loading}>{busy === "generate" ? "Writing..." : resume ? "Regenerate content" : "Generate resume"}</Button>}
      />
      <ErrorBox>{error}</ErrorBox>

      {loading && <p className="mt-4 text-sm text-ink-soft">Loading your saved resume...</p>}

      {!loading && !resume && (
        <Empty>Click <b>Generate resume</b> to start. After that you can edit the text, change fonts, colors and alignment, reorder sections, or type what you want in plain English.</Empty>
      )}

      {resume && style && layout && meta && (
        <>
        {/* phones show the editor or the preview, one at a time */}
        <div className="mt-4 flex gap-2 lg:hidden" role="tablist" aria-label="Resume view">
          {[["edit", "Edit", Pencil], ["preview", "Preview", Eye]].map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={mobileView === id} onClick={() => setMobileView(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mobileView === id ? "bg-ink text-white shadow-sm" : "border border-line bg-white text-ink-soft"}`}>
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[390px_1fr]">
          {/* ------------- editor ------------- */}
          <Card className={`self-start !p-0 ${mobileView === "edit" ? "" : "hidden lg:block"}`}>
            <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line p-2" role="tablist">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
                  {t}{t === "AI & tips" && tips.length > 0 ? ` (${tips.length})` : ""}
                </button>
              ))}
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              {/* ---------- CONTENT ---------- */}
              {tab === "Content" && (
                <>
                  <Group title="Header">
                    <Field label="Full name"><Input value={resume.name || ""} onChange={setField("name")} /></Field>
                    <Field label="Title under your name"><Input value={resume.headline || ""} onChange={setField("headline")} placeholder="UI/UX Designer" /></Field>
                    <Field label="Email"><Input value={resume.email || ""} onChange={setField("email")} /></Field>
                    <Field label="Phone"><Input value={resume.phone || ""} onChange={setField("phone")} /></Field>
                    <Field label="Location"><Input value={resume.location || ""} onChange={setField("location")} placeholder="Kochi, Kerala, India" /></Field>
                  </Group>

                  <Group title="Summary">
                    <Textarea rows={6} aria-label="Professional summary" value={resume.summary || ""} onChange={setField("summary")} />
                    <AiRewrite kind="summary" getText={() => resume.summary || ""} onResult={(t) => setResume((r) => ({ ...r, summary: t }))} />
                  </Group>

                  {resume.experience?.map((x, i) => (
                    <Group key={i} title={`${x.role}${x.company ? ` - ${x.company}` : ""}`}>
                      <Textarea rows={6} aria-label={`Points for ${x.role}`} value={(x.bullets || []).join("\n")} onChange={(e) => setBullets(i, e.target.value)} />
                      <p className="text-xs text-ink-soft">One point per line. Wrap words in **double asterisks** to make them bold.</p>
                      <AiRewrite kind="bullets" getText={() => (x.bullets || []).join("\n")} onResult={(t) => setBullets(i, t)} />
                    </Group>
                  ))}

                  {Object.keys(resume.skills || {}).length > 0 && (
                    <Group title="Skills">
                      {Object.entries(resume.skills).map(([group, list]) => (
                        <SkillGroup key={group} name={group} list={list} onChange={(l) => setSkillGroup(group, l)} />
                      ))}
                    </Group>
                  )}
                </>
              )}

              {/* ---------- DESIGN ---------- */}
              {tab === "Design" && (
                <>
                  <Group title="Starting point">
                    <TemplateGallery templates={meta.templates} presets={meta.presets} value={template} onPick={applyPreset} />
                    <p className="text-xs text-ink-soft">Choosing a template resets the settings below. Use Undo (in the AI &amp; tips tab) to go back.</p>
                  </Group>

                  <Group title="Text">
                    <Row label="Font"><div className="w-full min-w-44 sm:w-52"><Pick label="Font" value={style.font} onChange={setS("font")} options={meta.fonts.map((f) => [f.id, f.label])} /></div></Row>
                    <p className="text-xs text-ink-soft">The PDF uses fonts installed on the server, so a font you do not see in the PDF may need installing there.</p>
                    <Slider label="Font size" unit="pt" min={8} max={14} step={0.5} value={style.fontSize} onChange={setS("fontSize")} />
                    <Slider label="Line spacing" min={1.1} max={2} step={0.05} value={style.lineHeight} onChange={setS("lineHeight")} />
                    <Row label="Summary alignment">
                      <Seg label="Summary alignment" value={style.textAlign} onChange={setS("textAlign")} options={[{ value: "left", label: "Left" }, { value: "justify", label: "Justified" }]} />
                    </Row>
                    <ColorField label="Text color" value={style.textColor} onChange={setS("textColor")} />
                  </Group>

                  <Group title="Layout and header">
                    <Row label="Columns"><div className="w-full min-w-44 sm:w-52"><Pick label="Columns" value={style.columns} onChange={setS("columns")} options={COLUMNS} /></div></Row>
                    {style.columns !== "single" ? (
                      <>
                        <ColorField label="Sidebar color" value={style.bannerColor} onChange={setS("bannerColor")} />
                        <p className="text-xs text-ink-soft">The sidebar holds your name, contact details, skills, languages and certifications. The text color switches to white or black automatically.</p>
                      </>
                    ) : (
                      <>
                        <Row label="Alignment">
                          <Seg label="Header alignment" value={style.headerAlign} onChange={setS("headerAlign")} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                        </Row>
                        <Row label="Style">
                          <Seg label="Header style" value={style.headerStyle} onChange={setS("headerStyle")} options={[{ value: "plain", label: "Plain" }, { value: "banner", label: "Banner" }]} />
                        </Row>
                        {style.headerStyle === "plain" && (
                          <Row label="Line under header">
                            <Seg label="Line under header" value={style.headerRule} onChange={setS("headerRule")} options={[{ value: "none", label: "None" }, { value: "thin", label: "Thin" }, { value: "thick", label: "Thick" }]} />
                          </Row>
                        )}
                        {style.headerStyle === "banner" && <ColorField label="Banner color" value={style.bannerColor} onChange={setS("bannerColor")} />}
                      </>
                    )}
                    <Row label="Name">
                      <Seg label="Name capitalisation" value={style.nameCase} onChange={setS("nameCase")} options={[{ value: "upper", label: "UPPERCASE" }, { value: "normal", label: "Normal" }]} />
                    </Row>
                    <Slider label="Name size" unit="px" min={16} max={44} step={1} value={style.nameSize} onChange={setS("nameSize")} />
                    {style.columns === "single" && style.headerStyle !== "banner" && <ColorField label="Name color" value={style.nameColor} onChange={setS("nameColor")} />}
                    {style.columns === "single" && <Row label="Contact separator"><div className="w-full min-w-36 sm:w-36"><Pick label="Contact separator" value={style.separator} onChange={setS("separator")} options={SEPARATORS} /></div></Row>}
                  </Group>

                  <Group title="Section headings">
                    <Row label="Style"><div className="w-full min-w-44 sm:w-52"><Pick label="Heading style" value={style.headingStyle} onChange={setS("headingStyle")} options={HEADING_STYLES} /></div></Row>
                    <Row label="Alignment">
                      <Seg label="Heading alignment" value={style.headingAlign} onChange={setS("headingAlign")} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} />
                    </Row>
                    <Slider label="Size" unit="px" min={10} max={20} step={1} value={style.headingSize} onChange={setS("headingSize")} />
                    <ColorField label="Heading color" value={style.headingColor} onChange={setS("headingColor")} />
                  </Group>

                  <Group title="Spacing and details">
                    <Slider label="Space between sections" unit="px" min={4} max={36} step={1} value={style.sectionGap} onChange={setS("sectionGap")} />
                    <Slider label="Space between jobs / projects" unit="px" min={2} max={24} step={1} value={style.itemGap} onChange={setS("itemGap")} />
                    {style.columns === "single" && <Slider label="Extra page padding" unit="px" min={0} max={40} step={1} value={style.pagePadding} onChange={setS("pagePadding")} />}
                    <Row label="Bullets"><div className="w-full min-w-36 sm:w-40"><Pick label="Bullet style" value={style.bulletStyle} onChange={setS("bulletStyle")} options={BULLETS} /></div></Row>
                    <Row label="Dates">
                      <Seg label="Date position" value={style.dateStyle} onChange={setS("dateStyle")} options={[{ value: "right", label: "Right side" }, { value: "inline", label: "After title" }]} />
                    </Row>
                    <Row label="Skills"><div className="w-full min-w-36 sm:w-40"><Pick label="Skills display" value={style.skillsStyle} onChange={setS("skillsStyle")} options={SKILL_STYLES} /></div></Row>
                  </Group>

                  <Button variant="dangerGhost" onClick={resetDesign}>Reset design and sections</Button>
                </>
              )}

              {/* ---------- SECTIONS ---------- */}
              {tab === "Sections" && (
                <Group title="Show, rename and reorder sections">
                  <p className="text-xs text-ink-soft">Untick a section to hide it. Edit the name to rename the heading. Use the arrows to move it.</p>
                  {layout.order.map((id, i) => (
                    <div key={id} className="flex items-center gap-2 rounded-md border border-line p-2">
                      <input type="checkbox" className="h-4 w-4 accent-brand" checked={!layout.hidden.includes(id)} onChange={() => toggleSection(id)} aria-label={`Show ${meta.sections[id]}`} />
                      <Input value={layout.titles[id] ?? ""} onChange={(e) => renameSection(id, e.target.value)} aria-label={`Heading for ${meta.sections[id]}`} />
                      <button type="button" disabled={i === 0} onClick={() => moveSection(i, -1)} className="px-1.5 text-lg font-bold disabled:opacity-30" aria-label={`Move ${meta.sections[id]} up`}>↑</button>
                      <button type="button" disabled={i === layout.order.length - 1} onClick={() => moveSection(i, 1)} className="px-1.5 text-lg font-bold disabled:opacity-30" aria-label={`Move ${meta.sections[id]} down`}>↓</button>
                    </div>
                  ))}
                  <p className="text-xs text-ink-soft">A section with no content (for example Projects when you have none) is left out automatically.</p>
                </Group>
              )}

              {/* ---------- AI & TIPS ---------- */}
              {tab === "AI & tips" && (
                <>
                  <Group title="Describe the look you want">
                    <Textarea rows={3} aria-label="Describe the look you want" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder='For example: "Center my name, make the headings dark green and fit everything on one page"' />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => applyAi()} disabled={!!busy || aiPrompt.trim().length < 3}>{busy === "ai" ? "Applying..." : "Apply with AI"}</Button>
                      <Button variant="ghost" onClick={undo} disabled={!history.length}>Undo last change</Button>
                    </div>
                    {aiNote && (
                      <p role="status" className="rounded-md bg-brand-soft px-3 py-2 text-sm">
                        {aiNote.text}{aiNote.changed === 0 ? " (nothing was changed. Try describing it differently.)" : ""}
                      </p>
                    )}
                    <p className="text-xs font-semibold text-ink-soft">Ideas to try:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PROMPT_IDEAS.map((idea) => (
                        <button type="button" key={idea} onClick={() => setAiPrompt(idea)}
                          className="rounded-full border border-line bg-white px-2.5 py-1 text-left text-xs font-semibold text-ink-soft hover:text-ink">{idea}</button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-soft">The AI only changes how the resume looks. To change wording, use the Rewrite buttons in the Content tab.</p>
                  </Group>

                  <Group title="Resume health check">
                    {tips.length === 0
                      ? <Badge tone="ok">All checks passed</Badge>
                      : <ul className="list-disc space-y-1.5 pl-5 text-sm">{tips.map((t) => <li key={t}>{t}</li>)}</ul>}
                  </Group>
                </>
              )}
            </div>
          </Card>

          {/* ------------- live preview ------------- */}
          <div className={`self-start lg:sticky lg:top-4 ${mobileView === "preview" ? "" : "invisible h-0 overflow-hidden lg:visible lg:h-auto lg:overflow-visible"}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-soft">
                Live preview <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink-soft ring-1 ring-line">A4</span>
                <span role="status" className="ml-2 text-xs font-normal">
                  {saveState === "saving" && "Saving..."}
                  {saveState === "saved" && "All changes saved"}
                  {saveState === "error" && <span className="text-red-600">Could not save. Retrying on your next change.</span>}
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={printResume} title="Opens the print dialog. Choose 'Save as PDF'.">Print / Save as PDF</Button>
                <Button onClick={download} disabled={!!busy}>{busy === "pdf" ? "Preparing..." : "Download PDF"}</Button>
              </div>
            </div>
            <PagedPreview html={html} style={style} />
          </div>
        </div>
        </>
      )}
    </>
  );
}

// Error responses for the PDF download arrive as a Blob, so read the real message out of it
async function pdfErrorMessage(e) {
  const data = e.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message; } catch { /* fall through */ }
  }
  return errMsg(e);
}