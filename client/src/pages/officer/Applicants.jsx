import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Select, Spinner } from "../../components/ui";
import { APPLICANT_STATUSES, Btn, BtnLink, OfficerHeader, Panel, Pill, fmtDate, statusLabel } from "../../components/officerUi";

const TONE = { registered: "neutral", shortlisted: "warn", selected: "ok", rejected: "bad" };
const TH = "pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft";

function Row({ r, onSave }) {
  const [next, setNext] = useState(r.status);
  useEffect(() => setNext(r.status), [r.status]); // follow the saved status after a reload
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-3 font-semibold">{r.student?.name}</td>
      <td className="py-3 pr-3 text-ink-soft">{r.profile?.department || "-"}</td>
      <td className="py-3 pr-3">{r.profile?.cgpa != null ? Number(r.profile.cgpa).toFixed(2) : "-"}</td>
      <td className="py-3 pr-3"><Pill tone={TONE[r.status]}>{statusLabel(r.status)}</Pill></td>
      <td className="py-3">
        <div className="flex w-44 flex-col gap-2">
          <Select value={next} onChange={(e) => setNext(e.target.value)} aria-label={`Status for ${r.student?.name}`}>
            {APPLICANT_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </Select>
          <Btn className="w-fit" onClick={() => onSave(r.student._id, next)}>Update</Btn>
        </div>
      </td>
    </tr>
  );
}

export default function Applicants() {
  const { id } = useParams();
  const drive = useApi(`/drives/${id}`);
  const regs = useApi(`/drives/${id}/registrations`);
  const [flash, setFlash] = useState({ ok: "", err: "" });

  useEffect(() => {
    if (!flash.ok) return;
    const t = setTimeout(() => setFlash((f) => ({ ...f, ok: "" })), 3500);
    return () => clearTimeout(t);
  }, [flash.ok]);

  async function save(studentId, status) {
    setFlash({ ok: "", err: "" });
    try {
      await api.put(`/drives/${id}/registrations/${studentId}`, { status });
      await Promise.all([regs.reload(), drive.reload()]);
      setFlash({ ok: "Applicant status updated!", err: "" });
    } catch (e) { setFlash({ ok: "", err: errMsg(e) }); }
  }

  if (drive.loading && !drive.data) return <Spinner />;
  if (drive.error) return <ErrorBox>{drive.error}</ErrorBox>;
  const d = drive.data;
  const list = regs.data || [];

  return (
    <>
      {flash.ok && <p role="status" className="mb-4 rounded-lg border border-ok/30 bg-ok-soft px-4 py-2.5 text-sm font-semibold text-ok">{flash.ok}</p>}
      {flash.err && <div className="mb-4"><ErrorBox>{flash.err}</ErrorBox></div>}

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

      <Panel className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Applicants</h2>
          <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">{list.length} student(s)</span>
        </div>
        {regs.loading && !regs.data ? <Spinner /> : regs.error ? <ErrorBox>{regs.error}</ErrorBox> : !list.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">No students have applied to this drive yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line"><th className={TH}>Name</th><th className={TH}>Department</th><th className={TH}>CGPA</th><th className={TH}>Status</th><th className={TH}>Update status</th></tr></thead>
              <tbody>{list.map((r) => <Row key={r.student?._id} r={r} onSave={save} />)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
