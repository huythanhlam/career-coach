import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";

/**
 * Grounded (Google-Search) company-research workflows. Because Gemini forbids a
 * `responseSchema` alongside search tools, these set `enableSearch: true` and
 * declare their JSON shape in the prompt; `runWorkflow` strips fences, strict-
 * parses, then validates with these permissive schemas. Collection fields are
 * typed loosely (`unknown[]`) so a stray element never fails the whole parse —
 * geminiService's `normalizeSection` / `normalizeNewsSection` / `normalizeTicker`
 * / `collectSources` do the real coercion afterward, exactly as before.
 */

// ─── Shared permissive schemas ──────────────────────────────────────────────

const sectionSchema = z.object({
  summary: z.string().optional(),
  bullets: z.array(z.unknown()).optional(),
  sources: z.array(z.unknown()).optional(),
});

const newsSectionSchema = z.object({
  summary: z.string().optional(),
  items: z.array(z.unknown()).optional(),
  sources: z.array(z.unknown()).optional(),
});

export const careerLinksSchema = z.object({
  careers: z.string().optional(),
  culture: z.string().optional(),
  benefits: z.string().optional(),
  interview: z.string().optional(),
});

export const companyProfileSchema = z.object({
  overview: z.string().optional(),
  hiringValues: sectionSchema.optional(),
  benefits: sectionSchema.optional(),
  interviewTips: sectionSchema.optional(),
  financials: sectionSchema.optional(),
  ticker: z.string().optional(),
  sources: z.array(z.unknown()).optional(),
});

export const companyNewsSchema = z.object({
  news: newsSectionSchema.optional(),
  sources: z.array(z.unknown()).optional(),
});

// ─── Prompt-building (moved verbatim from geminiService) ─────────────────────

// Bound how much of the (free, user-provided) JD we feed each grounded call, so
// inputs stay small. The profile call gets more — it mines benefits/values from
// the posting; the news call only needs light role context.
const JD_PROFILE_EXCERPT = 1500;
const JD_ROLE_SNIPPET = 400;
// Cap how much scraped careers-site text we feed the profile call so the input
// stays bounded even when several pages were navigated.
const CAREERS_TEXT_EXCERPT = 6000;

function roleLine(jobTitle: string, jobDescription: string, snippetLen: number): string {
  const title = jobTitle?.trim() ? jobTitle.trim() : "(role described in the posting excerpt)";
  const snippet = (jobDescription ?? "").trim().slice(0, snippetLen);
  return `TARGET ROLE: ${title}${snippet ? `\nROLE CONTEXT (excerpt): ${snippet}` : ""}`;
}

// ─── Career-URL discovery ────────────────────────────────────────────────────

const CAREER_DISCOVERY_SYSTEM = `You locate a company's OWN official careers website pages. A live web search tool IS available — use it and return only real, working URLs on the company's own domain (never Glassdoor/LinkedIn/Indeed/news/aggregators). Find up to four pages: the main careers/jobs page, a culture/life/values page, a benefits/perks page, and an interview-process / how-we-hire page. Omit any you genuinely can't find on the company's own site.
Output ONLY a compact JSON object, no fences: {"careers":"https://...","culture":"https://...","benefits":"https://...","interview":"https://..."}. Begin with "{" and end with "}".`;

export const careerDiscoveryWorkflow = defineWorkflow({
  id: "career_url_discovery",
  tier: "RESEARCH",
  enableSearch: true,
  inputSchema: z.object({ companyName: z.string() }),
  outputSchema: careerLinksSchema,
  buildSystem: () => CAREER_DISCOVERY_SYSTEM,
  buildPrompt: ({ companyName }) =>
    `COMPANY: ${uc(companyName)}\nReturn only the JSON object.\n${injectionTrailer()}`,
});

// ─── Slow-moving profile tier ────────────────────────────────────────────────

const COMPANY_PROFILE_SYSTEM = `You research a company to help a candidate interview well. A live web search tool IS available — use it for anything time-sensitive and cite the real URLs you retrieve; never invent URLs or figures. You are given JOB POSTING TEXT — use it directly for benefits/values where present and only search for what it doesn't cover. You may also be given CAREERS-SITE TEXT scraped from the company's own careers/culture/benefits pages — treat that as the most authoritative source and extract from it directly, citing those page URLs.

Navigate the company's OWN official careers website (its careers/jobs/culture/life/benefits/interview pages) and extract from it. Produce, searching where needed:
- hiringValues: what the company values when hiring (careers/culture pages — traits, principles, competencies).
- benefits: key benefits & perks (comp philosophy, health/leave, equity, remote/flexibility, learning budget).
- interviewTips: how to succeed in THIS company's interview process — process/stages, formats, what they assess, prep advice, sample focus areas. Prefer the company's own "interview prep"/"hiring process" pages; otherwise reputable guides. Make each bullet actionable.
- financials: most recent quarterly earnings, revenue/growth, guidance, stock; private → latest funding/valuation. Date-stamp every figure. If unknown, say so in the summary and leave bullets sparse.
- ticker: the company's primary public stock ticker symbol in UPPERCASE (e.g. "AAPL"). If the company is private or you are unsure, use "".

Do NOT output employee ratings or review scores — those are shown from verified sources elsewhere, not from you.

Output ONLY a compact JSON object, no markdown fences:
{"overview":"2-3 sentences + recency note","hiringValues":{"summary":"1-2 sentences","bullets":["..."],"sources":[{"label":"...","url":"https://..."}]},"benefits":{"summary":"...","bullets":["..."],"sources":[...]},"interviewTips":{"summary":"...","bullets":["..."],"sources":[...]},"financials":{"summary":"...","bullets":["metric — value — period"],"sources":[...]},"ticker":"AAPL or \"\"","sources":[{"label":"...","url":"..."}]}
At most 4 bullets/section (≤25 words each, interviewTips may use up to 5) and 3 sources/section. Begin with "{" and end with "}".`;

export const companyProfileWorkflow = defineWorkflow({
  id: "company_profile",
  tier: "RESEARCH",
  enableSearch: true,
  inputSchema: z.object({
    companyName: z.string(),
    jobTitle: z.string(),
    jobDescription: z.string(),
    careersText: z.string(),
    careerSourceUrls: z.array(z.string()),
  }),
  outputSchema: companyProfileSchema,
  buildSystem: () => COMPANY_PROFILE_SYSTEM,
  buildPrompt: ({ companyName, jobTitle, jobDescription, careersText, careerSourceUrls }) => {
    const careers = careersText.trim().slice(0, CAREERS_TEXT_EXCERPT);
    const jdExcerpt = (jobDescription || "(none provided)").slice(0, JD_PROFILE_EXCERPT);
    return `COMPANY: ${uc(companyName)}
${roleLine(jobTitle, jobDescription, JD_PROFILE_EXCERPT)}

JOB POSTING TEXT (use for benefits/values where present; don't search for what's already here):
${uc(jdExcerpt)}
${careers ? `\nCAREERS-SITE TEXT (scraped from ${careerSourceUrls.join(", ") || "the company's careers pages"} — authoritative; extract culture/benefits/interview tips from this and cite these pages):\n${uc(careers)}\n` : ""}
${injectionTrailer()}
Return only the JSON object.`;
  },
});

// ─── Fast-moving news tier ───────────────────────────────────────────────────

const COMPANY_NEWS_SYSTEM = `You find recent news about a company to help a candidate interview well. A live web search tool IS available — use it and cite the real URLs you retrieve; never invent URLs. Strongly prioritize the MOST RECENT developments: aim for the last 30 days, and do not include anything older than ~6 months unless nothing newer exists. Prioritize news tied to the candidate's role/team/department (launches, org changes, hiring in that area); if little role-specific news exists, fall back to the most important recent company news.

Return each item with an ISO date so it can be sorted. The "date" MUST be the publication date in YYYY-MM-DD form (use the most precise date you can verify; if only month/year is known use the first of that month). Order does not matter — the app re-sorts newest first.

Output ONLY a compact JSON object, no markdown fences:
{"news":{"summary":"1-2 sentences","items":[{"headline":"...","date":"YYYY-MM-DD","whyItMatters":"why it matters for a candidate","url":"https://..."}],"sources":[{"label":"...","url":"https://..."}]},"sources":[{"label":"...","url":"..."}]}
At most 8 items (headline + whyItMatters ≤25 words each) and 4 sources. Begin with "{" and end with "}".`;

export const companyNewsWorkflow = defineWorkflow({
  id: "company_news",
  tier: "RESEARCH",
  enableSearch: true,
  inputSchema: z.object({
    companyName: z.string(),
    jobTitle: z.string(),
    jobDescription: z.string(),
  }),
  outputSchema: companyNewsSchema,
  buildSystem: () => COMPANY_NEWS_SYSTEM,
  buildPrompt: ({ companyName, jobTitle, jobDescription }) =>
    `COMPANY: ${uc(companyName)}
${roleLine(jobTitle, jobDescription, JD_ROLE_SNIPPET)}

${injectionTrailer()}
Find recent news (role/team-relevant first, else important recent company news). Return only the JSON object.`,
});
