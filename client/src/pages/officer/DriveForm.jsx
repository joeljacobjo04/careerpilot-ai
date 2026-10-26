import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Briefcase, GraduationCap, ListChecks, Users } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { ErrorBox, Field, Input, Select, Spinner, Textarea } from "../../components/ui";
import { Btn, OfficerHeader, Panel } from "../../components/officerUi";
import { ChipPicker, JOB_TYPES } from "../../components/filters";

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
// today as YYYY-MM-DD in the officer's own timezone (toISOString would give the UTC day)
const todayStr = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** A numbered block of the form */
const Section = ({ icon: Icon, title, subtitle, children }) => (
  <Panel className="!p-4 sm:!p-6">
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={18} aria-hidden="true" /></span>
      <div><h2 className="font-bold leading-tight">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}</div>
    </div>
    {children}
  </Panel>
);

/** Live "who will this reach" box */
function Reach({ count, audienceText }) {
  if (!count) return <div className="mt-5 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">Counting the students this drive is open to...</div>;
  const pct = count.total ? Math.round((count.eligible / count.total) * 100) : 0;
  return (
    <div className="mt-5 rounded-xl border border-brand/20 bg-brand-soft/50 p-4" role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm"><b className="text-2xl font-extrabold text-brand-dark">{count.eligible}</b> <span className="font-semibold">student{count.eligible === 1 ? "" : "s"}</span> can apply <span className="text-ink-soft">({audienceText})</span></p>
        <p className="text-xs font-semibold text-ink-soft">{pct}% of {count.total} students</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-bar transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
      {count.unsure > 0 && <p className="mt-2 text-xs text-ink-soft">{count.unsure} more student{count.unsure === 1 ? " has" : "s have"} an incomplete profile and will be asked to finish it to check their eligibility.</p>}
      {count.eligible === 0 && count.unsure === 0 && <p className="mt-2 text-xs font-semibold text-warn">Nobody matches these rules yet. Loosen the CGPA, backlog or audience rules.</p>}
    </div>
  );
}

function Form({ drive, companies, options }) {
  const nav = useNavigate();
  const editing = !!drive;
  const e = drive?.eligibility || {};
  const [form, setForm] = useState({
    company: drive?.company?._id || drive?.company || "", role: drive?.role || "", title: drive?.title || "",
    date: day(drive?.date), deadline: day(drive?.deadline), status: drive?.status || "upcoming",
    minCgpa: e.minCgpa ?? 6, maxBacklogs: e.maxBacklogs ?? 0,
    departments: e.departments || [], batches: e.batches || [],
    package: drive?.package || "", jobType: drive?.jobType || "full_time", location: drive?.location || "", rounds: (drive?.rounds || []).join(", "),
    description: drive?.description || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(null);
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });
  // The choices come from the officer's Dropdown lists. A new one typed here is saved to those lists too,
  // so students can pick it in their profile as well.
  const [opts, setOpts] = useState(options);
  const LIST_TYPE = { departments: "department", batches: "batch" };
  const setList = (k) => async (next) => {
    const tidy = (v) => v.trim().replace(/\s+/g, " ");
    const known = opts[k];
    // reuse the spelling already in the list ("cse" -> "CSE") and drop duplicates
    const chosen = [...new Map(next.map((v) => [tidy(v).toLowerCase(), known.find((o) => o.toLowerCase() === tidy(v).toLowerCase()) || tidy(v)])).values()].filter(Boolean);
    const fresh = chosen.filter((v) => !known.includes(v));
    if (fresh.length) {
      try {
        await api.post("/officer/lists", { type: LIST_TYPE[k], values: fresh });
        setOpts((o) => ({ ...o, [k]: [...o[k], ...fresh] }));
      } catch (x) { setErr(errMsg(x)); return; }
    }
    setForm((f) => ({ ...f, [k]: chosen }));
  };
  const today = todayStr();
  // Calendars grey out every day before today. An old drive keeps its already-saved past date until the officer picks a new one.
  const minFor = (k) => { const saved = day(drive?.[k]); return saved && saved < today && form[k] === saved ? saved : today; };

  // how many students the rules reach (recounted a moment after any change)
  const rulesKey = JSON.stringify([form.minCgpa, form.maxBacklogs, form.departments, form.batches]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api.post("/officer/eligible-count", {
        minCgpa: Number(form.minCgpa) || 0, maxBacklogs: Number(form.maxBacklogs) || 0,
        departments: form.departments, batches: form.batches,
      }).then((r) => live && setCount(r.data)).catch(() => live && setCount(null));
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesKey]);

  const audienceText = [
    form.departments.length ? form.departments.join(", ") : "all departments",
    form.batches.length ? `batch ${form.batches.join(", ")}` : "all batches",
  ].join(" \u00b7 ");

  async function save(ev) {
    ev.preventDefault();
    setErr("");
    if (form.date && form.date < minFor("date")) return setErr("Drive date cannot be in the past.");
    if (form.deadline && form.deadline < minFor("deadline")) return setErr("Registration deadline cannot be in the past.");
    setBusy(true);
    const companyName = companies.find((c) => c._id === form.company)?.name || "";
    const body = {
      company: form.company, role: form.role, package: form.package, jobType: form.jobType, location: form.location, description: form.description,
      // the list shows "Company - Role", so the stored title just defaults to that
      title: form.title.trim() || `${companyName} \u2014 ${form.role}`,
      date: form.date || undefined, deadline: form.deadline || undefined, status: form.status, rounds: csv(form.rounds),
      eligibility: { minCgpa: Number(form.minCgpa), maxBacklogs: Number(form.maxBacklogs), departments: form.departments, batches: form.batches },
    };
    try {
      const res = editing ? await api.put(`/drives/${drive._id}`, body) : await api.post("/drives", body);
      const n = res.data.notified;
      const flash = editing ? null
        : n === null ? { tone: "warn", text: "Drive created, but the student notifications could not be sent. Check the server log." }
        : n === 0 ? { tone: "warn", text: "Drive created, but no students were notified: no student profiles match its eligibility yet." }
        : { tone: "ok", text: `Drive created. ${n} student${n === 1 ? "" : "s"} notified.` };
      nav(`/officer/drives/${res.data._id}`, { state: flash ? { flash } : undefined });
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <OfficerHeader center title={editing ? "Edit drive" : "Create new drive"} subtitle={editing ? "Update this placement drive." : "Set up the drive, choose who can apply, and the right students are notified automatically."} />
      <form onSubmit={save} className="space-y-5">
        <Section icon={Briefcase} title="Drive details" subtitle="What the opening is and where.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <Select required value={form.company} onChange={set("company")}>
                <option value="">Choose a company</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Job role"><Input required placeholder="e.g. Software Engineer" value={form.role} onChange={set("role")} /></Field>
            <Field label="Job type">
              <Select value={form.jobType} onChange={set("jobType")}>{JOB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Package" hint="Use LPA so package filters work, e.g. 6-9 LPA."><Input placeholder="e.g. 6-9 LPA" value={form.package} onChange={set("package")} /></Field>
            <Field label="Location"><Input placeholder="e.g. Bengaluru" value={form.location} onChange={set("location")} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={set("status")}>
                <option value="upcoming">Open &ndash; upcoming</option><option value="ongoing">Open &ndash; ongoing</option><option value="completed">Closed</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section icon={CalendarDays} title="Dates" subtitle="Students can register until the deadline.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registration deadline"><Input type="date" min={minFor("deadline")} value={form.deadline} onChange={set("deadline")} /></Field>
            <Field label="Drive date"><Input type="date" min={minFor("date")} value={form.date} onChange={set("date")} /></Field>
          </div>
        </Section>

        <Section icon={Users} title="Who can apply" subtitle="Leave a group empty to include everyone. Only matching students are notified and can register.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum CGPA"><Input type="number" step="0.1" min="0" max="10" value={form.minCgpa} onChange={set("minCgpa")} /></Field>
            <Field label="Max backlogs allowed"><Input type="number" min="0" value={form.maxBacklogs} onChange={set("maxBacklogs")} /></Field>
          </div>
          <div className="mt-5 space-y-5">
            <ChipPicker label="Departments" options={opts.departments} values={form.departments} onChange={setList("departments")} allowCustom placeholder="Add a department" emptyText="No departments yet. Type one below." />
            <ChipPicker label="Batches (graduation year)" options={opts.batches} values={form.batches} onChange={setList("batches")} allowCustom placeholder="e.g. 2026" emptyText="No batches yet. Type one below." />
            <p className="text-xs text-ink-soft">The choices above are your <Link to="/officer/lists" className="font-semibold text-brand hover:underline">Dropdown lists</Link>. Anything you add here is saved to them, so students can pick it in their profile too.</p>
          </div>
          <Reach count={count} audienceText={audienceText} />
        </Section>

        <Section icon={ListChecks} title="Rounds & description" subtitle="Optional, but it helps students prepare.">
          <div className="grid gap-4">
            <Field label="Rounds (comma separated)"><Input placeholder="Online test, Technical, HR" value={form.rounds} onChange={set("rounds")} /></Field>
            <Field label="Description"><Textarea rows={4} placeholder="About the drive..." value={form.description} onChange={set("description")} /></Field>
            <Field label="Drive title (optional)" hint="Leave blank to use Company — Role."><Input value={form.title} onChange={set("title")} /></Field>
          </div>
        </Section>

        <ErrorBox>{err}</ErrorBox>
        <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
          <Btn type="button" variant="outline" onClick={() => nav(editing ? `/officer/drives/${drive._id}` : "/officer/drives")}>Cancel</Btn>
          <Btn type="submit" variant={editing ? "bright" : "dark"} disabled={busy} className="min-w-44"><GraduationCap size={15} aria-hidden="true" /> {busy ? "Saving..." : editing ? "Update drive" : "Create & notify students"}</Btn>
        </div>
      </form>
    </div>
  );
}

export default function DriveForm() {
  const { id } = useParams();
  const drive = useApi(`/drives/${id}`, { skip: !id });
  const companies = useApi("/companies");
  const options = useApi("/officer/options");
  if (companies.loading || options.loading || (id && drive.loading)) return <Spinner />;
  if (companies.error || drive.error) return <ErrorBox>{companies.error || drive.error}</ErrorBox>;
  return <Form drive={id ? drive.data : null} companies={companies.data || []} options={options.data || { departments: [], batches: [] }} />;
}
