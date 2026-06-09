import type { UserProfile } from "@/types/userProfile";
import { supabase } from "@/lib/supabaseClient";
import { buildCompanyResearchSources } from "@/config/companyResearchSources";
import { parseJsonObject, parseJsonArray, parseLooseJsonObject } from "@/lib/looseJson";

const GATEWAY_URL =
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate";

const PROFILE_EXTRACTION_SYSTEM = `You are a structured data extractor. Given career content (LinkedIn profile text or resume text), return ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string (URL if present)",
  "github": "string (URL if present)",
  "portfolio": "string (URL if present)",
  "targetRole": "string (infer from most recent role or stated goal)",
  "currentRole": "string (most recent job title)",
  "yearsOfExperience": number,
  "summary": "string (2-3 sentences)",
  "workHistory": [{ "id": "string (8-char random alphanumeric)", "company": "string", "role": "string", "startDate": "string (e.g. January 2020)", "endDate": "string (e.g. March 2023, or Present if current)", "responsibilities": "string (every bullet/sentence copied VERBATIM from the source, one per line, separated by \\n — do not summarise, reword, merge, or drop any)", "current": boolean }],
  "education": [{ "id": "string (8-char random alphanumeric)", "university": "string", "degree": "string", "graduationYear": "string (e.g. May 2021)", "major": "string", "minor": "string" }],
  "skills": ["array of individual skill strings"]
}
CRITICAL ACCURACY RULES:
- Transcribe content exactly as written. Never invent, embellish, or infer responsibilities, metrics, titles, dates, or skills that are not in the source.
- Preserve every work-experience bullet verbatim — do not summarise or combine bullets.
- Keep dates exactly as the source presents them.
- Omit fields not present in the source material (do not include null or empty strings).
- The source is machine-extracted text and may be messy (multi-column layouts, broken line wraps, stray characters). Reassemble it into the correct fields using your best reading, but if a field is garbled, truncated, or you cannot confidently determine it, omit that field rather than guessing.
- Generate random 8-character alphanumeric IDs for id fields.
- Output the raw JSON object only: begin with "{" and end with "}", with no prose, comments, or code fences before or after.`;

export async function parseProfileFromImport(
  input:
    | { type: "linkedin"; text: string; url?: string }
    | { type: "resume"; text: string }
): Promise<Partial<UserProfile>> {
  let prompt: string;
  if (input.type === "linkedin") {
    prompt = `Extract structured career profile data from the following LinkedIn profile text.\n`;
    if (input.url) prompt += `LinkedIn URL: ${input.url}\n\n`;
    prompt += `LinkedIn Profile Text:\n${input.text}`;
  } else {
    prompt = `Extract structured career profile data from the following resume:\n\n${input.text}`;
  }

  try {
    const raw = await generateWorkflowData(PROFILE_EXTRACTION_SYSTEM, prompt, "gemini-3.1-flash-lite");
    const clean = raw.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    const jsonStr = firstBrace >= 0 && lastBrace >= 0 ? clean.slice(firstBrace, lastBrace + 1) : clean;
    const parsed = JSON.parse(jsonStr) as Partial<UserProfile>;
    return parsed;
  } catch (err) {
    console.error("parseProfileFromImport failed:", err);
    return {};
  }
}

export interface Improvement {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'impact' | 'clarity' | 'grammar' | 'keywords' | 'formatting';
  checklistLabel: string;
  description: string;
  originalText: string;
  suggestedText: string;
}

export interface ResumeAnalysisResult {
  resumeText: string;
  overallScore: number | null;
  summary: string;
  improvements: Improvement[];
}

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

export interface SourceLink { label: string; url: string }

const GATEWAY_DOWN_MESSAGE =
  "The local Privacy Gateway is not running. Please run 'npx tsx server.ts' in your terminal.";

/**
 * Low-level gateway call that surfaces both the generated text AND any grounding
 * sources the gateway returns (production Gemini search grounding populates
 * `sources`; the local Claude-CLI gateway returns `[]` and embeds citations in
 * the text instead). Most callers want only the text — use `postToGateway`.
 */
async function postToGatewayRaw(body: object): Promise<{ text: string; sources: SourceLink[] }> {
  console.log("🚀 Sending to gateway:", GATEWAY_URL);
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "(no body)");
      throw new Error(`Gateway ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    return { text: data.text, sources: Array.isArray(data.sources) ? data.sources : [] };
  } catch (error) {
    console.error("❌ Gateway Error:", error);
    return { text: GATEWAY_DOWN_MESSAGE, sources: [] };
  }
}

async function postToGateway(body: object): Promise<string> {
  return (await postToGatewayRaw(body)).text;
}

export async function generateWorkflowData(
  systemInstruction: string,
  prompt: string,
  model: string = "claude-haiku-4-5-20251001",
  enableSearch: boolean = false
) {
  return postToGateway({ systemInstruction, prompt, model, enableSearch });
}

const RESUME_ANALYSIS_SYSTEM = `You are an expert resume reviewer and applicant-tracking-system (ATS) specialist who has screened thousands of resumes across many industries. You give honest, specific, prioritized feedback, tailored to the candidate's field and — when provided — the target job. Output only the requested JSON: no prose, no explanations, no code fences; begin with "{" and end with "}".`;

const buildResumeAnalysisPrompt = (resumeText: string, jd: string): string => `
Analyze the resume below and return ONLY a raw JSON object — no markdown fences, no explanation.

Required JSON shape:
{
  "resumeText": "<full resume as clean Markdown, preserving all content>",
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence assessment of key strengths and gaps>",
  "improvements": [
    {
      "id": "<unique string like '1', '2', ...>",
      "priority": "high" | "medium" | "low",
      "category": "impact" | "clarity" | "grammar" | "keywords" | "formatting",
      "checklistLabel": "<short imperative label, max 8 words, e.g. Quantify impact in Work Experience>",
      "description": "<1-2 sentences explaining what to fix and why>",
      "originalText": "<a SHORT exact substring (one sentence or phrase, not a whole section) copied character-for-character from resumeText>",
      "suggestedText": "<improved replacement text>"
    }
  ]
}

Rules:
- Produce 6-15 of the highest-impact improvements, prioritized — do not pad the list or repeat the same issue.
- overallScore guide: 85-100 = strong, interview-ready; 70-84 = solid with clear gaps; 50-69 = needs significant work; below 50 = major issues. Score against the target job if one is provided, otherwise against general best practice for the candidate's field.
- originalText must be a SHORT exact substring copied character-for-character from resumeText (a single sentence or phrase, not a whole paragraph or section) so the app can locate and replace it — never paraphrase, abbreviate, or add line breaks that aren't in the source.
- Do not include the candidate's name or contact info in originalText.
- impact: flag vague duties (Responsible for, Helped with) and missing metrics; suggest the XYZ pattern (Action + Metric + Result).
- clarity: flag passive voice, sentences over 25 words, jargon.
- grammar: flag tense inconsistency, punctuation errors.
- keywords: flag keywords from the target job that are missing from the resume (high priority); skip this category entirely if no job description was provided.
- formatting: flag inconsistent dates, missing section headers.
${jd ? `\nTarget Job Description:\n${jd}` : ''}

Resume:
${resumeText}
`.trim();

export async function analyzeResume(
  resumeText: string,
  jdText: string,
  jdUrl: string
): Promise<ResumeAnalysisResult> {
  const jd = jdText || jdUrl;
  const prompt = buildResumeAnalysisPrompt(resumeText, jd);
  const response = await generateWorkflowData(RESUME_ANALYSIS_SYSTEM, prompt, 'claude-sonnet-4-6');

  try {
    const parsed = parseJsonObject(response);
    return {
      resumeText: parsed.resumeText ?? resumeText,
      overallScore: parsed.overallScore ?? null,
      summary: parsed.summary ?? '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };
  } catch (e) {
    console.error('Failed to parse resume analysis JSON. Raw response preview:', response.slice(0, 500));
    return { resumeText, overallScore: null, summary: '', improvements: [] };
  }
}

// ─── LinkedIn profile optimization ──────────────────────────────────────────

export type ProfileRegionKey =
  | 'banner' | 'photo' | 'headline' | 'about' | 'featured'
  | 'experience' | 'education' | 'skills' | 'none';

export interface DesignRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'banner' | 'photo' | 'url' | 'featured' | 'formatting' | 'completeness' | 'scannability';
  title: string;
  description: string;
  region: ProfileRegionKey; // which part of the profile this points at (for highlighting)
}

export interface LinkedInAnalysisResult {
  profileText: string;
  overallScore: number | null;
  summary: string;
  improvements: Improvement[];
  designRecommendations: DesignRecommendation[];
}

const LINKEDIN_ANALYSIS_SYSTEM = `You are an expert LinkedIn profile strategist, recruiter, and personal-branding coach who has reviewed thousands of profiles across many industries. You give honest, specific, prioritized feedback that helps the profile win attention from both human recruiters and LinkedIn keyword search. You optimize for the candidate's target role when one is given. Output only the requested JSON: no prose, no explanations, no code fences; begin with "{" and end with "}".`;

const buildLinkedInAnalysisPrompt = (profileText: string, targetRole: string): string => `
Analyze the LinkedIn profile below (extracted from the user's "Save to PDF" export) and return ONLY a raw JSON object — no markdown fences, no explanation.

Required JSON shape:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence assessment of the profile's biggest strengths and gaps>",
  "improvements": [
    {
      "id": "<unique string like '1', '2', ...>",
      "priority": "high" | "medium" | "low",
      "category": "impact" | "clarity" | "grammar" | "keywords" | "formatting",
      "checklistLabel": "<short imperative label naming the section, max 8 words, e.g. 'Headline: lead with measurable value'>",
      "description": "<1-2 sentences explaining what to fix and why>",
      "originalText": "<a SHORT exact substring (one sentence or phrase) copied character-for-character from the LinkedIn Profile text below>",
      "suggestedText": "<improved replacement text the user can paste into LinkedIn>"
    }
  ],
  "designRecommendations": [
    {
      "id": "<unique string like 'd1', 'd2', ...>",
      "priority": "high" | "medium" | "low",
      "category": "banner" | "photo" | "url" | "featured" | "formatting" | "completeness" | "scannability",
      "title": "<short imperative, max 8 words>",
      "description": "<1-2 sentences of concrete, actionable design/presentation advice>",
      "region": "banner" | "photo" | "headline" | "about" | "featured" | "experience" | "education" | "skills" | "none"
    }
  ]
}

Rules:
- "improvements" are CONTENT edits (Headline, About, Experience, Skills). Produce 5-8 of the highest-impact, prioritized — name the section in checklistLabel. originalText must be a SHORT exact substring copied character-for-character from the LinkedIn Profile text below so the app can locate it; never paraphrase or add line breaks that aren't in the source. Keep any Headline rewrite under 220 characters.
- "designRecommendations" are PRESENTATION/visual best practices that are NOT text edits — the profile PDF does not reveal these, so advise based on standard LinkedIn best practice. Produce 3-5, prioritized. Cover, where relevant: a custom background banner (banner), a professional headshot (photo), a custom profile URL (url), using the Featured section (featured), formatting/readability of the About and Experience (formatting), completeness of sections like Skills/Education/Recommendations (completeness), and scannability — short paragraphs, line breaks, bullet points (scannability). Set "region" to the profile area each tip points at so the app can highlight it on the screenshot (banner, photo, headline, about, featured, experience, education, skills) — use "none" only if it maps to no single area.
- overallScore guide: 85-100 = strong, recruiter-ready; 70-84 = solid with clear gaps; 50-69 = needs significant work; below 50 = major issues. Score against the target role if provided, otherwise against general best practice for the candidate's field.
- Use only the candidate's real experience — never invent roles, employers, metrics, or skills.
${targetRole ? `\nTarget role: ${targetRole}` : ''}

LinkedIn Profile:
${profileText}
`.trim();

export async function analyzeLinkedInProfile(
  profileText: string,
  targetRole: string = ""
): Promise<LinkedInAnalysisResult> {
  const prompt = buildLinkedInAnalysisPrompt(profileText, targetRole);
  const response = await generateWorkflowData(LINKEDIN_ANALYSIS_SYSTEM, prompt, 'claude-sonnet-4-6');

  try {
    const parsed = parseJsonObject(response);
    return {
      profileText: parsed.profileText ?? profileText,
      overallScore: parsed.overallScore ?? null,
      summary: parsed.summary ?? '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      designRecommendations: Array.isArray(parsed.designRecommendations) ? parsed.designRecommendations : [],
    };
  } catch (e) {
    console.error('Failed to parse LinkedIn analysis JSON. Raw response preview:', response.slice(0, 500));
    return {
      profileText,
      overallScore: null,
      summary: "We couldn't generate suggestions this time — please try analysing again.",
      improvements: [],
      designRecommendations: [],
    };
  }
}

export interface TailorSuggestion {
  id: string;
  section: string;
  type: 'rewrite' | 'add_keyword' | 'strengthen';
  originalText: string;
  suggestedText: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

const TAILOR_RESUME_SYSTEM = `You are an expert resume coach. Your job is to help candidates tailor their existing resume to a specific job description by suggesting targeted inline edits.

CRITICAL RULES:
- Never invent new companies, job titles, dates, projects, or metrics that don't exist in the resume
- Only rewrite or strengthen content that already exists
- You may suggest adding job-relevant keywords where the existing context supports them
- Focus on: keyword alignment, stronger action verbs, quantification of existing achievements, reordering emphasis
- Return ONLY a valid JSON array — no markdown fences, no explanation; begin with "[" and end with "]"`;

export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  jobMeta?: { jobTitle?: string; companyName?: string }
): Promise<TailorSuggestion[]> {
  const targetLine = [jobMeta?.jobTitle, jobMeta?.companyName].filter(Boolean).join(" at ");
  const prompt = `Analyze the resume below against the job description and produce 6–15 high-impact inline edit suggestions, prioritized.
${targetLine ? `\nTARGET ROLE: ${targetLine}\n` : ""}

Return a JSON array with this exact shape:
[
  {
    "id": "<unique string>",
    "section": "<section label, e.g. 'Summary', 'Work Experience – Acme Corp'>",
    "type": "rewrite" | "add_keyword" | "strengthen",
    "originalText": "<a SHORT exact substring (one sentence or phrase) copied character-for-character from the resume>",
    "suggestedText": "<drop-in replacement — same length/scope as originalText>",
    "rationale": "<one sentence naming the specific job-description requirement or keyword this edit targets>",
    "priority": "high" | "medium" | "low"
  }
]

Rules:
- originalText must be a SHORT exact substring (a single sentence or phrase, not a whole section) copied character-for-character from the resume so the app can locate it — never abbreviate or add line breaks that aren't in the source.
- Do NOT invent new roles, companies, dates, or metrics; only strengthen or reframe what already exists.
- Every suggestion's rationale must name the specific job-description requirement or keyword it targets.
- high priority = directly matches a key requirement/keyword in the job description.
- Spread suggestions across the relevant sections (e.g. Summary, Skills, Work Experience) and don't pile more than a few edits into any single section.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}`;

  const response = await generateWorkflowData(TAILOR_RESUME_SYSTEM, prompt, 'claude-sonnet-4-6');
  try {
    return parseJsonArray<TailorSuggestion>(response);
  } catch (e) {
    console.error('Failed to parse tailor suggestions. Raw preview:', response.slice(0, 500));
    return [];
  }
}

// ─── Research Company (live web search) ─────────────────────────────────────

/**
 * Model for the grounded company-research call. Passed straight through the
 * gateway: `toGeminiModel` forwards unknown `gemini-*` names as-is.
 *
 * `gemini-2.5-flash` is verified working with Google-Search grounding on the
 * current API key (returns real groundingMetadata source URLs). The 3.x flash
 * *preview* models (e.g. `gemini-3.1-flash-lite-preview`) return HTTP 429
 * "quota exceeded" on this plan — swap this constant to one of them once that
 * model is enabled/has grounding quota on the project's billing tier.
 */
export const COMPANY_RESEARCH_MODEL = "gemini-2.5-flash";

export interface CompanyResearchSection {
  summary: string;
  bullets: string[];
  sources: SourceLink[];
}

/** Combined shape the UI renders (assembled from the two cached tiers). */
export interface CompanyResearchResult {
  overview: string;
  hiringValues: CompanyResearchSection;
  benefits: CompanyResearchSection;
  news: CompanyResearchSection;
  financials: CompanyResearchSection;
  sources: SourceLink[];
}

/** Slow-moving tier — cached for weeks. */
export interface CompanyProfileData {
  overview: string;
  hiringValues: CompanyResearchSection;
  benefits: CompanyResearchSection;
  financials: CompanyResearchSection;
  sources: SourceLink[];
}

/** Fast-moving tier — cached briefly. */
export interface CompanyNewsData {
  news: CompanyResearchSection;
  sources: SourceLink[];
}

// Lean, purpose-built system prompts (no basePersona) to minimize input tokens.
const COMPANY_PROFILE_SYSTEM = `You research a company to help a candidate interview well. A live web search tool IS available — use it for anything time-sensitive and cite the real URLs you retrieve; never invent URLs or figures. You are given JOB POSTING TEXT — use it directly for benefits/values where present and only search for what it doesn't cover.

Produce, searching where needed:
- hiringValues: what the company values when hiring (careers/jobs/culture pages — traits, principles, competencies).
- benefits: key benefits & perks (comp philosophy, health/leave, equity, remote/flexibility, learning budget).
- financials: most recent quarterly earnings, revenue/growth, guidance, stock; private → latest funding/valuation. Date-stamp every figure. If unknown, say so in the summary and leave bullets sparse.

Output ONLY a compact JSON object, no markdown fences:
{"overview":"2-3 sentences + recency note","hiringValues":{"summary":"1-2 sentences","bullets":["..."],"sources":[{"label":"...","url":"https://..."}]},"benefits":{"summary":"...","bullets":["..."],"sources":[...]},"financials":{"summary":"...","bullets":["metric — value — period"],"sources":[...]},"sources":[{"label":"...","url":"..."}]}
At most 4 bullets/section (≤25 words each) and 3 sources/section. Begin with "{" and end with "}".`;

const COMPANY_NEWS_SYSTEM = `You find recent news about a company to help a candidate interview well. A live web search tool IS available — use it and cite the real URLs you retrieve; never invent URLs. Prioritize news tied to the candidate's role/team/department (launches, org changes, hiring in that area); if little role-specific news exists, fall back to the most important recent company news. Date-stamp each item.

Output ONLY a compact JSON object, no markdown fences:
{"news":{"summary":"1-2 sentences","bullets":["headline — date — why it matters"],"sources":[{"label":"...","url":"https://..."}]},"sources":[{"label":"...","url":"..."}]}
At most 5 bullets (≤25 words each) and 4 sources. Begin with "{" and end with "}".`;

/**
 * Parse a JSON object from an LLM response that may be fenced (```json) and/or
 * TRUNCATED (e.g. cut off at the token limit mid-string). Strips fences, then
 * if a clean parse fails, walks the text tracking string/escape state and
 * closes any unterminated string and open braces/brackets to recover the
 * largest valid object. Returns a best-effort object; throws only if there is
 * no `{` at all.
 */
const EMPTY_SECTION = (summary: string): CompanyResearchSection => ({ summary, bullets: [], sources: [] });

function normalizeSection(raw: any, fallbackSources: SourceLink[]): CompanyResearchSection {
  const sources: SourceLink[] = Array.isArray(raw?.sources)
    ? raw.sources.filter((s: any) => s && typeof s.url === "string" && s.url.trim())
        .map((s: any) => ({ label: String(s.label ?? s.url), url: String(s.url) }))
    : [];
  return {
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    bullets: Array.isArray(raw?.bullets) ? raw.bullets.filter((b: any) => typeof b === "string") : [],
    sources: sources.length ? sources : fallbackSources,
  };
}

// Bound how much of the (free, user-provided) JD we feed each grounded call, so
// inputs stay small. The profile call gets more — it mines benefits/values from
// the posting; the news call only needs light role context.
const JD_PROFILE_EXCERPT = 1500;
const JD_ROLE_SNIPPET = 400;

function roleLine(jobTitle: string, jobDescription: string, snippetLen: number): string {
  const title = jobTitle?.trim() ? jobTitle.trim() : "(role described in the posting excerpt)";
  const snippet = (jobDescription ?? "").trim().slice(0, snippetLen);
  return `TARGET ROLE: ${title}${snippet ? `\nROLE CONTEXT (excerpt): ${snippet}` : ""}`;
}

/** Model-declared sources + gateway grounding URLs, deduped; fallback if none. */
function collectSources(parsed: any, grounding: SourceLink[], fallback: SourceLink[]): SourceLink[] {
  const declared: SourceLink[] = Array.isArray(parsed?.sources)
    ? parsed.sources.filter((s: any) => s && typeof s.url === "string").map((s: any) => ({ label: String(s.label ?? s.url), url: String(s.url) }))
    : [];
  const merged = [...declared, ...grounding];
  const dedup = merged.filter((s, i) => s.url && merged.findIndex((o) => o.url === s.url) === i);
  return dedup.length ? dedup : fallback;
}

/**
 * Slow-moving tier: hiring values, benefits, financials (+overview). Mines the
 * provided JD excerpt for benefits/values before searching. Cached for weeks.
 */
export async function researchCompanyProfile(input: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}): Promise<CompanyProfileData> {
  const { jobTitle, companyName, jobDescription } = input;
  const fallback = buildCompanyResearchSources(companyName);
  const prompt = `COMPANY: ${companyName}
${roleLine(jobTitle, jobDescription, JD_PROFILE_EXCERPT)}

JOB POSTING TEXT (use for benefits/values where present; don't search for what's already here):
${(jobDescription || "(none provided)").slice(0, JD_PROFILE_EXCERPT)}

Return only the JSON object.`;
  const { text, sources: grounding } = await postToGatewayRaw({
    systemInstruction: COMPANY_PROFILE_SYSTEM,
    prompt,
    model: COMPANY_RESEARCH_MODEL,
    enableSearch: true,
  });
  try {
    const parsed = parseLooseJsonObject(text);
    return {
      overview: typeof parsed.overview === "string" ? parsed.overview : "",
      hiringValues: normalizeSection(parsed.hiringValues, [fallback.careers]),
      benefits: normalizeSection(parsed.benefits, [fallback.careers]),
      financials: normalizeSection(parsed.financials, [fallback.financials]),
      sources: collectSources(parsed, grounding, [fallback.careers, fallback.financials]),
    };
  } catch {
    console.error("Failed to parse company profile JSON. Raw preview:", text.slice(0, 500));
    return {
      overview: "",
      hiringValues: EMPTY_SECTION(""),
      benefits: EMPTY_SECTION(""),
      financials: EMPTY_SECTION(""),
      sources: [fallback.careers, fallback.financials],
    };
  }
}

/** Fast-moving tier: role-relevant news (fallback: recent company news). Cached briefly. */
export async function researchCompanyNews(input: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}): Promise<CompanyNewsData> {
  const { jobTitle, companyName, jobDescription } = input;
  const fallback = buildCompanyResearchSources(companyName);
  const prompt = `COMPANY: ${companyName}
${roleLine(jobTitle, jobDescription, JD_ROLE_SNIPPET)}

Find recent news (role/team-relevant first, else important recent company news). Return only the JSON object.`;
  const { text, sources: grounding } = await postToGatewayRaw({
    systemInstruction: COMPANY_NEWS_SYSTEM,
    prompt,
    model: COMPANY_RESEARCH_MODEL,
    enableSearch: true,
  });
  try {
    const parsed = parseLooseJsonObject(text);
    return { news: normalizeSection(parsed.news, [fallback.news]), sources: collectSources(parsed, grounding, [fallback.news]) };
  } catch {
    console.error("Failed to parse company news JSON. Raw preview:", text.slice(0, 500));
    return { news: EMPTY_SECTION(""), sources: [fallback.news] };
  }
}

/** Merge the two cached tiers into the shape the UI renders. */
export function assembleCompanyResearch(profile: CompanyProfileData, news: CompanyNewsData): CompanyResearchResult {
  const merged = [...profile.sources, ...news.sources];
  const sources = merged.filter((s, i) => s.url && merged.findIndex((o) => o.url === s.url) === i);
  return {
    overview: profile.overview,
    hiringValues: profile.hiringValues,
    benefits: profile.benefits,
    news: news.news,
    financials: profile.financials,
    sources,
  };
}

export async function rewriteResumeSelection(selectedText: string, instruction: string, fullResumeText: string) {
  const systemInstruction = `You are an elite resume writer. The user has selected a specific passage from their resume and wants it improved.
Return ONLY the rewritten text — no explanation, no preamble, no quotes. Preserve the original's markdown structure (any leading bullet marker like "- ", heading level, bold, etc.) so it drops in cleanly, and keep it close to the original length (within roughly ±15%). Improve wording, impact, and clarity, but never invent achievements, metrics, employers, titles, or dates that aren't in the original or clearly supported by the resume context — if a metric would help, leave a placeholder like "[X%]" for the user to fill in.`;
  const prompt = `Full resume context:\n${fullResumeText}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`;
  return await generateWorkflowData(systemInstruction, prompt, "claude-haiku-4-5-20251001");
}

export async function suggestWorkExperienceBullets(role: string, company: string, currentBullets: string = "") {
  const systemInstruction = `You are an expert resume writer. Generate 3-5 high-impact bullet points for the given role, tailored to its field, using strong action verbs and the XYZ pattern (accomplished X, measured by Y, by doing Z). Do NOT invent specific numbers, metrics, employers, or facts the user hasn't provided — where a metric would strengthen a bullet, insert a clear placeholder like "[X%]" or "[$ amount]" for the user to fill in. Return only the bullet points.`;
  const prompt = `Role: ${role}\nCompany: ${company}\nCurrent content: ${currentBullets}\n\nGenerate improved bullet points using the XYZ pattern. Use placeholders like [X%] for any metric you don't have.`;
  return await generateWorkflowData(systemInstruction, prompt);
}

export type ImproveMode = "refine" | "suggest";

const REFINE_SYSTEM = `You are an editor polishing a short career self-assessment answer. Improve HOW it is written without changing WHAT it says.

You MAY:
- Fix grammar, spelling, and punctuation.
- Improve sentence structure and flow.
- Improve clarity — rephrase awkward or vague wording into plain, precise language (same meaning).
- Make it more concise — cut filler, redundancy, and rambling.
- Strengthen tone — confident and professional, while staying authentic and first person.
- Prefer active voice and stronger, more precise verbs (e.g. "was responsible for managing" → "managed").
- Remove hedging and filler words ("kind of", "I guess", "just", "really").
- Keep tense and point of view consistent.

You MUST NOT:
- Add new ideas, facts, examples, skills, metrics, or details that aren't already in the draft.
- Complete or expand unfinished thoughts, or answer parts the user left blank — that is the separate "Suggest" tool's job.

Return ONLY the edited text — no preamble, no quotes, no markdown.`;

const SUGGEST_SYSTEM = `You help a professional complete and round out a short answer to a career self-assessment question.
Review their draft and produce an improved, fuller version that builds on what they wrote — completing unfinished thoughts and making it clearer and more specific so it's useful for career planning.
RULES:
- Build on the user's actual content; keep their voice, stay first person, keep it concise (1–5 sentences).
- Do NOT invent concrete facts the user didn't provide (specific companies, metrics, named skills). Where a specific detail would strengthen the answer but you don't know it, insert a short bracketed placeholder for the user to fill in, e.g. "[name the specific skill — e.g. mobile dev, UX, or back-end]".
- Return ONLY the suggested text — no preamble, no quotes, no markdown.`;

function cleanAnswerText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * Improve a free-text survey answer.
 * - "refine": copy-edit only (grammar, spelling, sentence structure) — no new content.
 * - "suggest": review and complete/expand the thought, with bracketed placeholders
 *   instead of invented specifics.
 * Returns plain text the user can accept into the field.
 */
export async function improveSurveyAnswer(
  question: string,
  answer: string,
  mode: ImproveMode
): Promise<string> {
  const system = mode === "refine" ? REFINE_SYSTEM : SUGGEST_SYSTEM;
  const verb = mode === "refine" ? "Correct" : "Improve and complete";
  const prompt = `Question: ${question}\n\nMy draft answer:\n${answer}\n\n${verb} my answer per the rules.`;
  const raw = await generateWorkflowData(system, prompt, "claude-haiku-4-5-20251001");
  return cleanAnswerText(raw) || answer;
}

export function createTechCoachChat(systemInstruction: string, _enableSearch?: boolean) {
  return {
    sendMessageStream: async ({ message }: any) => {
      const response = await generateWorkflowData(systemInstruction, message);
      return [{ text: response }];
    }
  };
}

/**
 * Stateful chat for interactive coaching. The AI gateway is stateless (it only
 * accepts `systemInstruction` + a single `prompt`), so this helper keeps the
 * running conversation in memory and replays it on every turn — giving the
 * coach genuine multi-turn memory of the profile baseline and generated plan.
 *
 * Seed `history` with prior turns (e.g. a previously generated plan) to resume
 * a saved coaching session.
 */
export function createCoachingChat(
  systemInstruction: string,
  history: { role: "user" | "model"; text: string }[] = []
) {
  const turns = [...history];
  return {
    sendMessageStream: async ({ message }: { message: string }) => {
      const transcript = turns
        .map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`)
        .join("\n\n");
      const prompt = transcript
        ? `Conversation so far:\n${transcript}\n\nUser: ${message}\n\nCoach:`
        : message;
      const response = await generateWorkflowData(systemInstruction, prompt, "claude-sonnet-4-6");
      turns.push({ role: "user", text: message });
      turns.push({ role: "model", text: response });
      return [{ text: response }];
    },
  };
}

export async function sendMessageStream(chat: any, message: string, onChunk: (text: string) => void) {
  const chunks = await chat.sendMessageStream({ message });
  onChunk(chunks[0].text);
}
