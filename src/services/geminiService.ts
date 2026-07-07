import type { UserProfile } from "@/types/userProfile";
import type { QuestionFeedback, STARElement } from "@/types/interviewSession";
import { supabase } from "@/lib/supabaseClient";
import { buildCompanyResearchSources } from "@/config/companyResearchSources";
import { MODELS } from "@/config/models";
import { runWorkflow } from "@/ai/client";
import { resumeAnalysisWorkflow, type ResumeAnalysisOutput } from "@/ai/workflows/resumeAnalysis";
import {
  resumeAnalysisCacheKey,
  getCachedResumeAnalysis,
  putCachedResumeAnalysis,
} from "@/services/resumeAnalysisCache";
import { linkedinAnalysisWorkflow } from "@/ai/workflows/linkedinAnalysis";
import { tailorResumeWorkflow } from "@/ai/workflows/tailorResume";
import { milestoneExtractionWorkflow } from "@/ai/workflows/milestoneExtraction";
import { interviewEvaluationWorkflow } from "@/ai/workflows/interviewEvaluation";
import { profileExtractionWorkflow } from "@/ai/workflows/profileExtraction";
import {
  rewriteSelectionWorkflow,
  workBulletsWorkflow,
  surveyAnswerWorkflow,
} from "@/ai/workflows/freeform";
import {
  careerDiscoveryWorkflow,
  companyProfileWorkflow,
  companyNewsWorkflow,
} from "@/ai/workflows/companyResearch";
import type { BlogSource } from "@/types/blogPost";
import { writerSystem, editorSystem } from "@/config/blogPrompts";
import {
  briefFromTopic,
  buildWriterPrompt,
  parseWriterDraft,
  buildEditorPrompt,
  parseEditorVerdict,
  readingMinutes,
} from "@/lib/blogDraft";

const GATEWAY_URL =
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate";

/** Drop blank/empty fields so absent data never clobbers the existing profile
 *  (the old prompt told the model to omit them; responseSchema may emit ""). */
function stripBlank<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export async function parseProfileFromImport(
  input: { type: "linkedin"; text: string; url?: string } | { type: "resume"; text: string },
): Promise<Partial<UserProfile>> {
  const result = await runWorkflow(profileExtractionWorkflow, {
    kind: input.type,
    text: input.text,
    url: input.type === "linkedin" ? input.url : undefined,
  });
  if (result.status !== "ok") {
    console.error("parseProfileFromImport failed:", result.error);
    return {};
  }
  return stripBlank(result.data) as Partial<UserProfile>;
}

export interface Improvement {
  id: string;
  priority: "high" | "medium" | "low";
  category: "impact" | "clarity" | "grammar" | "keywords" | "formatting";
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

export interface SourceLink {
  label: string;
  url: string;
}

const GATEWAY_DOWN_MESSAGE = import.meta.env.DEV
  ? "The local Privacy Gateway is not running. Please run 'npx tsx server.ts' in your terminal."
  : "Could not reach the AI service. Check your connection and try again.";
const GATEWAY_TIMEOUT_MESSAGE = "The AI request timed out. Please try again.";

/** Map a failed gateway call to a message a user can act on. */
function describeGatewayError(error: unknown, timedOut: boolean): string {
  if (timedOut) return GATEWAY_TIMEOUT_MESSAGE;
  const msg = error instanceof Error ? error.message : "";
  const status = Number(/^Gateway (\d{3})/.exec(msg)?.[1] ?? NaN);
  if (status === 401 || status === 403)
    return "Your session has expired. Please refresh the page and sign in again.";
  if (status === 429)
    return "The AI service is handling too many requests right now. Please wait a minute and try again.";
  if (status >= 500) return "The AI service hit a temporary error. Please try again.";
  if (Number.isFinite(status)) return `The AI request failed (HTTP ${status}). Please try again.`;
  return GATEWAY_DOWN_MESSAGE;
}

// Generations with web search can legitimately take a while, but a request
// should never hang the UI forever.
const GATEWAY_TIMEOUT_MS = 120_000;
const GATEWAY_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Low-level gateway call that surfaces both the generated text AND any grounding
 * sources the gateway returns (production Gemini search grounding populates
 * `sources`; the local Claude-CLI gateway returns `[]` and embeds citations in
 * the text instead). Most callers want only the text — use `postToGateway`.
 *
 * Times out after GATEWAY_TIMEOUT_MS and retries transient failures (network
 * errors, 408/429/5xx) with exponential backoff. Timeouts are not retried —
 * the user has already waited long enough.
 */
async function postToGatewayRaw(body: object): Promise<{ text: string; sources: SourceLink[] }> {
  console.log("🚀 Sending to gateway:", GATEWAY_URL);
  let timedOut = false;
  try {
    const authHeader = await getAuthHeader();
    let lastError: unknown;
    for (let attempt = 0; attempt < GATEWAY_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      try {
        const response = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => "(no body)");
          lastError = new Error(`Gateway ${response.status}: ${errBody}`);
          if (RETRYABLE_STATUS.has(response.status)) continue;
          throw lastError;
        }
        const data = await response.json();
        return { text: data.text, sources: Array.isArray(data.sources) ? data.sources : [] };
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          timedOut = true;
          throw error;
        }
        if (error === lastError) throw error; // non-retryable HTTP status
        lastError = error; // network hiccup — retry
      }
    }
    throw lastError;
  } catch (error) {
    console.error("❌ Gateway Error:", error);
    return { text: describeGatewayError(error, timedOut), sources: [] };
  }
}

async function postToGateway(body: object): Promise<string> {
  return (await postToGatewayRaw(body)).text;
}

export async function generateWorkflowData(
  systemInstruction: string,
  prompt: string,
  model: string = MODELS.FAST,
  enableSearch: boolean = false,
) {
  return postToGateway({ systemInstruction, prompt, model, enableSearch });
}

// ─── Blog draft generation (admin authoring) ────────────────────────────────

/** A freshly generated draft, ready to persist as a `blog_posts` row. */
export interface GeneratedBlogDraft {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string;
  sources: BlogSource[];
  heroEmoji?: string;
  model: string;
  readingMinutes: number;
  editorScore: number;
  editorRounds: number;
}

/** Thrown when generation can't produce a usable draft (so callers show the message). */
export class BlogGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogGenerationError";
  }
}

/**
 * Generate a blog draft for a backlog topic, ahead of the scheduled build. Runs
 * a trimmed editorial pass through the gateway — Writer (search-grounded) then a
 * single Editor review whose copy-edit is applied if it approves. The admin edits
 * the result before publishing, so we never gate on the editor's decision.
 */
export async function generateBlogDraft(topic: {
  title: string;
  category: string;
}): Promise<GeneratedBlogDraft> {
  const brief = briefFromTopic(topic.title, topic.category);

  const { text: writerText, sources } = await postToGatewayRaw({
    systemInstruction: writerSystem,
    prompt: buildWriterPrompt(brief),
    model: MODELS.RESEARCH,
    enableSearch: true,
  });
  const draft = parseWriterDraft(writerText, brief, sources as BlogSource[]);
  if (!draft) {
    // On failure postToGatewayRaw returns a human-readable error as `text` (not
    // JSON), so parseWriterDraft yields null — surface that message.
    const looksLikeMessage = writerText && !writerText.trimStart().startsWith("{");
    throw new BlogGenerationError(
      looksLikeMessage ? writerText : "The writer couldn't produce a draft. Please try again.",
    );
  }

  const { text: editorText } = await postToGatewayRaw({
    systemInstruction: editorSystem,
    prompt: buildEditorPrompt(draft),
    model: MODELS.RESEARCH,
    enableSearch: false,
  });
  const verdict = parseEditorVerdict(editorText);
  const content = verdict.polishedContent ?? draft.content;

  return {
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    content,
    sources: draft.sources,
    heroEmoji: draft.heroEmoji,
    model: MODELS.RESEARCH,
    readingMinutes: readingMinutes(content),
    editorScore: verdict.score,
    editorRounds: 1,
  };
}

// Resume-analysis prompt + system instruction now live in the typed workflow
// module `src/ai/workflows/resumeAnalysis.ts` (AI Core v2). This function is a
// thin adapter that maps the workflow result to the existing UI shape.

/** Map a raw workflow analysis onto the UI shape, clamping the score. */
function toResumeAnalysisResult(
  data: ResumeAnalysisOutput,
  resumeText: string,
): ResumeAnalysisResult {
  const overallScore = Number.isFinite(data.overallScore)
    ? Math.min(100, Math.max(0, Math.round(data.overallScore)))
    : null;
  return {
    resumeText: data.resumeText || resumeText,
    overallScore,
    summary: data.summary,
    improvements: data.improvements,
  };
}

export async function analyzeResume(
  resumeText: string,
  jdText: string,
  jdUrl: string,
): Promise<ResumeAnalysisResult> {
  // Migrated onto AI Core v2: native responseSchema + Zod validation via the
  // `ai-gateway` client. No "return ONLY JSON" prompt, no loose-JSON recovery.
  const jd = jdText || jdUrl;

  // Result cache: a byte-identical (resumeText, jd) yields the same analysis, so
  // serve the stored result instead of spending another Gemini call. Editing the
  // resume or changing the target job produces a new key (natural invalidation).
  const cacheKey = await resumeAnalysisCacheKey(resumeText, jd);
  const cached = await getCachedResumeAnalysis(cacheKey);
  if (cached) return toResumeAnalysisResult(cached.data, resumeText);

  const result = await runWorkflow(resumeAnalysisWorkflow, { resumeText, jd });

  if (result.status === "ok") {
    // Fire-and-forget: never block the response on the cache write.
    void putCachedResumeAnalysis(cacheKey, result.data);
    return toResumeAnalysisResult(result.data, resumeText);
  }
  return { resumeText, overallScore: null, summary: result.error, improvements: [] };
}

// ─── LinkedIn profile optimization ──────────────────────────────────────────

export type ProfileRegionKey =
  | "banner"
  | "photo"
  | "headline"
  | "about"
  | "featured"
  | "experience"
  | "education"
  | "skills"
  | "none";

export interface DesignRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category:
    "banner" | "photo" | "url" | "featured" | "formatting" | "completeness" | "scannability";
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

export async function analyzeLinkedInProfile(
  profileText: string,
  targetRole: string = "",
): Promise<LinkedInAnalysisResult> {
  const result = await runWorkflow(linkedinAnalysisWorkflow, { profileText, targetRole });
  if (result.status !== "ok") {
    return {
      profileText,
      overallScore: null,
      summary: "We couldn't generate suggestions this time — please try analysing again.",
      improvements: [],
      designRecommendations: [],
    };
  }
  const { data } = result;
  return {
    profileText: data.profileText ?? profileText,
    overallScore: data.overallScore ?? null,
    summary: data.summary ?? "",
    improvements: data.improvements,
    designRecommendations: data.designRecommendations,
  };
}

export interface TailorSuggestion {
  id: string;
  section: string;
  type: "rewrite" | "add_keyword" | "strengthen";
  originalText: string;
  suggestedText: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  jobMeta?: { jobTitle?: string; companyName?: string },
): Promise<TailorSuggestion[]> {
  const targetLine = [jobMeta?.jobTitle, jobMeta?.companyName].filter(Boolean).join(" at ");
  const result = await runWorkflow(tailorResumeWorkflow, {
    resumeText,
    jobDescription,
    targetLine,
  });
  return result.status === "ok" ? result.data.suggestions : [];
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
export const COMPANY_RESEARCH_MODEL = MODELS.RESEARCH;

/** A single dated news item — lets the UI sort strictly newest → oldest. */
export interface CompanyNewsItem {
  headline: string;
  /** ISO date (YYYY-MM-DD) when known; "" if the model couldn't date it. */
  date: string;
  whyItMatters: string;
  url?: string;
}

export interface CompanyResearchSection {
  summary: string;
  bullets: string[];
  sources: SourceLink[];
  /** News only: structured, date-sorted items. Other sections leave this unset. */
  items?: CompanyNewsItem[];
}

/** Combined shape the UI renders (assembled from the two cached tiers). */
export interface CompanyResearchResult {
  overview: string;
  hiringValues: CompanyResearchSection;
  benefits: CompanyResearchSection;
  interviewTips: CompanyResearchSection;
  news: CompanyResearchSection;
  financials: CompanyResearchSection;
  /** Public stock ticker (uppercase) when the company is listed; "" if private/unknown. */
  ticker?: string;
  sources: SourceLink[];
}

/** Slow-moving tier — cached for weeks. */
export interface CompanyProfileData {
  overview: string;
  hiringValues: CompanyResearchSection;
  benefits: CompanyResearchSection;
  interviewTips: CompanyResearchSection;
  financials: CompanyResearchSection;
  ticker?: string;
  sources: SourceLink[];
}

/** Fast-moving tier — cached briefly. */
export interface CompanyNewsData {
  news: CompanyResearchSection;
  sources: SourceLink[];
}

/**
 * Parse a JSON object from an LLM response that may be fenced (```json) and/or
 * TRUNCATED (e.g. cut off at the token limit mid-string). Strips fences, then
 * if a clean parse fails, walks the text tracking string/escape state and
 * closes any unterminated string and open braces/brackets to recover the
 * largest valid object. Returns a best-effort object; throws only if there is
 * no `{` at all.
 */
const EMPTY_SECTION = (summary: string): CompanyResearchSection => ({
  summary,
  bullets: [],
  sources: [],
});

/** Coerce a model-supplied ticker to a clean uppercase symbol, or "" if implausible. */
function normalizeTicker(raw: any): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().toUpperCase();
  return /^[A-Z][A-Z.\-]{0,9}$/.test(t) ? t : "";
}

/**
 * Coerce the model's `news.items` into dated, newest-first CompanyNewsItems and
 * synthesize matching `bullets` ("headline — date — why") for the copy/markdown
 * path and older renderers. Undated items sort to the bottom.
 */
export function normalizeNewsSection(
  raw: any,
  fallbackSources: SourceLink[],
): CompanyResearchSection {
  const base = normalizeSection(raw, fallbackSources);
  const rawItems: any[] = Array.isArray(raw?.items) ? raw.items : [];
  const items: CompanyNewsItem[] = rawItems
    .map((it) => ({
      headline: typeof it?.headline === "string" ? it.headline.trim() : "",
      date:
        typeof it?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.date.trim())
          ? it.date.trim()
          : "",
      whyItMatters: typeof it?.whyItMatters === "string" ? it.whyItMatters.trim() : "",
      url: typeof it?.url === "string" && it.url.trim() ? it.url.trim() : undefined,
    }))
    .filter((it) => it.headline)
    .sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));

  if (items.length === 0) return base; // pre-`items` shape or empty — keep bullets as-is
  return {
    ...base,
    items,
    bullets: items.map((it) => [it.headline, it.date, it.whyItMatters].filter(Boolean).join(" — ")),
  };
}

function normalizeSection(raw: any, fallbackSources: SourceLink[]): CompanyResearchSection {
  const sources: SourceLink[] = Array.isArray(raw?.sources)
    ? raw.sources
        .filter((s: any) => s && typeof s.url === "string" && s.url.trim())
        .map((s: any) => ({ label: String(s.label ?? s.url), url: String(s.url) }))
    : [];
  return {
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    bullets: Array.isArray(raw?.bullets)
      ? raw.bullets.filter((b: any) => typeof b === "string")
      : [],
    sources: sources.length ? sources : fallbackSources,
  };
}

/** Model-declared sources + gateway grounding URLs, deduped; fallback if none. */
function collectSources(
  parsed: any,
  grounding: SourceLink[],
  fallback: SourceLink[],
): SourceLink[] {
  const declared: SourceLink[] = Array.isArray(parsed?.sources)
    ? parsed.sources
        .filter((s: any) => s && typeof s.url === "string")
        .map((s: any) => ({ label: String(s.label ?? s.url), url: String(s.url) }))
    : [];
  const merged = [...declared, ...grounding];
  // Normalize so http/https and trailing-slash variants of the same page dedupe.
  const normalize = (url: string) =>
    url
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  const dedup = merged.filter(
    (s, i) => s.url && merged.findIndex((o) => normalize(o.url) === normalize(s.url)) === i,
  );
  return dedup.length ? dedup : fallback;
}

/** URLs on the company's OWN careers site, used to navigate + scrape primary-source content. */
export interface CareerPageLinks {
  careers?: string;
  culture?: string;
  benefits?: string;
  interview?: string;
}

/**
 * Ask the grounded model for the company's own careers-related page URLs so the
 * app can navigate to and scrape them. Best-effort: returns {} on any failure.
 */
export async function discoverCareerUrls(companyName: string): Promise<CareerPageLinks> {
  const result = await runWorkflow(careerDiscoveryWorkflow, { companyName });
  if (result.status !== "ok") return {};
  const parsed = result.data;
  const pick = (v: unknown) =>
    typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : undefined;
  return {
    careers: pick(parsed.careers),
    culture: pick(parsed.culture),
    benefits: pick(parsed.benefits),
    interview: pick(parsed.interview),
  };
}

export async function researchCompanyProfile(input: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  /** Real text scraped from the company's own careers pages, plus their URLs. */
  careerContext?: { text: string; sources: SourceLink[] };
}): Promise<CompanyProfileData> {
  const { jobTitle, companyName, jobDescription, careerContext } = input;
  const fallback = buildCompanyResearchSources(companyName);
  const careerSources = careerContext?.sources ?? [];
  const result = await runWorkflow(companyProfileWorkflow, {
    companyName,
    jobTitle,
    jobDescription,
    careersText: careerContext?.text ?? "",
    careerSourceUrls: careerSources.map((s) => s.url),
  });
  if (result.status !== "ok") {
    console.error("Failed to research company profile:", result.error);
    return {
      overview: "",
      hiringValues: EMPTY_SECTION(""),
      benefits: EMPTY_SECTION(""),
      interviewTips: EMPTY_SECTION(""),
      financials: EMPTY_SECTION(""),
      ticker: "",
      sources: [fallback.careers, fallback.financials],
    };
  }
  const parsed = result.data;
  return {
    overview: typeof parsed.overview === "string" ? parsed.overview : "",
    hiringValues: normalizeSection(
      parsed.hiringValues,
      careerSources.length ? careerSources : [fallback.careers],
    ),
    benefits: normalizeSection(
      parsed.benefits,
      careerSources.length ? careerSources : [fallback.careers],
    ),
    interviewTips: normalizeSection(
      parsed.interviewTips,
      careerSources.length ? careerSources : [fallback.careers],
    ),
    financials: normalizeSection(parsed.financials, [fallback.financials]),
    ticker: normalizeTicker(parsed.ticker),
    sources: collectSources(
      parsed,
      [...careerSources, ...result.sources],
      [fallback.careers, fallback.financials],
    ),
  };
}

/** Fast-moving tier: role-relevant news (fallback: recent company news). Cached briefly. */
export async function researchCompanyNews(input: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}): Promise<CompanyNewsData> {
  const { jobTitle, companyName, jobDescription } = input;
  const fallback = buildCompanyResearchSources(companyName);
  const result = await runWorkflow(companyNewsWorkflow, { companyName, jobTitle, jobDescription });
  if (result.status !== "ok") {
    console.error("Failed to research company news:", result.error);
    return { news: EMPTY_SECTION(""), sources: [fallback.news] };
  }
  const parsed = result.data;
  return {
    news: normalizeNewsSection(parsed.news, [fallback.news]),
    sources: collectSources(parsed, result.sources, [fallback.news]),
  };
}

/** Merge the two cached tiers into the shape the UI renders. */
export function assembleCompanyResearch(
  profile: CompanyProfileData,
  news: CompanyNewsData,
): CompanyResearchResult {
  const merged = [...profile.sources, ...news.sources];
  const sources = merged.filter((s, i) => s.url && merged.findIndex((o) => o.url === s.url) === i);
  return {
    overview: profile.overview,
    hiringValues: profile.hiringValues,
    benefits: profile.benefits,
    // Default for profiles cached/seeded before interviewTips existed.
    interviewTips: profile.interviewTips ?? EMPTY_SECTION(""),
    news: news.news,
    financials: profile.financials,
    ticker: profile.ticker ?? "",
    sources,
  };
}

export async function rewriteResumeSelection(
  selectedText: string,
  instruction: string,
  fullResumeText: string,
) {
  const result = await runWorkflow(rewriteSelectionWorkflow, {
    selectedText,
    instruction,
    fullResumeText,
  });
  return result.status === "ok" ? result.data : result.error;
}

export async function suggestWorkExperienceBullets(
  role: string,
  company: string,
  currentBullets: string = "",
) {
  const result = await runWorkflow(workBulletsWorkflow, { role, company, currentBullets });
  return result.status === "ok" ? result.data : result.error;
}

export type ImproveMode = "refine" | "suggest";

/** Strip fences/quotes a free-text model sometimes wraps around a survey answer. */
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
  mode: ImproveMode,
): Promise<string> {
  const result = await runWorkflow(surveyAnswerWorkflow, { question, answer, mode });
  return (result.status === "ok" && cleanAnswerText(result.data)) || answer;
}

export function createTechCoachChat(systemInstruction: string, _enableSearch?: boolean) {
  return {
    sendMessageStream: async ({ message }: any) => {
      const response = await generateWorkflowData(systemInstruction, message);
      return [{ text: response }];
    },
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
/** Char budget for the replayed coaching transcript (mirrors the 20k cap used by
 * evaluateInterviewTranscript). Exported for tests. */
export const COACHING_TRANSCRIPT_CHAR_BUDGET = 20_000;

/**
 * Serialize the most-recent turns within a char budget. The AI gateway is
 * stateless, so the whole transcript is re-sent on every turn; without a bound a
 * long coaching session's input tokens grow unbounded (O(n²) over the session).
 * Whole turns are kept (never split mid-turn); the single most-recent turn is
 * always included even if it alone exceeds the budget.
 */
export function windowCoachingTranscript(
  turns: { role: "user" | "model"; text: string }[],
  budget: number = COACHING_TRANSCRIPT_CHAR_BUDGET,
): string {
  const lines = turns.map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`);
  let transcript = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const next = transcript ? `${lines[i]}\n\n${transcript}` : lines[i];
    if (transcript && next.length > budget) break;
    transcript = next;
  }
  return transcript;
}

export function createCoachingChat(
  systemInstruction: string,
  history: { role: "user" | "model"; text: string }[] = [],
) {
  const turns = [...history];
  return {
    sendMessageStream: async ({ message }: { message: string }) => {
      const transcript = windowCoachingTranscript(turns);
      const prompt = transcript
        ? `Conversation so far:\n${transcript}\n\nUser: ${message}\n\nCoach:`
        : message;
      const response = await generateWorkflowData(systemInstruction, prompt, MODELS.QUALITY);
      turns.push({ role: "user", text: message });
      turns.push({ role: "model", text: response });
      return [{ text: response }];
    },
  };
}

export async function sendMessageStream(
  chat: any,
  message: string,
  onChunk: (text: string) => void,
) {
  const chunks = await chat.sendMessageStream({ message });
  onChunk(chunks[0].text);
}

/* ─────────────────────────────────────────────────────────────────────────
   Career-plan milestone extraction — turns the plan's markdown "Milestones"
   section into a structured, checkable list.
   ───────────────────────────────────────────────────────────────────────── */

export interface ExtractedMilestone {
  title: string;
  timeframe?: string;
}

export async function extractPlanMilestones(planMarkdown: string): Promise<ExtractedMilestone[]> {
  const result = await runWorkflow(milestoneExtractionWorkflow, { planMarkdown });
  if (result.status !== "ok") return [];
  return result.data.milestones
    .filter((m) => typeof m?.title === "string" && m.title.trim())
    .slice(0, 12)
    .map((m) => ({
      title: m.title.trim(),
      timeframe: m.timeframe && m.timeframe.trim() ? m.timeframe.trim() : undefined,
    }));
}

/* ─────────────────────────────────────────────────────────────────────────
   Interview transcript evaluation — scores a finished mock-interview session
   against a fixed rubric so progress is comparable across sessions.
   ───────────────────────────────────────────────────────────────────────── */

export interface InterviewEvaluation {
  scores: { communication: number; structure: number; depth: number };
  overall: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionFeedback: QuestionFeedback[];
}

export async function evaluateInterviewTranscript(
  interviewKind: string,
  role: string,
  transcript: { role: "user" | "model"; text: string }[],
): Promise<InterviewEvaluation> {
  const serialized = transcript
    .map((t) => `${t.role === "user" ? "User" : "Interviewer"}: ${t.text}`)
    .join("\n\n")
    .slice(-20000); // keep the most recent turns when very long
  const result = await runWorkflow(interviewEvaluationWorkflow, {
    interviewKind,
    role,
    transcript: serialized,
  });
  // Post-process defensively regardless of parse success: clamp scores, derive
  // quality, and coerce STAR/missing so odd model output can't crash the UI.
  const parsed: Record<string, unknown> & {
    scores?: Record<string, unknown>;
    questionFeedback?: unknown;
  } = result.status === "ok" ? result.data : {};

  const clamp = (n: unknown): number =>
    Math.min(100, Math.max(0, Math.round(typeof n === "number" ? n : parseFloat(String(n)) || 0)));
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()).slice(0, 4) : [];

  const scores = {
    communication: clamp(parsed?.scores?.communication),
    structure: clamp(parsed?.scores?.structure),
    depth: clamp(parsed?.scores?.depth),
  };

  const STAR_NAMES: readonly STARElement[] = ["Situation", "Task", "Action", "Result"];
  const starText = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const questionFeedback: QuestionFeedback[] = Array.isArray(parsed?.questionFeedback)
    ? parsed.questionFeedback
        .filter((q: unknown) => q && typeof q === "object")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((q: any): QuestionFeedback => {
          const score = clamp(q?.score);
          const quality: QuestionFeedback["quality"] =
            q?.quality === "Strong" || q?.quality === "Adequate" || q?.quality === "Weak"
              ? q.quality
              : score >= 80
                ? "Strong"
                : score >= 50
                  ? "Adequate"
                  : "Weak";
          const missing: STARElement[] = Array.isArray(q?.missing)
            ? q.missing.filter((m: unknown): m is STARElement =>
                STAR_NAMES.includes(m as STARElement),
              )
            : [];
          return {
            question: typeof q?.question === "string" ? q.question : "",
            answerSummary: typeof q?.answerSummary === "string" ? q.answerSummary : "",
            star: {
              situation: starText(q?.star?.situation),
              task: starText(q?.star?.task),
              action: starText(q?.star?.action),
              result: starText(q?.star?.result),
            },
            missing,
            score,
            quality,
            feedback: typeof q?.feedback === "string" ? q.feedback : "",
          };
        })
        .filter((q: QuestionFeedback) => q.question || q.feedback)
    : [];

  return {
    scores,
    overall: clamp(parsed?.overall ?? (scores.communication + scores.structure + scores.depth) / 3),
    summary: typeof parsed?.summary === "string" ? parsed.summary : "",
    strengths: strings(parsed?.strengths),
    improvements: strings(parsed?.improvements),
    questionFeedback,
  };
}
