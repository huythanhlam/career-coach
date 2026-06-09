-- ─────────────────────────────────────────────────────────
-- Targeted Job Postings: user-defined target roles + companies
-- Stored as JSONB arrays on profiles (mirrors saved_resumes etc.).
--   target_roles:     [{ id, title, keywords?, location?, seniority?, remote? }]
--   target_companies: [{ id, name, ats: 'greenhouse'|'lever'|'ashby', boardToken }]
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_roles     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_companies JSONB NOT NULL DEFAULT '[]'::jsonb;
