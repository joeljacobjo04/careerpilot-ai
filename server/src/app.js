import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { notFound, errorHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resume.js";
import atsRoutes from "./routes/ats.js";
import skillgapRoutes from "./routes/skillgap.js";
import careersRoutes from "./routes/careers.js";
import readinessRoutes from "./routes/readiness.js";
import interviewRoutes from "./routes/interview.js";
import companyRoutes from "./routes/companies.js";
import driveRoutes from "./routes/drives.js";
import officerRoutes from "./routes/officer.js";
import dashboardRoutes from "./routes/dashboard.js";
import aptitudeRoutes from "./routes/aptitude.js";
import notificationRoutes from "./routes/notifications.js";
import accountRoutes from "./routes/account.js";

const app = express();

// Behind Render / Vercel / nginx every request arrives from the proxy, so without this all users would share ONE IP
// (and one rate limit). Set TRUST_PROXY=0 if the server is exposed directly to the internet.
app.set("trust proxy", process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY) || 0);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// Per IP. Generous on purpose: a whole class registering from one college Wi-Fi shares a single public IP.
// Brute-force protection for passwords is the per-email limiter on /auth/login and the per-email OTP rules.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT) || 600, message: { message: "Too many attempts. Try again later." } });
// LLM calls are the expensive resource (and Groq's free tier is rate limited).
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 25, message: { message: "Too many AI requests. Wait a moment." } });

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/profile", profileRoutes);
// resume.js applies its own limits: strict for AI calls, relaxed for the live preview and PDF
app.use("/api/resume", resumeRoutes);
app.use("/api/ats", aiLimiter, atsRoutes);
app.use("/api/skillgap", aiLimiter, skillgapRoutes);
app.use("/api/careers", aiLimiter, careersRoutes);
app.use("/api/readiness", readinessRoutes);
app.use("/api/interview", aiLimiter, interviewRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/drives", driveRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/aptitude", aptitudeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/account", accountRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;