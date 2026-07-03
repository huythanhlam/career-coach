/**
 * documentParserService — extract plain text from uploaded documents for AI processing.
 *
 * Supports: PDF, DOCX, TXT
 * Output feeds into parseProfileFromImport() / AI analysis — not the visual editor.
 */

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type SupportedFileType = "pdf" | "docx" | "txt" | "unknown";

export function detectFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (mime === "text/plain" || name.endsWith(".txt")) return "txt";
  return "unknown";
}

export function isSupportedFile(file: File): boolean {
  return detectFileType(file) !== "unknown";
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
  }
  if (!isSupportedFile(file)) {
    throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
  }
}

/**
 * Extract plain text from a document file for AI analysis and profile extraction.
 */
export async function parseDocumentToText(file: File): Promise<string> {
  validateFile(file);
  const type = detectFileType(file);

  if (type === "pdf") {
    const [pdfjs, { configurePdfWorker }] = await Promise.all([
      import("pdfjs-dist"),
      import("@/lib/pdfWorker"),
    ]);
    configurePdfWorker(pdfjs);
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf
          .getPage(i + 1)
          .then((p) => p.getTextContent())
          .then((c) => c.items.map((item) => ("str" in item ? item.str : "")).join(" ")),
      ),
    );
    return pages.join("\n");
  }

  if (type === "docx") {
    const mammoth = (await import("mammoth")).default;
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value;
  }

  // txt
  return file.text();
}
