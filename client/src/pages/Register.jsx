import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input, PasswordInput, Select } from "../components/ui";
import { AuthShell } from "./Login";

const DEFAULT_RESEND = 60;

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "student", inviteCode: "" });
  const [step, setStep] = useState("details"); // "details" -> "verify"
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(null); // what the last code was sent for: { email, role, inviteCode, expiresAt }
  const [cooldown, setCooldown] = useState(0); // seconds until "Resend code" works again
  const [minutes, setMinutes] = useState(10); // how long the code works
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // counts the resend timer down once a second
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const email = form.email.trim();
  const inviteCode = form.role === "officer" ? form.inviteCode : "";

  // Step 1: email the code. (Also used by "Resend code".)
  async function sendCode(e, { force = false } = {}) {
    e?.preventDefault();
    setError("");
    // coming back from "Edit details" with the same email: the earlier code still works, so don't send another
    if (!force && sent && sent.email === email && sent.role === form.role && sent.inviteCode === inviteCode && Date.now() < sent.expiresAt) {
      setStep("verify");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register/send-otp", { email, role: form.role, ...(inviteCode ? { inviteCode } : {}) });
      const mins = data.expiresInMinutes || 10;
      setMinutes(mins);
      setSent({ email, role: form.role, inviteCode, expiresAt: Date.now() + mins * 60 * 1000 });
      setCooldown(data.resendIn || DEFAULT_RESEND);
      setOtp("");
      setStep("verify");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  // Step 2: the code and the form go to the server together; the account is created only if the code is right.
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = { ...form, email, otp };
      if (form.role !== "officer") delete payload.inviteCode;
      const user = await register(payload);
      nav(user.role === "officer" ? "/officer" : "/profile");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthShell title="Verify your email" subtitle="One last step before your account is created.">
        <form onSubmit={submit} className="cp-stagger space-y-4">
          <div className="flex gap-3 cp-card rounded-2xl p-4">
            <MailCheck className="mt-0.5 shrink-0 text-brand" size={22} aria-hidden="true" />
            <p className="text-sm leading-relaxed text-ink-soft">
              We sent a 6-digit code to <b className="break-all text-ink">{email}</b>. It works for {minutes} minutes. Check your spam folder if it does not show up.
            </p>
          </div>
          <Field label="Verification code">
            <Input
              required autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000"
              className="!text-center !text-2xl !font-bold !tracking-[0.5em]" aria-describedby="otp-help"
            />
          </Field>
          <p id="otp-help" className="-mt-2 text-xs text-ink-soft">Enter the 6 digits from the email sent to {email}.</p>
          <ErrorBox>{error}</ErrorBox>
          <Button className="w-full" disabled={busy || otp.length !== 6}>{busy ? "Verifying..." : "Verify & create account"}</Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" onClick={() => { setStep("details"); setError(""); }} className="inline-flex items-center gap-1 font-semibold text-ink-soft hover:text-ink">
              <ArrowLeft size={14} aria-hidden="true" /> Edit details
            </button>
            <button type="button" disabled={busy || cooldown > 0} onClick={() => sendCode(null, { force: true })}
              className="font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:text-ink-soft disabled:no-underline">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="It takes under a minute.">
      <form onSubmit={sendCode} className="cp-stagger space-y-4">
        <Field label="Full name"><Input required value={form.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Email" hint="We will email a 6-digit code to confirm it is yours."><Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></Field>
        <Field label="Mobile number" hint="10 digits, or start with + and your country code. We use it for placement alerts by SMS; you can turn that off any time.">
          <Input type="tel" required value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="98765 43210" />
        </Field>
        <Field label="Password" hint="At least 8 characters."><PasswordInput required minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" /></Field>
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
        <Button className="w-full" disabled={busy}>{busy ? "Sending code..." : "Send verification code"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </AuthShell>
  );
}
