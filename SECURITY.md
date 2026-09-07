# Security Policy

## Supported versions

TechCoach AI is a continuously deployed application; only the current `main`
branch and the running production deployment are supported. Fixes ship forward —
there are no backported release branches.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.**

Report privately, either way:

- **GitHub Security Advisories** — use *Security → Report a vulnerability* on
  this repository (preferred; keeps the discussion attached to the code).
- **Email** — huythanhlam1@gmail.com, with `SECURITY` in the subject line.

Please include what you can: the affected area (frontend, AI gateway,
Supabase Edge Function, a data pipeline), reproduction steps or a proof of
concept, and the impact you believe it has.

## What to expect

- **Acknowledgement** within 3 business days.
- **Initial assessment** — severity and whether we can reproduce it — within
  7 business days.
- Progress updates until the issue is resolved, and credit in the advisory if
  you would like it.

Please give us a reasonable window to ship a fix before disclosing publicly.

## Scope

In scope: this repository's application code, the Express AI gateway
(`server.ts`), the Supabase Edge Functions and migrations under `supabase/`,
the CI workflows in `.github/workflows/`, and the data pipelines in `scripts/`.

Out of scope: vulnerabilities in third-party services themselves (Supabase,
Google Gemini, GitHub) — report those to the respective vendor — and findings
that require an already-compromised maintainer account or CI secret.

## Handling of user data

Application user data is protected by Supabase Row Level Security. Reports
involving RLS bypass, service-role key exposure, or authentication bypass are
treated as highest severity. If you believe you have accessed another user's
data, stop, do not download or retain it, and tell us immediately.
