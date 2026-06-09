import { describe, it, expect } from "vitest";
import { isPrivateIp, isPrivateHostname, assertPublicUrl } from "./safe-fetch.ts";

describe("isPrivateIp (IPv4)", () => {
  it.each([
    ["10.0.0.1", true], // 10/8
    ["10.255.255.255", true],
    ["127.0.0.1", true], // loopback
    ["0.0.0.0", true], // unspecified / 0/8
    ["169.254.169.254", true], // link-local / cloud metadata
    ["172.16.0.1", true], // 172.16/12
    ["172.31.255.255", true],
    ["192.168.1.1", true], // 192.168/16
    ["100.64.0.1", true], // CGNAT 100.64/10
    ["100.127.255.255", true],
  ])("flags private %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["172.15.0.1", false], // just below 172.16/12
    ["172.32.0.1", false], // just above 172.16/12
    ["100.63.255.255", false], // just below CGNAT
    ["100.128.0.0", false], // just above CGNAT
    ["11.0.0.1", false],
  ])("allows public %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it("returns false for non-IPv4 garbage that isn't IPv6 either", () => {
    expect(isPrivateIp("not-an-ip")).toBe(false);
    expect(isPrivateIp("999.999.999.999")).toBe(false);
  });
});

describe("isPrivateIp (IPv6)", () => {
  it.each([
    ["::1", true], // loopback
    ["::", true], // unspecified
    ["fe80::1", true], // link-local
    ["fc00::1", true], // unique-local
    ["fd12:3456::1", true], // unique-local
    ["::ffff:10.0.0.1", true], // IPv4-mapped private
    ["::ffff:169.254.169.254", true], // IPv4-mapped metadata
  ])("flags private %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ["2606:4700:4700::1111", false], // public (Cloudflare)
    ["::ffff:8.8.8.8", false], // IPv4-mapped public
  ])("allows public %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

describe("isPrivateHostname", () => {
  it.each([
    "localhost",
    "app.localhost",
    "svc.internal",
    "10.0.0.1", // literal private IPv4
    "192.168.0.1",
    "[::1]", // bracketed IPv6 literal
    "[fe80::1]",
  ])("flags internal hostname %s", (h) => {
    expect(isPrivateHostname(h)).toBe(true);
  });

  it.each(["example.com", "api.github.com", "8.8.8.8", "[2606:4700::1111]"])(
    "allows public hostname %s",
    (h) => {
      expect(isPrivateHostname(h)).toBe(false);
    },
  );
});

describe("assertPublicUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow(
      "URL not allowed",
    );
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(
      "URL not allowed",
    );
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow("Invalid URL");
  });

  it("rejects literal private/loopback/metadata hosts", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/")).rejects.toThrow(
      "URL not allowed",
    );
    await expect(
      assertPublicUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow("URL not allowed");
    await expect(assertPublicUrl("http://localhost:8080/")).rejects.toThrow(
      "URL not allowed",
    );
    await expect(assertPublicUrl("http://[::1]/")).rejects.toThrow(
      "URL not allowed",
    );
  });

  it("accepts a public literal IP and returns a URL", async () => {
    const u = await assertPublicUrl("https://8.8.8.8/path");
    expect(u).toBeInstanceOf(URL);
    expect(u.hostname).toBe("8.8.8.8");
  });

  // Hostname resolution uses Deno.resolveDns, which is unavailable under the
  // Node test runtime; the helper swallows that resolver error (best-effort) and
  // falls back to the literal checks, so a public hostname is accepted here.
  it("accepts a public hostname (DNS check is best-effort)", async () => {
    const u = await assertPublicUrl("https://example.com/x");
    expect(u.hostname).toBe("example.com");
  });
});
