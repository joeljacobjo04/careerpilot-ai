import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Spinner } from "../../components/ui";
import { BackLink, Btn, BtnLink, Fact, Panel, Pill, fmtDate, isOpen } from "../../components/officerUi";

const Line = ({ label, children }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
    <p className="mt-0.5 text-sm">{children}</p>
  </div>
);

export default function DriveDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: d, loading, error } = useApi(`/drives/${id}`);
  const [err, setErr] = useState("");

  async function remove() {
    if (!confirm("Delete this drive and all of its applications?")) return;
    try { await api.delete(`/drives/${id}`); nav("/officer/drives"); } catch (e) { setErr(errMsg(e)); }
  }

  if (loading) return <Spinner />;
  if (error) return <><BackLink to="/officer/drives">Back to drives</BackLink><ErrorBox>{error}</ErrorBox></>;

  const e = d.eligibility || {};
  return (
    <>
      <BackLink to="/officer/drives">Back to drives</BackLink>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{d.company?.name} &mdash; {d.role}</h1>
          <p className="mt-1 text-sm text-ink-soft">Drive date: {fmtDate(d.date)}</p>
        </div>
        <Pill tone={isOpen(d) ? "ok" : "neutral"}>{isOpen(d) ? "Open" : "Closed"}</Pill>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Fact label="Company">{d.company?.name}</Fact>
        <Fact label="Job role">{d.role}</Fact>
        <Fact label="Minimum CGPA">{(e.minCgpa ?? 0).toFixed(2)}</Fact>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <BtnLink to={`/officer/drives/edit/${id}`}><Pencil size={14} aria-hidden="true" /> Edit drive</BtnLink>
        <Btn variant="dangerOutline" onClick={remove}><Trash2 size={14} aria-hidden="true" /> Delete drive</Btn>
        <BtnLink variant="outline" to={`/officer/drives/${id}/applicants`}>Manage applicants ({d.registeredCount})</BtnLink>
      </div>
      <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>

      <Panel className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Line label="Registration deadline">{fmtDate(d.deadline, "Not set")}</Line>
        <Line label="Max backlogs">{e.maxBacklogs ?? 0}</Line>
        <Line label="Eligible departments">{e.departments?.length ? e.departments.join(", ") : "All departments"}</Line>
        <Line label="Package">{d.package || "Not provided"}</Line>
        <Line label="Location">{d.location || "Not provided"}</Line>
        <Line label="Rounds">{d.rounds?.length ? d.rounds.join(" \u2192 ") : "Not provided"}</Line>
        {d.description && <div className="sm:col-span-2 lg:col-span-3"><Line label="Description">{d.description}</Line></div>}
      </Panel>
    </>
  );
}
