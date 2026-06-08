import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function innerText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** 1. Try JSON-LD JobPosting schema — used by Greenhouse, Lever, Ashby, Workday, etc. */
function extractFromJsonLd(html: string): string | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
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
  // Strip nav, header, footer, aside, scripts, styles first
  const cleaned = html
    .replace(/<(nav|header|footer|aside|script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try <main> first, then <article>
  for (const tag of ["main", "article"]) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = re.exec(cleaned);
    if (match) {
      const text = innerText(match[1]);
      if (text.length > 200) return text.slice(0, 8000);
    }
  }

  // Fallback: find the block element with the most text
  const blockRe = /<(section|div)[^>]*>([\s\S]{300,}?)<\/\1>/gi;
  let best = "";
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(cleaned)) !== null) {
    const t = innerText(bm[2]);
    if (t.length > best.length) best = t;
  }
  return best.slice(0, 8000) || innerText(cleaned).slice(0, 8000);
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
