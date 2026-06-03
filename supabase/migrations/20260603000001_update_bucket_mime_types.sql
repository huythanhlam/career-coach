-- Update user-documents bucket to allow JSON payloads (cover letter HTML+style)
update storage.buckets
  set allowed_mime_types = array['text/plain', 'text/markdown', 'application/json']
  where id = 'user-documents';
