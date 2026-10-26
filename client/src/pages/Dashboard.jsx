import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BookOpen, ChevronRight, Compass, FileText, GraduationCap, Mic, RefreshCw, Target } from "lucide-react";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { Badge, Bar, Card, ErrorBox, ScoreRing, Spinner } from "../components/ui";

const ROWS = [
  ["technical", "Technical skills", "/skill-gap"],
  ["certifications", "Certifications", "/profile"],
  ["projects", "Project experience", "/profile"],
  ["aptitude", "Aptitude performance", "/aptitude"],
  ["communication", "Communication", "/interview"],
  ["academics", "Academics (CGPA)", "/profile"],
];

const dateFmt = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBA");
const eligibilityTone = { Open: "ok", Registered: "brand", Closed: "neutral", "Not eligible": "warn" };

function NotificationBell({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notifications${items.length ? `, ${items.length} new` : ""}`}
        className="cp-press relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
      >
        <Bell size={20} aria-hidden="true" />
        {items.length > 0 && <span className="cp-pulse-dot absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-bad" />}
      </button>
      {open && (
        <div className="cp-pop cp-modal absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] rounded-2xl bg-white p-2 text-ink">
          <p className="px-3 py-2 text-sm font-bold">Notifications</p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-ink-soft">You are all caught up.</p>
          ) : (
            <ul>
              {items.map((n, i) => (
                <li key={i} className="flex gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-paper">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.tone === "warn" ? "bg-warn" : n.tone === "ok" ? "bg-bar" : "bg-brand"}`} />
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, note, dot }) {
  return (
    <Card className="group !p-5 overflow-hidden">
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-brand-soft to-transparent transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
      <p className="relative text-sm font-medium text-ink-soft">{label}</p>
      <p className="relative mt-2 bg-gradient-to-br from-ink to-brand bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">{value}</p>
      <p className="relative mt-2 flex items-center gap-2 text-sm font-medium text-ink-soft">
        <span className={`h-2 w-2 rounded-full ${dot}`} />{note}
      </p>
    </Card>
  );
}

function Suggestions() {
  const { data, loading, error, setData } = useApi("/dashboard/suggestions");
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  async function refresh() {
    setBusy(true); setRefreshError("");
    try { setData((await api.get("/dashboard/suggestions", { params: { refresh: 1 } })).data); }
    catch (e) { setRefreshError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Compass size={20} className="text-brand" aria-hidden="true" /> AI Suggestions for You</h2>
        <button onClick={refresh} disabled={busy || loading} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand disabled:opacity-50">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} aria-hidden="true" /> Refresh
        </button>
      </div>
      <ErrorBox>{error || refreshError}</ErrorBox>
      {loading ? <Spinner text="Preparing suggestions..." /> : !data?.items?.length ? (
        <p className="text-sm text-ink-soft">Add skills and a target role to your profile to get personalised suggestions.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((s, i) => (
            <li key={i} className="flex gap-3 py-3.5 first:pt-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                {s.kind === "learn" ? <BookOpen size={18} aria-hidden="true" /> : <GraduationCap size={18} aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {s.kind === "learn" ? <>Learn: {s.title}{s.reason && ` (${s.reason})`}</> : <>Get Certified: {s.title}{s.reason && ` \u2013 ${s.reason}`}</>}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {s.kind === "learn" ? "Add this skill to strengthen your profile." : "Earning this certification will boost your credibility."}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data?.source === "basic" && !loading && (
        <p className="mt-3 text-xs text-ink-soft">These are basic suggestions. AI suggestions were unavailable just now, so try Refresh in a moment.</p>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useApi("/dashboard");

  if (loading) return <Spinner text="Calculating your readiness..." />;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  const { readiness, stats } = data;
  const actions = [
    { to: "/resume", Icon: FileText, title: "Update resume", sub: "Generate from your profile" },
    { to: "/skill-gap", Icon: Target, title: "Close a skill gap", sub: "See what's missing" },
    { to: "/interview", Icon: Mic, title: "Practice an interview", sub: `${stats.interviews} session${stats.interviews === 1 ? "" : "s"} completed` },
    { to: "/careers", Icon: Compass, title: "See career matches", sub: "AI-powered recommendations" },
  ];
  const delta = stats.completenessDelta;

  return (
    <div className="cp-stagger space-y-5">
      <header className="cp-auth-art relative z-20 flex items-start justify-between gap-4 rounded-3xl p-6 text-white shadow-[0_24px_50px_-24px_rgba(5,46,22,.7)] md:p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
          <div className="cp-grid-bg absolute inset-0" />
          <div className="cp-orb absolute -right-10 -top-16 h-56 w-56 bg-gradient-to-br from-[#4ade80]/40 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-4xl">Welcome back, <span className="cp-gradient-text">{data.name}</span></h1>
          <p className="mt-1.5 text-white/75">Here's where your placement readiness stands today.</p>
        </div>
        <NotificationBell items={data.notifications} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="!p-6">
          <h2 className="mb-5 text-lg font-bold">Placement readiness score</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreRing value={readiness.score} size={160} color="var(--color-bar)">
              <span className="text-4xl font-extrabold leading-none">{readiness.score}</span>
              <span className="mt-1 text-[10px] font-bold tracking-wide text-ink-soft">READY SCORE</span>
              <span className="mt-1.5 rounded-full bg-warn-soft px-2.5 py-0.5 text-[11px] font-semibold text-warn">{readiness.status}</span>
            </ScoreRing>

            <dl className="grid w-full flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3.5">
              {ROWS.map(([key, label, to]) => (
                <div key={key} className="col-span-3 grid grid-cols-subgrid items-center">
                  <dt><Link to={to} className="text-sm text-ink-soft hover:text-ink hover:underline">{label}</Link></dt>
                  <dd className="min-w-24"><Bar value={readiness.breakdown[key]} color="var(--color-bar)" /></dd>
                  <dd className="w-10 text-right text-sm font-bold">{readiness.breakdown[key]}%</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card className="!p-6">
          <h2 className="mb-4 text-lg font-bold">Quick actions</h2>
          <ul className="space-y-3">
            {actions.map(({ to, Icon, title, sub }) => (
              <li key={to}>
                <Link to={to} className="group flex items-center gap-3 rounded-xl border border-transparent bg-paper p-3.5 transition-all duration-300 hover:translate-x-1 hover:border-brand/25 hover:bg-brand-soft hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand">
                  <span className="cp-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm"><Icon size={19} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-sm text-ink-soft">{sub}</span>
                  </span>
                  <ChevronRight size={18} className="text-ink-soft transition-transform group-hover:translate-x-1 group-hover:text-brand" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profile completeness" value={`${stats.completeness}%`} dot={delta < 0 ? "bg-bad" : "bg-bar"}
          note={`${delta >= 0 ? "+" : ""}${delta}% this week`} />
        <StatCard label="Certifications" value={stats.certifications} dot="bg-bar" note="Add more to improve" />
        <StatCard label="Projects added" value={stats.projects} dot="bg-warn" note={`${stats.projectsRecommended} more recommended`} />
        <StatCard label="Mock interviews" value={stats.interviews} dot="bg-bar" note={stats.interviews ? "Keep practicing" : "Take your first one"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="!p-6 self-start">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Upcoming placement drives</h2>
            <Link to="/drives" className="text-sm font-semibold text-brand hover:underline">View all</Link>
          </div>
          {!data.drives.length ? (
            <p className="text-sm text-ink-soft">No upcoming drives right now. New drives appear here as soon as your placement cell posts them.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="cp-table w-full text-left text-sm">
                <thead className="text-ink-soft">
                  <tr className="border-b border-line"><th className="pb-2 pr-3 font-semibold">Company</th><th className="pb-2 pr-3 font-semibold">Role</th><th className="pb-2 pr-3 font-semibold">Date</th><th className="pb-2 font-semibold">Eligibility</th></tr>
                </thead>
                <tbody>
                  {data.drives.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-3 font-medium">{d.company || "-"}</td>
                      <td className="py-3 pr-3">{d.role}</td>
                      <td className="whitespace-nowrap py-3 pr-3">{dateFmt(d.date)}</td>
                      <td className="py-3"><Badge tone={eligibilityTone[d.eligibility]}>{d.eligibility}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Suggestions />
      </div>
    </div>
  );
}
