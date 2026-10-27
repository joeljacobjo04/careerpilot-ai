import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import api, { errMsg } from "../api/client";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { Avatar, Badge, Bar, Button, Card, Empty, ErrorBox, Field, Input, Select, Spinner, Tabs, Textarea } from "../components/ui";
import AvatarUpload from "../components/AvatarUpload";
import { useConfirm, useToast } from "../components/Feedback";

const TABS = ["Account", "Basics", "Experience", "Skills", "Projects", "Certifications", "Education", "Languages"];

const SECTIONS = {
  experience: {
    noun: "experience",
    fields: [
      { name: "role", label: "Role / position", required: true },
      { name: "company", label: "Company / organisation", required: true },
      { name: "location", label: "Location (optional)" },
      { name: "start", label: "Start (e.g. Aug 2025)", half: true },
      { name: "end", label: "End (e.g. Present)", half: true },
      { name: "description", label: "What did you do? (one point per line)", textarea: true },
    ],
    title: (i) => i.role,
    meta: (i) => [i.company, [i.start, i.end].filter(Boolean).join(" - ")].filter(Boolean).join(", "),
    body: (i) => i.description,
  },
  languages: {
    noun: "language",
    fields: [
      { name: "name", label: "Language", required: true },
      { name: "proficiency", label: "Proficiency", options: ["Native", "Professional", "Fluent", "Conversational", "Basic"], default: "Professional" },
    ],
    title: (i) => i.name,
    meta: (i) => i.proficiency,
  },
  skills: {
    noun: "skill",
    fields: [
      { name: "name", label: "Skill", required: true },
      { name: "level", label: "Level", options: ["Beginner", "Intermediate", "Advanced"], default: "Intermediate" },
    ],
    title: (i) => i.name,
    meta: (i) => i.level,
  },
  projects: {
    noun: "project",
    fields: [
      { name: "title", label: "Project title", required: true },
      { name: "description", label: "What does it do? What did you build?", textarea: true },
      { name: "techStack", label: "Tech stack (comma separated)", list: true },
      { name: "link", label: "Link (GitHub or live URL)" },
    ],
    title: (i) => i.title,
    meta: (i) => (i.techStack || []).join(", "),
    body: (i) => i.description,
  },
  certifications: {
    noun: "certification",
    fields: [
      { name: "title", label: "Certification", required: true },
      { name: "issuer", label: "Issued by" },
      { name: "date", label: "Year" },
      { name: "url", label: "Credential URL" },
    ],
    title: (i) => i.title,
    meta: (i) => [i.issuer, i.date].filter(Boolean).join(", "),
  },
  education: {
    noun: "education",
    fields: [
      { name: "degree", label: "Degree", required: true },
      { name: "institution", label: "Institution", required: true },
      { name: "year", label: "Years (e.g. 2022-2026)", half: true },
      { name: "score", label: "CGPA or percentage", half: true },
    ],
    title: (i) => i.degree,
    meta: (i) => [i.institution, i.year, i.score].filter(Boolean).join(", "),
  },
};

const blankFor = (cfg) => Object.fromEntries(cfg.fields.map((f) => [f.name, f.default || ""]));
// the form holds text, so list fields (tech stack) are shown comma separated while editing
const toForm = (cfg, item) => Object.fromEntries(cfg.fields.map((f) => [f.name, f.list ? (item[f.name] || []).join(", ") : item[f.name] ?? f.default ?? ""]));

/**
 * Form on the left, list on the right. The form keeps a fixed size (long text boxes scroll inside themselves),
 * and only the list of added items scrolls, so the page itself never grows as entries are added.
 */
function SectionEditor({ section, items, onChange }) {
  const cfg = SECTIONS[section];
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState(blankFor(cfg));
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  function reset() { setForm(blankFor(cfg)); setEditingId(null); setError(""); }

  function startEdit(item) {
    setForm(toForm(cfg, item));
    setEditingId(item._id);
    setError("");
    document.getElementById("section-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const body = { ...form };
    cfg.fields.filter((f) => f.list).forEach((f) => { body[f.name] = form[f.name].split(",").map((x) => x.trim()).filter(Boolean); });
    try {
      const { data } = editingId
        ? await api.put(`/profile/${section}/${editingId}`, body)
        : await api.post(`/profile/${section}`, body);
      onChange(data);
      toast(editingId ? "Changes saved" : `Added ${cfg.noun}`);
      reset();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(item) {
    const ok = await confirm({
      title: `Remove "${cfg.title(item)}"?`,
      message: "This will be taken off your profile and your resume. You can add it again later.",
      confirmText: "Remove", tone: "danger",
    });
    if (!ok) return;
    try {
      onChange((await api.delete(`/profile/${section}/${item._id}`)).data);
      if (editingId === item._id) reset();
      toast("Removed");
    } catch (err) { toast(errMsg(err), "error"); }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card id="section-form" className="lg:sticky lg:top-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-bold">{editingId ? `Edit ${cfg.noun}` : `Add ${cfg.noun}`}</h2>
          {editingId && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
              <X size={13} aria-hidden="true" /> Cancel
            </button>
          )}
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          {cfg.fields.map((f) => (
            <Field key={f.name} label={f.label} className={f.half ? "col-span-1" : "col-span-2"}>
              {f.options ? (
                <Select value={form[f.name]} onChange={set(f.name)}>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
              ) : f.textarea ? (
                // fixed height: the text scrolls inside the box instead of stretching the page
                <Textarea rows={4} className="!min-h-0 h-28 resize-none thin-scroll" value={form[f.name]} onChange={set(f.name)} />
              ) : (
                <Input required={f.required} value={form[f.name]} onChange={set(f.name)} />
              )}
            </Field>
          ))}
          {error && <div className="col-span-2"><ErrorBox>{error}</ErrorBox></div>}
          <div className="col-span-2 flex gap-2 pt-1">
            <Button disabled={busy} className="flex-1">
              {editingId ? <><Pencil size={14} aria-hidden="true" /> {busy ? "Saving..." : "Save changes"}</> : <><Plus size={15} aria-hidden="true" /> {busy ? "Adding..." : "Add"}</>}
            </Button>
            {editingId && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-bold">Your {section}</h2>
          <Badge tone="brand">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <div className="p-5"><Empty>Nothing here yet. Add your first entry using the form.</Empty></div>
        ) : (
          // only this list scrolls
          <ul className="thin-scroll max-h-[28rem] divide-y divide-line overflow-y-auto lg:max-h-[calc(100vh-17rem)]">
            {items.map((i) => (
              <li key={i._id} className={`flex items-start justify-between gap-3 px-5 py-4 transition ${editingId === i._id ? "bg-brand-soft/50" : "hover:bg-mint"}`}>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{cfg.title(i)}</p>
                  {cfg.meta(i) && <p className="mt-0.5 text-sm text-ink-soft">{cfg.meta(i)}</p>}
                  {cfg.body?.(i) && <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-sm">{cfg.body(i)}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(i)} aria-label={`Edit ${cfg.title(i)}`} title="Edit"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-brand-soft hover:text-brand"><Pencil size={15} aria-hidden="true" /></button>
                  <button onClick={() => remove(i)} aria-label={`Remove ${cfg.title(i)}`} title="Remove"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-bad-soft hover:text-bad"><Trash2 size={15} aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PasswordInput({ label, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <Input type={show ? "text" : "password"} className="!pr-11" {...props} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft hover:text-ink">
          {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

/** Permanently delete the signed-in student's own account (needs their password). */
function DeleteAccount() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const ok = await confirm({
      title: "Delete your account permanently?",
      message: "Your profile, resumes, interview and aptitude history and applications will be erased. This cannot be undone.",
      confirmText: "Delete my account", tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete("/account", { data: { password } });
      logout();
      toast("Your account has been deleted. We sent a confirmation to your email.");
      navigate("/", { replace: true });
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <Card className="border-bad/30">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-bad"><Trash2 size={16} aria-hidden="true" /> Delete account</h2>
      <p className="mb-4 text-xs text-ink-soft">Permanently removes your account and all your data. You will get a confirmation by email and SMS.</p>
      {!open ? (
        <Button type="button" variant="dangerGhost" onClick={() => setOpen(true)}>Delete my account</Button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <PasswordInput label="Enter your password to confirm" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <ErrorBox>{err}</ErrorBox>}
          <div className="flex gap-2">
            <Button variant="danger" disabled={busy || !password}>{busy ? "Deleting..." : "Delete permanently"}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setPassword(""); setErr(""); }}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Account({ profile }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: profile.phone || "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = form.name !== user.name || form.phone !== (profile.phone || "");

  const blank = { currentPassword: "", newPassword: "", confirm: "" };
  const [pw, setPw] = useState(blank);
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function saveDetails(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { data } = await api.put("/account", { name: form.name, phone: form.phone });
      setForm({ name: data.name, phone: data.phone });
      await refresh();
      toast("Account details saved");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwErr("");
    if (pw.newPassword !== pw.confirm) return setPwErr("New password and confirmation do not match");
    setPwBusy(true);
    try {
      await api.put("/account/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw(blank);
      toast("Password updated");
    } catch (x) { setPwErr(errMsg(x)); } finally { setPwBusy(false); }
  }

  const strength = pw.newPassword.length >= 12 ? 3 : pw.newPassword.length >= 10 ? 2 : pw.newPassword.length >= 8 ? 1 : 0;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Card>
          <h2 className="mb-4 font-bold">Profile picture</h2>
          <AvatarUpload size={88} />
        </Card>
        <Card>
          <h2 className="mb-4 font-bold">Personal details</h2>
          <form onSubmit={saveDetails} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Mobile number" hint="Used for SMS alerts."><Input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" /></Field>
            <Field label="Email" hint="Your email is your sign-in ID and can't be changed here." className="sm:col-span-2"><Input value={user.email} disabled readOnly /></Field>
            {err && <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox></div>}
            <div className="flex gap-2 sm:col-span-2">
              <Button disabled={busy || !dirty}>{busy ? "Saving..." : "Save changes"}</Button>
              <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setForm({ name: user.name, phone: profile.phone || "" })}>Reset</Button>
            </div>
          </form>
        </Card>
      </div>

      <div className="space-y-5">
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck size={16} className="text-brand" aria-hidden="true" /> Change password</h2>
        <p className="mb-4 text-xs text-ink-soft">Use at least 8 characters. A longer one is stronger.</p>
        <form onSubmit={savePassword} className="space-y-4">
          <PasswordInput label="Current password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <div>
            <PasswordInput label="New password" autoComplete="new-password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            {pw.newPassword && (
              <div className="mt-2 flex items-center gap-2" aria-hidden="true">
                {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${strength >= n ? (strength === 1 ? "bg-warn" : "bg-ok") : "bg-line"}`} />)}
                <span className="w-14 text-right text-[11px] font-semibold text-ink-soft">{["Too short", "Okay", "Good", "Strong"][strength]}</span>
              </div>
            )}
          </div>
          <PasswordInput label="Confirm new password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          {pwErr && <ErrorBox>{pwErr}</ErrorBox>}
          <Button disabled={pwBusy} className="w-full">{pwBusy ? "Updating..." : "Update password"}</Button>
        </form>
      </Card>
        <DeleteAccount />
      </div>
    </div>
  );
}

/**
 * Drop-down for department, programme and batch. The choices are the ones the placement officer maintains,
 * so students cannot type their own spelling. A value saved before this existed stays selectable.
 */
function OptionSelect({ label, noun, one, value, options, onChange, hint, emptyHint, emptyLabel, className }) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  const empty = list.length === 0;
  return (
    <Field label={label} className={className}
      hint={empty ? emptyHint || `Your placement officer has not added any ${noun} yet. Check back soon.` : hint}>
      <Select value={value} onChange={onChange} disabled={empty}>
        <option value="">{empty ? emptyLabel || `No ${noun} available yet` : `Select ${one}`}</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    </Field>
  );
}

function Basics({ profile, onChange }) {
  const lists = useApi("/profile/options");
  if (lists.loading && !lists.data) return <Spinner />;
  if (lists.error) return <ErrorBox>{lists.error}</ErrorBox>;
  return <BasicsForm profile={profile} onChange={onChange} lists={lists.data || {}} />;
}

// Declared outside BasicsForm on purpose: a component created inside another one is rebuilt on every keystroke,
// which makes the text boxes lose focus after each character.
const Group = ({ title, children }) => (
  <fieldset className="grid gap-4 sm:grid-cols-2">
    <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">{title}</legend>
    {children}
  </fieldset>
);

function BasicsForm({ profile, onChange, lists }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    rollNo: profile.rollNo || "", department: profile.department || "", program: profile.program || "", batch: profile.batch || "",
    cgpa: profile.cgpa ?? "", backlogs: profile.backlogs ?? 0,
    headline: profile.headline || "", location: profile.location || "",
    github: profile.links?.github || "", linkedin: profile.links?.linkedin || "", portfolio: profile.links?.portfolio || "",
    targetRole: profile.targetRole || "", interests: (profile.interests || []).join(", "),
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Programmes belong to a department: a student sees their own department's programmes plus any open to everyone.
  const programsFor = (department) => (department
    ? [...new Set([...((lists.programsByDepartment || {})[department] || []), ...(lists.generalPrograms || [])])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []);
  // changing department drops a programme that does not exist in the new one
  const setDepartment = (e) => {
    const department = e.target.value;
    setForm((f) => ({ ...f, department, program: programsFor(department).includes(f.program) ? f.program : "" }));
  };
  const programOptions = programsFor(form.department);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { data } = await api.put("/profile", {
        rollNo: form.rollNo, department: form.department, program: form.program, batch: form.batch,
        headline: form.headline, location: form.location,
        cgpa: form.cgpa === "" ? undefined : Number(form.cgpa), backlogs: Number(form.backlogs) || 0,
        links: { github: form.github, linkedin: form.linkedin, portfolio: form.portfolio },
        targetRole: form.targetRole, interests: form.interests.split(",").map((x) => x.trim()).filter(Boolean),
      });
      onChange(data);
      refresh();
      toast("Profile saved");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-7">
        <Group title="Academics">
          <Field label="Roll number"><Input value={form.rollNo} onChange={set("rollNo")} /></Field>
          <OptionSelect label="Department" noun="departments" one="department" value={form.department} options={lists.departments || []} onChange={setDepartment} />
          <OptionSelect label="Programme / degree" noun="programmes" one="programme" value={form.program} options={programOptions} onChange={set("program")}
            hint="Only your department's programmes are listed."
            emptyLabel={form.department ? "No programmes available yet" : "Choose your department first"}
            emptyHint={form.department ? `No programmes have been added for ${form.department} yet. Check back soon.` : "Pick your department above, then choose your programme."} />
          <OptionSelect label="Batch (graduation year)" noun="batches" one="batch" value={form.batch} options={lists.batches || []} onChange={set("batch")} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="CGPA (0-10)"><Input type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={set("cgpa")} /></Field>
            <Field label="Active backlogs"><Input type="number" min="0" value={form.backlogs} onChange={set("backlogs")} /></Field>
          </div>
        </Group>
        <Group title="Resume header">
          <Field label="Professional title" hint="Shown under your name on the resume."><Input value={form.headline} onChange={set("headline")} placeholder="UI/UX Designer" /></Field>
          <Field label="Location" hint="City, state, country."><Input value={form.location} onChange={set("location")} placeholder="Kochi, Kerala, India" /></Field>
        </Group>
        <Group title="Links">
          <Field label="GitHub URL"><Input value={form.github} onChange={set("github")} /></Field>
          <Field label="LinkedIn URL"><Input value={form.linkedin} onChange={set("linkedin")} /></Field>
          <Field label="Portfolio URL" className="sm:col-span-2"><Input value={form.portfolio} onChange={set("portfolio")} /></Field>
        </Group>
        <Group title="Career goals">
          <Field label="Target job role" hint="Used for skill gap and readiness."><Input value={form.targetRole} onChange={set("targetRole")} placeholder="Full Stack Developer" /></Field>
          <Field label="Interests (comma separated)"><Input value={form.interests} onChange={set("interests")} placeholder="Web development, AI, open source" /></Field>
        </Group>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button>
      </form>
    </Card>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("Account");
  const [error, setError] = useState("");

  useEffect(() => { api.get("/profile").then((r) => setState(r.data)).catch((e) => setError(errMsg(e))); }, []);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!state) return <Spinner />;
  const { profile, completeness } = state;

  const counts = { Experience: profile.experience?.length, Skills: profile.skills?.length, Projects: profile.projects?.length, Certifications: profile.certifications?.length, Education: profile.education?.length, Languages: profile.languages?.length };

  return (
    <>
      <Card className="mb-5 !p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} src={user.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight md:text-2xl">{user.name}</h1>
            <p className="truncate text-sm text-ink-soft">{[profile.headline, profile.department, user.email].filter(Boolean).join(" \u00b7 ")}</p>
          </div>
          <div className="w-full sm:w-64">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold">Profile completeness</span>
              <Badge tone={completeness >= 80 ? "ok" : "warn"}>{completeness}%</Badge>
            </div>
            <Bar value={completeness} color="var(--color-bar)" />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">Your resume, skill gap analysis and interview questions are all built from this profile.</p>
      </Card>

      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={TABS.map((t) => [t, t, counts[t]])} />

      {tab === "Account" ? (
        <Account profile={profile} />
      ) : tab === "Basics" ? (
        <Basics profile={profile} onChange={setState} />
      ) : (
        <SectionEditor key={tab} section={tab.toLowerCase()} items={profile[tab.toLowerCase()] || []} onChange={setState} />
      )}
    </>
  );
}
