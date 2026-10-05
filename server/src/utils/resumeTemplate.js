const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Escapes first, then turns **text** into bold, so it is safe to use inside bullets.
const rich = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// Only real web addresses become links (blocks javascript: and similar). A missing "https://" is added.
const safeUrl = (u) => {
  const v = String(u || "").trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
const link = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

export const TEMPLATES = ["professional", "classic", "modern", "executive", "sidebar", "minimal", "elegant", "bold"];

// Shown in the template gallery
export const TEMPLATE_INFO = {
  professional: { label: "Professional", description: "Clean sans-serif with a centered header" },
  classic: { label: "Classic", description: "Traditional serif with ruled headings" },
  modern: { label: "Modern", description: "Colored header banner" },
  executive: { label: "Executive", description: "Navy serif with a strong header rule" },
  sidebar: { label: "Sidebar", description: "Two columns with a colored side panel" },
  minimal: { label: "ATS Minimal", description: "Plain and simple, safest for applicant tracking systems" },
  elegant: { label: "Elegant", description: "Centered serif with warm accents" },
  bold: { label: "Bold", description: "Teal banner, side-bar headings and pills" },
};

/* ------------------------------------------------------------------ */
/*  Everything the user can customise, with the values that are allowed */
/* ------------------------------------------------------------------ */

// Only these font stacks can be used, so user or AI input can never inject CSS.
// The PDF uses fonts installed on the server; the preview uses fonts installed on your computer.
export const FONTS = {
  latin: { label: "Modern sans (Latin Modern)", stack: "'Latin Modern Sans','Computer Modern Sans','Helvetica Neue',Arial,sans-serif" },
  helvetica: { label: "Arial / Helvetica", stack: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  calibri: { label: "Calibri", stack: "Calibri,Carlito,'Segoe UI',Arial,sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana,'DejaVu Sans',Geneva,sans-serif" },
  georgia: { label: "Georgia (serif)", stack: "Georgia,'Times New Roman',serif" },
  times: { label: "Times New Roman (serif)", stack: "'Times New Roman',Times,'Liberation Serif',serif" },
  garamond: { label: "Garamond (serif)", stack: "Garamond,'EB Garamond','Times New Roman',serif" },
  mono: { label: "Monospace", stack: "'Courier New',Courier,monospace" },
};

export const SECTION_IDS = ["summary", "experience", "projects", "education", "skills", "certifications", "languages"];
export const DEFAULT_TITLES = {
  summary: "Professional Summary",
  experience: "Professional Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
};

export const STYLE_SCHEMA = {
  options: {
    font: Object.keys(FONTS),
    textAlign: ["left", "justify"], // alignment of the summary paragraph
    headerAlign: ["left", "center", "right"],
    headerStyle: ["plain", "banner"], // banner = coloured block behind the name
    nameCase: ["upper", "normal"],
    separator: ["|", "•", "·", "/", "-"], // between email, phone, location
    headingStyle: ["plain", "underline", "caps", "caps-underline", "bar"],
    headingAlign: ["left", "center"],
    bulletStyle: ["disc", "circle", "square", "dash", "none"],
    dateStyle: ["right", "inline"],
    skillsStyle: ["list", "inline", "chips"],
    columns: ["single", "sidebar-left", "sidebar-right"], // sidebar = colored side panel with contact, skills, languages, certifications
    headerRule: ["none", "thin", "thick"], // line under the header (plain header only)
  },
  ranges: {
    fontSize: [8, 14], // pt
    lineHeight: [1.1, 2],
    nameSize: [16, 44], // px
    headingSize: [10, 20], // px
    sectionGap: [4, 36], // px between sections
    itemGap: [2, 24], // px between jobs / projects
    pagePadding: [0, 40], // px of extra space inside the page margins (single column only)
  },
  colors: ["textColor", "headingColor", "nameColor", "bannerColor"],
};

const BASE = {
  font: "latin", textAlign: "left", headerAlign: "center", headerStyle: "plain", nameCase: "upper", separator: "|",
  headingStyle: "plain", headingAlign: "left", bulletStyle: "disc", dateStyle: "right", skillsStyle: "list",
  columns: "single", headerRule: "none",
  fontSize: 10.5, lineHeight: 1.45, nameSize: 25, headingSize: 14, sectionGap: 18, itemGap: 10, pagePadding: 0,
  textColor: "#111111", headingColor: "#000000", nameColor: "#000000", bannerColor: "#2b59ff",
};

export const PRESETS = {
  // Same look as the sample resume: centred name and title, bold headings, role and date on one line.
  professional: { ...BASE },
  classic: {
    ...BASE, font: "georgia", fontSize: 10, lineHeight: 1.5, nameCase: "normal", nameSize: 24, headingStyle: "caps-underline",
    headingSize: 12, sectionGap: 14, itemGap: 8, skillsStyle: "inline", headerRule: "thin",
    textColor: "#1f2937", headingColor: "#111827", nameColor: "#111827",
  },
  modern: {
    ...BASE, font: "helvetica", fontSize: 10, lineHeight: 1.5, headerAlign: "left", headerStyle: "banner", nameCase: "normal", nameSize: 26,
    headingStyle: "caps-underline", headingSize: 12, sectionGap: 14, itemGap: 8, skillsStyle: "inline",
    textColor: "#1f2937", headingColor: "#2b59ff", nameColor: "#2b59ff",
  },
  executive: {
    ...BASE, font: "georgia", fontSize: 10, lineHeight: 1.5, headerAlign: "left", nameCase: "upper", nameSize: 26, headerRule: "thick",
    headingStyle: "caps-underline", headingSize: 12, sectionGap: 15, itemGap: 9, skillsStyle: "inline", separator: "•",
    textColor: "#222222", headingColor: "#1e3a5f", nameColor: "#1e3a5f", bannerColor: "#1e3a5f",
  },
  sidebar: {
    ...BASE, font: "calibri", fontSize: 9.5, lineHeight: 1.45, columns: "sidebar-left", headerAlign: "left", nameCase: "normal", nameSize: 24,
    headingStyle: "caps-underline", headingSize: 11, sectionGap: 14, itemGap: 8, skillsStyle: "list", bulletStyle: "disc",
    textColor: "#1f2933", headingColor: "#24364d", nameColor: "#24364d", bannerColor: "#24364d",
  },
  minimal: {
    ...BASE, font: "helvetica", fontSize: 10, lineHeight: 1.45, headerAlign: "left", nameCase: "upper", nameSize: 22, headerRule: "thin",
    headingStyle: "caps", headingSize: 11, sectionGap: 14, itemGap: 8, skillsStyle: "inline", separator: "|",
    textColor: "#000000", headingColor: "#000000", nameColor: "#000000",
  },
  elegant: {
    ...BASE, font: "garamond", fontSize: 11, lineHeight: 1.5, headerAlign: "center", nameCase: "upper", nameSize: 28, headerRule: "thin",
    headingStyle: "caps-underline", headingAlign: "center", headingSize: 12, sectionGap: 16, itemGap: 9, skillsStyle: "inline",
    bulletStyle: "dash", separator: "·", textColor: "#2b2b2b", headingColor: "#7a5c3e", nameColor: "#3b2f26", bannerColor: "#7a5c3e",
  },
  bold: {
    ...BASE, font: "helvetica", fontSize: 10, lineHeight: 1.5, headerAlign: "left", headerStyle: "banner", nameCase: "normal", nameSize: 28,
    headingStyle: "bar", headingSize: 13, sectionGap: 15, itemGap: 9, skillsStyle: "chips", bulletStyle: "square",
    textColor: "#1f2937", headingColor: "#0f766e", nameColor: "#0f766e", bannerColor: "#0f766e",
  },
};

const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const clampNum = (v, [lo, hi], fallback) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Accepts anything, returns a complete, safe style object. Unknown or invalid values fall back to the preset. */
export function normalizeStyle(input, template = "professional") {
  const def = PRESETS[template] || PRESETS.professional;
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  for (const [key, allowed] of Object.entries(STYLE_SCHEMA.options)) out[key] = allowed.includes(src[key]) ? src[key] : def[key];
  for (const [key, range] of Object.entries(STYLE_SCHEMA.ranges)) out[key] = clampNum(src[key], range, def[key]);
  for (const key of STYLE_SCHEMA.colors) out[key] = isHex(src[key]) ? src[key] : def[key];
  return out;
}

/** Section order, hidden sections and renamed headings. */
export function normalizeLayout(input) {
  const src = input && typeof input === "object" ? input : {};
  const order = [];
  for (const id of Array.isArray(src.order) ? src.order : []) if (SECTION_IDS.includes(id) && !order.includes(id)) order.push(id);
  for (const id of SECTION_IDS) if (!order.includes(id)) order.push(id);
  const hidden = (Array.isArray(src.hidden) ? src.hidden : []).filter((id, i, all) => SECTION_IDS.includes(id) && all.indexOf(id) === i);
  const titles = {};
  for (const id of SECTION_IDS) {
    const t = src.titles?.[id];
    titles[id] = typeof t === "string" && t.trim() ? t.trim().slice(0, 60) : DEFAULT_TITLES[id];
  }
  return { order, hidden, titles };
}

/* ------------------------------------------------------------------ */
/*  Renderer                                                           */
/* ------------------------------------------------------------------ */

// Black or white text, whichever is readable on the given background colour
const onColor = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#111111" : "#ffffff";
};

const SIDE_SECTIONS = ["skills", "languages", "certifications"];

export function renderResumeHtml(r, template = "professional", options = {}) {
  const base = TEMPLATES.includes(template) ? template : "professional";
  const s = normalizeStyle(options.style, base);
  const layout = normalizeLayout(options.layout);
  const banner = s.headerStyle === "banner";
  const cols = s.columns !== "single";
  const bannerText = onColor(s.bannerColor);

  const emailOk = r.email && /^[^\s@<>"']+@[^\s@<>"']+$/.test(r.email.trim());
  const contactItems = [
    r.email ? (emailOk ? link(`mailto:${r.email.trim()}`, r.email.trim()) : esc(r.email)) : "",
    esc(r.phone || ""),
    esc(r.location || ""),
    // short names (GitHub, LinkedIn, Portfolio) that open the full address, instead of printing long URLs
    ...[["GitHub", r.links?.github], ["LinkedIn", r.links?.linkedin], ["Portfolio", r.links?.portfolio]]
      .map(([label, url]) => (safeUrl(url) ? link(safeUrl(url), label) : "")),
  ].filter(Boolean);
  const contactLine = contactItems.join(` <span class="sep">${esc(s.separator)}</span> `);

  const bullets = (list = []) => {
    const items = list.filter((b) => b && String(b).trim());
    return items.length ? `<ul class="b-${s.bulletStyle}">${items.map((b) => `<li>${rich(b)}</li>`).join("")}</ul>` : "";
  };

  // title on the left, dates (or tech stack) on the right, or inline after the title
  const head = (title, right, cls = "date") =>
    s.dateStyle === "inline"
      ? `<div class="line"><b>${title}</b>${right ? ` <span class="${cls}">&nbsp;${esc(s.separator)}&nbsp; ${right}</span>` : ""}</div>`
      : `<div class="row"><b class="t">${title}</b>${right ? `<span class="${cls}">${right}</span>` : ""}</div>`;

  // company on the left, place on the right
  const sub = (left, right) =>
    !left && !right ? "" :
    s.dateStyle === "inline" || !right
      ? `<div class="sub"><span class="co">${left}</span>${left && right ? ", " : ""}<span class="loc">${right}</span></div>`
      : `<div class="row sub"><span class="co">${left}</span><span class="loc">${right}</span></div>`;

  const builders = {
    summary: () => (r.summary ? `<p class="summary">${rich(r.summary)}</p>` : ""),

    experience: () =>
      (r.experience || [])
        .map((e) => {
          const dates = [e.start, e.end].filter(Boolean).map(esc).join(" &ndash; ");
          return `<div class="item">${head(esc(e.role), dates)}${sub(esc(e.company || ""), esc(e.location || ""))}${bullets(e.bullets)}</div>`;
        })
        .join(""),

    projects: () =>
      (r.projects || [])
        .map((p) => `<div class="item">${head(esc(p.title), esc((p.techStack || []).join(", ")), "meta")}${bullets(p.bullets)}</div>`)
        .join(""),

    education: () =>
      (r.education || [])
        .map((e) => `<div class="item">${head(esc(e.degree), esc(e.year || ""))}${sub(esc(e.institution || ""), esc(e.score || ""))}</div>`)
        .join(""),

    skills: () => {
      const entries = Object.entries(r.skills || {}).filter(([, list]) => Array.isArray(list) && list.length);
      if (!entries.length) return "";
      if (s.skillsStyle === "list") return `<ul class="b-${s.bulletStyle}">${entries.map(([g, l]) => `<li><b>${esc(g)}:</b> ${l.map(esc).join(", ")}</li>`).join("")}</ul>`;
      if (s.skillsStyle === "chips")
        return entries.map(([g, l]) => `<div class="sk"><b>${esc(g)}</b><div>${l.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>`).join("");
      // "inline": group names in an aligned column, skills beside them
      return `<div class="skgrid">${entries.map(([g, l]) => `<b>${esc(g)}</b><span>${l.map(esc).join(", ")}</span>`).join("")}</div>`;
    },

    certifications: () => {
      const items = (r.certifications || [])
        .map((c) => `<li><div class="row"><span>${esc(c.title)}${c.issuer ? ", " + esc(c.issuer) : ""}</span>${c.date ? `<span class="date">${esc(c.date)}</span>` : ""}</div></li>`)
        .join("");
      return items ? `<ul class="b-${s.bulletStyle}">${items}</ul>` : "";
    },

    languages: () => {
      const items = (r.languages || [])
        .map((l) => `<li>${esc(l.name)}${l.proficiency ? " &ndash; " + esc(l.proficiency) : ""}</li>`)
        .join("");
      return items ? `<ul class="b-${s.bulletStyle}${cols ? "" : " two"}">${items}</ul>` : "";
    },
  };

  const section = (id) => {
    const html = builders[id]();
    return html ? `<section><h2 class="h-${s.headingStyle}">${esc(layout.titles[id])}</h2>${html}</section>` : "";
  };

  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const nameHtml = `<h1>${esc(r.name)}</h1>${r.headline ? `<div class="headline">${esc(r.headline)}</div>` : ""}`;

  let page;
  if (cols) {
    const side = visible.filter((id) => SIDE_SECTIONS.includes(id)).map(section).join("\n");
    const main = visible.filter((id) => !SIDE_SECTIONS.includes(id)).map(section).join("\n");
    const contact = contactItems.length ? `<section><h2 class="h-${s.headingStyle}">Contact</h2>${contactItems.map((c) => `<div class="c">${c}</div>`).join("")}</section>` : "";
    page = `<div class="page cols ${s.columns}"><aside class="side">${nameHtml}${contact}${side}</aside><main class="main">${main}</main></div>`;
  } else {
    page = `<div class="page"><header>${nameHtml}<div class="contact">${contactLine}</div></header><main>${visible.map(section).join("\n")}</main></div>`;
  }

  const A = s.bannerColor;
  const colBg = !cols ? "" : s.columns === "sidebar-left"
    ? `linear-gradient(to right,${A} 0,${A} 32%,#fff 32%,#fff 100%)`
    : `linear-gradient(to left,${A} 0,${A} 32%,#fff 32%,#fff 100%)`;
  // faint line on screen where the A4 page ends, so you can see page breaks while editing
  const pageLines = "repeating-linear-gradient(to bottom,transparent 0,transparent calc(297mm - 1px),#cbd5e1 calc(297mm - 1px),#cbd5e1 297mm)";
  const hdrRule = s.headerRule === "none" ? "" : `border-bottom:${s.headerRule === "thick" ? 2.5 : 1}px solid ${s.headingColor};padding-bottom:10px;`;

  const css = `
  *{box-sizing:border-box}
  @page{size:A4;margin:${cols ? "0" : "13mm 15mm"}}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{margin:0;font-family:${FONTS[s.font].stack};color:${s.textColor};font-size:${s.fontSize}pt;line-height:${s.lineHeight};-webkit-font-smoothing:antialiased}
  .page{padding:${cols ? 0 : s.pagePadding}px}
  @media screen{
    html{background:#d9dde3}
    body{padding:20px 0}
    .page{width:210mm;min-height:297mm;margin:0 auto;background-color:#fff;background-image:${[pageLines, colBg].filter(Boolean).join(",")};box-shadow:0 2px 16px rgba(0,0,0,.2);${cols ? "" : `padding:calc(13mm + ${s.pagePadding}px) calc(15mm + ${s.pagePadding}px);`}}
  }
  @media print{
    .page{background-image:${colBg || "none"};${cols ? "min-height:296mm;" : ""}}
  }
  header{text-align:${s.headerAlign};${banner ? `background:${s.bannerColor};color:${bannerText};padding:18px 22px;border-radius:3px;` : hdrRule}}
  h1{margin:0;font-size:${s.nameSize}px;line-height:1.15;font-weight:700;letter-spacing:${s.nameCase === "upper" ? (s.headerAlign === "center" ? "2px" : "1px") : ".2px"};${s.nameCase === "upper" ? "text-transform:uppercase;" : ""}color:${banner ? bannerText : s.nameColor}}
  .headline{margin-top:4px;font-size:${Math.max(11, Math.round(s.nameSize * 0.56))}px;opacity:.88}
  .contact{margin-top:7px;font-size:${Math.max(9, s.fontSize - 0.5)}pt;opacity:.9}
  .sep{opacity:.55;margin:0 3px}
  h2{font-size:${s.headingSize}px;line-height:1.3;font-weight:700;color:${s.headingColor};margin:${s.sectionGap}px 0 8px;text-align:${s.headingAlign};break-after:avoid;page-break-after:avoid}
  main>section:first-child h2{margin-top:${Math.round(s.sectionGap * 0.9)}px}
  h2.h-underline,h2.h-caps-underline{border-bottom:1px solid ${s.headingColor};padding-bottom:3px}
  h2.h-caps,h2.h-caps-underline{text-transform:uppercase;letter-spacing:.9px}
  h2.h-bar{border-left:4px solid ${s.headingColor};padding-left:8px}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
  .row>.t{min-width:0}
  .date{white-space:nowrap;flex:none}
  .meta{flex:0 1 52%;text-align:right;font-size:.92em;opacity:.85}
  .sub{margin-top:1px;font-style:italic}
  .sub .co{font-weight:500}
  .sub .loc{opacity:.8}
  .item{margin-bottom:${s.itemGap}px;break-inside:avoid;page-break-inside:avoid}
  .item:last-child{margin-bottom:0}
  p{margin:3px 0}
  a{color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
  .summary{text-align:${s.textAlign};${s.textAlign === "justify" ? "hyphens:auto;" : ""}margin-top:0}
  ul{margin:4px 0 0 18px;padding:0}
  li{margin:2.5px 0;padding-left:1px;orphans:2;widows:2}
  li .row{gap:10px}
  ul.b-disc{list-style:disc} ul.b-circle{list-style:circle} ul.b-square{list-style:square}
  ul.b-none{list-style:none;margin-left:0}
  ul.b-dash{list-style:none;margin-left:14px} ul.b-dash li{position:relative} ul.b-dash li::before{content:"\\2013";position:absolute;left:-13px}
  ul.two{columns:2;column-gap:28px} ul.two li{break-inside:avoid}
  .skgrid{display:grid;grid-template-columns:fit-content(34%) 1fr;column-gap:14px;row-gap:3px}
  .sk{margin:4px 0}
  .chip{display:inline-block;border:1px solid ${s.headingColor};border-radius:999px;padding:1px 9px;margin:3px 4px 1px 0;font-size:.9em}
  /* two-column templates */
  .cols{display:flex;align-items:stretch}
  .cols.sidebar-right{flex-direction:row-reverse}
  .side{flex:0 0 32%;width:32%;padding:14mm 7mm;color:${bannerText};overflow-wrap:anywhere}
  .main{flex:1;min-width:0;padding:14mm 11mm}
  .side h1{color:inherit;font-size:${Math.min(s.nameSize, 26)}px}
  .side .headline{margin-bottom:4px}
  .side .c{margin:4px 0;font-size:.95em}
  .side h2{color:inherit;border-color:currentColor;margin-top:${s.sectionGap}px}
  .side .chip{border-color:currentColor}
  .side ul{margin-left:15px}
  .side .skgrid{grid-template-columns:1fr}
  .main>section:first-child h2{margin-top:0}
  .cols a{text-decoration:none}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.name)} - Resume</title>
<style>${css}
</style></head><body>
${page}
</body></html>`;
}