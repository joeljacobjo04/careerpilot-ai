import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, Briefcase, Building2, Calculator, Compass, FileText, House, Layers, LogOut, Mic, Target, User, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const STUDENT_NAV = [
  ["/dashboard", "Dashboard", House],
  ["/profile", "My profile", User],
  ["/resume", "Resume builder", FileText],
  ["/skill-gap", "Skill gap analysis", Target],
  ["/interview", "Mock interview", Mic],
  ["/aptitude", "Aptitude test", Calculator],
  ["/careers", "Career recommendations", Compass],
  ["/drives", "Placement drives", Briefcase],
  ["/ats", "ATS Analysis", Layers],
];
const OFFICER_NAV = [
  ["/officer/dashboard", "Dashboard", House],
  ["/officer/students", "Student records", Users],
  ["/officer/companies", "Companies", Building2],
  ["/officer/drives", "Placement drives", Briefcase],
  ["/officer/analytics", "Reports & analytics", BarChart3],
];

const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isOfficer = user.role === "officer";
  const items = isOfficer ? OFFICER_NAV : STUDENT_NAV;
  const roleLine = isOfficer ? "Placement officer" : ["Student", user.department].filter(Boolean).join(" \u00b7 ");
  const signOut = () => { logout(); nav("/login"); };

  return (
    // The officer area uses Space Grotesk and a mint page background; students keep their existing look.
    <div className={`min-h-screen md:flex ${isOfficer ? "font-officer bg-mint" : ""}`}>
      <aside className="bg-side text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-side">CP</span>
          <p className="text-lg font-bold tracking-tight">CareerPilot AI</p>
        </div>
        <p className="hidden px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-white/75 md:block">Menu</p>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-visible" aria-label="Main">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to} to={to}
              // keep "Companies" highlighted on /officer/companies/add, /officer/companies/3 and so on
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-side-active text-side-ink" : "text-white/90 hover:bg-white/10"}`}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="hidden p-4 md:block">
          {(() => {
            const cls = "flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5";
            const inner = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-side-active text-xs font-bold text-side-ink">{initials(user.name)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-white/75">{roleLine}</p>
                </div>
              </>
            );
            // officers open their profile page from the user card; students keep the plain card
            return isOfficer
              ? <NavLink to="/officer/profile" aria-label="My profile" className={({ isActive }) => `${cls} transition hover:bg-white/15 ${isActive ? "ring-2 ring-side-active" : ""}`}>{inner}</NavLink>
              : <div className={cls}>{inner}</div>;
          })()}
          <button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/35 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
            <LogOut size={15} aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
        <div className="mt-8 border-t border-line pt-4 md:hidden">
          <button onClick={signOut} className="text-sm font-semibold text-ink-soft">Log out ({user.name})</button>
        </div>
      </main>
    </div>
  );
}