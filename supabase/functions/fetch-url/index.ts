import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// Use Deno's built-in DOMParser for HTML extraction.
// This replaces regex-based stripping which is bypassable by polyglot payloads.
const parser = new DOMParser();

function domToText(el: Element): string {
  const BLOCK_TAGS = new Set(["p", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "tr"]);
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      out += node.textContent;
    } else if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === "br") { out += "\n"; continue; }
      out += domToText(node as Element);
      if (BLOCK_TAGS.has(tag)) out += "\n";
    }
  }
  return out;
}

function innerText(html: string): string {
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  return domToText(doc.body ?? doc.documentElement)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 1. Try JSON-LD JobPosting schema — used by Greenhouse, Lever, Ashby, Workday, etc. */
function extractFromJsonLd(html: string): string | null {
  const doc = parser.parseFromString(html, "text/html");
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (node["@type"] !== "JobPosting") continue;
        const parts: string[] = [];
        if (node.title) parts.push(`Job Title: ${node.title}`);
        if (node.hiringOrganization?.name) parts.push(`Company: ${node.hiringOrganization.name}`);
        if (node.jobLocation) {
          const loc = Array.isArray(node.jobLocation) ? node.jobLocation[0] : node.jobLocation;
          const addr = loc?.address;
          if (addr) {
            const city = addr.addressLocality ?? "";
            const region = addr.addressRegion ?? "";
            const country = addr.addressCountry ?? "";
            const location = [city, region, country].filter(Boolean).join(", ");
            if (location) parts.push(`Location: ${location}`);
          }
        }
        if (node.employmentType) parts.push(`Employment Type: ${node.employmentType}`);
        if (node.baseSalary) {
          const s = node.baseSalary;
          const val = s.value;
          if (val?.minValue && val?.maxValue) {
            parts.push(`Salary: ${val.minValue}–${val.maxValue} ${val.unitText ?? ""}`);
          }
        }
        if (node.description) parts.push(`\n${innerText(node.description)}`);
        if (parts.length > 2) return parts.join("\n");
      }
    } catch {
      // malformed JSON-LD, skip
    }
  }
  return null;
}

/** 2. Extract the largest semantic content block: <main>, <article>, or the densest <section>/<div> */
function extractFromSemanticHtml(html: string): string {
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("nav, header, footer, aside, script, style, noscript").forEach((el) => el.remove());

  for (const tag of ["main", "article"]) {
    const el = doc.querySelector(tag);
    if (el) {
      const text = domToText(el as Element).replace(/\s{2,}/g, " ").trim();
      if (text.length > 200) return text.slice(0, 8000);
    }
  }

  // Fallback: body text
  return domToText(doc.body ?? doc.documentElement).replace(/\s{2,}/g, " ").trim().slice(0, 8000);
}

async function verifyUser(authHeader: string | null) {
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return json({ error: "Invalid URL" }, 400, cors);
    }

    // SSRF-safe fetch: validates the host (and each redirect hop), rejects
    // private/loopback/metadata targets, and caps the body size + time.
    let pageRes;
    try {
      pageRes = await safeFetchText(url, {
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 10_000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TechCoachBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fetch failed";
      // Validation failures are client errors; everything else is upstream.
      const status = msg === "URL not allowed" || msg === "Invalid URL" ? 400 : 502;
      return json({ error: msg }, status, cors);
    }

    if (!pageRes.ok) {
      return json({ error: `Fetch failed: ${pageRes.statusText}` }, pageRes.status, cors);
    }

    const html = pageRes.text;
    const text = extractFromJsonLd(html) ?? extractFromSemanticHtml(html);

    return json({ text }, 200, cors);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
