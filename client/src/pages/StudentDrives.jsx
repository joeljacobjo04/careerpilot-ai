import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Briefcase, CalendarDays, CheckCircle2, ChevronDown, Clock, MapPin, Undo2, Users, Wallet, XCircle } from "lucide-react";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, Tabs } from "../components/ui";
import { useConfirm, useToast } from "../components/Feedback";
import {
  FilterBar, FilterGroup, JOB_TYPES, RangeFilter, SearchBox, SelectFilter,
  closingMatches, countText, jobTypeLabel, makeChips, packageInRange, parseLpa, rangeChips, uniq, useUrlFilters,
} from "../components/filters";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBA");
const DAY = 86400000;

// "3 days left", "Closes today", "Closed"
function deadlineInfo(d) {
  if (!d.deadline) return { text: "No deadline set", tone: "text-ink-soft", passed: false, days: Infinity };
  const ms = new Date(d.deadline).getTime() - Date.now();
  if (ms <= 0) return { text: "Registration closed", tone: "text-bad", passed: true, days: -1 };
  const days = Math.ceil(ms / DAY);
  if (days <= 1) return { text: "Closes within 24 hours", tone: "text-bad", passed: false, days };
  if (days <= 3) return { text: `${days} days left`, tone: "text-warn", passed: false, days };
  return { text: `${days} days left`, tone: "text-ok", passed: false, days };
}

const MY_STATUS = {
  registered: { tone: "brand", label: "Applied", Icon: CheckCircle2, note: "Your application is with the placement cell." },
  shortlisted: { tone: "warn", label: "Shortlisted", Icon: Award, note: "You've been shortlisted. Watch for the next steps." },
  selected: { tone: "ok", label: "Selected", Icon: Award, note: "Congratulations! You're selected for this drive." },
  rejected: { tone: "bad", label: "Not selected", Icon: XCircle, note: "You weren't selected this time. More drives are on the way." },
};

const isOpenDrive = (d) => d.status !== "completed";

const DEFAULTS = { tab: "all", q: "", jobType: "", company: "", location: "", minPkg: "", maxPkg: "", closing: "", applied: "", sort: "deadline" };
const MORE_KEYS = ["company", "minPkg", "maxPkg", "closing", "applied"];
const SORTS = [["deadline", "Closing soonest"], ["newest", "Newest drive date"], ["package", "Highest package"], ["company", "Company A-Z"]];

function Chip({ icon: Icon, children }) {
  return <span className="inline-flex items-center gap-1.5 rounded-lg bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft"><Icon size={13} aria-hidden="true" />{children}</span>;
}

function DriveCard({ d, onChanged }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dl = deadlineInfo(d);
  const mine = d.myStatus ? MY_STATUS[d.myStatus] : null;
  const e = d.eligibility || {};
  const label = `${d.company?.name || "Company"} - ${d.role}`;
  const canRegister = isOpenDrive(d) && !dl.passed && d.eligible && !mine;
  const canWithdraw = mine && d.myStatus === "registered" && isOpenDrive(d);

  async function register() {
    const ok = await confirm({
      title: `Register for ${label}?`,
      message: `You'll be added to the applicant list${d.deadline ? ` (registration closes ${fmt(d.deadline)})` : ""}. You can withdraw later until the placement cell reviews your application.`,
      confirmText: "Register",
    });
    if (!ok) return;
    setBusy(true);
    try { await api.post(`/drives/${d._id}/register`); toast(`Registered for ${label}`); await onChanged(); }
    catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  }

  async function withdraw() {
    const ok = await confirm({
      title: `Withdraw from ${label}?`,
      message: "Your application will be removed and the placement cell will be told. You can register again before the deadline if the drive is still open.",
      confirmText: "Withdraw", tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try { await api.delete(`/drives/${d._id}/register`); toast("Registration withdrawn"); await onChanged(); }
    catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  }

  return (
    <Card className="flex flex-col !p-0">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-extrabold text-brand">{(d.company?.name || "?")[0].toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold leading-snug">{d.role}</h2>
            <p className="truncate text-sm text-ink-soft">{d.company?.name}{d.company?.industry ? ` \u00b7 ${d.company.industry}` : ""}</p>
          </div>
          {mine ? <Badge tone={mine.tone}>{mine.label}</Badge> : <Badge tone={isOpenDrive(d) && !dl.passed ? "ok" : "neutral"}>{isOpenDrive(d) ? (dl.passed ? "Closed" : "Open") : "Closed"}</Badge>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip icon={CalendarDays}>Drive: {fmt(d.date)}</Chip>
          {d.package && <Chip icon={Wallet}>{d.package}</Chip>}
          {d.location && <Chip icon={MapPin}>{d.location}</Chip>}
          <Chip icon={Users}>{d.registeredCount} applied</Chip>
          <Chip icon={Briefcase}>{jobTypeLabel(d.jobType)}</Chip>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-ink-soft"><Clock size={15} aria-hidden="true" /> Register by <b className="text-ink">{fmt(d.deadline)}</b></span>
          <span className={`text-xs font-bold ${dl.tone}`}>{isOpenDrive(d) ? dl.text : "Drive closed"}</span>
        </div>

        {mine ? (
          <p className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${d.myStatus === "rejected" ? "bg-bad-soft text-bad" : d.myStatus === "registered" ? "bg-brand-soft text-brand-dark" : "bg-ok-soft text-ok"}`}>
            <mine.Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {mine.note}
          </p>
        ) : d.eligible ? (
          isOpenDrive(d) && !dl.passed && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ok"><CheckCircle2 size={16} aria-hidden="true" /> You meet the eligibility criteria.</p>
        ) : (
          <p className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">{d.ineligibleReason || "You're not eligible for this drive."} Update your details in <Link to="/profile" className="font-bold underline">My profile</Link>.</p>
        )}

        <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {open ? "Hide details" : "View details"} <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="mt-3 space-y-4 border-t border-line pt-4 text-sm">
            {d.description && <p className="whitespace-pre-line leading-relaxed">{d.description}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-ink-soft">Minimum CGPA</dt><dd className="font-medium">{e.minCgpa || 0}</dd>
              <dt className="text-ink-soft">Max backlogs</dt><dd className="font-medium">{e.maxBacklogs ?? 0}</dd>
              <dt className="text-ink-soft">Departments</dt><dd className="font-medium">{e.departments?.length ? e.departments.join(", ") : "All departments"}</dd>
              <dt className="text-ink-soft">Batches</dt><dd className="font-medium">{e.batches?.length ? e.batches.join(", ") : "All batches"}</dd>
              <dt className="text-ink-soft">Classes</dt><dd className="font-medium">{e.sections?.length ? e.sections.join(", ") : "All classes"}</dd>
              {d.myRegisteredAt && <><dt className="text-ink-soft">You applied on</dt><dd className="font-medium">{fmt(d.myRegisteredAt)}</dd></>}
            </dl>
            {d.rounds?.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Selection rounds</p>
                <ol className="space-y-2">
                  {d.rounds.map((r, i) => (
                    <li key={i} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-dark">{i + 1}</span>{r}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* actions stay at the bottom of every card, so the buttons line up across a row */}
      <div className="mt-auto border-t border-line bg-mint/60 px-5 py-3.5">
        {canWithdraw ? (
          <Button variant="dangerGhost" className="w-full" onClick={withdraw} disabled={busy}><Undo2 size={15} aria-hidden="true" /> {busy ? "Withdrawing..." : "Withdraw registration"}</Button>
        ) : canRegister ? (
          <Button className="w-full" onClick={register} disabled={busy}><Briefcase size={15} aria-hidden="true" /> {busy ? "Registering..." : "Register for this drive"}</Button>
        ) : (
          <Button className="w-full" variant="ghost" disabled>{mine ? mine.label : !isOpenDrive(d) || dl.passed ? "Registration closed" : "Not eligible"}</Button>
        )}
      </div>
    </Card>
  );
}

export default function StudentDrives() {
  const { data, loading, error, reload } = useApi("/drives");
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const tab = f.tab;

  const drives = data || [];
  const counts = useMemo(() => ({
    all: drives.length,
    open: drives.filter((d) => isOpenDrive(d) && !deadlineInfo(d).passed).length,
    registered: drives.filter((d) => d.myStatus).length,
    eligible: drives.filter((d) => d.eligible && !d.myStatus && isOpenDrive(d) && !deadlineInfo(d).passed).length,
    closed: drives.filter((d) => !isOpenDrive(d) || deadlineInfo(d).passed).length,
    soon: drives.filter((d) => isOpenDrive(d) && !d.myStatus && deadlineInfo(d).days <= 3 && deadlineInfo(d).days >= 0).length,
  }), [drives]);

  const options = useMemo(() => ({
    companies: uniq(drives.map((d) => d.company?.name)).map((name) => [drives.find((d) => d.company?.name === name).company._id, name]),
    locations: uniq(drives.map((d) => d.location)),
  }), [drives]);

  const shown = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    return drives
      .filter((d) => {
        const closed = !isOpenDrive(d) || deadlineInfo(d).passed;
        if (tab === "open" && closed) return false;
        if (tab === "registered" && !d.myStatus) return false;
        if (tab === "eligible" && (closed || !d.eligible || d.myStatus)) return false;
        if (tab === "closed" && !closed) return false;
        if (text && ![d.role, d.title, d.company?.name, d.company?.industry, d.location].some((v) => v?.toLowerCase().includes(text))) return false;
        if (f.jobType && (d.jobType || "full_time") !== f.jobType) return false;
        if (f.company && String(d.company?._id) !== f.company) return false;
        if (f.location && d.location?.toLowerCase() !== f.location.toLowerCase()) return false;
        if (!packageInRange(d.package, f.minPkg, f.maxPkg)) return false;
        if (!closingMatches(d.deadline, f.closing, isOpenDrive(d))) return false;
        if (f.applied === "none" && d.myStatus) return false;
        if (f.applied && f.applied !== "none" && d.myStatus !== f.applied) return false;
        return true;
      })
      .sort((a, b) => {
        if (f.sort === "newest") return (new Date(b.date || 0)) - (new Date(a.date || 0));
        if (f.sort === "package") return (parseLpa(b.package)?.hi ?? -1) - (parseLpa(a.package)?.hi ?? -1);
        if (f.sort === "company") return (a.company?.name || "").localeCompare(b.company?.name || "");
        // open drives that close soonest come first, closed ones last
        const ca = !isOpenDrive(a) || deadlineInfo(a).passed, cb = !isOpenDrive(b) || deadlineInfo(b).passed;
        if (ca !== cb) return ca ? 1 : -1;
        return (new Date(a.deadline || a.date || 8.64e15)) - (new Date(b.deadline || b.date || 8.64e15));
      });
  }, [drives, tab, f]);

  const moreCount = MORE_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const chips = useMemo(() => [
    ...makeChips(f, DEFAULTS, set, [
      { key: "q", label: "Search" }, { key: "jobType", label: "Type", format: jobTypeLabel },
      { key: "company", label: "Company", format: (v) => options.companies.find(([id]) => id === v)?.[1] || v },
      { key: "location", label: "Location" },
      { key: "closing", label: "Registration", format: (v) => ({ 7: "closes in 7 days", 30: "closes in 30 days", passed: "closed", none: "no deadline" }[v] || v) },
      { key: "applied", label: "My application", format: (v) => (v === "none" ? "Not applied" : MY_STATUS[v]?.label || v) },
    ]),
    ...rangeChips(f, set, DEFAULTS, { label: "Package", minKey: "minPkg", maxKey: "maxPkg", suffix: " LPA" }),
  ], [f, set, options]);

  if (loading && !data) return <Spinner />;
  return (
    <>
      <PageHeader title="Placement drives" subtitle="Register for drives you are eligible for. Eligibility is based on your CGPA, backlogs, department and batch." />
      <ErrorBox>{error}</ErrorBox>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Open drives", counts.open, "text-ink"], ["You can apply to", counts.eligible, "text-ok"], ["Your applications", counts.registered, "text-brand-dark"], ["Closing in 3 days", counts.soon, counts.soon ? "text-warn" : "text-ink"]].map(([label, n, tone]) => (
          <Card key={label} className="!p-4"><p className="text-xs font-semibold text-ink-soft">{label}</p><p className={`mt-1 text-3xl font-extrabold tracking-tight ${tone}`}>{n}</p></Card>
        ))}
      </div>

      <div className="mb-4"><Tabs value={tab} onChange={(v) => set({ tab: v })} tabs={[["all", "All", counts.all], ["open", "Open", counts.open], ["eligible", "Eligible", counts.eligible], ["registered", "My applications", counts.registered], ["closed", "Closed", counts.closed]]} /></div>

      <FilterBar
        search={<SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder="Search company, role or location" label="Search drives" />}
        moreCount={moreCount} chips={chips} onClear={() => reset(["tab"])} summary={drives.length ? countText(shown.length, drives.length, "drive") : ""}
        actions={<SelectFilter label="Sort by" value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} hideAny className="w-full sm:w-48" />}
        more={
          <>
            <FilterGroup title="The offer">
              <SelectFilter label="Company" value={f.company} onChange={(v) => set({ company: v })} options={options.companies} className="w-full" />
              <RangeFilter label="Package (LPA)" min={f.minPkg} max={f.maxPkg} onMin={(v) => set({ minPkg: v })} onMax={(v) => set({ maxPkg: v })} />
            </FilterGroup>
            <FilterGroup title="Timing & my status">
              <SelectFilter label="Registration deadline" value={f.closing} onChange={(v) => set({ closing: v })} options={[["7", "Closes in 7 days"], ["30", "Closes in 30 days"], ["passed", "Already closed"], ["none", "No deadline set"]]} className="w-full" />
              <SelectFilter label="My application" value={f.applied} onChange={(v) => set({ applied: v })} options={[["none", "Not applied yet"], ["registered", "Applied"], ["shortlisted", "Shortlisted"], ["selected", "Selected"], ["rejected", "Not selected"]]} className="w-full" />
            </FilterGroup>
          </>
        }
      >
        <SelectFilter label="Job type" value={f.jobType} onChange={(v) => set({ jobType: v })} options={JOB_TYPES} anyLabel="All types" className="w-full sm:w-40" />
        <SelectFilter label="Location" value={f.location} onChange={(v) => set({ location: v })} options={options.locations} anyLabel="All locations" className="w-full sm:w-44" />
      </FilterBar>

      {!drives.length ? <Empty icon={Briefcase}>No drives have been announced yet. You'll be notified when your placement cell posts one.</Empty>
        : !shown.length ? <Empty icon={Briefcase}>No drives match these filters.{chips.length > 0 && <button type="button" onClick={() => reset(["tab"])} className="ml-2 font-bold text-brand hover:underline">Clear all filters</button>}</Empty> : (
          <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((d) => <DriveCard key={d._id} d={d} onChanged={reload} />)}
          </div>
        )}
    </>
  );
}
