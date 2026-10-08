import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Building2, ShieldCheck } from "lucide-react";
import api, { errMsg } from "../../api/client";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { ErrorBox, Field, Input, Spinner, Textarea } from "../../components/ui";
import { Btn, OfficerHeader, Panel, Pill } from "../../components/officerUi";

const Banner = ({ ok }) => ok
  ? <p role="status" className="mb-4 rounded-lg border border-ok/30 bg-ok-soft px-4 py-2.5 text-sm font-semibold text-ok">{ok}</p>
  : null;

const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Details({ profile, onSaved }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: profile.name, designation: profile.designation, phone: profile.phone,
    institution: profile.institution, officeLocation: profile.officeLocation, bio: profile.bio,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const dirty = Object.keys(form).some((k) => form[k] !== profile[k]);

  async function save(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await api.put("/officer/profile", form);
      await refresh(); // updates the name shown in the sidebar
      onSaved(res.data);
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  return (
    <Panel>
      <h2 className="mb-4 font-bold">Personal details</h2>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input required value={form.name} onChange={set("name")} /></Field>
        <Field label="Designation"><Input placeholder="e.g. Training & Placement Officer" value={form.designation} onChange={set("designation")} /></Field>
        <Field label="Phone"><Input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Office location"><Input placeholder="e.g. Admin Block, Room 204" value={form.officeLocation} onChange={set("officeLocation")} /></Field>
        <Field label="Institution" className="sm:col-span-2"><Input placeholder="e.g. College of Engineering" value={form.institution} onChange={set("institution")} /></Field>
        <Field label="About" hint={`${form.bio.length}/500`} className="sm:col-span-2">
          <Textarea rows={3} maxLength={500} placeholder="A short note about your role..." value={form.bio} onChange={set("bio")} />
        </Field>
        <div className="sm:col-span-2"><ErrorBox>{err}</ErrorBox></div>
        <div className="flex gap-3 sm:col-span-2">
          <Btn type="submit" disabled={busy || !dirty}>{busy ? "Saving..." : "Save changes"}</Btn>
          <Btn type="button" variant="outline" disabled={!dirty} onClick={() => setForm({ name: profile.name, designation: profile.designation, phone: profile.phone, institution: profile.institution, officeLocation: profile.officeLocation, bio: profile.bio })}>Reset</Btn>
        </div>
      </form>
    </Panel>
  );
}

function Password({ onDone }) {
  const blank = { currentPassword: "", newPassword: "", confirm: "" };
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setErr("");
    if (form.newPassword !== form.confirm) return setErr("New password and confirmation do not match");
    setBusy(true);
    try {
      await api.put("/officer/password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(blank); onDone("Password updated.");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  return (
    <Panel>
      <h2 className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck size={16} className="text-brand" aria-hidden="true" /> Change password</h2>
      <p className="mb-4 text-xs text-ink-soft">Use at least 8 characters.</p>
      <form onSubmit={save} className="space-y-4">
        <Field label="Current password"><Input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set("currentPassword")} /></Field>
        <Field label="New password"><Input type="password" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={set("newPassword")} /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <Btn type="submit" disabled={busy}>{busy ? "Updating..." : "Update password"}</Btn>
      </form>
    </Panel>
  );
}

export default function OfficerProfile() {
  const { data, loading, error, setData } = useApi("/officer/profile");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(""), 3500);
    return () => clearTimeout(t);
  }, [ok]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const p = data;
  const meta = [[Mail, p.email], [Phone, p.phone], [Building2, p.institution], [MapPin, p.officeLocation]].filter(([, v]) => v);

  return (
    <>
      <Banner ok={ok} />
      <OfficerHeader title="My profile" subtitle="Manage your account details and security." />

      <Panel className="mb-5 flex flex-wrap items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-side-active text-xl font-bold text-side-ink">{initials(p.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{p.name}</h2>
            <Pill tone="ok">Placement officer</Pill>
          </div>
          <p className="text-sm text-ink-soft">{p.designation || "Designation not set"}</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            {meta.map(([Icon, v]) => <li key={v} className="flex items-center gap-1.5"><Icon size={13} aria-hidden="true" />{v}</li>)}
          </ul>
        </div>
        <p className="text-xs text-ink-soft">Member since {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Details profile={p} onSaved={(next) => { setData(next); setOk("Profile updated."); }} />
        <div className="space-y-5">
          <Panel>
            <h2 className="mb-1 font-bold">Account email</h2>
            <p className="break-all text-sm">{p.email}</p>
            <p className="mt-2 text-xs text-ink-soft">Your email is your sign-in ID and can't be changed here.</p>
          </Panel>
          <Password onDone={setOk} />
        </div>
      </div>
    </>
  );
}