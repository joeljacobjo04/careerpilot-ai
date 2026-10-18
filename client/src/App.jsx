import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ResumeBuilder from "./pages/ResumeBuilder";
import AtsAnalyzer from "./pages/AtsAnalyzer";
import SkillGap from "./pages/SkillGap";
import Careers from "./pages/Careers";
import Aptitude from "./pages/Aptitude";
import StudentDrives from "./pages/StudentDrives";
import InterviewResult from "./pages/InterviewResult";
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import Companies from "./pages/officer/Companies";
import Drives from "./pages/officer/Drives";
import Students from "./pages/officer/Students";
import StudentDetail from "./pages/officer/StudentDetail";
import CompanyDetail from "./pages/officer/CompanyDetail";
import CompanyForm from "./pages/officer/CompanyForm";
import DriveDetail from "./pages/officer/DriveDetail";
import DriveForm from "./pages/officer/DriveForm";
import Applicants from "./pages/officer/Applicants";
import OfficerProfile from "./pages/officer/OfficerProfile";
import Analytics from "./pages/officer/Analytics";
import Notifications from "./pages/Notifications";

// TensorFlow.js is large, so the interview pages load only when needed
const InterviewSetup = lazy(() => import("./pages/InterviewSetup"));
const InterviewRoom = lazy(() => import("./pages/InterviewRoom"));

const Home = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Landing />; // visitors see the home page; signed-in users go straight to their dashboard
  return <Navigate to={user.role === "officer" ? "/officer/dashboard" : "/dashboard"} replace />;
};

const student = (el) => (
  <ProtectedRoute role="student"><Suspense fallback={<p className="p-8 text-sm text-ink-soft">Loading...</p>}>{el}</Suspense></ProtectedRoute>
);
const officer = (el) => <ProtectedRoute role="officer">{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* The interview room is full-screen and deliberately has no sidebar */}
      <Route path="/interview/room/:id" element={student(<InterviewRoom />)} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={student(<Dashboard />)} />
        <Route path="/profile" element={student(<Profile />)} />
        <Route path="/resume" element={student(<ResumeBuilder />)} />
        <Route path="/ats" element={student(<AtsAnalyzer />)} />
        <Route path="/skill-gap" element={student(<SkillGap />)} />
        <Route path="/careers" element={student(<Careers />)} />
        <Route path="/aptitude" element={student(<Aptitude />)} />
        <Route path="/drives" element={student(<StudentDrives />)} />
        <Route path="/notifications" element={student(<Notifications />)} />
        <Route path="/interview" element={student(<InterviewSetup />)} />
        <Route path="/interview/result/:id" element={student(<InterviewResult />)} />

        {/* /officer is kept as an alias so Login, Register and ProtectedRoute keep working */}
        <Route path="/officer" element={<Navigate to="/officer/dashboard" replace />} />
        <Route path="/officer/dashboard" element={officer(<OfficerDashboard />)} />

        <Route path="/officer/students" element={officer(<Students />)} />
        <Route path="/officer/students/:id" element={officer(<StudentDetail />)} />

        <Route path="/officer/companies" element={officer(<Companies />)} />
        <Route path="/officer/companies/add" element={officer(<CompanyForm />)} />
        <Route path="/officer/companies/edit/:id" element={officer(<CompanyForm />)} />
        <Route path="/officer/companies/:id" element={officer(<CompanyDetail />)} />

        <Route path="/officer/drives" element={officer(<Drives />)} />
        <Route path="/officer/drives/new" element={officer(<DriveForm />)} />
        <Route path="/officer/drives/edit/:id" element={officer(<DriveForm />)} />
        <Route path="/officer/drives/:id/applicants" element={officer(<Applicants />)} />
        <Route path="/officer/drives/:id" element={officer(<DriveDetail />)} />

        <Route path="/officer/analytics" element={officer(<Analytics />)} />
        <Route path="/officer/profile" element={officer(<OfficerProfile />)} />
        <Route path="/officer/notifications" element={officer(<Notifications />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
