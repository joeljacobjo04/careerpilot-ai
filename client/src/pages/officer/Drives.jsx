import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, Plus, Search, Users } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Input, Spinner, Tabs } from "../../components/ui";
import { BtnLink, OfficerHeader, Panel, Pill, fmtDate, isOpen } from "../../components/officerUi";

export const driveName = (d) => `${d.company?.name || "Company"} \u2014 ${d.role}`;

const daysTo = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

export default function Drives() {
  const { data, loading, error } = useApi("/drives");
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const drives = data || [];
  const counts = { all: drives.length, open: drives.filter(isOpen).length, closed: drives.filter((d) => !isOpen(d)).length };
  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    return drives.filter((d) => (tab === "all" || (tab === "open") === isOpen(d))
      && (!text || [d.role, d.title, d.company?.name].some((v) => v?.toLowerCase().includes(text))));
  }, [drives, tab, q]);

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
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onChange={setTab} tabs={[["all", "All", counts.all], ["open", "Open", counts.open], ["closed", "Closed", counts.closed]]} />
            <div className="relative w-full lg:w-72">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              <Input className="!pl-10" placeholder="Search company or role" aria-label="Search drives" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {!shown.length ? <p className="py-10 text-center text-sm text-ink-soft">No drives match.</p> : (
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
