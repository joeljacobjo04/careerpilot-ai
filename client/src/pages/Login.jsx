import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input, PasswordInput } from "../components/ui";

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-side to-[#0d4f27] p-10 text-white md:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" aria-hidden="true" />
        <p className="relative flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm text-side">CP</span> CareerPilot AI
        </p>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">Practise the interview before it counts.</h2>
          <p className="mt-4 max-w-md text-white/75">
            Build your profile, fix your resume, close skill gaps, and sit a proctored voice interview that scores you the way a recruiter would.
          </p>
        </div>
        <p className="relative text-sm text-white/55">For students and placement cells.</p>
      </div>
      <div className="flex flex-col bg-white md:bg-transparent">
        {/* phones get a compact brand bar instead of the big panel */}
        <div className="flex items-center gap-2.5 bg-side px-5 py-4 text-white safe-top md:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-side">CP</span>
          <p className="font-bold tracking-tight">CareerPilot AI</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mb-6 mt-1 text-sm text-ink-soft">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: state?.email || "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const user = await login(form.email, form.password);
      nav(user.role === "officer" ? "/officer" : "/dashboard");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="-mt-1 text-right"><Link to="/forgot-password" state={{ email: form.email }} className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link></div>
        {state?.notice && <p role="status" className="rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm text-ok">{state.notice}</p>}
        <ErrorBox>{error}</ErrorBox>
        <Button className="w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link>
      </p>
    </AuthShell>
  );
}
