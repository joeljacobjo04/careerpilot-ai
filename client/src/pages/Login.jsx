import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Button, ErrorBox, Field, Input, PasswordInput } from "../components/ui";

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="cp-canvas grid min-h-dvh md:grid-cols-[1.05fr_1fr]">
      {/* ---------- artwork panel ---------- */}
      <div className="cp-auth-art relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex lg:p-14">
        <div className="cp-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="cp-orb pointer-events-none absolute -right-20 -top-24 h-80 w-80 bg-gradient-to-br from-[#4ade80]/40 to-transparent" aria-hidden="true" />
        <div className="cp-orb pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 bg-gradient-to-tr from-[#22c55e]/30 to-transparent [animation-delay:-5s]" aria-hidden="true" />

        <p className="relative flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <span className="cp-logo flex h-10 w-10 items-center justify-center rounded-xl text-sm text-side">CP</span>
          CareerPilot <span className="text-side-active">AI</span>
        </p>

        <div className="relative">
          <span className="cp-glass mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/90">
            <span className="cp-pulse-dot h-2 w-2 rounded-full bg-side-active" aria-hidden="true" /> AI-powered placement prep
          </span>
          <h2 className="max-w-md text-4xl font-extrabold leading-[1.1] lg:text-5xl">
            Practise the interview <span className="cp-gradient-text">before it counts.</span>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-white/75">
            Build your profile, fix your resume, close skill gaps, and sit a proctored voice interview that scores you the way a recruiter would.
          </p>

          <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
            {[["Resume", "ATS-ready"], ["Interview", "Voice + AI"], ["Skills", "Gap-checked"]].map(([k, v], i) => (
              <div key={k} className={`cp-glass rounded-2xl p-3.5 ${["cp-float-a", "cp-float-b", "cp-float-c"][i]}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-side-active">{k}</p>
                <p className="mt-1 text-sm font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-white/55">For students and placement cells.</p>
      </div>

      {/* ---------- form panel ---------- */}
      <div className="relative flex flex-col overflow-hidden">
        <div className="cp-orb pointer-events-none absolute -right-24 top-10 h-72 w-72 bg-gradient-to-br from-[#4ade80]/25 to-transparent" aria-hidden="true" />
        {/* phones get a compact brand bar instead of the big panel */}
        <div className="cp-auth-art flex items-center gap-2.5 px-5 py-4 text-white safe-top md:hidden">
          <span className="cp-logo flex h-9 w-9 items-center justify-center rounded-lg text-xs font-extrabold text-side">CP</span>
          <p className="font-bold tracking-tight">CareerPilot <span className="text-side-active">AI</span></p>
        </div>
        <div className="relative flex flex-1 items-center justify-center p-5 sm:p-10">
          <div className="cp-auth-form w-full max-w-md rounded-3xl p-6 sm:p-8">
            <h1 className="cp-title-grad text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mb-6 mt-1 text-sm text-ink-soft">{subtitle}</p>
            <div className="cp-stagger">{children}</div>
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
      <form onSubmit={submit} className="cp-stagger space-y-4">
        <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="-mt-1 text-right"><Link to="/forgot-password" state={{ email: form.email }} className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link></div>
        {state?.notice && <p role="status" className="rounded-xl border border-ok/20 bg-ok-soft px-3.5 py-2.5 text-sm text-ok">{state.notice}</p>}
        <ErrorBox>{error}</ErrorBox>
        <Button className="w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link>
      </p>
    </AuthShell>
  );
}
