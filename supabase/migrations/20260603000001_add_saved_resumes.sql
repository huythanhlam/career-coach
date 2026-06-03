ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_resumes JSONB NOT NULL DEFAULT '[]'::jsonb;
