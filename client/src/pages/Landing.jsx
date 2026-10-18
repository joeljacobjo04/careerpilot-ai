import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Award, BarChart3, Bell, Briefcase, Building2, Calculator, Camera, Check, ChevronDown, Compass, FileText,
  GraduationCap, Layers, Menu, Mic, ShieldCheck, Sparkles, Target, User, Users, X,
} from "lucide-react";
import Cube3D from "./landing/Cube3D";
import Tilt from "./landing/Tilt";
import { useCountUp, useRevealAll, useScrollState } from "./landing/hooks";
import "./landing/landing.css";

// three.js is large, so it loads after the page text is already on screen
const Scene3D = lazy(() => import("./landing/Scene3D"));

/* ----------------------------------------------------------------- content */

const NAV = [["features", "Features"], ["readiness", "Readiness score"], ["how", "How it works"], ["interview", "Mock interview"], ["officers", "For officers"], ["faq", "FAQ"]];

const STATS = [
  { to: 6, label: "readiness signals in one score" },
  { to: 8, label: "resume templates" },
  { to: 4, label: "alert channels: in-app, push, SMS, email" },
  { to: 2, label: "workspaces: student and officer" },
];

const FEATURES = [
  { icon: User, title: "Smart profile", body: "Skills, projects, certifications, education and CGPA in one place, plus a target role that powers every other tool." },
  { icon: FileText, title: "AI resume builder", body: "Generate a resume from your profile, pick from 8 templates, adjust fonts and sections against a live A4 preview, then download a PDF." },
  { icon: Layers, title: "ATS analyzer", body: "Upload a PDF or DOCX. The score blends an AI review with fixed rule checks, so it stays steady between runs." },
  {
    icon: Mic, title: "Proctored mock interview", wide: true, accent: true,
    body: "A spoken interview built from your target role and projects. Questions are read aloud, you answer by voice or text, and each answer is scored on clarity, correctness, completeness and communication.",
    chips: ["Camera + full-screen proctoring", "Easy, medium or hard", "3 to 10 questions"],
  },
  { icon: Target, title: "Skill gap & careers", body: "Pick a role to see matched and missing skills with a learning path, or let AI suggest roles that fit your profile." },
  { icon: Calculator, title: "Aptitude practice", body: "Short tests with instant scoring. Your latest result feeds straight into your readiness score." },
  { icon: Briefcase, title: "Placement drives", body: "Browse drives, see exactly why you are or are not eligible, register or withdraw, and follow your status." },
  { icon: Bell, title: "Alerts that reach you", body: "New drives, closing deadlines and shortlist results arrive in the app, as push notifications, by SMS and by email." },
];

const SIGNALS = [
  { label: "Technical skills", weight: 30, value: 90, how: "Skill match for your target role", icon: Target },
  { label: "Projects", weight: 15, value: 100, how: "Two or more projects is full marks", icon: Layers },
  { label: "Aptitude", weight: 15, value: 75, how: "Score of your latest aptitude test", icon: Calculator },
  { label: "Communication", weight: 15, value: 85, how: "Average of your last 3 mock interviews", icon: Mic },
  { label: "Academics", weight: 15, value: 85, how: "Your CGPA x 10", icon: GraduationCap },
  { label: "Certifications", weight: 10, value: 100, how: "Three or more is full marks", icon: Award },
];
const SAMPLE_SCORE = Math.round(SIGNALS.reduce((s, x) => s + (x.weight * x.value) / 100, 0));

const STEPS = [
  { icon: User, title: "Build your profile", body: "Add skills, projects, certifications and your target role." },
  { icon: FileText, title: "Polish your resume", body: "Generate it with AI, then check it against the ATS analyzer." },
  { icon: Target, title: "Close gaps, practise", body: "Follow your learning path, take aptitude tests and sit mock interviews." },
  { icon: Briefcase, title: "Apply with confidence", body: "Register for drives you are eligible for and get alerted at every step." },
];

const RULES = [
  "Runs in full-screen. Leaving it ends the interview.",
  "Switching tabs or apps ends it.",
  "Camera stays on. A phone, a book or a second person ends it.",
  "Copy, paste, right-click and dev tools are blocked.",
  "Answer by voice (Chrome or Edge) or type it.",
];

const OFFICER = [
  { icon: Users, title: "Student records", body: "Search students and open each readiness breakdown." },
  { icon: Building2, title: "Companies", body: "Keep company details and the drives linked to them." },
  { icon: Briefcase, title: "Drives with rules", body: "Set minimum CGPA, maximum backlogs and eligible departments." },
  { icon: ShieldCheck, title: "Applicant pipeline", body: "Move applicants from registered to shortlisted to selected." },
  { icon: BarChart3, title: "Analytics & CSV", body: "Placement reports, plus a student export." },
  { icon: Bell, title: "Automatic alerts", body: "Eligible students are told about new drives and deadlines." },
];

const FAQ = [
  ["Do I need a camera for the mock interview?", "Yes. The interview is proctored, so the camera has to stay on. You can answer by voice in Chrome or Edge, or type your answers."],
  ["Is the proctoring a guarantee?", "No. Browser proctoring is a deterrent. The server logs every event and enforces the interview rules, but it cannot see your screen. Treat scores as practice feedback, not an official result."],
  ["What happens to my resume when I upload it?", "It is read in memory, sent to the AI for review and discarded. Only the numeric ATS score is saved."],
  ["How do placement officers get access?", "Officers register with an invite code from their institution. Without it, an officer account cannot be created."],
  ["I forgot my password. What do I do?", "Use Forgot password on the sign-in page. We email you a link that works for 30 minutes and can be used once."],
];

const STACK = ["React", "Node.js", "Express", "MongoDB", "Groq LLM", "TensorFlow.js", "Web Speech API", "Puppeteer", "Tailwind CSS", "Three.js"];

/* -------------------------------------------------------------- small parts */

const Logo = ({ dark }) => (
  <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight" aria-label="CareerPilot AI home">
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold ${dark ? "bg-brand text-white" : "bg-white text-side"}`}>CP</span>
    <span>CareerPilot AI</span>
  </Link>
);

const Eyebrow = ({ children, light }) => (
  <p className={`mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] ${light ? "text-side-active" : "text-brand"}`}>
    <span className={`h-px w-6 ${light ? "bg-side-active" : "bg-brand"}`} /> {children}
  </p>
);

function Stat({ to, label }) {
  const [ref, v] = useCountUp(to);
  return (
    <div ref={ref} className="text-center sm:text-left">
      <p className="font-officer text-4xl font-bold tracking-tight text-white sm:text-5xl">{v}</p>
      <p className="mt-1 text-sm leading-snug text-white/65">{label}</p>
    </div>
  );
}

function ScoreCount({ to }) {
  const [ref, v] = useCountUp(to, { duration: 1800 });
  return <span ref={ref}>{v}</span>;
}

function HeroVisual() {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  return (
    <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[34rem] lg:max-w-none">
      {failed ? (
        <div className="absolute inset-0 grid place-items-center"><div className="lp-orb h-52 w-52 rounded-full" /></div>
      ) : (
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><div className="lp-orb h-40 w-40 rounded-full opacity-70" /></div>}>
          <div className="absolute inset-0"><Scene3D onFail={onFail} /></div>
        </Suspense>
      )}

      {/* floating sample cards */}
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-[8%] sm:-left-2">
        <div className="lp-float-a lp-glass w-40 rounded-2xl p-3.5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Readiness</p>
          <p className="font-officer text-3xl font-bold leading-none">{SAMPLE_SCORE}<span className="text-base text-white/50">/100</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-side-active" style={{ width: `${SAMPLE_SCORE}%` }} /></div>
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[22%] right-0 sm:-right-2">
        <div className="lp-float-b lp-glass flex items-center gap-3 rounded-2xl p-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-side-active/20 text-side-active"><Check size={18} /></span>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">ATS score</p><p className="font-officer text-xl font-bold leading-none">92</p></div>
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[8%] left-[4%]">
        <div className="lp-float-c lp-glass flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white">
          <span className="relative flex h-2.5 w-2.5 text-red-400"><span className="lp-pulse absolute inset-0 rounded-full" /><span className="relative h-2.5 w-2.5 rounded-full bg-red-400" /></span>
          Interview live
        </div>
      </div>
      <p className="absolute -bottom-1 right-0 text-[10px] uppercase tracking-widest text-white/35">Sample data</p>
    </div>
  );
}

/* --------------------------------------------------------------------- page */

export default function Landing() {
  const rootRef = useRef(null);
  const progressRef = useRef(null);
  const [menu, setMenu] = useState(false);
  const scrolled = useScrollState(progressRef);
  useRevealAll(rootRef);

  const solid = scrolled || menu;
  const link = "rounded-lg px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <div ref={rootRef} className="lp relative overflow-x-clip bg-paper text-ink">
      <a href="#features" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>
      <div ref={progressRef} className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-side-active to-amber-300" aria-hidden="true" />

      {/* ------------------------------------------------------------ nav */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? "border-b border-line bg-white/85 text-ink shadow-sm backdrop-blur-lg" : "text-white"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo dark={solid} />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Sections">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className={`${link} ${solid ? "text-ink-soft hover:bg-mint hover:text-ink" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{label}</a>)}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login" className={`${link} ${solid ? "text-ink hover:bg-mint" : "text-white hover:bg-white/10"}`}>Sign in</Link>
            <Link to="/register" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-side-active px-4 text-sm font-bold text-side-ink transition hover:brightness-110">Get started <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menu && (
          <div className="border-t border-line bg-white px-5 pb-5 pt-2 text-ink lg:hidden">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-mint">{label}</a>)}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold">Sign in</Link>
              <Link to="/register" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">Get started</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="lp-hero lp-grain relative overflow-hidden pb-16 pt-28 text-white sm:pt-32 lg:pb-24">
          <div className="lp-floor pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p data-reveal className="lp-glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-emerald-100">
                <Sparkles size={14} className="text-amber-300" aria-hidden="true" /> AI placement readiness for students and placement cells
              </p>
              <h1 data-reveal style={{ "--d": "80ms" }} className="font-officer text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
                Practise the interview <span className="lp-gradient-text">before it counts.</span>
              </h1>
              <p data-reveal style={{ "--d": "160ms" }} className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                CareerPilot turns your profile, resume, skills and mock interviews into one readiness score, and gives placement officers one console to run every drive.
              </p>
              <div data-reveal style={{ "--d": "240ms" }} className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/register" className="lp-btn-glow inline-flex min-h-12 items-center gap-2 rounded-xl bg-side-active px-6 font-bold text-side-ink transition hover:brightness-110">
                  Create free account <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link to="/login" className="lp-glass inline-flex min-h-12 items-center rounded-xl px-6 font-semibold text-white transition hover:bg-white/15">Sign in</Link>
              </div>
              <ul data-reveal style={{ "--d": "320ms" }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
                {["Resume + ATS check", "Voice mock interviews", "Drive alerts by SMS and email"].map((t) => <li key={t} className="flex items-center gap-2"><Check size={15} className="text-side-active" aria-hidden="true" />{t}</li>)}
              </ul>
            </div>
            <div data-reveal="zoom" style={{ "--d": "200ms" }}><HeroVisual /></div>
          </div>

          <div className="relative mx-auto mt-14 max-w-7xl px-5 sm:px-8">
            <div className="lp-glass grid grid-cols-2 gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-4">
              {STATS.map((s) => <Stat key={s.label} {...s} />)}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ features */}
        <section id="features" className="lp-section mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Everything in one cockpit</Eyebrow>
            <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Every tool a placement season needs</h2>
            <p className="mt-4 text-ink-soft">Each module feeds the next, so your readiness score moves as you improve.</p>
          </div>
          <div className="mt-14 grid grid-flow-dense gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} data-reveal style={{ "--d": `${(i % 3) * 90}ms` }} className={f.wide ? "md:col-span-2" : ""}>
                <Tilt className={`group h-full overflow-hidden rounded-3xl border p-6 sm:p-7 ${f.accent ? "border-transparent bg-gradient-to-br from-side to-[#0a3d1f] text-white shadow-pop" : "border-line bg-white shadow-card hover:shadow-pop"}`}>
                  <span className={`lp-tilt-lift mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${f.accent ? "bg-white/15 text-side-active" : "bg-brand-soft text-brand"}`}><f.icon size={22} aria-hidden="true" /></span>
                  <h3 className="font-officer text-xl font-bold">{f.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${f.accent ? "text-white/75" : "text-ink-soft"}`}>{f.body}</p>
                  {f.chips && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {f.chips.map((c) => <span key={c} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">{c}</span>)}
                    </div>
                  )}
                  {f.accent && (
                    <div className="lp-wave mt-6 flex h-10 items-center gap-1" aria-hidden="true">
                      {Array.from({ length: 28 }, (_, k) => <i key={k} style={{ animationDelay: `${(k % 9) * 0.11}s`, height: "100%" }} />)}
                    </div>
                  )}
                </Tilt>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ readiness */}
        <section id="readiness" className="lp-section bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div data-reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>Your readiness score</Eyebrow>
              <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Six signals. One honest number.</h2>
              <p className="mt-4 text-ink-soft">No guesswork about where you stand. The score is a weighted sum you can see, and every bar is something you can improve.</p>
            </div>

            <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[.9fr_1.1fr]">
              <div data-reveal="left" className="relative flex min-h-[26rem] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#04260f] to-[#0d4f27] p-8 text-white">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-side-active/15 blur-3xl" aria-hidden="true" />
                <Cube3D faces={SIGNALS} />
                <div className="lp-shadow mt-10 h-5 w-40" aria-hidden="true" />
                <p className="mt-6 text-center text-sm text-white/65">Drag the cube to explore each signal and its weight.</p>
              </div>

              <div data-reveal="right" className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="relative h-36 w-36 shrink-0" data-reveal style={{ "--v": SAMPLE_SCORE }}>
                    <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={`Sample readiness score ${SAMPLE_SCORE} out of 100`}>
                      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-line)" strokeWidth="10" />
                      <circle className="lp-ring-fg" cx="60" cy="60" r="52" fill="none" stroke="var(--color-brand)" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 60 60)" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-officer text-4xl font-bold leading-none"><ScoreCount to={SAMPLE_SCORE} /></span>
                      <span className="mt-1 text-[11px] font-semibold text-ink-soft">of 100</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Placement ready</p>
                    <p className="mt-1 text-sm text-ink-soft">Below 40: just starting. 40 to 84: in progress. 85 and above: placement ready.</p>
                    <p className="mt-2 text-xs text-ink-soft/80">Sample numbers for illustration.</p>
                  </div>
                </div>

                <ul className="mt-7 space-y-4">
                  {SIGNALS.map((s, i) => (
                    <li key={s.label} data-reveal style={{ "--d": `${i * 70}ms` }}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold"><s.icon size={15} className="text-brand" aria-hidden="true" />{s.label}</span>
                        <span className="text-xs font-bold text-ink-soft">{s.weight}% of score</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"><div className="lp-bar h-full rounded-full bg-gradient-to-r from-brand to-bar" style={{ "--w": `${s.value}%`, "--d": `${i * 90}ms` }} /></div>
                      <p className="mt-1 text-xs text-ink-soft">{s.how}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section id="how" className="lp-section mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Flight plan</Eyebrow>
            <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">From first login to offer letter</h2>
          </div>
          <div className="relative mt-16" data-reveal>
            <span className="lp-line hidden lg:block" aria-hidden="true" />
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative text-center lg:text-left">
                  <span className="relative z-10 mx-auto flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-brand text-white shadow-pop lg:mx-0"><s.icon size={22} aria-hidden="true" /></span>
                  <p className="mt-5 font-officer text-sm font-bold text-brand">Step {i + 1}</p>
                  <h3 className="mt-1 font-officer text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ interview */}
        <section id="interview" className="lp-section lp-hero relative overflow-hidden py-20 text-white lg:py-28">
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
            <div data-reveal="left">
              <Eyebrow light>Mock interview</Eyebrow>
              <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Sit a real interview, without the real stakes</h2>
              <p className="mt-4 max-w-lg text-white/70">The interview is proctored the way a real one is, so what you practise is what you will face. You get a scored breakdown for every answer.</p>
              <ul className="mt-7 space-y-3">
                {RULES.map((r) => <li key={r} className="flex gap-3 text-sm text-white/85"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-side-active/20 text-side-active"><Check size={13} aria-hidden="true" /></span>{r}</li>)}
              </ul>
              <Link to="/register" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-side-active px-6 font-bold text-side-ink transition hover:brightness-110">Try a mock interview <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>

            <div data-reveal="right" aria-hidden="true">
              <Tilt max={6} className="lp-glass mx-auto max-w-md rounded-3xl p-4">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b3d20] to-black/70">
                  <div className="absolute inset-0 grid place-items-center text-white/20"><Camera size={64} /></div>
                  <div className="lp-box left-[30%] top-[18%] h-[52%] w-[40%]"><span className="absolute -top-6 left-0 rounded-md bg-side-active px-2 py-0.5 text-[10px] font-bold text-side-ink">1 person</span></div>
                  <div className="lp-scan" />
                  <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"><span className="h-2 w-2 rounded-full bg-red-400" /> Rec</span>
                  <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] font-semibold">
                    <span className="rounded-md bg-white/15 px-2 py-1">Full-screen on</span><span className="rounded-md bg-white/15 px-2 py-1">Camera on</span>
                  </div>
                </div>
                <div className="lp-tilt-lift mt-4 rounded-2xl bg-white p-4 text-ink">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Question 2 of 5</p>
                  <p className="lp-caret mt-1 text-sm font-semibold">Explain how you would structure the state of a large React app.</p>
                  <div className="lp-wave mt-4 flex h-8 items-center gap-1">{Array.from({ length: 36 }, (_, k) => <i key={k} style={{ animationDelay: `${(k % 11) * 0.09}s`, height: "100%" }} />)}</div>
                </div>
              </Tilt>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ officers */}
        <section id="officers" className="lp-section mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <div data-reveal>
                <Eyebrow>For placement officers</Eyebrow>
                <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Run the whole season from one console</h2>
                <p className="mt-4 max-w-xl text-ink-soft">Create drives with eligibility rules, and the right students are told automatically. Then manage applicants through to the final list.</p>
              </div>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                {OFFICER.map((o, i) => (
                  <li key={o.title} data-reveal style={{ "--d": `${(i % 2) * 90}ms` }}>
                    <Tilt max={5} className="h-full rounded-2xl border border-line bg-white p-5 shadow-card">
                      <o.icon size={20} className="text-brand" aria-hidden="true" />
                      <h3 className="mt-3 font-officer font-bold">{o.title}</h3>
                      <p className="mt-1 text-sm text-ink-soft">{o.body}</p>
                    </Tilt>
                  </li>
                ))}
              </ul>
            </div>

            <div data-reveal="right" aria-hidden="true">
              <Tilt max={6} className="rounded-3xl border border-line bg-white p-6 shadow-pop">
                <div className="flex items-center justify-between">
                  <p className="font-officer font-bold">Applicant pipeline</p>
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">Sample</span>
                </div>
                <div className="lp-tilt-lift mt-6 space-y-5">
                  {[["Registered", 100, "from-brand to-bar"], ["Shortlisted", 62, "from-[#0f766e] to-teal-400"], ["Selected", 28, "from-amber-500 to-amber-300"]].map(([l, w, c], i) => (
                    <div key={l} data-reveal>
                      <div className="mb-1.5 flex justify-between text-sm font-semibold"><span>{l}</span><span className="text-ink-soft">{w}%</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-paper"><div className={`lp-bar h-full rounded-full bg-gradient-to-r ${c}`} style={{ "--w": `${w}%`, "--d": `${i * 160}ms` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-7 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
                  {[["CGPA", "6.5+"], ["Backlogs", "0"], ["Dept", "CSE, IT"]].map(([k, v]) => <div key={k} className="rounded-xl bg-paper py-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{k}</p><p className="font-officer font-bold">{v}</p></div>)}
                </div>
              </Tilt>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ stack + faq */}
        <section className="border-y border-line bg-white py-8" aria-label="Built with">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-[.2em] text-ink-soft">Built with</p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
            <div className="lp-marquee gap-4 pr-4">
              {[...STACK, ...STACK].map((s, i) => <span key={`${s}${i}`} className="shrink-0 rounded-full border border-line bg-paper px-5 py-2 font-officer text-sm font-semibold text-ink-soft">{s}</span>)}
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-28">
          <div data-reveal className="text-center">
            <Eyebrow>Good to know</Eyebrow>
            <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Questions, answered</h2>
          </div>
          <div className="mt-12 space-y-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ "--d": `${i * 60}ms` }} className="lp-faq group rounded-2xl border border-line bg-white px-5 py-4 shadow-card">
                <summary className="flex items-center justify-between gap-4 font-semibold">{q}<ChevronDown size={18} className="lp-faq-icon shrink-0 text-brand transition-transform" aria-hidden="true" /></summary>
                <p className="lp-faq-body mt-3 text-sm leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ cta */}
        <section className="px-5 pb-20 sm:px-8">
          <div data-reveal="zoom" className="lp-hero lp-grain relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <div className="lp-floor pointer-events-none absolute inset-x-0 bottom-0 h-3/4 opacity-70" aria-hidden="true" />
            <div className="relative">
              <h2 className="font-officer text-3xl font-bold tracking-tight sm:text-5xl">Ready for take-off?</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/70">Create your account in under a minute and see where you stand today.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/register" className="lp-btn-glow inline-flex min-h-12 items-center gap-2 rounded-xl bg-side-active px-7 font-bold text-side-ink transition hover:brightness-110">Get started <ArrowRight size={18} aria-hidden="true" /></Link>
                <Link to="/login" className="lp-glass inline-flex min-h-12 items-center rounded-xl px-7 font-semibold transition hover:bg-white/15">I already have an account</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:px-8">
          <div className="text-ink"><Logo dark /></div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <Link to="/login" className="hover:text-ink">Sign in</Link>
            <Link to="/register" className="hover:text-ink">Register</Link>
            <Link to="/forgot-password" className="hover:text-ink">Forgot password</Link>
          </nav>
          <p>&copy; {new Date().getFullYear()} CareerPilot AI</p>
        </div>
      </footer>
    </div>
  );
}
