import { useEffect, useMemo, useState } from "react";
import api, { errMsg } from "../api/client";
import { Badge, Bar, Button, Card, Empty, ErrorBox, PageHeader } from "../components/ui";
import { FilterBar, SearchBox, SelectFilter, countText, makeChips, uniq, useUrlFilters } from "../components/filters";

const DEFAULTS = { q: "", min: "", skill: "", sort: "best" };
const SORTS = [["best", "Best match first"], ["fewest", "Fewest skills to learn"], ["az", "Role A-Z"]];

export default function Careers() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);

  useEffect(() => { api.get("/careers").then((r) => setData(r.data)).catch(() => {}); }, []);

  async function generate() {
    setBusy(true); setError("");
    try { setData((await api.post("/careers/recommend")).data); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const roles = data?.roles || [];
  const skillOptions = useMemo(() => uniq(roles.flatMap((r) => r.topSkillsToAdd || [])), [roles]);
  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const list = roles.filter((r) => {
      if (text && ![r.title, r.reason, ...(r.topSkillsToAdd || [])].some((v) => v?.toLowerCase().includes(text))) return false;
      if (f.min && r.matchPercent < Number(f.min)) return false;
      if (f.skill && !(r.topSkillsToAdd || []).includes(f.skill)) return false;
      return true;
    });
    const by = {
      best: (a, b) => b.matchPercent - a.matchPercent,
      fewest: (a, b) => (a.topSkillsToAdd?.length || 0) - (b.topSkillsToAdd?.length || 0) || b.matchPercent - a.matchPercent,
      az: (a, b) => a.title.localeCompare(b.title),
    }[f.sort] || (() => 0);
    return [...list].sort(by);
  }, [roles, f]);
  const chips = useMemo(() => makeChips(f, DEFAULTS, set, [
    { key: "q", label: "Search" }, { key: "min", label: "Match", format: (v) => `${v}%+` }, { key: "skill", label: "Learn next" },
  ]), [f, set]);

  return (
    <>
      <PageHeader
        title="Career recommendations"
        subtitle="Roles that fit your skills, projects and interests, with the skills that would raise each match."
        action={<Button onClick={generate} disabled={busy}>{busy ? "Thinking..." : data ? "Refresh suggestions" : "Suggest roles"}</Button>}
      />
      <ErrorBox>{error}</ErrorBox>
      {!data && !busy && <Empty>Add skills and projects to your profile, then choose Suggest roles.</Empty>}
      {roles.length > 0 && (
        <FilterBar
          search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Search role, reason or skill" label="Search roles" />}
          chips={chips} onClear={() => reset()} summary={countText(shown.length, roles.length, "role")}
          actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-48" />}
        >
          <SelectFilter label="Minimum match" value={f.min} onChange={(v) => set({ min: v })} options={[["50", "50% or more"], ["60", "60% or more"], ["70", "70% or more"], ["80", "80% or more"]]} anyLabel="Any match" className="w-full sm:w-40" />
          <SelectFilter label="Skill to learn next" value={f.skill} onChange={(v) => set({ skill: v })} options={skillOptions} anyLabel="Any skill" />
        </FilterBar>
      )}
      {roles.length > 0 && !shown.length && (
        <Empty>No roles match these filters.{chips.length > 0 && <button type="button" onClick={() => reset()} className="ml-2 font-bold text-brand hover:underline">Clear all filters</button>}</Empty>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((r) => (
          <Card key={r.title}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-bold">{r.title}</h2>
              <Badge tone={r.matchPercent >= 70 ? "ok" : "brand"}>{r.matchPercent}% match</Badge>
            </div>
            <Bar value={r.matchPercent} />
            <p className="mt-3 text-sm">{r.reason}</p>
            {r.topSkillsToAdd?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-soft">Learn next:</span>
                {r.topSkillsToAdd.map((s) => <Badge key={s} tone="warn">{s}</Badge>)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
