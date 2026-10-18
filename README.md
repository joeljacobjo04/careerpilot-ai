# CareerPilot AI (MERN)

Placement readiness platform: student profile, AI resume builder, ATS check, skill gap analysis,
career recommendations, proctored voice mock interview, and a placement officer console.

**Stack:** React (Vite) + Tailwind v4 · Node/Express · MongoDB/Mongoose · Groq LLM · TensorFlow.js COCO-SSD · Web Speech API · Puppeteer

---

## Step-by-step setup

### 1. Prerequisites
- Node.js 18 or newer (`node -v`)
- MongoDB: either local (`mongodb://127.0.0.1:27017`) or a free MongoDB Atlas cluster
- A free Groq API key from https://console.groq.com
- Chrome or Edge for testing the interview (speech recognition support)

### 2. Install
```bash
cd careerpilot-ai
npm run install:all
```
Puppeteer downloads Chromium here (about 150 MB). That is needed for the resume PDF export.

### 3. Configure the server
```bash
cd server
cp .env.example .env
```
Edit `server/.env`:
| Variable | What to put |
|---|---|
| `MONGO_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `GROQ_API_KEY` | Your Groq key |
| `GROQ_MODEL` | A current model from https://console.groq.com/docs/models |
| `OFFICER_INVITE_CODE` | Secret code officers must enter when registering |

### 4. Seed sample data
```bash
npm run seed          # from the server folder (or `npm run seed` in the project root)
```
Creates 7 job roles (used by skill gap analysis), 20 aptitude questions, a demo company and drive, and two demo accounts. It is safe to run again, and you must run it again after upgrading so the aptitude questions are loaded:
- Student: `student@demo.com` / `Student@123`
- Officer: `officer@demo.com` / `Officer@123`

### 5. Run
Two terminals:
```bash
npm run dev:server    # http://localhost:5000
npm run dev:client    # http://localhost:5173
```
Open http://localhost:5173. The Vite dev server proxies `/api` to the backend, so no CORS setup is needed in development.

### 6. Try every feature (in this order)
1. **Student** → Profile: fill Basics, add 5+ skills, 2 projects, a certification, an education entry, and a target role.
2. **Resume builder** → Generate → pick a template → Download PDF.
3. **ATS check** → upload a PDF/DOCX resume.
4. **Skill gap** → pick a role → view the learning path.
   **Aptitude test** → take the 10-question test (this fills the Aptitude bar on the dashboard).
5. **Career paths** → Suggest roles.
6. **Mock interview** → Test camera → Start → Enter full-screen and begin.
7. Try breaking a rule on purpose (press Esc, switch tab, hold up a phone) and confirm the interview cancels.
8. **Dashboard** → the readiness score should now reflect all six bars.
9. Sign out, sign in as the **officer** → check Students, Companies, Drives (Manage → change a status), Analytics, and Export CSV.

---

## Project layout
```
server/src
  app.js, server.js         Express app + bootstrap
  config/db.js
  middleware/               auth (JWT + role), validate (zod), upload (multer memory), error
  models/                   User, StudentProfile, Company, PlacementDrive, JobRole,
                            InterviewSession, SkillGapReport, ReadinessSnapshot, CareerRecommendation
  services/                 groq.service, resumeParser, ats.rules, skillMatch, readiness.service, pdf.service
  routes/                   one file per module (router + handlers)
  seed/seed.js
client/src
  api/client.js             axios + token handling
  context/AuthContext.jsx
  hooks/                    useProctor, useCamera, useObjectDetection, useSpeech, useApi
  components/               ui kit, Layout, ProtectedRoute
  pages/                    student pages, interview pages, officer/ pages
```

## API overview
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Profile | `GET/PUT /profile`, `POST/PUT/DELETE /profile/:skills\|projects\|certifications\|education` |
| Resume | `POST /resume/generate`, `/resume/preview`, `/resume/pdf` |
| ATS | `POST /ats/analyze` (multipart `resume`, optional `target`) |
| Skill gap | `GET /skillgap/roles`, `POST /skillgap/analyze`, `GET /skillgap/history` |
| Careers | `GET /careers`, `POST /careers/recommend` |
| Readiness | `GET /readiness`, `GET /readiness/history` |
| Dashboard | `GET /dashboard`, `GET /dashboard/suggestions` (`?refresh=1` to regenerate) |
| Aptitude | `GET /aptitude/questions`, `POST /aptitude/submit`, `GET /aptitude/history` |
| Interview | `POST /interview/start`, `GET /interview/:id`, `POST /interview/:id/answer`, `/violation`, `/finish`, `GET /interview/history` |
| Companies | `GET/POST /companies`, `PUT/DELETE /companies/:id` (officer) |
| Drives | `GET /drives`, `POST/PUT/DELETE` (officer), `POST /drives/:id/register` (student), `GET /drives/:id/eligible-students`, `/registrations` |
| Officer | `GET /officer/dashboard`, `/students`, `/analytics`, `/export/students.csv` |

## How the important parts work

**Readiness score** is a weighted sum of the six bars shown on the dashboard (logic in `server/src/services/readiness.service.js`):

| Bar | How it is measured | Weight |
|---|---|---|
| Technical skills | Skill match % for the target role (latest skill gap analysis) | 30% |
| Project experience | 2 or more projects = 100% | 15% |
| Aptitude performance | Score of the latest aptitude test | 15% |
| Communication | Average communication score over the last 3 completed mock interviews | 15% |
| Academics (CGPA) | CGPA x 10 | 15% |
| Certifications | 3 or more certifications = 100% | 10% |

The status under the score is "Just starting" below 40, "In progress" from 40 to 84, and "Placement ready" from 85.

**Dashboard extras:** the AI Suggestions card is generated by Groq from the student's skills, certifications and target role, then cached for 24 hours (or until the profile changes). If the AI is unavailable it falls back to basic suggestions. The notification bell is built from live drive data (new drives, closing deadlines, shortlisted/selected status).

**ATS score** = 60% LLM review + 40% deterministic rule checks (`ats.rules.js`), so results are steadier between runs.

**Privacy:** resumes are parsed from memory (`multer.memoryStorage`), sent to the LLM, and discarded. Only the numeric ATS score is saved.

**Proctoring**
| Rule | Where | Result |
|---|---|---|
| Leave full-screen, switch tab/app, camera off, phone, book, 2+ people | client detects, server enforces | Cancelled immediately |
| Copy/paste, right-click, F12/DevTools shortcuts, no face visible | client detects | Warning; cancelled at 3 |

The server validates every answer request: the interview must be `in_progress`, questions must be answered in order, and expected answer points are never sent to the browser.

## Forgot password
Sign in page > **Forgot password?** emails a one-time link (valid 30 minutes) to `/reset-password`. It uses the same Brevo setup as alert emails (`BREVO_API_KEY`, `EMAIL_FROM`). With no email provider configured and `NODE_ENV` not `production`, the reset link is printed in the server console so you can test locally. Only a SHA-256 hash of the token is stored, requests are rate limited, and a successful reset signs out every older session.

## Production deployment
1. **Database:** MongoDB Atlas.
2. **Backend** (Render / Railway / EC2): set the env vars from step 3, plus `CLIENT_URL=https://your-frontend`. Puppeteer needs Chromium system libraries. On Render/Railway use a Docker image based on `ghcr.io/puppeteer/puppeteer`.
3. **Frontend** (Vercel / Netlify): build command `npm run build`, output `dist`, env `VITE_API_URL=https://your-api/api`. Add an SPA fallback rewrite to `index.html`.
4. **HTTPS is mandatory.** Camera, microphone and speech APIs do not work on plain HTTP (except localhost).

## Troubleshooting
| Problem | Fix |
|---|---|
| `Missing MONGO_URI` | You forgot to copy `.env.example` to `.env` |
| AI routes return 503 | `GROQ_API_KEY` is missing or invalid |
| AI routes return 429 | Groq free-tier limit reached. Wait a minute, or lower usage |
| "model decommissioned" error | Update `GROQ_MODEL` to a current model |
| PDF download fails | Chromium not installed. Run `npx puppeteer browsers install chrome` in `server/` |
| Voice input does nothing | Use Chrome or Edge. Or type the answer |
| Interview cancels the moment it starts | Another window took focus (e.g. a permission prompt). Grant camera and mic permission on the setup page first |
| Officer registration rejected | The invite code must match `OFFICER_INVITE_CODE` |

## Known limitations (be honest in your report/viva)
- Browser proctoring is a deterrent, not a guarantee. A determined user can bypass client-side checks. The server logs every event and enforces ordering and status, but cannot see the screen.
- COCO-SSD can miss objects or produce false positives (thresholds and consecutive-frame checks reduce this).
- LLM scoring is subjective. Treat scores as practice feedback, not an official evaluation.
- The JWT is kept in `localStorage` for simplicity. For stricter security switch to an httpOnly cookie.

## Ideas to extend
Refresh tokens · email notifications for new drives · resume version history · recording snapshots during interviews for officer review · Jest/Supertest API tests and Playwright interview-flow tests · role-specific question banks.
