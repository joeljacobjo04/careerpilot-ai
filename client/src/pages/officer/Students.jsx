import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Download, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api/client";
import { ErrorBox, Input, Spinner } from "../../components/ui";
import { Btn, Meter, OfficerHeader, Panel, Pill, readinessColor, readinessLabel, readinessTone } from "../../components/officerUi";
import {
  FilterBar, FilterField, FilterGroup, MultiSelect, QuickFilters, RangeFilter, SavedViews, SearchBox, SelectFilter, TagInput,
  cleanParams, countText, fromList, makeChips, rangeChips, toList, useUrlFilters,
} from "../../components/filters";
import { BulkBar, Checkbox, NotifyModal, SelectBanner, useSelection } from "../../components/bulk";
import { useConfirm, useToast } from "../../components/Feedback";

// every filter, with its "off" value. They live in the address bar, so a filtered list can be shared or reloaded.
const DEFAULTS = {
  search: "", dept: "", batch: "", program: "", role: "", placement: "",
  skills: "", skillMatch: "any", skillLevel: "", experience: "", expRole: "",
  minCgpa: "", maxCgpa: "", backlogs: "", band: "", minReadiness: "", maxReadiness: "",
  ats: "", minAts: "", maxAts: "", location: "", resume: "", interview: "", aptitude: "",
  sort: "readiness_desc", page: "1",
};
// the ones inside the "More filters" panel (used for the counter on its button)
const MORE_KEYS = ["placement", "skills", "skillLevel", "experience", "expRole", "minCgpa", "maxCgpa", "backlogs", "band", "minReadiness", "maxReadiness", "ats", "minAts", "maxAts", "location", "resume", "interview", "aptitude"];

const QUICK = [
  { label: "Needs attention", patch: { band: "needs_attention" } },
  { label: "On track", patch: { band: "on_track" } },
  { label: "Never applied", patch: { placement: "not_applied" } },
  { label: "In process", patch: { placement: "in_process" } },
  { label: "Placed", patch: { placement: "placed" } },
  { label: "Freshers", patch: { experience: "none" } },
  { label: "No ATS check", patch: { ats: "not_checked" } },
];
const PLACEMENT = { placed: ["ok", "Placed"], in_process: ["warn", "In process"], not_selected: ["bad", "Not selected"], not_applied: ["neutral", "Not applied"] };
const SORTS = [["readiness_desc", "Readiness: high to low"], ["readiness_asc", "Readiness: low to high"], ["cgpa_desc", "CGPA: high to low"], ["cgpa_asc", "CGPA: low to high"], ["ats_desc", "ATS score: high to low"], ["dept", "Department A-Z"], ["newest", "Recently joined"]];

export default function Students() {
  const { values: f, set, reset, apply, query } = useUrlFilters(DEFAULTS);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notify, setNotify] = useState(null); // { payload, heading } while the dialog is open
  const [reloadKey, setReloadKey] = useState(0);
  const confirm = useConfirm();
  const toast = useToast();
  const sel = useSelection();
  const page = Number(f.page) || 1;
  const filtersOnly = useMemo(() => cleanParams(f, ["page", "sort"]), [f]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setError("");
      try { setData((await api.get("/officer/students", { params: { ...cleanParams(f, ["page"]), page, limit: 20 } })).data); }
      catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
    }, 250); // wait for a pause while typing in number boxes
    return () => clearTimeout(t);
  }, [f, page, reloadKey]);

  // a different set of filters means a different list, so start the selection again
  const listKey = JSON.stringify(filtersOnly);
  useEffect(() => { sel.clear(); }, [listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteStudent(p) {
    const name = p.user?.name || "this student";
    const ok = await confirm({
      title: `Delete ${name}'s account?`,
      message: "Their account and all of their data will be erased permanently, and they will be told by email, SMS and push notification. This cannot be undone.",
      confirmText: "Delete account", tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/officer/students/${p._id}`);
      sel.clear();
      toast(`${name}'s account was deleted and they were notified`);
      // went past the last page? step back one
      if (items.length === 1 && page > 1) set({ page: page - 1 }); else setReloadKey((k) => k + 1);
    } catch (e) { toast(errMsg(e), "error"); }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get("/officer/export/students.csv", { params: cleanParams(f, ["page"]), responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement("a"), { href: url, download: "students.csv" }).click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(errMsg(e)); } finally { setExporting(false); }
  }

  const o = data?.options || {};
  // with departments picked in the filter, only their programmes (and any open to everyone) are offered
  const pickedDepts = toList(f.dept);
  const programOptions = pickedDepts.length && o.programsByDepartment
    ? [...new Set([...pickedDepts.flatMap((d) => o.programsByDepartment[d] || []), ...(o.generalPrograms || []), ...toList(f.program)])].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    : o.programs || [];
  const items = data?.items || [];
  const moreCount = MORE_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const skills = toList(f.skills);
  const pageIds = items.map((p) => p._id);
  const pageAll = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  const pageSome = pageIds.some((id) => sel.has(id));
  const selectedCount = sel.all ? data?.total || 0 : sel.size;

  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [
      { key: "search", label: "Search" }, { key: "dept", label: "Department", multi: true }, { key: "batch", label: "Batch", multi: true }, { key: "program", label: "Programme", multi: true }, { key: "role", label: "Target role", multi: true },
      { key: "placement", label: "Placement", multi: true, format: (v) => ({ placed: "Placed", in_process: "In process", not_placed: "Not placed yet", not_applied: "Never applied" }[v] || v) },
      { key: "skills", label: "Skill" },
      { key: "skillLevel", label: "Skill level", format: (v) => `${v}+` },
      { key: "experience", label: "Experience", format: (v) => ({ none: "Fresher", any: "Has experience", "2plus": "2 or more" }[v] || v) },
      { key: "expRole", label: "Worked as / at" },
      { key: "backlogs", label: "Backlogs", format: (v) => ({ none: "None", has: "1 or more", le1: "At most 1", le2: "At most 2" }[v] || v) },
      { key: "band", label: "Status", multi: true, format: (v) => ({ on_track: "On track", in_progress: "In progress", needs_attention: "Needs attention" }[v] || v) },
      { key: "ats", label: "ATS check", format: (v) => (v === "checked" ? "Done" : "Not done") },
      { key: "location", label: "Location", multi: true },
      { key: "resume", label: "Resume saved", format: (v) => (v === "yes" ? "Yes" : "No") },
      { key: "interview", label: "Mock interview", format: (v) => (v === "done" ? "Taken" : "Not taken") },
      { key: "aptitude", label: "Aptitude test", format: (v) => (v === "done" ? "Taken" : "Not taken") },
    ]),
    ...rangeChips(f, set, DEFAULTS, { label: "CGPA", minKey: "minCgpa", maxKey: "maxCgpa" }),
    ...rangeChips(f, set, DEFAULTS, { label: "Readiness", minKey: "minReadiness", maxKey: "maxReadiness", suffix: "%" }),
    ...rangeChips(f, set, DEFAULTS, { label: "ATS score", minKey: "minAts", maxKey: "maxAts" }),
  ], [f, set]);

  const summary = data ? `${countText(data.total, data.overall ?? data.total, "student")}${data.total !== data.overall ? " match" : ""}` : "";
  const sentence = chips.length ? "Students matching your filters" : "All students";

  const notifySelected = () => setNotify({
    payload: sel.all ? { filters: filtersOnly } : { ids: [...sel.ids] },
    heading: sel.all ? `${sentence}` : `${sel.size} selected student${sel.size === 1 ? "" : "s"}`,
  });
  const notifyMatching = () => setNotify({ payload: { filters: filtersOnly }, heading: sentence });

  return (
    <>
      <OfficerHeader
        title="Student records" subtitle="Find students by department, programme, batch, skills, experience, target role and readiness, then message them."
        action={<Btn variant="outline" onClick={exportCsv} disabled={exporting}><Download size={14} aria-hidden="true" /> {exporting ? "Preparing..." : "Export CSV"}</Btn>}
      />

      <FilterBar
        quick={<QuickFilters items={QUICK} values={f} defaults={DEFAULTS} set={set} />}
        search={<SearchBox value={f.search} onChange={(v) => set({ search: v })} placeholder="Name, email, roll no or phone" label="Search students" className="min-w-56 flex-1 basis-56" />}
        moreCount={moreCount} chips={chips} onClear={() => reset(["sort"])} summary={summary}
        actions={<>
          <SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-48" />
          <SavedViews storageKey="officer-students" query={query} onApply={apply} />
        </>}
        primary={<Btn onClick={notifyMatching} disabled={!data?.total}><BellRing size={15} aria-hidden="true" /> Notify {data?.total && chips.length ? data.total : "all"}</Btn>}
        more={
          <>
            <FilterGroup title="Skills & experience">
              <TagInput label="Skills" values={skills} onChange={(v) => set({ skills: fromList(v) })} suggestions={o.skills} placeholder="e.g. React, SQL" />
              <div className="grid grid-cols-2 gap-3">
                <SelectFilter label="Match" value={f.skillMatch} onChange={(v) => set({ skillMatch: v })} options={[["any", "Any skill"], ["all", "All skills"]]} hideAny className="w-full" />
                <SelectFilter label="Min. level" value={f.skillLevel} onChange={(v) => set({ skillLevel: v })} options={["Beginner", "Intermediate", "Advanced"]} className="w-full" />
              </div>
              <SelectFilter label="Experience" value={f.experience} onChange={(v) => set({ experience: v })} options={[["none", "Fresher (none)"], ["any", "Has experience / internship"], ["2plus", "2 or more entries"]]} className="w-full" />
              <FilterField label="Worked as / at">
                <Input list="exp-roles" value={f.expRole} onChange={(e) => set({ expRole: e.target.value })} placeholder="Role or company" aria-label="Experience role or company" />
                <datalist id="exp-roles">{(o.experienceRoles || []).map((r) => <option key={r} value={r} />)}</datalist>
              </FilterField>
            </FilterGroup>

            <FilterGroup title="Academics & readiness">
              <RangeFilter label="CGPA" min={f.minCgpa} max={f.maxCgpa} onMin={(v) => set({ minCgpa: v })} onMax={(v) => set({ maxCgpa: v })} step="0.1" hi={10} />
              <SelectFilter label="Backlogs" value={f.backlogs} onChange={(v) => set({ backlogs: v })} options={[["none", "None"], ["le1", "At most 1"], ["le2", "At most 2"], ["has", "1 or more"]]} className="w-full" />
              <MultiSelect label="Readiness status" value={f.band} onChange={(v) => set({ band: v })} options={[["on_track", "On track (75+)"], ["in_progress", "In progress (45-74)"], ["needs_attention", "Needs attention (<45)"]]} className="w-full" />
              <RangeFilter label="Readiness %" min={f.minReadiness} max={f.maxReadiness} onMin={(v) => set({ minReadiness: v })} onMax={(v) => set({ maxReadiness: v })} hi={100} />
              <MultiSelect label="Location" value={f.location} onChange={(v) => set({ location: v })} options={o.locations || []} className="w-full" />
            </FilterGroup>

            <FilterGroup title="Placement & activity">
              <MultiSelect label="Placement" value={f.placement} onChange={(v) => set({ placement: v })} options={[["placed", "Placed"], ["in_process", "In process"], ["not_placed", "Not placed yet"], ["not_applied", "Never applied"]]} className="w-full" />
              <SelectFilter label="ATS resume check" value={f.ats} onChange={(v) => set({ ats: v })} options={[["checked", "Done"], ["not_checked", "Not done"]]} className="w-full" />
              <RangeFilter label="ATS score" min={f.minAts} max={f.maxAts} onMin={(v) => set({ minAts: v })} onMax={(v) => set({ maxAts: v })} hi={100} />
              <div className="grid grid-cols-3 gap-3">
                <SelectFilter label="Resume" value={f.resume} onChange={(v) => set({ resume: v })} options={[["yes", "Saved"], ["no", "Not saved"]]} className="w-full" />
                <SelectFilter label="Interview" value={f.interview} onChange={(v) => set({ interview: v })} options={[["done", "Taken"], ["none", "Not taken"]]} className="w-full" />
                <SelectFilter label="Aptitude" value={f.aptitude} onChange={(v) => set({ aptitude: v })} options={[["done", "Taken"], ["none", "Not taken"]]} className="w-full" />
              </div>
            </FilterGroup>
          </>
        }
      >
        <MultiSelect label="Department" value={f.dept} onChange={(v) => set({ dept: v })} options={o.departments || []} anyLabel="All departments" />
        <MultiSelect label="Batch" value={f.batch} onChange={(v) => set({ batch: v })} options={o.batches || []} anyLabel="All batches" className="w-full sm:w-36" />
        <MultiSelect label="Programme" value={f.program} onChange={(v) => set({ program: v })} options={programOptions} anyLabel="All programmes" className="w-full sm:w-36" />
        <MultiSelect label="Target role" value={f.role} onChange={(v) => set({ role: v })} options={o.roles || []} anyLabel="All roles" />
      </FilterBar>

      <Panel>
        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !items.length ? (
          <div className="py-12 text-center text-sm text-ink-soft">
            <p className="font-semibold text-ink">No students match these filters</p>
            <p className="mt-1">Try removing a filter or searching for something else.</p>
            {chips.length > 0 && <Btn variant="outline" className="mt-4" onClick={() => reset(["sort"])}>Clear all filters</Btn>}
          </div>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <SelectBanner pageCount={pageAll ? items.length : 0} total={data.total} all={sel.all} onSelectAll={sel.selectAll} onClear={sel.clear} />

            <div className="hidden overflow-x-auto md:block">
              <table className="cp-table w-full min-w-[1060px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    <th className="w-8 pb-2"><Checkbox checked={pageAll} indeterminate={pageSome} onChange={(e) => sel.setMany(pageIds, e.target.checked)} label="Select all students on this page" /></th>
                    <th className="pb-2">Student</th><th className="pb-2">Department</th><th className="pb-2">CGPA</th><th className="pb-2">Target role</th>
                    <th className="pb-2">Skills</th><th className="pb-2">Exp.</th><th className="pb-2">Readiness</th><th className="pb-2">Placement</th><th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const score = p.readiness?.score || 0;
                    const [tone, label] = PLACEMENT[p.placement] || PLACEMENT.not_applied;
                    const picked = sel.has(p._id);
                    return (
                      <tr key={p._id} className={`border-b border-line transition last:border-0 hover:bg-mint ${picked ? "bg-brand-soft/40" : ""}`}>
                        <td className="py-3 pr-2"><Checkbox checked={picked} onChange={() => sel.toggle(p._id)} label={`Select ${p.user?.name}`} /></td>
                        <td className="py-3 pr-3 font-semibold">{p.user?.name}<span className="block text-xs font-normal text-ink-soft">{p.rollNo || p.user?.email}</span></td>
                        <td className="py-3 pr-3 text-ink-soft">{[p.department, p.program].filter(Boolean).join(" \u00b7 ") || "-"}{p.batch && <span className="block text-xs">Batch {p.batch}</span>}</td>
                        <td className="py-3 pr-3">{p.cgpa != null ? Number(p.cgpa).toFixed(2) : "-"}{p.backlogs > 0 && <span className="block text-xs text-bad">{p.backlogs} backlog{p.backlogs === 1 ? "" : "s"}</span>}</td>
                        <td className="py-3 pr-3 text-ink-soft">{p.targetRole || "-"}</td>
                        <td className="py-3 pr-3">
                          {p.skills?.length ? (
                            <div className="flex max-w-56 flex-wrap gap-1">
                              {p.skills.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{s}</span>)}
                              {p.skillCount > 3 && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft">+{p.skillCount - 3}</span>}
                            </div>
                          ) : <span className="text-ink-soft">-</span>}
                        </td>
                        <td className="py-3 pr-3">{p.experienceCount || <span className="text-ink-soft">-</span>}</td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-20"><Meter value={score} color={readinessColor(score)} /></div>
                            <span className="font-bold">{score.toFixed(0)}%</span>
                          </div>
                          <span className="mt-1 block"><Pill tone={readinessTone(score)}>{readinessLabel(score)}</Pill></span>
                        </td>
                        <td className="py-3 pr-3"><Pill tone={tone}>{label}</Pill></td>
                        <td className="whitespace-nowrap py-3 text-right">
                          <Link to={`/officer/students/${p._id}`} className="inline-block rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft">View</Link>
                          <button type="button" onClick={() => deleteStudent(p)} aria-label={`Delete ${p.user?.name}'s account`} title="Delete account"
                            className="ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white align-middle text-ink-soft transition hover:border-bad/40 hover:bg-bad-soft hover:text-bad"><Trash2 size={14} aria-hidden="true" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* phone: one card per student */}
            <ul className="space-y-3 md:hidden">
              {items.map((p) => {
                const score = p.readiness?.score || 0;
                const [tone, label] = PLACEMENT[p.placement] || PLACEMENT.not_applied;
                return (
                  <li key={p._id} className={`flex items-start gap-3 rounded-xl border p-4 transition ${sel.has(p._id) ? "border-brand/40 bg-brand-soft/40" : "border-line"}`}>
                    <Checkbox className="mt-1" checked={sel.has(p._id)} onChange={() => sel.toggle(p._id)} label={`Select ${p.user?.name}`} />
                    <Link to={`/officer/students/${p._id}`} className="block min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{p.user?.name}</p>
                          <p className="truncate text-xs text-ink-soft">{[p.department, p.program, p.batch && `Batch ${p.batch}`, p.cgpa != null && `CGPA ${Number(p.cgpa).toFixed(2)}`].filter(Boolean).join(" \u00b7 ") || "No details yet"}</p>
                          {p.targetRole && <p className="truncate text-xs text-ink-soft">Aiming for {p.targetRole}</p>}
                        </div>
                        <Pill tone={tone}>{label}</Pill>
                      </div>
                      {p.skills?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.skills.slice(0, 4).map((s) => <span key={s} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-dark">{s}</span>)}
                          {p.skillCount > 4 && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft">+{p.skillCount - 4}</span>}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-3"><Meter value={score} color={readinessColor(score)} /><span className="text-sm font-bold">{score.toFixed(0)}%</span></div>
                    </Link>
                    <button type="button" onClick={() => deleteStudent(p)} aria-label={`Delete ${p.user?.name}'s account`} title="Delete account"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition hover:bg-bad-soft hover:text-bad"><Trash2 size={15} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data?.pages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm text-ink-soft">
            <span>{data.total} students</span>
            <div className="flex items-center gap-2">
              <Btn variant="outline" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</Btn>
              <span>Page {data.page} of {data.pages}</span>
              <Btn variant="outline" disabled={page >= data.pages} onClick={() => set({ page: page + 1 })}>Next</Btn>
            </div>
          </div>
        )}

        {selectedCount > 0 && (
          <BulkBar label={`${selectedCount} selected`} onClear={sel.clear}>
            <Btn onClick={notifySelected}><BellRing size={15} aria-hidden="true" /> Notify</Btn>
          </BulkBar>
        )}
      </Panel>

      <NotifyModal open={!!notify} onClose={() => setNotify(null)} payload={notify?.payload} heading={notify?.heading} onSent={() => sel.clear()} />
    </>
  );
}
