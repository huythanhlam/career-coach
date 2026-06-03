-- Fix: persist saved resumes (text stored inline as JSONB)
alter table public.profiles
  add column if not exists saved_resumes jsonb not null default '[]';

-- Cover letter metadata (full text lives in Supabase Storage)
alter table public.profiles
  add column if not exists saved_cover_letters jsonb not null default '[]';

-- Storage bucket for user documents (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'user-documents',
    'user-documents',
    false,
    5242880,  -- 5 MB per file
    array['text/plain', 'text/markdown']
  )
  on conflict (id) do nothing;

-- RLS: each user can only access their own folder ({userId}/...)
create policy "Users can upload own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
