import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0|169\.254\.)/.test(hostname);
  } catch {
    return true;
  }
}

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

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return unauthorized();

  try {
    const { url } = await req.json();

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (isPrivateUrl(url)) {
      return new Response(JSON.stringify({ error: "URL not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TechCoachBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!pageRes.ok) {
      return new Response(
        JSON.stringify({ error: `Fetch failed: ${pageRes.statusText}` }),
        { status: pageRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await pageRes.text();
    const text = extractFromJsonLd(html) ?? extractFromSemanticHtml(html);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
