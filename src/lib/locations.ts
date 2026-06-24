/**
 * Location normalization — the app's single method for collapsing the many ways a
 * place can be typed ("Austin, TX", "Austin, Texas", "austin tx", "Austin, TX, USA")
 * into ONE canonical string, so the same city/state/country never duplicates across
 * storage, caches, or filters.
 *
 * The canonical geo reference data (countries, US states, cities) lives in
 * `jobFilters.ts` and is re-exported here so this module is the single import
 * surface for everything location-related.
 *
 * Canonical output format:
 *   • US city            → "City, ST"        (2-letter state)     e.g. "Austin, TX"
 *   • US state only      → "State, USA"                            e.g. "California, USA"
 *   • non-US city        → "City, COUNTRY"   (short code if any)  e.g. "London, UK"
 *   • country only       → full country name                      e.g. "United Kingdom"
 *   • remote             → "Remote" / "Remote (US)"
 */

import { COUNTRIES, COUNTRY_SHORT, US_STATES, CITIES } from "./jobFilters";

export { COUNTRIES, COUNTRY_SHORT, US_STATES, CITIES } from "./jobFilters";

/* ───────────────────────────── Lookups ──────────────────────────────────── */

const norm = (s: string): string => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));
const STATE_BY_CODE = new Map(US_STATES.map((s) => [s.code, s.name]));
const CODE_SET = new Set(US_STATES.map((s) => s.code));
const CITY_BY_NAME = new Map(CITIES.map((c) => [c.city.toLowerCase(), c]));

function hasToken(n: string, tok: string): boolean {
  return new RegExp(`(^| )${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(n);
}

/** Resolve a single token to a country name, or undefined. */
function countryOfToken(token: string): string | undefined {
  const n = norm(token);
  for (const c of COUNTRIES) {
    for (const a of c.aliases) {
      if (a.length <= 3 ? hasToken(n, a) : n.includes(a)) return c.name;
    }
  }
  return undefined;
}

/** Resolve a single token to a US state code (exact name or code match), or undefined. */
function stateCodeOfToken(token: string): string | undefined {
  const n = norm(token);
  if (n.length === 2 && CODE_SET.has(n.toUpperCase())) return n.toUpperCase();
  return STATE_BY_NAME.get(n);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function countryLabel(country: string): string {
  return COUNTRY_SHORT[country] ?? country;
}

/* ───────────────────────────── Resolution ───────────────────────────────── */

export interface ResolvedLocation {
  city?: string;
  /** 2-letter US state code, when the location is in the US. */
  stateCode?: string;
  /** Canonical country name, when determinable. */
  country?: string;
  remote?: boolean;
  /** The canonical display string (also what gets stored). */
  canonical: string;
}

/** Peel a trailing state off a no-comma single token, e.g. "Austin TX" / "Austin Texas". */
function splitTrailingState(part: string): { city: string; code: string } | undefined {
  const tokens = part.split(" ").filter(Boolean);
  if (tokens.length < 2) return undefined;
  const lastUpper = tokens[tokens.length - 1].toUpperCase();
  if (lastUpper.length === 2 && CODE_SET.has(lastUpper)) {
    return { city: tokens.slice(0, -1).join(" "), code: lastUpper };
  }
  if (tokens.length >= 3) {
    const code2 = STATE_BY_NAME.get(tokens.slice(-2).join(" ").toLowerCase());
    if (code2) return { city: tokens.slice(0, -2).join(" "), code: code2 };
  }
  const code1 = STATE_BY_NAME.get(tokens[tokens.length - 1].toLowerCase());
  if (code1) return { city: tokens.slice(0, -1).join(" "), code: code1 };
  return undefined;
}

function format(city: string | undefined, stateCode: string | undefined, country: string | undefined): string {
  if (city && stateCode) return `${city}, ${stateCode}`;
  if (city && country && country !== "United States") return `${city}, ${countryLabel(country)}`;
  if (city) return city;
  if (stateCode) return `${STATE_BY_CODE.get(stateCode)}, USA`;
  if (country) return country;
  return "";
}

/** Structured resolution of a free-text location. Exposed for callers that need the parts. */
export function resolveLocation(raw: string | null | undefined): ResolvedLocation {
  if (!raw) return { canonical: "" };
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return { canonical: "" };

  const low = s.toLowerCase();
  if (/\bremote\b|\bwfh\b|work from home|telecommute/.test(low)) {
    const us = /\b(us|usa|united states)\b/.test(low);
    return { remote: true, country: us ? "United States" : undefined, canonical: us ? "Remote (US)" : "Remote" };
  }

  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);

  let city: string | undefined;
  let stateCode: string | undefined;
  let country: string | undefined;

  if (parts.length >= 2) {
    const rest = parts.slice(1);
    // Country: prefer the last part that names one.
    for (let i = rest.length - 1; i >= 0; i--) {
      const c = countryOfToken(rest[i]);
      if (c) { country = c; break; }
    }
    // US state from any remaining part.
    for (const part of rest) {
      const code = stateCodeOfToken(part);
      if (code) { stateCode = code; if (!country) country = "United States"; break; }
    }
    // First part is the city — unless it is itself a state ("Texas, USA").
    const head = parts[0];
    const headState = stateCodeOfToken(head);
    if (!stateCode && headState) {
      stateCode = headState;
      if (!country) country = "United States";
    } else {
      city = head;
    }
  } else {
    const p = parts[0];
    const trailing = splitTrailingState(p);
    if (trailing) {
      city = trailing.city;
      stateCode = trailing.code;
      country = "United States";
    } else if (CITY_BY_NAME.has(norm(p))) {
      city = p; // known city wins over the state/country reading of an ambiguous token
    } else {
      const code = stateCodeOfToken(p);
      const ctry = countryOfToken(p);
      if (code) { stateCode = code; country = "United States"; }
      else if (ctry) { country = ctry; }
      else { city = p; }
    }
  }

  // Snap a known city to its canonical casing and fill in its state/country.
  if (city) {
    const known = CITY_BY_NAME.get(norm(city));
    if (known) {
      city = known.city;
      if (!stateCode && known.stateCode) stateCode = known.stateCode;
      if (!country) country = known.country;
    } else {
      city = titleCase(city);
    }
  }

  return { city, stateCode, country, canonical: format(city, stateCode, country) };
}

/**
 * Resolve a free-text location to ONE canonical value. Returns "" for blank input.
 * Examples: "Austin, Texas" → "Austin, TX"; "New York" → "New York, NY";
 * "london" → "London, UK"; "toronto, ontario, canada" → "Toronto, Canada".
 */
export function normalizeLocation(raw: string | null | undefined): string {
  return resolveLocation(raw).canonical;
}

/* ───────────────────────────── Suggestions ──────────────────────────────── */

/** Canonical location suggestions (already normalized) for combo/autocomplete inputs. */
export const KNOWN_LOCATIONS: string[] = [
  "Remote",
  "Remote (US)",
  ...CITIES.map((c) => (c.stateCode ? `${c.city}, ${c.stateCode}` : `${c.city}, ${countryLabel(c.country)}`)),
];
