import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Briefcase, Building2, Calculator, Compass, FileText, House, Layers, ListChecks, LogOut, Menu, Mic, Target, User, Users, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import DesktopAlertsPrompt from "./DesktopAlertsPrompt";
import { disablePush, syncPush } from "./pushClient";
import { Avatar } from "./ui";
import { useConfirm } from "./Feedback";

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
  ["/officer/lists", "Dropdown lists", ListChecks],
];

/** true on phones and small tablets (below Tailwind's md breakpoint) */
function useIsMobile() {
  const query = "(max-width: 767px)";
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const confirm = useConfirm();
  const mobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOfficer = user.role === "officer";
  const items = isOfficer ? OFFICER_NAV : STUDENT_NAV;
  const profilePath = isOfficer ? "/officer/profile" : "/profile";
  const bellPath = isOfficer ? "/officer/notifications" : "/notifications";
  const roleLine = isOfficer ? "Placement officer" : ["Student", user.department].filter(Boolean).join(" \u00b7 ");

  useEffect(() => { syncPush(); }, [user.id]); // if alerts are already allowed on this device, link it to this account

  // the slide-out menu closes whenever you go to another page
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // ...and when the screen grows past phone size
  useEffect(() => { if (!mobile) setMenuOpen(false); }, [mobile]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const key = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [menuOpen]);

  async function signOut() {
    const ok = await confirm({ title: "Log out of CareerPilot?", message: "You'll need to sign in again to get back in.", confirmText: "Log out" });
    if (!ok) return;
    await disablePush({ remember: false }); // so the next person on this phone doesn't get this account's alerts
    logout(); nav("/login");
  }

  const drawerOpen = mobile && menuOpen;

  return (
    // The officer area uses Space Grotesk and a mint page background; students keep their existing look.
    <div className={`cp-canvas min-h-dvh md:flex ${isOfficer ? "font-officer" : ""}`}>
      {/* ---------- phone top bar ---------- */}
      <header className="cp-side sticky top-0 z-30 flex h-14 items-center gap-2 px-3 text-white shadow-lg shadow-black/15 safe-top md:hidden">
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link to={isOfficer ? "/officer/dashboard" : "/dashboard"} className="flex items-center gap-2 font-bold tracking-tight">
          <span className="cp-logo flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold text-side">CP</span>
          CareerPilot AI
        </Link>
        <div className="ml-auto">{mobile && <NotificationBell listPath={bellPath} />}</div>
      </header>

      {/* dim background behind the slide-out menu */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px] animate-fade md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {/* ---------- sidebar (slides in from the left on phones) ---------- */}
      <aside
        id="main-menu" aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] flex-col cp-side text-white shadow-2xl transition-transform duration-300 ease-out safe-top safe-bottom md:sticky md:top-0 md:z-30 md:h-screen md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2.5 px-4 py-5">
          <span className="cp-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-side">CP</span>
          <p className="whitespace-nowrap text-[17px] font-bold tracking-tight">CareerPilot <span className="text-side-active">AI</span></p>
          <div className="ml-auto flex items-center gap-1">
            {!mobile && <NotificationBell listPath={bellPath} />}
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/10 md:hidden">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="px-5 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Menu</p>

        <nav className="thin-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3" aria-label="Main">
          {items.map(([to, label, Icon], i) => (
            <NavLink
              key={to} to={to} style={{ animation: `cp-rise .5s cubic-bezier(.2,.7,.2,1) ${i * 45}ms both` }}
              className={({ isActive }) =>
                `cp-nav-link flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold md:py-2.5 ${isActive ? "cp-nav-active bg-gradient-to-r from-[#86efac] to-side-active text-side-ink" : "text-white/90 hover:bg-white/10"}`}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4">
          <NavLink to={profilePath} aria-label="My profile"
            className={({ isActive }) => `flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15 ${isActive ? "ring-2 ring-side-active" : ""}`}>
            <Avatar name={user.name} src={user.avatar} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/75">{roleLine}</p>
            </div>
          </NavLink>
          <button onClick={signOut} className="cp-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/35 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 hover:shadow-lg">
            <LogOut size={15} aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-10 md:p-8">
        <div className="cp-page mx-auto max-w-6xl"><DesktopAlertsPrompt /><Outlet /></div>
      </main>
    </div>
  );
}
