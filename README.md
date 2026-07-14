<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# TechCoach AI

**An AI career coach for every job search.**

</div>

TechCoach AI gives any professional — not just tech workers — the kind of specific, data-backed coaching that used to require a big budget or the right referral: resume audits, LinkedIn optimization, mock interviews, salary negotiation, and market compensation data, organized around the stages of a real job search (Plan → Apply → Practice → Research). A stateful AI coach persists context across sessions, proactively nudges users, and drafts interview follow-ups. A separate **Employer mode** lets companies post and promote job listings. Designed with a warm "Mentor Mode" aesthetic and powered by Google Gemini.

---

## Features

### Job seeker mode

| Workflow | Description |
|---|---|
| **Dashboard & AI Coach** | Persistent coach with memory, proactive nudges, and a global chat panel always accessible |
| **LinkedIn Optimization** | AI-rewrites your profile sections for visibility and recruiter appeal |
| **Resume Builder** | Reviews an uploaded resume or generates an ATS-ready one from scratch, with a rich in-app document editor |
| **Resume Tailoring** | Tailors a resume to a specific job posting with suggested rewrites and keyword strengthening |
| **Cover Letters** | AI-drafted, editable cover letters |
| **Job Postings** | Scans target companies' ATS boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) for weekly matches, scored against the user's profile; tracks applications end to end |
| **Follow-Up & Thank-You Notes** | Drafts post-interview follow-ups and thank-you notes tied to tracked applications |
| **Salary Negotiation** | Coaches you through offer evaluation and a simulated counter-offer roleplay |
| **Interview Prep & Mock Interviews** | Structured coaching plus simulated behavioral, case study, and technical interviews — including voice-driven practice sessions with a spoken AI interviewer (Gemini TTS) |
| **Market Compensation** | Interactive salary benchmarking by role and location, grounded in U.S. BLS wage data |
| **Career Planning** | Long-horizon coaching and milestone tracking for learning a skill, changing roles, or earning a promotion |
| **Company Research** | AI-assisted research briefs sourced from SEC filings, Blind, and Wikipedia |
| **Networking** | Outreach persona builder, message composer, and outreach tracker |
| **Autopilot** | Auto-assembled application packages (resume + cover letter + tailoring) reviewed before submission |
| **Response-Rate Analytics** | Tracks reply/response rates per resume variant to see what's working |
| **Blog** | Career-advice articles, auto-curated by a 3-agent editorial AI pipeline |

### Employer mode

| Workflow | Description |
|---|---|
| **Employer Studio** | Company profile editor and job listing editor for employers |
| **Listing Promotion** | Boost/promote job listings with a checkout flow |

---

## Tech Stack

**Frontend:** React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · shadcn/ui (Base UI) · Fraunces + Geist fonts · Recharts · react-pdf · Framer Motion

**Backend:** Node.js + Express AI gateway (`server.ts`, port 4000) in dev; Supabase Edge Functions (`ai-gateway`, `job-search`, `refresh-suggestions`, `scan-jobs`, `generate-nudges`, `bls`, and more) in prod

**AI:** Google Gemini (`gemini-3.1-flash-lite` — see `src/config/models.ts` for the current tier mapping) — all requests proxied through the gateway, never called directly from the frontend

**Auth & DB:** Supabase (Auth with MFA, user profiles, Row Level Security, scheduled `pg_cron` jobs)

---

## Getting Started

**Prerequisites:** Node.js 22, a Gemini API key, a Supabase project

**1. Install dependencies**
```bash
npm ci
```
`.npmrc` sets `ignore-scripts=true` for supply-chain hardening — use `npm ci`, not `npm install`.

**2. Set environment variables**

Copy `.env.example` to `.env.local` and fill in at minimum:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```
`BLS_API_KEY` is optional (grounds Market Compensation in real government wage data; falls back to AI estimates without it). See `.env.example` for the full list, including optional AI Core v2 gateway and screenshot-endpoint overrides.

**3. Run the AI gateway server** (required — handles all Gemini API calls in dev)
```bash
npm run server
```

**4. Run the frontend dev server** (in a separate terminal)
```bash
npm run dev
```

App runs at `http://localhost:3000`. The AI gateway runs at `http://localhost:4000`.

---

## Project Structure

```
src/
  components/       # All React UI components (workspaces, dashboard, employer studio, blog, etc.)
  config/
    workflows.ts    # AI system prompts and workflow field configs
    models.ts        # Gemini model id per capability tier
  context/          # React context (UserProfileContext, etc.)
  services/         # Gemini API client (geminiService.ts) and job-scan service
  hooks/            # Custom React hooks
  types/            # TypeScript interfaces
scripts/
  blog/             # 3-agent editorial pipeline (Ideator → Writer → Editor) that curates blog posts
  company-profiles/ # Deterministic company-data pipeline (SEC filings, Blind, Wikipedia)
supabase/
  migrations/       # SQL migration files
  functions/        # Edge Functions (ai-gateway, job-search, refresh-suggestions, scan-jobs, ...)
  types.ts          # Generated Supabase TypeScript types
server.ts           # Express AI gateway (dev)
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run server` | Start Express AI gateway on port 4000 (required for any AI feature in dev) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite |
| `npm run profiles:build` | Run the company-profiles data pipeline |
| `npm run blog:build` | Auto-curate blog posts via the 3-agent editorial pipeline |
| `npm run blog:sync` | Publish committed blog posts into the public `blog_posts` table |
