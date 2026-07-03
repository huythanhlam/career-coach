/**
 * resumeMarkdown — deterministically serialize structured profile data into
 * editor-ready Markdown.
 *
 * This is intentionally NOT an AI step. The AI (parseProfileFromImport) extracts
 * structured data; this function maps every field 1:1 into Markdown so nothing is
 * dropped, reordered, or invented. The output uses only the grammar understood by
 * DocumentEditor's markdownToHtml: `#`, `##`, `###`, `- `, `*em*`, `[text](url)`.
 */
import type { UserProfile, WorkExperience, Education } from "@/types/userProfile";
import { DEFAULT_STYLE_CONFIG } from "@/types/resumeStyle";

type ResumeData = Partial<UserProfile>;

/** Trim, and treat null/"undefined"/empty as absent. */
function clean(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
  return s;
}

/** Escape characters that would otherwise be read as Markdown control syntax. */
function escapeInline(value: string): string {
  // Only escape leading list/heading markers and emphasis chars; keep URLs intact.
  return value.replace(/([*_`])/g, "\\$1");
}

/** Build the contact line: "email · phone · linkedin · github · portfolio". */
function contactLine(p: ResumeData): string {
  const parts = [p.email, p.phone, p.linkedin, p.github, p.portfolio].map(clean).filter(Boolean);
  return parts.join(" · ");
}

function dateRange(w: WorkExperience): string {
  const start = clean(w.startDate);
  const end = w.current ? "Present" : clean(w.endDate) || (start ? "Present" : "");
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

/** Split a free-text responsibilities blob into clean bullet lines. */
function responsibilityBullets(raw: unknown): string[] {
  const text = clean(raw);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•·]\s*/, "").trim())
    .filter(Boolean);
}

function experienceBlock(item: WorkExperience): string {
  const role = clean(item.role);
  const company = clean(item.company);
  const heading = [role, company].filter(Boolean).join(" · ");
  if (!heading) return "";

  const lines: string[] = [`### ${heading}`];
  const dates = dateRange(item);
  if (dates) lines.push(`*${dates}*`);

  const bullets = responsibilityBullets(item.responsibilities);
  if (bullets.length) {
    lines.push("");
    bullets.forEach((b) => lines.push(`- ${escapeInline(b)}`));
  }
  return lines.join("\n");
}

function educationBlock(item: Education): string {
  const degree = clean(item.degree);
  const major = clean(item.major);
  const university = clean(item.university);
  const titleLeft = [degree, major].filter(Boolean).join(", ");
  const heading = [titleLeft, university].filter(Boolean).join(" · ");
  if (!heading) return "";

  const lines: string[] = [`### ${heading}`];
  const year = clean(item.graduationYear);
  if (year) lines.push(`*${year}*`);
  const minor = clean(item.minor);
  if (minor) lines.push(`Minor: ${escapeInline(minor)}`);
  return lines.join("\n");
}

/** Section builders keyed to ResumeStyleConfig.sectionOrder keys. */
const SECTION_BUILDERS: Record<string, (p: ResumeData) => string> = {
  contact: () => "", // header is emitted separately, before any section
  summary: (p) => {
    const summary = clean(p.summary);
    return summary ? `## Summary\n\n${escapeInline(summary)}` : "";
  },
  experience: (p) => {
    const blocks = (p.workHistory ?? []).map(experienceBlock).filter(Boolean);
    return blocks.length ? `## Experience\n\n${blocks.join("\n\n")}` : "";
  },
  education: (p) => {
    const blocks = (p.education ?? []).map(educationBlock).filter(Boolean);
    return blocks.length ? `## Education\n\n${blocks.join("\n\n")}` : "";
  },
  skills: (p) => {
    const skills = (p.skills ?? []).map(clean).filter(Boolean);
    return skills.length ? `## Skills\n\n${skills.join(" · ")}` : "";
  },
};

/**
 * Serialize structured profile data into resume Markdown for the Document Editor.
 *
 * @param profile     Structured data (typically from parseProfileFromImport).
 * @param sectionOrder Ordered section keys. Defaults to the default template's order.
 */
export function profileToResumeMarkdown(
  profile: ResumeData,
  sectionOrder: string[] = DEFAULT_STYLE_CONFIG.sectionOrder,
): string {
  const blocks: string[] = [];

  // Header (name + contact) always leads, regardless of where "contact" sits in order.
  const name = clean(profile.fullName) || clean(profile.preferredName);
  if (name) blocks.push(`# ${escapeInline(name)}`);
  const contact = contactLine(profile);
  if (contact) blocks.push(contact);

  for (const key of sectionOrder) {
    if (key === "contact") continue; // handled in the header above
    const build = SECTION_BUILDERS[key];
    const section = build ? build(profile).trim() : "";
    if (section) blocks.push(section);
  }

  return blocks.join("\n\n").trim();
}
