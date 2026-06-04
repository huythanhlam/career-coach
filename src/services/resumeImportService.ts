/**
 * resumeImportService — one-step "uploaded resume → editable templated document".
 *
 * Pipeline (each stage deliberately separated for accuracy):
 *   1. parseDocumentToText   — deterministic text extraction (PDF/DOCX/TXT).
 *   2. parseProfileFromImport — AI extracts structured data into a typed schema.
 *   3. profileToResumeMarkdown — deterministic assembly into editor Markdown.
 *
 * The AI is used ONLY as a schema-constrained extractor; document assembly is
 * deterministic so no content is dropped, reordered, or hallucinated.
 */
import type { UserProfile } from "@/types/userProfile";
import { parseDocumentToText } from "@/services/documentParserService";
import { parseProfileFromImport } from "@/services/geminiService";
import { profileToResumeMarkdown } from "@/lib/resumeMarkdown";

/** Minimum extracted characters to consider a file worth parsing. */
const MIN_TEXT_LENGTH = 100;

export interface ResumeImportResult {
  /** Editor-ready Markdown in the default template's section order. */
  markdown: string;
  /** Structured data extracted from the resume (for prefilling profile/forms). */
  profile: Partial<UserProfile>;
  /** Raw extracted text (kept so callers can persist the original if desired). */
  rawText: string;
}

export class ResumeImportError extends Error {
  constructor(
    message: string,
    /** Stage that failed — useful for targeted UI messaging. */
    public readonly stage: "extract" | "parse" | "empty"
  ) {
    super(message);
    this.name = "ResumeImportError";
  }
}

/**
 * Build an editor-ready resume document from already-extracted resume text.
 * Use this when the caller already has the plain text (e.g. a pasted resume or a
 * file whose text was extracted earlier) to avoid re-parsing the file.
 *
 * @param rawText      Plain resume text.
 * @param sectionOrder Optional template section order (defaults to the default template).
 */
export async function buildResumeDocumentFromText(
  rawText: string,
  sectionOrder?: string[],
  /** Source of the text — tunes the extraction prompt. Defaults to "resume". */
  sourceType: "resume" | "linkedin" = "resume"
): Promise<ResumeImportResult> {
  if (rawText.trim().length < MIN_TEXT_LENGTH) {
    throw new ResumeImportError(
      "Could not read enough text from this resume. Try pasting the text manually.",
      "empty"
    );
  }

  // AI structured extraction (schema-constrained, no document writing).
  const profile = await parseProfileFromImport({ type: sourceType, text: rawText });
  if (!profile || Object.keys(profile).length === 0) {
    throw new ResumeImportError(
      "We couldn't read any resume details from that file. Please try another file or enter your details manually.",
      "parse"
    );
  }

  // Deterministic assembly into editor Markdown.
  const markdown = profileToResumeMarkdown(profile, sectionOrder);

  return { markdown, profile, rawText };
}

/**
 * Import an uploaded resume file and return editor-ready Markdown plus the
 * structured profile it was assembled from.
 *
 * @param file       The uploaded PDF/DOCX/TXT file.
 * @param sectionOrder Optional template section order (defaults to the default template).
 */
export async function importResumeToDocument(
  file: File,
  sectionOrder?: string[],
  sourceType: "resume" | "linkedin" = "resume"
): Promise<ResumeImportResult> {
  // Deterministic text extraction (also validates type/size).
  let rawText: string;
  try {
    rawText = await parseDocumentToText(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to read the file.";
    throw new ResumeImportError(msg, "extract");
  }

  return buildResumeDocumentFromText(rawText, sectionOrder, sourceType);
}
