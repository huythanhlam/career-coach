ALTER TABLE public.profiles
  RENAME COLUMN resume_text TO resume_storage_path;

ALTER TABLE public.profiles
  RENAME COLUMN linkedin_text TO linkedin_storage_path;
