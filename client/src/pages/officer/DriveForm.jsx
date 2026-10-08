import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Field, Input, Select, Spinner, Textarea } from "../../components/ui";
import { Btn, OfficerHeader, Panel } from "../../components/officerUi";

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

function Form({ drive, companies }) {
  const nav = useNavigate();
  const editing = !!drive;
  const e = drive?.eligibility || {};
  const [form, setForm] = useState({
    company: drive?.company?._id || drive?.company || "", role: drive?.role || "", title: drive?.title || "",
    date: day(drive?.date), deadline: day(drive?.deadline), status: drive?.status || "upcoming",
    minCgpa: e.minCgpa ?? 6, maxBacklogs: e.maxBacklogs ?? 0, departments: (e.departments || []).join(", "),
    package: drive?.package || "", location: drive?.location || "", rounds: (drive?.rounds || []).join(", "),
    description: drive?.description || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });

  async function save(ev) {
    ev.preventDefault();
    setErr(""); setBusy(true);
    const companyName = companies.find((c) => c._id === form.company)?.name || "";
    const body = {
      company: form.company, role: form.role, package: form.package, location: form.location, description: form.description,
      // the list shows "Company - Role", so the stored title just defaults to that
      title: form.title.trim() || `${companyName} \u2014 ${form.role}`,
      date: form.date || undefined, deadline: form.deadline || undefined, status: form.status, rounds: csv(form.rounds),
      eligibility: { minCgpa: Number(form.minCgpa), maxBacklogs: Number(form.maxBacklogs), departments: csv(form.departments) },
    };
    try {
      const res = editing ? await api.put(`/drives/${drive._id}`, body) : await api.post("/drives", body);
      nav(`/officer/drives/${res.data._id}`);
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <OfficerHeader center title={editing ? "Edit drive" : "Create new drive"} subtitle={editing ? "Update this placement drive." : "Set up a placement drive with its eligibility rules."} />
      <Panel className="!p-7 shadow-[0_18px_40px_-24px_rgba(16,40,28,.35)]">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Company">
            <Select required value={form.company} onChange={set("company")}>
              <option value="">Choose a company</option>
              {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Job role"><Input required placeholder="e.g. Software Engineer" value={form.role} onChange={set("role")} /></Field>
          <Field label="Drive date"><Input type="date" value={form.date} onChange={set("date")} /></Field>
          <Field label="Registration deadline"><Input type="date" value={form.deadline} onChange={set("deadline")} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option value="upcoming">Open &ndash; upcoming</option><option value="ongoing">Open &ndash; ongoing</option><option value="completed">Closed</option>
            </Select>
          </Field>
          <Field label="Minimum CGPA"><Input type="number" step="0.1" min="0" max="10" value={form.minCgpa} onChange={set("minCgpa")} /></Field>
          <Field label="Max backlogs"><Input type="number" min="0" value={form.maxBacklogs} onChange={set("maxBacklogs")} /></Field>
          <Field label="Eligible departments" hint="Comma separated. Leave empty for all."><Input placeholder="Computer Science, Data Science" value={form.departments} onChange={set("departments")} /></Field>
          <Field label="Package"><Input placeholder="e.g. 6-9 LPA" value={form.package} onChange={set("package")} /></Field>
          <Field label="Location"><Input placeholder="e.g. Bengaluru" value={form.location} onChange={set("location")} /></Field>
          <Field label="Rounds (comma separated)" className="sm:col-span-2"><Input placeholder="Online test, Technical, HR" value={form.rounds} onChange={set("rounds")} /></Field>
          <Field label="Drive title (optional)" hint="Leave blank to use Company — Role." className="sm:col-span-2"><Input value={form.title} onChange={set("title")} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={3} placeholder="About the drive..." value={form.description} onChange={set("description")} /></Field>

          <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox></div>
          <div className="flex justify-center gap-3 border-t border-line pt-5 sm:col-span-2">
            <Btn type="submit" variant={editing ? "bright" : "dark"} disabled={busy}>{busy ? "Saving..." : editing ? "Update drive" : "Create drive"}</Btn>
            <Btn type="button" variant="outline" onClick={() => nav(editing ? `/officer/drives/${drive._id}` : "/officer/drives")}>Cancel</Btn>
          </div>
        </form>
      </Panel>
    </div>
  );
}

export default function DriveForm() {
  const { id } = useParams();
  const drive = useApi(`/drives/${id}`, { skip: !id });
  const companies = useApi("/companies");
  if (companies.loading || (id && drive.loading)) return <Spinner />;
  if (companies.error || drive.error) return <ErrorBox>{companies.error || drive.error}</ErrorBox>;
  return <Form drive={id ? drive.data : null} companies={companies.data || []} />;
}
