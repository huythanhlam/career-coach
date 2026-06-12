<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# TechCoach AI

**An AI-powered career coaching platform for technology professionals.**

</div>

TechCoach AI helps engineers, PMs, and data scientists land better jobs — from resume audits and LinkedIn optimization to mock interviews, salary negotiation, and market compensation data. Designed with a warm "Mentor Mode" aesthetic and powered by Google Gemini.

---

## Features

| Workflow | Description |
|---|---|
| **LinkedIn Optimization** | AI-rewrites your profile sections for visibility and recruiter appeal |
| **Resume Review** | Parses your PDF resume and gives role-specific feedback |
| **Resume Generation** | Builds an ATS-ready resume from scratch with AI guidance |
| **Salary Negotiation** | Coaches you through offer evaluation and counter-offer strategy |
| **Interview Prep** | Structured coaching for behavioral, case study, and technical rounds |
| **Mock Interviews** | Simulated sessions — behavioral, case study, and technical |
| **Market Compensation** | Interactive charts for salary benchmarking by role and location |
| **Career Planning** | Long-horizon coaching for IC → Staff or role-switch transitions |
| **Company Research** | AI-assisted research briefs for target companies |
| **Global Chat** | Free-form career coaching conversation always accessible |

---

## Tech Stack

**Frontend:** React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · shadcn/ui (Base UI) · Fraunces + Geist fonts · Recharts · react-pdf · Framer Motion

**Backend:** Node.js + Express (port 4000) · TypeScript via `tsx`

**AI:** Google Gemini (`gemini-1.5-flash` default, `gemini-1.5-pro` for resume analysis) — all requests proxied through local Express gateway

**Auth & DB:** Supabase (Auth with MFA, user profiles, Row Level Security)

---

## Getting Started

**Prerequisites:** Node.js 18+, a Gemini API key, a Supabase project

**1. Install dependencies**
```bash
npm install
```

**2. Set environment variables**

Create a `.env.local` file:
```
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**3. Run the AI gateway server** (required — handles all Gemini API calls)
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
  components/       # All React UI components
    workflows.ts    # Sidebar view IDs and type definitions
    onboarding/     # Onboarding flow components
    ui/             # shadcn/ui primitives
  config/
    workflows.ts    # AI system prompts and workflow field configs
  context/          # React context (UserProfileContext, etc.)
  services/         # Gemini API client (geminiService.ts)
  hooks/            # Custom React hooks
  types/            # TypeScript interfaces
agents/             # Multi-agent CLI dev system (8 specialized agents)
supabase/
  migrations/       # SQL migration files
  types.ts          # Generated Supabase TypeScript types
server.ts           # Express AI gateway
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run server` | Start Express AI gateway on port 4000 |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
