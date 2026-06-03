import { supabase } from "@/lib/supabaseClient";

const BUCKET = "resumes";

export async function uploadResume(
  userId: string,
  resumeId: string,
  text: string
): Promise<string> {
  const path = `${userId}/${resumeId}.md`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([text], { type: "text/markdown" }), { upsert: true });
  if (error) throw new Error(`Failed to upload resume: ${error.message}`);
  return path;
}

export async function downloadResume(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`Failed to download resume: ${error.message}`);
  return data.text();
}

export async function uploadImportedResume(userId: string, text: string): Promise<string> {
  const path = `${userId}/imports/resume.md`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([text], { type: "text/markdown" }), { upsert: true });
  if (error) throw new Error(`Failed to upload imported resume: ${error.message}`);
  return path;
}

export async function uploadLinkedInText(userId: string, text: string): Promise<string> {
  const path = `${userId}/imports/linkedin.md`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([text], { type: "text/markdown" }), { upsert: true });
  if (error) throw new Error(`Failed to upload LinkedIn text: ${error.message}`);
  return path;
}

export async function deleteResume(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Failed to delete resume: ${error.message}`);
}
