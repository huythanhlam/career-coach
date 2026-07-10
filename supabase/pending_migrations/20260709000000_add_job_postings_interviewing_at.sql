-- F3 Slice A: mirrors the existing `applied_at` pattern so the nightly nudge
-- generator can detect "interview happened ~1-2 days ago" for the thank-you
-- draft rule. See docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md §3.

alter table public.job_postings
  add column if not exists interviewing_at timestamptz;
