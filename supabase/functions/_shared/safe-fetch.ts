// SSRF-resistant fetch for user-supplied URLs.
//
// A literal-hostname check is not enough on its own: `fetch` follows redirects by
// default, and a public DNS name can resolve to an internal IP (DNS rebinding).
// This helper therefore:
//   • allows only http/https
//   • rejects literal private/loopback/link-local hosts
//   • resolves the hostname (best-effort) and rejects private resolved IPs
//   • follows redirects MANUALLY, re-validating every hop
//   • caps the response body size and total time
//
// Residual risk: TOCTOU DNS rebinding between the resolve check and the socket
// connect cannot be fully closed without IP pinning, which the runtime fetch does
// not expose. The checks below raise the bar substantially for the common cases
// (redirect to 169.254.169.254, internal hostnames, etc.).

function ipv4ToParts(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map((n) => Number(n));
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/** True for loopback, RFC1918, link-local, CGNAT, and unspecified addresses. */
export function isPrivateIp(ip: string): boolean {
  const v4 = ipv4ToParts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // loopback
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true;         // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (lower.startsWith("::ffff:")) {                 // IPv4-mapped
    return isPrivateIp(lower.replace("::ffff:", ""));
  }
  return false;
}

/** True when the hostname is a literal private address or obvious internal name. */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (ipv4ToParts(h) || h.includes(":")) return isPrivateIp(h);
  return false;
}

/** Throws if the URL is not a public http(s) endpoint. Resolves DNS best-effort. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("URL not allowed");
  }
  if (isPrivateHostname(u.hostname)) {
    throw new Error("URL not allowed");
  }
  // Resolve and re-check, if the host is a name (not a literal IP).
  if (!ipv4ToParts(u.hostname) && !u.hostname.includes(":")) {
    try {
      const records = await Promise.allSettled([
        Deno.resolveDns(u.hostname, "A"),
        Deno.resolveDns(u.hostname, "AAAA"),
      ]);
      for (const r of records) {
        if (r.status === "fulfilled") {
          for (const ip of r.value) {
            if (isPrivateIp(ip)) throw new Error("URL not allowed");
          }
        }
      }
    } catch (e) {
      // Re-throw our own rejection; swallow resolver errors (best-effort).
      if (e instanceof Error && e.message === "URL not allowed") throw e;
    }
  }
  return u;
}

export interface SafeFetchOptions {
  maxBytes?: number;   // default 2 MB
  timeoutMs?: number;  // default 10s
  maxRedirects?: number; // default 4
  headers?: Record<string, string>;
}

/**
 * Fetch a user-supplied URL with SSRF protections. Returns the response body as
 * text (capped at `maxBytes`). Follows redirects manually, validating each hop.
 */
export async function safeFetchText(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<{ status: number; ok: boolean; statusText: string; text: string }> {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRedirects = opts.maxRedirects ?? 4;

  let current = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current.toString(), {
      redirect: "manual",
      headers: opts.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Manual redirect handling: validate the Location before following it.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) return { status: res.status, ok: false, statusText: res.statusText, text: "" };
      current = await assertPublicUrl(new URL(loc, current).toString());
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel();
      return { status: res.status, ok: false, statusText: res.statusText, text: "" };
    }

    // Read with a hard size cap.
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, ok: true, statusText: res.statusText, text: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(total > maxBytes ? maxBytes : total);
    let offset = 0;
    for (const c of chunks) {
      if (offset + c.length > merged.length) {
        merged.set(c.subarray(0, merged.length - offset), offset);
        break;
      }
      merged.set(c, offset);
      offset += c.length;
    }
    return {
      status: res.status,
      ok: true,
      statusText: res.statusText,
      text: new TextDecoder().decode(merged),
    };
  }

  throw new Error("Too many redirects");
}
