// Role nickname / abbreviation expansion for search.
//
// People search with shorthand ("SWE", "SDE", "TPM", "PM") but postings use the
// spelled-out title ("Software Engineer", "Technical Program Manager") — and vice
// versa. We expand a query into its equivalent role phrases so the search covers
// the whole family. Each group lists interchangeable forms; abbreviations (no
// space) expand to the full-name variants, which is what we actually search.

const GROUPS: string[][] = [
  [
    "software engineer",
    "software developer",
    "software development engineer",
    "swe",
    "sde",
    "programmer",
    "coder",
  ],
  ["technical program manager", "tpm", "technical project manager"],
  ["program manager", "program management"],
  ["product manager", "product management", "pm"],
  ["project manager", "project management"],
  ["data scientist", "data science", "ds"],
  ["machine learning engineer", "ml engineer", "mle", "machine learning"],
  ["data engineer"],
  ["data analyst"],
  ["business analyst", "ba"],
  ["site reliability engineer", "sre"],
  ["devops engineer", "devops"],
  ["platform engineer"],
  ["security engineer", "infosec engineer"],
  [
    "frontend engineer",
    "front end engineer",
    "frontend developer",
    "front end developer",
    "fe engineer",
  ],
  [
    "backend engineer",
    "back end engineer",
    "backend developer",
    "back end developer",
    "be engineer",
  ],
  ["full stack engineer", "fullstack engineer", "full stack developer", "fullstack developer"],
  ["mobile engineer", "mobile developer", "ios engineer", "android engineer"],
  [
    "qa engineer",
    "quality assurance engineer",
    "quality assurance",
    "qa",
    "sdet",
    "software development engineer in test",
  ],
  ["ux designer", "user experience designer"],
  ["ui designer", "user interface designer"],
  ["product designer", "ux/ui designer", "ui/ux designer"],
  ["engineering manager", "em"],
  ["solutions architect", "solution architect", "solutions engineer"],
  ["account executive", "ae"],
  ["sales development representative", "sdr"],
  ["business development representative", "bdr"],
  ["customer success manager", "csm"],
  ["chief technology officer", "cto"],
  ["chief executive officer", "ceo"],
  ["chief financial officer", "cfo"],
  ["chief operating officer", "coo"],
  ["chief marketing officer", "cmo"],
  ["vice president", "vp"],
  ["human resources", "people operations", "people ops", "hr"],
  ["natural language processing", "nlp"],
];

const MAX_PHRASES = 3;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[._/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Precompute: normalized groups + an index from short alias → spelled-out names.
const NORM_GROUPS = GROUPS.map((g) => g.map(norm));
const FULL_NAMES = NORM_GROUPS.map((g) => g.filter((a) => a.includes(" ")));

const ABBREV_INDEX = new Map<string, string[]>();
NORM_GROUPS.forEach((g, gi) => {
  for (const alias of g) {
    if (!alias.includes(" ")) {
      const names = FULL_NAMES[gi];
      if (names.length) ABBREV_INDEX.set(alias, [...(ABBREV_INDEX.get(alias) ?? []), ...names]);
    }
  }
});

function dedupeCI(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

/**
 * Expand a role query into equivalent search phrases (the original plus any
 * spelled-out / abbreviated synonyms), capped to a few to keep request fan-out
 * small. Always includes the original query. Examples:
 *   "swe"          → ["software engineer", "software developer", "swe"]
 *   "senior tpm"   → ["senior tpm", "senior technical program manager"]
 *   "data analyst" → ["data analyst"]
 */
export function expandRoleQuery(query: string): string[] {
  const original = query.trim();
  const q = norm(query);
  if (!q) return original ? [original] : [];

  const out = new Set<string>([original]);

  // Whole-query is a known alias → add the full-name variants of its group(s).
  NORM_GROUPS.forEach((g, gi) => {
    if (g.includes(q)) for (const name of FULL_NAMES[gi]) out.add(name);
  });

  // Abbreviations embedded in the query (e.g. "senior swe") → substitute in place.
  const tokens = q.split(" ");
  tokens.forEach((tok, i) => {
    const names = ABBREV_INDEX.get(tok);
    if (!names) return;
    for (const name of names) {
      const rep = tokens.slice();
      rep[i] = name;
      out.add(rep.join(" "));
    }
  });

  let list = dedupeCI([...out]);
  // If the user typed a bare abbreviation, prefer the spelled-out variants in the
  // limited slots and push the raw abbreviation to the end.
  if (ABBREV_INDEX.has(q))
    list = [
      ...list.filter((s) => s.toLowerCase() !== q),
      ...list.filter((s) => s.toLowerCase() === q),
    ];
  return list.slice(0, MAX_PHRASES);
}

/**
 * All synonym-family tokens for a role phrase — used by the recommendation engine
 * so that, e.g., a profile role of "TPM" matches a "Technical Program Manager"
 * posting (and vice-versa). Returns the spelled-out AND abbreviated tokens of any
 * role group the phrase belongs to (matched as the whole phrase, a contained
 * full-name, or an embedded abbreviation token). Empty when the role is unknown.
 */
export function expandRoleTokens(text: string): Set<string> {
  const q = norm(text);
  const result = new Set<string>();
  if (!q) return result;
  const tokens = q.split(" ");
  NORM_GROUPS.forEach((g, gi) => {
    const inGroup =
      g.includes(q) ||
      tokens.some((tok) => g.includes(tok)) ||
      g.some((alias) => alias.includes(" ") && q.includes(alias));
    if (inGroup) {
      for (const alias of g) for (const t of alias.split(" ")) if (t.length >= 2) result.add(t);
    }
  });
  return result;
}

/** Significant search terms across all expanded phrases — used for the ATS title filter. */
export function roleSearchTerms(phrases: string[]): string[] {
  return Array.from(
    new Set(
      phrases
        .flatMap((p) => p.split(/[^a-zA-Z0-9+#]+/))
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2),
    ),
  );
}
