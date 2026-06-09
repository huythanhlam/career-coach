/**
 * Wikidata → structured key facts (founded, HQ, industry, employees, CEO,
 * website, ticker, country). Free, keyless, fully structured.
 *
 * Flow (up to 3 requests):
 *   1. wbsearchentities  — resolve the company name to a Q-id.
 *   2. wbgetentities(id) — pull its claims.
 *   3. wbgetentities(ids)— resolve referenced entity labels (HQ/industry/CEO/country).
 */
import type { HttpGet } from "../lib.ts";
import { safeJson } from "../lib.ts";
import type { KeyFacts, ProfileSource } from "../../../src/types/companyProfile.ts";

export interface WikidataResult {
  facts: KeyFacts;
  source?: ProfileSource;
  entityId?: string;
  /** Exact English Wikipedia page title (from sitelinks) — drives the Wikipedia fetch. */
  enwikiTitle?: string;
}

// Wikidata property ids we read.
const P = {
  inception: "P571",
  headquarters: "P159",
  industry: "P452",
  employees: "P1128",
  ceo: "P169",
  website: "P856",
  ticker: "P249",
  country: "P17",
  pointInTime: "P585",
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Claim = any;

function firstClaim(claims: Record<string, Claim[]>, prop: string): Claim | undefined {
  const arr = claims?.[prop];
  return Array.isArray(arr) && arr.length ? arr[0] : undefined;
}

function entityIdValue(claim: Claim | undefined): string | undefined {
  return claim?.mainsnak?.datavalue?.value?.id;
}

/**
 * For a multi-valued office property (e.g. P169 CEO with historical holders),
 * return the entity id of the CURRENT holder. Wikidata marks the authoritative
 * value with rank "preferred"; we honor that, but never pick a FUTURE-dated
 * holder (start year > now — e.g. an announced successor). Order of preference:
 *   1. preferred-rank, not future, latest start
 *   2. no end date (P582), not future, latest start
 *   3. not future, latest start
 *   4. first claim
 */
export function currentEntityId(claims: Record<string, Claim[]>, prop: string): string | undefined {
  const arr = claims?.[prop];
  if (!Array.isArray(arr) || !arr.length) return undefined;
  const now = new Date().getFullYear();
  const startYear = (c: Claim) => {
    const t = c?.qualifiers?.["P580"]?.[0]?.datavalue?.value?.time;
    return typeof t === "string" ? Number(t.match(/^[+-](\d{4})/)?.[1] ?? 0) : 0;
  };
  const hasEnd = (c: Claim) => Array.isArray(c?.qualifiers?.["P582"]) && c.qualifiers["P582"].length > 0;
  const notFuture = arr.filter((c) => startYear(c) <= now);
  const preferred = notFuture.filter((c) => c?.rank === "preferred");
  const ongoing = notFuture.filter((c) => !hasEnd(c));
  const pool = preferred.length ? preferred : ongoing.length ? ongoing : notFuture.length ? notFuture : arr;
  const best = [...pool].sort((a, b) => startYear(b) - startYear(a))[0];
  return entityIdValue(best);
}

function timeValue(claim: Claim | undefined): string | undefined {
  const t: string | undefined = claim?.mainsnak?.datavalue?.value?.time; // "+2004-00-00T00:00:00Z"
  if (!t) return undefined;
  const m = t.match(/^[+-](\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (mo === "00") return y; // year precision only
  return `${y}-${mo === "00" ? "01" : mo}-${d === "00" ? "01" : d}`;
}

function stringValue(claim: Claim | undefined): string | undefined {
  const v = claim?.mainsnak?.datavalue?.value;
  return typeof v === "string" ? v : undefined;
}

/** Quantity claim with an optional P585 "point in time" qualifier year. */
function quantityWithYear(claim: Claim | undefined): { amount?: number; asOf?: string } {
  const amountStr: string | undefined = claim?.mainsnak?.datavalue?.value?.amount;
  const amount = amountStr != null ? Number(String(amountStr).replace(/^\+/, "")) : undefined;
  const pit = claim?.qualifiers?.[P.pointInTime]?.[0]?.datavalue?.value?.time;
  const asOf = typeof pit === "string" ? pit.match(/^[+-](\d{4})/)?.[1] : undefined;
  return { amount: Number.isFinite(amount) ? amount : undefined, asOf };
}

// Words in a Wikidata search-result description that signal a company/org (so
// "Apple" resolves to Apple Inc., not the fruit).
const COMPANY_HINT = /\b(company|corporation|business|enterprise|manufacturer|conglomerate|retailer|technology|software|firm|bank|airline|automaker|brand)\b/i;

interface SearchHit { id?: string; description?: string }

/** Prefer the first hit whose description looks like a company; else the first hit. */
function pickCompanyHit(hits: SearchHit[]): string | undefined {
  const company = hits.find((h) => h.description && COMPANY_HINT.test(h.description));
  return (company ?? hits[0])?.id;
}

export async function fetchWikidata(name: string, httpGet: HttpGet): Promise<WikidataResult> {
  // 1. Resolve the company to a Q-id, biasing toward company-like results.
  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=${encodeURIComponent(name)}`;
  const searchRes = await httpGet(searchUrl);
  if (!searchRes.ok) return { facts: {} };
  const search = safeJson<{ search?: SearchHit[] }>(searchRes.text);
  const entityId = pickCompanyHit(search?.search ?? []);
  if (!entityId) return { facts: {} };

  // 2. Pull its claims + the English Wikipedia sitelink.
  const entUrl =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims%7Csitelinks&ids=${entityId}`;
  const entRes = await httpGet(entUrl);
  if (!entRes.ok) return { facts: {}, entityId };
  const ent = safeJson<{ entities?: Record<string, { claims?: Record<string, Claim[]>; sitelinks?: Record<string, { title?: string }> }> }>(entRes.text);
  const entity = ent?.entities?.[entityId];
  const claims = entity?.claims ?? {};
  const enwikiTitle = entity?.sitelinks?.enwiki?.title;

  const facts: KeyFacts = {};
  facts.founded = timeValue(firstClaim(claims, P.inception));
  facts.website = stringValue(firstClaim(claims, P.website));
  facts.ticker = stringValue(firstClaim(claims, P.ticker));
  // Employees: pick the claim with the most recent "point in time" qualifier.
  const empClaims = Array.isArray(claims[P.employees]) ? claims[P.employees] : [];
  const emp = empClaims
    .map(quantityWithYear)
    .filter((e) => e.amount != null)
    .sort((a, b) => Number(b.asOf ?? 0) - Number(a.asOf ?? 0))[0];
  if (emp?.amount != null) {
    facts.employeeCount = Math.round(emp.amount);
    facts.employeeCountAsOf = emp.asOf;
  }

  // 3. Resolve referenced-entity labels (HQ, industry, CEO, country).
  const refs = {
    headquarters: entityIdValue(firstClaim(claims, P.headquarters)),
    industry: entityIdValue(firstClaim(claims, P.industry)),
    ceo: currentEntityId(claims, P.ceo), // current holder, not the first historical one
    country: entityIdValue(firstClaim(claims, P.country)),
  };
  const refIds = [...new Set(Object.values(refs).filter(Boolean))] as string[];
  if (refIds.length) {
    const labelsUrl =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${refIds.join("|")}`;
    const labelsRes = await httpGet(labelsUrl);
    const labelsData = safeJson<{ entities?: Record<string, { labels?: { en?: { value?: string } } }> }>(labelsRes.text ?? "");
    const labelOf = (id?: string) => (id ? labelsData?.entities?.[id]?.labels?.en?.value : undefined);
    facts.headquarters = labelOf(refs.headquarters);
    facts.industry = labelOf(refs.industry);
    facts.ceo = labelOf(refs.ceo);
    facts.country = labelOf(refs.country);
  }

  return {
    facts,
    entityId,
    enwikiTitle,
    source: { label: `Wikidata — ${entityId}`, url: `https://www.wikidata.org/wiki/${entityId}`, provider: "wikidata" },
  };
}
