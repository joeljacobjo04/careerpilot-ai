import { Link } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { BtnLink, OfficerHeader, Panel, Pill, fmtDate, isOpen } from "../../components/officerUi";

export const driveName = (d) => `${d.company?.name || "Company"} \u2014 ${d.role}`;

export default function Drives() {
  const { data, loading, error } = useApi("/drives");

  return (
    <>
      <OfficerHeader
        title="Placement drives" subtitle="Create and manage placement drives, eligibility, and applications."
        action={<BtnLink to="/officer/drives/new"><Plus size={15} aria-hidden="true" /> Create new drive</BtnLink>}
      />
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : !data.length ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">No drives yet. Add a company first, then create a drive.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((d) => (
            <Panel key={d._id} hover className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/officer/drives/${d._id}`} className="font-bold leading-snug hover:text-brand hover:underline">{driveName(d)}</Link>
                <Pill tone={isOpen(d) ? "ok" : "neutral"}>{isOpen(d) ? "Open" : "Closed"}</Pill>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Drive date: {fmtDate(d.date)}</p>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-soft/60 px-3 py-2 text-sm font-semibold text-brand-dark">
                <Users size={15} aria-hidden="true" /> Applicants: {d.registeredCount}
              </div>
              <BtnLink variant="outline" to={`/officer/drives/${d._id}/applicants`} className="mt-3 w-full !text-brand-dark">Manage applicants</BtnLink>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
