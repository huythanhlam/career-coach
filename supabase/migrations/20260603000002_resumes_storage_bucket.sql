-- Create the resumes storage bucket (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload/update/delete only their own files (path starts with their user id)
DROP POLICY IF EXISTS "Users can manage their own resume files" ON storage.objects;
CREATE POLICY "Users can manage their own resume files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
