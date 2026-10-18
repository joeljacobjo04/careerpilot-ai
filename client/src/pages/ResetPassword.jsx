import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api, { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input } from "../components/ui";
import { AuthShell } from "./Login";

function PasswordInput({ label, hint, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <span className="relative block">
        <Input type={show ? "text" : "password"} className="!pr-11" {...props} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:text-ink">
          {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </span>
    </Field>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = pw.password.length >= 12 ? 3 : pw.password.length >= 10 ? 2 : pw.password.length >= 8 ? 1 : 0;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (pw.password !== pw.confirm) return setError("The two passwords do not match");
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password: pw.password });
      nav("/login", { replace: true, state: { notice: "Password updated. Sign in with your new password." } });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs the link from your email.">
        <Link to="/forgot-password" className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you have not used before.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <PasswordInput label="New password" hint="At least 8 characters." autoComplete="new-password" required minLength={8} autoFocus value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
          {pw.password && (
            <div className="mt-2 flex items-center gap-2" aria-hidden="true">
              {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${strength >= n ? (strength === 1 ? "bg-warn" : "bg-ok") : "bg-line"}`} />)}
              <span className="w-12 text-right text-xs text-ink-soft">{["Short", "OK", "Good", "Strong"][strength]}</span>
            </div>
          )}
        </div>
        <PasswordInput label="Confirm new password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <ErrorBox>{error}</ErrorBox>
        {error.includes("expired") && <Link to="/forgot-password" className="block text-sm font-semibold text-brand">Request a new reset link</Link>}
        <Button className="w-full" disabled={busy}>{busy ? "Updating..." : "Update password"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft"><Link to="/login" className="font-semibold text-brand">Back to sign in</Link></p>
    </AuthShell>
  );
}
