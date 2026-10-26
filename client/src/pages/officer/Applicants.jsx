import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BellRing, CheckCircle2, Download } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Select, Spinner, Tabs } from "../../components/ui";
import { useConfirm, useToast } from "../../components/Feedback";
import { APPLICANT_STATUSES, Btn, BtnLink, OfficerHeader, Panel, Pill, fmtDate, statusLabel } from "../../components/officerUi";
import {
  DateRangeFilter, FilterBar, FilterGroup, MultiSelect, RangeFilter, SearchBox, SelectFilter, TagInput,
  countText, downloadCsv, fromList, inDateRange, inRange, makeChips, rangeChips, toList, toMulti, uniq, useUrlFilters,
} from "../../components/filters";
import { BulkBar, Checkbox, NotifyModal, useSelection } from "../../components/bulk";

const TONE = { registered: "neutral", shortlisted: "warn", selected: "ok", rejected: "bad" };
const TH = "pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft";

const DEFAULTS = {
  tab: "all", q: "", dept: "", batch: "", program: "", role: "", skills: "", experience: "", backlogs: "",
  minCgpa: "", maxCgpa: "", minReadiness: "", maxReadiness: "", minAts: "", maxAts: "", from: "", to: "", sort: "applied",
};
const MORE_KEYS = ["role", "skills", "experience", "backlogs", "minCgpa", "maxCgpa", "minReadiness", "maxReadiness", "minAts", "maxAts", "from", "to"];
const SORTS = [["applied", "Applied: earliest first"], ["recent", "Applied: latest first"], ["readiness", "Readiness: high to low"], ["cgpa", "CGPA: high to low"], ["name", "Name A-Z"]];

/** Status dropdown + Update button. Shows "Updated" for a few seconds after a successful save. */
function StatusControl({ r, justUpdated, onSave, compact = false }) {
  const [next, setNext] = useState(r.status);
  const [busy, setBusy] = useState(false);
  useEffect(() => setNext(r.status), [r.status]); // follow the saved status after a reload
  const changed = next !== r.status;

  async function save() {
    setBusy(true);
    try { await onSave(r, next); } finally { setBusy(false); }
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex w-48 flex-col gap-2"}>
      <Select value={next} onChange={(e) => setNext(e.target.value)} aria-label={`Status for ${r.student?.name}`}>
        {APPLICANT_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </Select>
      <div className="flex items-center gap-2">
        <Btn className="w-fit" onClick={save} disabled={!changed || busy}>{busy ? "Updating..." : "Update"}</Btn>
        {justUpdated && !changed && (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-ok animate-fade"><CheckCircle2 size={14} aria-hidden="true" /> Updated</span>
        )}
      </div>
    </div>
  );
}

export default function Applicants() {
  const { id } = useParams();
  const confirm = useConfirm();
  const toast = useToast();
  const drive = useApi(`/drives/${id}`);
  const regs = useApi(`/drives/${id}/registrations`);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState({}); // studentId -> true for a few seconds after saving
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const tab = f.tab;
  const sel = useSelection();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function save(r, status) {
    setErr("");
    const name = r.student?.name || "this student";
    if (status === "selected" || status === "rejected" || status === "shortlisted") {
      const ok = await confirm({
        title: `Mark ${name} as ${statusLabel(status).toLowerCase()}?`,
        message: `${name} will be notified right away${status === "rejected" ? " (in the app)" : " by notification, SMS and email"}. You can change the status again later.`,
        confirmText: `Mark as ${statusLabel(status).toLowerCase()}`,
        tone: status === "rejected" ? "danger" : "primary",
      });
      if (!ok) return;
    }
    try {
      await api.put(`/drives/${id}/registrations/${r.student._id}`, { status });
      await Promise.all([regs.reload(), drive.reload()]);
      setUpdated((u) => ({ ...u, [r.student._id]: true }));
      setTimeout(() => setUpdated((u) => { const { [r.student._id]: _gone, ...rest } = u; return rest; }), 8000);
      toast(`${name} is now ${statusLabel(status).toLowerCase()}`);
    } catch (e) { setErr(errMsg(e)); toast(errMsg(e), "error"); }
  }

  async function bulkStatus(status) {
    const label = statusLabel(status).toLowerCase();
    const targets = shown.filter((r) => sel.has(r.student?._id) && r.status !== status);
    if (!targets.length) return toast(`Everyone selected is already ${label}`, "info");
    const ok = await confirm({
      title: `Mark ${targets.length} applicant${targets.length === 1 ? "" : "s"} as ${label}?`,
      message: `${targets.length === 1 ? "This student" : "These students"} will be notified right away${status === "rejected" ? " (in the app)" : " by notification, SMS and email"}. You can change the status again later.`,
      confirmText: `Mark as ${label}`, tone: status === "rejected" ? "danger" : "primary",
    });
    if (!ok) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map((r) => api.put(`/drives/${id}/registrations/${r.student._id}`, { status })));
    const failed = results.filter((x) => x.status === "rejected").length;
    await Promise.all([regs.reload(), drive.reload()]);
    setBulkBusy(false); sel.clear();
    toast(failed ? `${targets.length - failed} updated, ${failed} could not be updated` : `${targets.length} applicant${targets.length === 1 ? "" : "s"} marked ${label}`, failed ? "error" : "ok");
  }

  const list = regs.data || [];
  const counts = useMemo(() => Object.fromEntries([["all", list.length], ...APPLICANT_STATUSES.map(([k]) => [k, list.filter((r) => r.status === k).length])]), [list]);
  const options = useMemo(() => ({
    depts: uniq(list.map((r) => r.profile?.department)),
    batches: uniq(list.map((r) => r.profile?.batch)).reverse(),
    programs: uniq(list.map((r) => r.profile?.program)),
    roles: uniq(list.map((r) => r.profile?.targetRole)),
    skills: uniq(list.flatMap((r) => r.profile?.skills || [])),
  }), [list]);
  const wantSkills = toList(f.skills).map((x) => x.toLowerCase());
  const depts = toMulti(f.dept), batches = toMulti(f.batch), programs = toMulti(f.program), roles = toMulti(f.role);

  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const filtered = list.filter((r) => {
      const p = r.profile || {};
      if (tab !== "all" && r.status !== tab) return false;
      if (text && ![r.student?.name, r.student?.email, p.department, p.rollNo, p.phone].some((v) => v?.toLowerCase().includes(text))) return false;
      if (depts.length && !depts.includes(p.department)) return false;
      if (batches.length && !batches.includes(p.batch)) return false;
      if (programs.length && !programs.includes(p.program)) return false;
      if (roles.length && !roles.includes(p.targetRole)) return false;
      if (wantSkills.length && !wantSkills.some((w) => (p.skills || []).some((x) => x.toLowerCase().includes(w)))) return false;
      if (f.experience === "none" && p.experienceCount) return false;
      if (f.experience === "any" && !p.experienceCount) return false;
      if (f.backlogs === "none" && p.backlogs > 0) return false;
      if (f.backlogs === "has" && !(p.backlogs > 0)) return false;
      if (!inRange(p.cgpa, f.minCgpa, f.maxCgpa)) return false;
      if (!inRange(p.readiness?.score ?? 0, f.minReadiness, f.maxReadiness)) return false;
      if (!inRange(p.latestAtsScore?.score, f.minAts, f.maxAts)) return false;
      if (!inDateRange(r.registeredAt, f.from, f.to)) return false;
      return true;
    });
    const t = (r) => (r.registeredAt ? new Date(r.registeredAt).getTime() : 0);
    const by = {
      applied: (a, b) => t(a) - t(b),
      recent: (a, b) => t(b) - t(a),
      readiness: (a, b) => (b.profile?.readiness?.score || 0) - (a.profile?.readiness?.score || 0),
      cgpa: (a, b) => (b.profile?.cgpa ?? -1) - (a.profile?.cgpa ?? -1),
      name: (a, b) => (a.student?.name || "").localeCompare(b.student?.name || ""),
    }[f.sort] || (() => 0);
    return [...filtered].sort(by);
  }, [list, f, tab, wantSkills.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownIds = shown.map((r) => r.student?._id).filter(Boolean);
  const allShown = shownIds.length > 0 && shownIds.every((x) => sel.has(x));
  const someShown = shownIds.some((x) => sel.has(x));
  const filterKey = JSON.stringify(f);
  useEffect(() => { sel.clear(); }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const moreCount = MORE_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [
      { key: "q", label: "Search" }, { key: "dept", label: "Department", multi: true }, { key: "batch", label: "Batch", multi: true }, { key: "program", label: "Programme", multi: true }, { key: "role", label: "Target role", multi: true },
      { key: "skills", label: "Skill" },
      { key: "experience", label: "Experience", format: (v) => (v === "none" ? "Fresher" : "Has experience") },
      { key: "backlogs", label: "Backlogs", format: (v) => (v === "none" ? "None" : "1 or more") },
    ]),
    ...rangeChips(f, set, DEFAULTS, { label: "CGPA", minKey: "minCgpa", maxKey: "maxCgpa" }),
    ...rangeChips(f, set, DEFAULTS, { label: "Readiness", minKey: "minReadiness", maxKey: "maxReadiness", suffix: "%" }),
    ...rangeChips(f, set, DEFAULTS, { label: "ATS score", minKey: "minAts", maxKey: "maxAts" }),
    ...rangeChips(f, set, DEFAULTS, { label: "Applied on", minKey: "from", maxKey: "to" }),
  ], [f, set]);

  function exportCsv() {
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    downloadCsv("applicants.csv",
      ["Name", "Email", "Roll No", "Department", "Batch", "Phone", "CGPA", "Backlogs", "Target role", "Skills", "Readiness", "ATS score", "Applied on", "Status"],
      shown.map((r) => { const p = r.profile || {}; return [r.student?.name, r.student?.email, p.rollNo, p.department, p.batch, p.phone, p.cgpa, p.backlogs, p.targetRole, (p.skills || []).join("; "), p.readiness?.score, p.latestAtsScore?.score, day(r.registeredAt), statusLabel(r.status)]; }));
  }

  if (drive.loading && !drive.data) return <Spinner />;
  if (drive.error) return <ErrorBox>{drive.error}</ErrorBox>;
  const d = drive.data;

  return (
    <>
      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <OfficerHeader
        title="Manage applicants" subtitle="Review and manage students who applied for this placement drive."
        action={<BtnLink variant="outline" to="/officer/drives"><span aria-hidden="true">&larr;</span> Back to drives</BtnLink>}
      />

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr_1fr]">
        <Panel>
          <p className="text-xs text-ink-soft">Placement drive</p>
          <p className="mt-1 text-xl font-bold">{d.company?.name} &mdash; {d.role}</p>
          <p className="mt-1 text-xs font-semibold text-ok">&bull; Drive date: {fmtDate(d.date)}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-ink-soft">Total applicants</p>
          <p className="mt-1 text-3xl font-bold">{d.registeredCount}</p>
          <p className="mt-1 text-xs font-semibold text-ok">&bull; Applied for this drive</p>
        </Panel>
        <Panel>
          <p className="text-xs text-ink-soft">Selected</p>
          <p className="mt-1 text-3xl font-bold">{d.selectedCount}</p>
          <p className="mt-1 text-xs font-semibold text-warn">&bull; {d.shortlistedCount} shortlisted</p>
        </Panel>
      </div>

      <div className="mt-5">
        <div className="mb-3"><Tabs value={tab} onChange={(v) => set({ tab: v })} tabs={[["all", "All", counts.all], ...APPLICANT_STATUSES.map(([k, label]) => [k, label, counts[k]])]} /></div>
        <FilterBar
          search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Name, roll no, email or phone" label="Search applicants" className="min-w-56 flex-1 basis-56" />}
          moreCount={moreCount} chips={chips} onClear={() => reset(["tab"])} summary={list.length ? countText(shown.length, list.length, "applicant") : ""}
          actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-52" />}
          primary={<Btn variant="outline" onClick={exportCsv} disabled={!shown.length}><Download size={14} aria-hidden="true" /> Export CSV</Btn>}
          more={
            <>
              <FilterGroup title="Skills & experience">
                <MultiSelect label="Target role" value={f.role} onChange={(v) => set({ role: v })} options={options.roles} className="w-full" />
                <TagInput label="Skills" values={toList(f.skills)} onChange={(v) => set({ skills: fromList(v) })} suggestions={options.skills} placeholder="e.g. React, SQL" />
                <SelectFilter label="Experience" value={f.experience} onChange={(v) => set({ experience: v })} options={[["none", "Fresher (none)"], ["any", "Has experience"]]} className="w-full" />
              </FilterGroup>
              <FilterGroup title="Academics & readiness">
                <RangeFilter label="CGPA" min={f.minCgpa} max={f.maxCgpa} onMin={(v) => set({ minCgpa: v })} onMax={(v) => set({ maxCgpa: v })} step="0.1" hi={10} />
                <SelectFilter label="Backlogs" value={f.backlogs} onChange={(v) => set({ backlogs: v })} options={[["none", "None"], ["has", "1 or more"]]} className="w-full" />
                <RangeFilter label="Readiness %" min={f.minReadiness} max={f.maxReadiness} onMin={(v) => set({ minReadiness: v })} onMax={(v) => set({ maxReadiness: v })} hi={100} />
                <RangeFilter label="ATS score" min={f.minAts} max={f.maxAts} onMin={(v) => set({ minAts: v })} onMax={(v) => set({ maxAts: v })} hi={100} />
              </FilterGroup>
              <FilterGroup title="Application">
                <DateRangeFilter label="Applied between" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} />
              </FilterGroup>
            </>
          }
        >
          <MultiSelect label="Department" value={f.dept} onChange={(v) => set({ dept: v })} options={options.depts} anyLabel="All departments" />
          <MultiSelect label="Batch" value={f.batch} onChange={(v) => set({ batch: v })} options={options.batches} anyLabel="All batches" className="w-full sm:w-36" />
          <MultiSelect label="Programme" value={f.program} onChange={(v) => set({ program: v })} options={options.programs} anyLabel="All programmes" className="w-full sm:w-36" />
        </FilterBar>
      </div>

      <Panel>
        {regs.loading && !regs.data ? <Spinner /> : regs.error ? <ErrorBox>{regs.error}</ErrorBox> : !list.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">No students have applied to this drive yet.</p>
        ) : !shown.length ? (
          <div className="py-8 text-center text-sm text-ink-soft"><p>No applicants match these filters.</p>{chips.length > 0 && <button type="button" onClick={() => reset(["tab"])} className="mt-2 font-bold text-brand hover:underline">Clear all filters</button>}</div>
        ) : (
          <>
            {/* desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="cp-table w-full min-w-[900px] text-left text-sm">
                <thead><tr className="border-b border-line"><th className={`${TH} w-8`}><Checkbox checked={allShown} indeterminate={someShown} onChange={(e) => sel.setMany(shownIds, e.target.checked)} label="Select all applicants shown" /></th><th className={TH}>Name</th><th className={TH}>Department</th><th className={TH}>Phone</th><th className={TH}>CGPA</th><th className={TH}>Readiness</th><th className={TH}>Status</th><th className={TH}>Update status</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.student?._id} className={`border-b border-line transition-colors duration-700 last:border-0 ${updated[r.student?._id] ? "bg-ok-soft/60" : sel.has(r.student?._id) ? "bg-brand-soft/40" : ""}`}>
                      <td className="py-3 pr-2"><Checkbox checked={sel.has(r.student?._id)} onChange={() => sel.toggle(r.student?._id)} label={`Select ${r.student?.name}`} /></td>
                      <td className="py-3 pr-3 font-semibold">{r.student?.name}<span className="block text-xs font-normal text-ink-soft">{r.profile?.rollNo || r.student?.email}</span></td>
                      <td className="py-3 pr-3 text-ink-soft">{[r.profile?.department, r.profile?.program].filter(Boolean).join(" \u00b7 ") || "-"}{r.profile?.batch && <span className="block text-xs">Batch {r.profile.batch}</span>}</td>
                      <td className="py-3 pr-3">{r.profile?.phone ? <a href={`tel:${r.profile.phone.replace(/\s/g, "")}`} className="font-semibold text-brand hover:underline">{r.profile.phone}</a> : <span className="text-ink-soft">-</span>}</td>
                      <td className="py-3 pr-3">{r.profile?.cgpa != null ? Number(r.profile.cgpa).toFixed(2) : "-"}</td>
                      <td className="py-3 pr-3 font-semibold">{r.profile?.readiness?.score != null ? `${Number(r.profile.readiness.score).toFixed(0)}%` : "-"}</td>
                      <td className="py-3 pr-3"><Pill tone={TONE[r.status]}>{statusLabel(r.status)}</Pill></td>
                      <td className="py-3"><StatusControl r={r} justUpdated={!!updated[r.student?._id]} onSave={save} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* phone: one card per applicant */}
            <ul className="space-y-3 md:hidden">
              {shown.map((r) => (
                <li key={r.student?._id} className={`rounded-xl border p-4 transition-colors duration-700 ${updated[r.student?._id] ? "border-ok/40 bg-ok-soft/60" : "border-line"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Checkbox className="mt-1" checked={sel.has(r.student?._id)} onChange={() => sel.toggle(r.student?._id)} label={`Select ${r.student?.name}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{r.student?.name}</p>
                      <p className="text-xs text-ink-soft">{[r.profile?.department, r.profile?.program, r.profile?.batch && `Batch ${r.profile.batch}`, r.profile?.cgpa != null ? `CGPA ${Number(r.profile.cgpa).toFixed(2)}` : "", r.profile?.readiness?.score != null ? `Readiness ${Number(r.profile.readiness.score).toFixed(0)}%` : ""].filter(Boolean).join(" \u00b7 ") || "-"}</p>
                    </div>
                    <Pill tone={TONE[r.status]}>{statusLabel(r.status)}</Pill>
                  </div>
                  {r.profile?.phone && <a href={`tel:${r.profile.phone.replace(/\s/g, "")}`} className="mt-2 inline-block text-sm font-semibold text-brand">{r.profile.phone}</a>}
                  <div className="mt-3 border-t border-line pt-3"><StatusControl compact r={r} justUpdated={!!updated[r.student?._id]} onSave={save} /></div>
                </li>
              ))}
            </ul>
          </>
        )}

        {sel.size > 0 && (
          <BulkBar label={`${sel.size} selected`} onClear={sel.clear}>
            <Btn onClick={() => setNotifyOpen(true)} disabled={bulkBusy}><BellRing size={15} aria-hidden="true" /> Notify</Btn>
            <Btn variant="outline" onClick={() => bulkStatus("shortlisted")} disabled={bulkBusy}>Shortlist</Btn>
            <Btn variant="outline" onClick={() => bulkStatus("selected")} disabled={bulkBusy}>Mark selected</Btn>
            <Btn variant="dangerOutline" onClick={() => bulkStatus("rejected")} disabled={bulkBusy}>Reject</Btn>
          </BulkBar>
        )}
      </Panel>

      <NotifyModal open={notifyOpen} onClose={() => setNotifyOpen(false)} payload={{ userIds: [...sel.ids] }}
        heading={`${sel.size} selected applicant${sel.size === 1 ? "" : "s"} of ${d.company?.name} \u2014 ${d.role}`} onSent={() => sel.clear()} />
    </>
  );
}
