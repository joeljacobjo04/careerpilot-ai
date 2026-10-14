import { useEffect, useMemo, useState } from "react";
import { History, Search, Sparkles } from "lucide-react";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, ScoreRing } from "../components/ui";

const POPULAR = ["Full Stack Developer", "Data Analyst", "Cloud Engineer", "UI/UX Designer", "Android Developer", "Cyber Security Analyst", "Machine Learning Engineer", "Business Analyst"];

export default function SkillGap() {
  const roles = useApi("/skillgap/roles");
  const history = useApi("/skillgap/history");
  const [role, setRole] = useState("");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // start from the target role saved in the profile
  useEffect(() => {
    api.get("/profile").then((r) => setRole((cur) => cur || r.data.profile?.targetRole || "")).catch(() => {});
  }, []);

  // typing suggestions: the roles already known plus some popular ones
  const suggestions = useMemo(() => {
    const names = new Set([...(roles.data || []).map((r) => r.title), ...POPULAR]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [roles.data]);

  const chips = useMemo(() => {
    const q = role.trim().toLowerCase();
    const list = q ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q) : POPULAR;
    return list.slice(0, 6);
  }, [role, suggestions]);

  async function analyse(name = role) {
    const typed = name.trim();
    if (typed.length < 2) return;
    setBusy(true); setError(""); setReport(null);
    try {
      setReport((await api.post("/skillgap/analyze", { role: typed })).data);
      history.reload();
      roles.reload();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  const run = (e) => { e.preventDefault(); analyse(); };

  return (
    <>
      <PageHeader title="Skill gap analysis" subtitle="Type any job role you are aiming for. We compare your skills and project tech stacks with what that role asks for, then build a learning path for the gaps." />
      <Card>
        <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Target role" className="flex-1" hint="Type any role, like “Cloud Engineer”. Pick a suggestion or write your own.">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              <Input required minLength={2} maxLength={80} list="role-suggestions" autoComplete="off" className="!pl-10"
                value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Data Analyst, DevOps Engineer, Game Developer..." />
              <datalist id="role-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
          </Field>
          <Button disabled={busy || role.trim().length < 2} className="sm:min-w-36">
            <Sparkles size={15} aria-hidden="true" /> {busy ? "Analysing..." : "Analyse gap"}
          </Button>
        </form>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft">{role.trim() ? "Suggestions:" : "Popular:"}</span>
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => { setRole(c); analyse(c); }} disabled={busy}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-50">{c}</button>
            ))}
          </div>
        )}
      </Card>
      <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>

      {busy && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" /> Working out what “{role.trim()}” needs and building your learning path...</div>}

      {report && (
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Card className="flex flex-col items-center gap-2">
            <ScoreRing value={report.matchPercent} label="skill match" />
            <p className="text-center font-semibold">{report.targetRole}</p>
            {report.generatedRole && <p className="text-center text-xs text-ink-soft">Required skills for this role were suggested by AI. Treat them as a guide.</p>}
          </Card>
          <Card className="md:col-span-2">
            <h2 className="mb-2 font-bold">You already have</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {report.matched.length ? report.matched.map((s) => <Badge key={s} tone="ok">{s}</Badge>) : <span className="text-sm text-ink-soft">No matching skills yet.</span>}
            </div>
            <h2 className="mb-2 font-bold">Still missing</h2>
            <div className="flex flex-wrap gap-2">
              {report.missing.length ? report.missing.map((s) => <Badge key={s} tone="warn">{s}</Badge>) : <span className="text-sm text-ok">Nothing missing. You cover every required skill.</span>}
            </div>
          </Card>
          {report.learningPath.length > 0 && (
            <Card className="md:col-span-3">
              <h2 className="mb-4 font-bold">Your learning path</h2>
              <ol className="space-y-5">
                {[...report.learningPath].sort((a, b) => a.order - b.order).map((step, i) => (
                  <li key={step.skill} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-bold">{step.skill} <span className="text-sm font-medium text-ink-soft">{step.estimatedTime}</span></p>
                      <p className="text-sm">{step.why}</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{step.resources.map((r, j) => <li key={j}>{r}</li>)}</ul>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      <h2 className="mb-3 mt-8 flex items-center gap-2 font-bold"><History size={16} className="text-ink-soft" aria-hidden="true" /> Previous analyses</h2>
      {!history.data?.length ? <Empty>Your past analyses will appear here.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {history.data.map((h) => (
            <button key={h._id} type="button" onClick={() => { setRole(h.targetRole); analyse(h.targetRole); }} disabled={busy}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 disabled:opacity-60" title="Run this analysis again">
              <span className="min-w-0"><span className="block truncate font-semibold">{h.targetRole}</span><span className="text-xs text-ink-soft">{new Date(h.createdAt).toLocaleDateString()} &middot; tap to re-run</span></span>
              <Badge tone={h.matchPercent >= 70 ? "ok" : "warn"}>{h.matchPercent}% match</Badge>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
