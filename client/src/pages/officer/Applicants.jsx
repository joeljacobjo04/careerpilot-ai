import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, CheckCircle2, Search } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Input, Select, Spinner, Tabs } from "../../components/ui";
import { useConfirm, useToast } from "../../components/Feedback";
import { APPLICANT_STATUSES, Btn, BtnLink, OfficerHeader, Panel, Pill, fmtDate, statusLabel } from "../../components/officerUi";

const TONE = { registered: "neutral", shortlisted: "warn", selected: "ok", rejected: "bad" };
const TH = "pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft";

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
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

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

  const list = regs.data || [];
  const counts = useMemo(() => Object.fromEntries([["all", list.length], ...APPLICANT_STATUSES.map(([k]) => [k, list.filter((r) => r.status === k).length])]), [list]);
  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    return list.filter((r) => (tab === "all" || r.status === tab)
      && (!text || [r.student?.name, r.profile?.department, r.profile?.rollNo].some((v) => v?.toLowerCase().includes(text))));
  }, [list, tab, q]);

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

      <Panel className="mt-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={tab} onChange={setTab} tabs={[["all", "All", counts.all], ...APPLICANT_STATUSES.map(([k, label]) => [k, label, counts[k]])]} />
          <div className="relative w-full lg:w-64">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
            <Input className="!pl-10" placeholder="Search name or department" aria-label="Search applicants" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {regs.loading && !regs.data ? <Spinner /> : regs.error ? <ErrorBox>{regs.error}</ErrorBox> : !list.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">No students have applied to this drive yet.</p>
        ) : !shown.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">No applicants match this filter.</p>
        ) : (
          <>
            {/* desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b border-line"><th className={TH}>Name</th><th className={TH}>Department</th><th className={TH}>Phone</th><th className={TH}>CGPA</th><th className={TH}>Status</th><th className={TH}>Update status</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.student?._id} className={`border-b border-line transition-colors duration-700 last:border-0 ${updated[r.student?._id] ? "bg-ok-soft/60" : ""}`}>
                      <td className="py-3 pr-3 font-semibold">{r.student?.name}<span className="block text-xs font-normal text-ink-soft">{r.profile?.rollNo || r.student?.email}</span></td>
                      <td className="py-3 pr-3 text-ink-soft">{r.profile?.department || "-"}</td>
                      <td className="py-3 pr-3">{r.profile?.phone ? <a href={`tel:${r.profile.phone.replace(/\s/g, "")}`} className="font-semibold text-brand hover:underline">{r.profile.phone}</a> : <span className="text-ink-soft">-</span>}</td>
                      <td className="py-3 pr-3">{r.profile?.cgpa != null ? Number(r.profile.cgpa).toFixed(2) : "-"}</td>
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
                    <div className="min-w-0">
                      <p className="font-bold">{r.student?.name}</p>
                      <p className="truncate text-xs text-ink-soft">{[r.profile?.department, r.profile?.cgpa != null ? `CGPA ${Number(r.profile.cgpa).toFixed(2)}` : ""].filter(Boolean).join(" \u00b7 ") || "-"}</p>
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
      </Panel>
    </>
  );
}
