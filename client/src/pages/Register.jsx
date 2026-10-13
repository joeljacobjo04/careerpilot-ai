import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input, Select } from "../components/ui";
import { AuthShell } from "./Login";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "student", inviteCode: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = { ...form };
      if (form.role !== "officer") delete payload.inviteCode;
      const user = await register(payload);
      nav(user.role === "officer" ? "/officer" : "/profile");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="It takes under a minute.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input required value={form.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Email"><Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></Field>
        <Field label="Mobile number" hint="10 digits, or start with + and your country code. We use it for placement alerts by SMS; you can turn that off any time.">
          <Input type="tel" required value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="98765 43210" />
        </Field>
        <Field label="Password" hint="At least 8 characters."><Input type="password" required minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" /></Field>
        <Field label="I am a">
          <Select value={form.role} onChange={set("role")}>
            <option value="student">Student</option>
            <option value="officer">Placement officer</option>
          </Select>
        </Field>
        {form.role === "officer" && (
          <Field label="Officer invite code" hint="Ask your institution's admin.">
            <Input required value={form.inviteCode} onChange={set("inviteCode")} />
          </Field>
        )}
        <ErrorBox>{error}</ErrorBox>
        <Button className="w-full" disabled={busy}>{busy ? "Creating..." : "Create account"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </AuthShell>
  );
}
