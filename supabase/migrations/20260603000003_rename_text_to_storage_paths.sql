-- Rename *_text columns to *_storage_path. Guarded so the migration is
-- idempotent and safe to re-run against a partially-migrated database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'resume_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'resume_storage_path'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN resume_text TO resume_storage_path;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'linkedin_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'linkedin_storage_path'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN linkedin_text TO linkedin_storage_path;
  END IF;
END $$;
