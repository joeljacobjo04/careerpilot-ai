import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { BackLink, BtnLink, Btn, Fact, LogoTile, Panel, Pill, isOpen } from "../../components/officerUi";

export default function CompanyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: c, loading, error } = useApi(`/companies/${id}`);
  const [err, setErr] = useState("");

  async function remove() {
    if (!confirm("Delete this company?")) return;
    try { await api.delete(`/companies/${id}`); nav("/officer/companies"); } catch (e) { setErr(errMsg(e)); }
  }

  if (loading) return <Spinner />;
  if (error) return <><BackLink to="/officer/companies">Back to companies</BackLink><ErrorBox>{error}</ErrorBox></>;

  return (
    <>
      <BackLink to="/officer/companies">Back to companies</BackLink>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <LogoTile company={c} size={52} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-sm text-ink-soft">{c.industry || "Industry not set"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <BtnLink variant="outline" to={`/officer/companies/edit/${id}`}><Pencil size={14} aria-hidden="true" /> Edit</BtnLink>
          <Btn variant="dangerOutline" onClick={remove}><Trash2 size={14} aria-hidden="true" /> Delete</Btn>
        </div>
      </div>
      <ErrorBox>{err}</ErrorBox>

      <div className="mt-2 grid gap-4 md:grid-cols-3">
        <Fact label="Industry">{c.industry || "Not provided"}</Fact>
        <Fact label="Website">
          {c.website ? <a href={/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="break-all text-base text-brand hover:underline">{c.website}</a> : "Not provided"}
        </Fact>
        <Fact label="Headquarters">{c.headquarters || "Not provided"}</Fact>
      </div>

      <Panel className="mt-4">
        <h2 className="font-bold">Company Description</h2>
        <p className="mt-2 text-sm text-ink-soft">{c.description || "No description added."}</p>
      </Panel>

      <h2 className="mb-3 mt-6 text-lg font-bold">Placement Drives</h2>
      {!c.drives.length ? <p className="text-sm text-ink-soft">No placement drives for this company yet.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.drives.map((d) => (
            <Link key={d._id} to={`/officer/drives/${d._id}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <Panel hover className="h-full">
                <Pill tone={isOpen(d) ? "ok" : "neutral"}>{isOpen(d) ? "Open" : "Closed"}</Pill>
                <p className="mt-3 font-bold">{d.role}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Date</p>
                <p className="text-sm">{d.date ? new Date(d.date).toISOString().slice(0, 10) : "TBA"}</p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Minimum CGPA</p>
                <p className="text-sm">{(d.eligibility?.minCgpa ?? 0).toFixed(2)}</p>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
