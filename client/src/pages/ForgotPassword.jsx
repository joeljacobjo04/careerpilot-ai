import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";
import api, { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input } from "../components/ui";
import { AuthShell } from "./Login";

export default function ForgotPassword() {
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="One more step.">
        <div className="flex gap-3 rounded-2xl border border-line bg-white p-4">
          <MailCheck className="mt-0.5 shrink-0 text-brand" size={22} aria-hidden="true" />
          <p className="text-sm leading-relaxed text-ink-soft">
            If an account exists for <b className="text-ink">{email}</b>, we have sent a link to reset the password. It works for 30 minutes and can be used once. Check your spam folder if it does not show up.
          </p>
        </div>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => setSent(false)}>Use a different email</Button>
        <p className="mt-6 text-sm text-ink-soft"><Link to="/login" className="font-semibold text-brand">Back to sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account email and we will send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <ErrorBox>{error}</ErrorBox>
        <Button className="w-full" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">Remembered it? <Link to="/login" className="font-semibold text-brand">Sign in</Link></p>
    </AuthShell>
  );
}
