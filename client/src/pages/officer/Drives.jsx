import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CalendarDays, Clock, Download, GraduationCap, MapPin, Plus, Users } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner, Tabs } from "../../components/ui";
import { Btn, BtnLink, OfficerHeader, Panel, Pill, fmtDate, isOpen } from "../../components/officerUi";
import {
  DateRangeFilter, FilterBar, FilterGroup, JOB_TYPES, RangeFilter, SearchBox, SelectFilter,
  closingMatches, countText, downloadCsv, inDateRange, jobTypeLabel, makeChips, packageInRange, parseLpa, rangeChips, uniq, useUrlFilters,
} from "../../components/filters";

export const driveName = (d) => `${d.company?.name || "Company"} \u2014 ${d.role}`;

const daysTo = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

const DEFAULTS = {
  q: "", tab: "all", status: "", company: "", jobType: "", location: "", dept: "",
  minPkg: "", maxPkg: "", from: "", to: "", closing: "", cgpa: "", batch: "", sort: "newest",
};
const MORE_KEYS = ["status", "location", "dept", "batch", "minPkg", "maxPkg", "from", "to", "closing", "cgpa"];
const STATUS = [["upcoming", "Upcoming"], ["ongoing", "Ongoing"], ["completed", "Completed (closed)"]];
const SORTS = [["newest", "Drive date: newest first"], ["oldest", "Drive date: oldest first"], ["deadline", "Registration deadline: soonest"], ["applicants", "Most applicants"], ["package", "Highest package"], ["company", "Company A-Z"]];
/** "CSE, ECE · batch 2026" or "All students" */
const audienceLine = (e = {}) => {
  const parts = [e.departments?.length && e.departments.join(", "), e.batches?.length && `batch ${e.batches.join(", ")}`].filter(Boolean);
  return parts.length ? `Open to ${parts.join(" \u00b7 ")}` : "Open to all students";
};
const time = (d) => (d ? new Date(d).getTime() : null);

export default function Drives() {
  const { data, loading, error } = useApi("/drives");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);

  const drives = data || [];
  const counts = { all: drives.length, open: drives.filter(isOpen).length, closed: drives.filter((d) => !isOpen(d)).length };

  // choices for the drop-downs come from the drives themselves
  const options = useMemo(() => ({
    companies: uniq(drives.map((d) => d.company?.name)).map((name) => [drives.find((d) => d.company?.name === name).company._id, name]),
    locations: uniq(drives.map((d) => d.location)),
    depts: uniq(drives.flatMap((d) => d.eligibility?.departments || [])),
    batches: uniq(drives.flatMap((d) => d.eligibility?.batches || [])).reverse(),
  }), [drives]);

  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const list = drives.filter((d) => {
      if (f.tab !== "all" && (f.tab === "open") !== isOpen(d)) return false;
      if (text && ![d.role, d.title, d.company?.name, d.location, d.company?.industry].some((v) => v?.toLowerCase().includes(text))) return false;
      if (f.status && d.status !== f.status) return false;
      if (f.company && String(d.company?._id) !== f.company) return false;
      if (f.jobType && (d.jobType || "full_time") !== f.jobType) return false;
      if (f.location && d.location?.toLowerCase() !== f.location.toLowerCase()) return false;
      if (f.dept) { const ds = d.eligibility?.departments || []; if (ds.length && !ds.includes(f.dept)) return false; }
      if (f.batch) { const bs = d.eligibility?.batches || []; if (bs.length && !bs.includes(f.batch)) return false; }
      if (!packageInRange(d.package, f.minPkg, f.maxPkg)) return false;
      if (!inDateRange(d.date, f.from, f.to)) return false;
      if (!closingMatches(d.deadline, f.closing, isOpen(d))) return false;
      if (f.cgpa !== "" && (d.eligibility?.minCgpa || 0) > Number(f.cgpa)) return false;
      return true;
    });
    const by = {
      newest: (a, b) => (time(b.date) ?? -Infinity) - (time(a.date) ?? -Infinity),
      oldest: (a, b) => (time(a.date) ?? Infinity) - (time(b.date) ?? Infinity),
      deadline: (a, b) => (time(a.deadline) ?? Infinity) - (time(b.deadline) ?? Infinity),
      applicants: (a, b) => (b.registeredCount || 0) - (a.registeredCount || 0),
      package: (a, b) => (parseLpa(b.package)?.hi ?? -1) - (parseLpa(a.package)?.hi ?? -1),
      company: (a, b) => (a.company?.name || "").localeCompare(b.company?.name || ""),
    }[f.sort] || (() => 0);
    return [...list].sort(by);
  }, [drives, f]);

  const moreCount = MORE_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [
      { key: "q", label: "Search" },
      { key: "company", label: "Company", format: (v) => options.companies.find(([id]) => id === v)?.[1] || v },
      { key: "jobType", label: "Type", format: jobTypeLabel },
      { key: "status", label: "Status", format: (v) => STATUS.find(([k]) => k === v)?.[1] || v },
      { key: "location", label: "Location" }, { key: "dept", label: "Department" }, { key: "batch", label: "Batch" },
      { key: "closing", label: "Registration", format: (v) => ({ 7: "closes in 7 days", 30: "closes in 30 days", passed: "deadline passed", none: "no deadline" }[v] || v) },
      { key: "cgpa", label: "Min CGPA required up to" },
    ]),
    ...rangeChips(f, set, DEFAULTS, { label: "Package", minKey: "minPkg", maxKey: "maxPkg", suffix: " LPA" }),
    ...rangeChips(f, set, DEFAULTS, { label: "Drive date", minKey: "from", maxKey: "to" }),
  ], [f, set, options]);

  function exportCsv() {
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    downloadCsv("drives.csv",
      ["Company", "Role", "Type", "Location", "Package", "Drive date", "Register by", "Status", "Min CGPA", "Max backlogs", "Departments", "Applied", "Shortlisted", "Selected"],
      shown.map((d) => [d.company?.name, d.role, jobTypeLabel(d.jobType), d.location, d.package, day(d.date), day(d.deadline), d.status, d.eligibility?.minCgpa, d.eligibility?.maxBacklogs,
        (d.eligibility?.departments || []).join("; ") || "All", d.registeredCount, d.shortlistedCount ?? 0, d.selectedCount ?? 0]));
  }

  return (
    <>
      <OfficerHeader
        title="Placement drives" subtitle="Create and manage placement drives, eligibility, and applications."
        action={<BtnLink to="/officer/drives/new"><Plus size={15} aria-hidden="true" /> Create new drive</BtnLink>}
      />
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : !drives.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink-soft">No drives yet. Add a company first, then create a drive.</p>
      ) : (
        <>
          <div className="mb-4"><Tabs value={f.tab} onChange={(v) => set({ tab: v })} tabs={[["all", "All", counts.all], ["open", "Open", counts.open], ["closed", "Closed", counts.closed]]} /></div>

          <FilterBar
            search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Search company, role or location" label="Search drives" />}
            moreCount={moreCount} chips={chips} onClear={() => reset(["tab"])} summary={countText(shown.length, drives.length, "drive")}
            actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-56" />}
            primary={<Btn variant="outline" onClick={exportCsv} disabled={!shown.length}><Download size={14} aria-hidden="true" /> Export CSV</Btn>}
            more={
              <>
                <FilterGroup title="Open to">
                  <SelectFilter label="Department" value={f.dept} onChange={(v) => set({ dept: v })} options={options.depts} className="w-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectFilter label="Batch" value={f.batch} onChange={(v) => set({ batch: v })} options={options.batches} className="w-full" />
                  </div>
                  <SelectFilter label="Min CGPA required up to" value={f.cgpa} onChange={(v) => set({ cgpa: v })} options={[["6", "6.0"], ["7", "7.0"], ["7.5", "7.5"], ["8", "8.0"], ["9", "9.0"]]} className="w-full" />
                </FilterGroup>
                <FilterGroup title="Schedule">
                  <SelectFilter label="Status" value={f.status} onChange={(v) => set({ status: v })} options={STATUS} className="w-full" />
                  <DateRangeFilter label="Drive date" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} />
                  <SelectFilter label="Registration deadline" value={f.closing} onChange={(v) => set({ closing: v })} options={[["7", "Closes in 7 days"], ["30", "Closes in 30 days"], ["passed", "Already passed"], ["none", "No deadline set"]]} className="w-full" />
                </FilterGroup>
                <FilterGroup title="Offer">
                  <SelectFilter label="Location" value={f.location} onChange={(v) => set({ location: v })} options={options.locations} className="w-full" />
                  <RangeFilter label="Package (LPA)" min={f.minPkg} max={f.maxPkg} onMin={(v) => set({ minPkg: v })} onMax={(v) => set({ maxPkg: v })} />
                </FilterGroup>
              </>
            }
          >
            <SelectFilter label="Company" value={f.company} onChange={(v) => set({ company: v })} options={options.companies} anyLabel="All companies" />
            <SelectFilter label="Job type" value={f.jobType} onChange={(v) => set({ jobType: v })} options={JOB_TYPES} anyLabel="All types" className="w-full sm:w-40" />
          </FilterBar>

          {!shown.length ? (
            <div className="py-10 text-center text-sm text-ink-soft">
              <p>No drives match these filters.</p>
              {chips.length > 0 && <button type="button" onClick={() => reset(["tab"])} className="mt-2 font-bold text-brand hover:underline">Clear all filters</button>}
            </div>
          ) : (
            // items-stretch + a flex column per card, with the button pushed to the bottom (mt-auto), so every button lines up
            <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((d) => {
                const left = daysTo(d.deadline);
                return (
                  <Panel key={d._id} hover className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/officer/drives/${d._id}`} className="font-bold leading-snug hover:text-brand hover:underline">{driveName(d)}</Link>
                      <Pill tone={isOpen(d) ? "ok" : "neutral"}>{isOpen(d) ? "Open" : "Closed"}</Pill>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-ink-soft">
                      <p className="flex items-center gap-2"><CalendarDays size={13} aria-hidden="true" /> Drive date: {fmtDate(d.date)}</p>
                      {d.deadline && (
                        <p className={`flex items-center gap-2 ${isOpen(d) && left != null && left <= 3 && left >= 0 ? "font-semibold text-warn" : ""}`}>
                          <Clock size={13} aria-hidden="true" /> Register by {fmtDate(d.deadline)}{isOpen(d) && left != null && left >= 0 ? ` (${left === 0 ? "today" : `${left} day${left === 1 ? "" : "s"} left`})` : ""}
                        </p>
                      )}
                      {(d.location || d.package) && <p className="flex items-center gap-2"><MapPin size={13} aria-hidden="true" /> {[d.location, d.package].filter(Boolean).join(" \u00b7 ")}</p>}
                      <p className="flex items-center gap-2"><Briefcase size={13} aria-hidden="true" /> {jobTypeLabel(d.jobType)}</p>
                      <p className="flex items-start gap-2"><GraduationCap size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{audienceLine(d.eligibility)}</span></p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[["Applied", d.registeredCount], ["Shortlisted", d.shortlistedCount ?? 0], ["Selected", d.selectedCount ?? 0]].map(([label, n]) => (
                        <div key={label} className="rounded-xl bg-brand-soft/60 px-2 py-2">
                          <p className="text-lg font-bold leading-none text-brand-dark">{n}</p>
                          <p className="mt-1 text-[11px] font-semibold text-ink-soft">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-4">
                      <BtnLink variant="outline" to={`/officer/drives/${d._id}/applicants`} className="w-full !text-brand-dark">
                        <Users size={15} aria-hidden="true" /> Manage applicants
                      </BtnLink>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
