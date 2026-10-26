import { useParams } from "react-router-dom";
import { BarChart3, Code, GraduationCap, Globe, Link2, Mail, MapPin, Phone } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, ScoreRing, Spinner } from "../../components/ui";
import { BackLink, Meter, Panel, readinessColor } from "../../components/officerUi";

const BREAKDOWN = [
  ["technical", "Technical skills"], ["certifications", "Certifications"], ["projects", "Projects"],
  ["aptitude", "Aptitude"], ["communication", "Communication"], ["academics", "Academics"],
];
// Skill levels are stored as words, so map them to a bar length
const LEVEL_PCT = { Beginner: 40, Intermediate: 70, Advanced: 90 };

const SectionTitle = ({ icon: Icon, children }) => (
  <h2 className="mb-4 flex items-center gap-2.5 font-bold">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={15} aria-hidden="true" /></span>
    {children}
  </h2>
);

const Row = ({ icon: Icon, value, href }) => (
  <li className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-0">
    <Icon size={15} className="shrink-0 text-ink-soft" aria-hidden="true" />
    {value
      ? (href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate font-semibold text-brand hover:underline">{value}</a> : <span className="min-w-0 truncate">{value}</span>)
      : <span className="text-ink-soft">Not provided</span>}
  </li>
);

const url = (v) => (v && /^https?:\/\//i.test(v) ? v : v ? `https://${v}` : undefined);

export default function StudentDetail() {
  const { id } = useParams();
  const { data: s, loading, error } = useApi(`/officer/students/${id}`);
  if (loading) return <Spinner />;
  if (error) return <><BackLink to="/officer/students">Back to student records</BackLink><ErrorBox>{error}</ErrorBox></>;

  return (
    <>
      <BackLink to="/officer/students">Back to student records</BackLink>

      <Panel className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-side-active text-xl font-bold text-side-ink">{s.name?.[0]?.toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{s.name}</h1>
            <p className="text-sm text-ink-soft">{[s.department, s.program, s.batch && `Batch ${s.batch}`].filter(Boolean).join(" \u2022 ") || "Department not set"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><Mail size={13} aria-hidden="true" />{s.email}</p>
          </div>
        </div>
        <ScoreRing value={s.readiness} size={104} color="#4ade80" label="Readiness">
          <span className="text-lg font-bold leading-none">{s.readiness.toFixed(1)}%</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-ink-soft">Readiness</span>
        </ScoreRing>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <SectionTitle icon={BarChart3}>Readiness breakdown</SectionTitle>
          <div className="space-y-3.5">
            {BREAKDOWN.map(([k, label]) => (
              <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                <span className="text-ink-soft">{label}</span>
                <Meter value={s.breakdown[k]} color="#22b45f" />
                <span className="text-right font-bold">{s.breakdown[k]}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={GraduationCap}>Contact &amp; links</SectionTitle>
          <ul>
            <Row icon={Phone} value={s.phone} />
            <Row icon={MapPin} value={s.location} />
            <Row icon={Link2} value={s.links.linkedin} href={url(s.links.linkedin)} />
            <Row icon={Link2} value={s.links.github} href={url(s.links.github)} />
            <Row icon={Globe} value={s.links.portfolio} href={url(s.links.portfolio)} />
            <Row icon={GraduationCap} value={s.cgpa != null ? `CGPA: ${s.cgpa}` : "CGPA: Not provided"} />
          </ul>
        </Panel>
      </div>

      <Panel className="mt-5">
        <SectionTitle icon={Code}>Skills</SectionTitle>
        {!s.skills.length ? <p className="text-sm text-ink-soft">No skills added yet.</p> : (
          <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {s.skills.map((k) => {
              const pct = LEVEL_PCT[k.level] ?? 70;
              return (
                <div key={k.name} className="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)_36px] items-center gap-3 text-sm" title={k.level}>
                  <span className="truncate font-semibold">{k.name}</span>
                  <Meter value={pct} color={readinessColor(pct)} />
                  <span className="text-right text-xs font-bold">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
