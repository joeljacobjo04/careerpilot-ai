import { Link } from "react-router-dom";
import { SquareArrowOutUpRight } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { Meter, OfficerHeader, Panel } from "../../components/officerUi";

const HINT = { ok: "bg-ok", bad: "bg-bad", neutral: "bg-ok" };

const Stat = ({ label, value, hint, hintTone = "ok", to }) => (
  <Panel hover className="relative">
    <p className="text-sm font-medium text-ink-soft">{label}</p>
    <Link to={to} aria-label={`Open ${label}`} className="absolute right-4 top-4 text-ink-soft/70 hover:text-brand">
      <SquareArrowOutUpRight size={15} aria-hidden="true" />
    </Link>
    <p className="mt-2 text-4xl font-bold tracking-tight">{value}</p>
    <p className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${hintTone === "bad" ? "text-bad" : "text-ok"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${HINT[hintTone]}`} aria-hidden="true" />{hint}
    </p>
  </Panel>
);

const BAND = [
  ["onTrack", "On track (75%+)", "#22b45f"],
  ["inProgress", "In progress (45\u201374%)", "#e9a62a"],
  ["needsAttention", "Needs attention (<45%)", "#e0483f"],
];

export default function OfficerDashboard() {
  const { data: d, loading, error } = useApi("/officer/dashboard");
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  const pct = (n) => (d.students ? Math.round((n / d.students) * 100) : 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <>
      <OfficerHeader title="Placement cell overview" subtitle="Institution-wide readiness and drive activity." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avg. readiness score" value={`${d.avgReadiness}%`} hint={`Across ${plural(d.students, "student")}`} to="/officer/analytics" />
        <Stat label="Students on track" value={`${d.onTrack} / ${d.students}`} hint={`${pct(d.onTrack)}% of cohort`} to="/officer/students" />
        <Stat label="Active drives" value={d.activeDrives} hint={`${d.closingThisWeek} closing this week`} hintTone="bad" to="/officer/drives" />
        <Stat label="Placements confirmed" value={d.placementsConfirmed} hint={`Out of ${plural(d.totalDrives, "drive")}`} to="/officer/drives" />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <h2 className="font-bold">Readiness distribution</h2>
          <div className="mt-4 space-y-3">
            {BAND.map(([key, label, color]) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 text-sm">
                <span className="text-ink-soft">{label}</span>
                <Meter value={pct(d[key])} color={color} />
                <span className="w-10 text-right font-bold">{pct(d[key])}%</span>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-xl bg-brand-soft/60 px-4 py-3 text-xs leading-relaxed text-ink-soft">
            {pct(d.needsAttention)}% of students ({plural(d.needsAttention, "student")}) are below the readiness threshold and may need targeted training sessions.
          </p>
        </Panel>

        <Panel className="lg:col-span-3">
          <h2 className="font-bold">Common skill gaps across cohort</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                <th className="pb-2">Skill</th><th className="pb-2">Students lacking</th><th className="pb-2">Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {d.skillGaps.map((g) => (
                <tr key={g.skill} className="border-b border-line last:border-0">
                  <td className="py-3 font-semibold">{g.skill}</td><td className="py-3">{g.students}</td><td className="py-3 text-ink-soft">{g.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.skillGaps.length && <p className="py-8 text-center text-sm font-semibold text-ink-soft">No skill gap data yet.</p>}
        </Panel>
      </div>
    </>
  );
}
