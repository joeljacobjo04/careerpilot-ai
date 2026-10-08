import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { BtnLink, LogoTile, OfficerHeader, Panel, Pill } from "../../components/officerUi";

export default function Companies() {
  const { data, loading, error } = useApi("/companies");

  return (
    <>
      <OfficerHeader title="Companies" subtitle="Manage company information and hiring relationships." />
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : (
        <>
          {!data.length && <p className="mb-5 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">No companies yet. Add your first recruiter below.</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((c) => (
              <Link key={c._id} to={`/officer/companies/${c._id}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <Panel hover className="h-full">
                  <LogoTile company={c} />
                  <p className="mt-3 font-bold">{c.name}</p>
                  <p className="mb-3 text-sm text-ink-soft">{c.industry || "\u00a0"}</p>
                  <Pill tone={c.openDrives ? "ok" : "neutral"}>{c.openDrives ? "Open Drive" : "No Active Drive"}</Pill>
                </Panel>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <BtnLink to="/officer/companies/add"><Plus size={15} aria-hidden="true" /> Add Company</BtnLink>
          </div>
        </>
      )}
    </>
  );
}
