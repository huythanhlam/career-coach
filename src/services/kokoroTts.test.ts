import { describe, expect, it } from "vitest";

import { kokoroWasmBase } from "./kokoroTts";

// Regression guard: Kokoro voices broke because Transformers.js defaulted
// `wasmPaths` to the jsDelivr CDN and the cross-origin dynamic import of the
// ONNX runtime glue failed ("no available backend found"). We now self-host the
// artifacts under <base>/ort/ and point the runtime there. This base must stay a
// same-origin, app-base-relative path with a trailing slash so the runtime can
// append the artifact filenames — and must never reach for the CDN.
describe("kokoroWasmBase", () => {
  it("serves from the app root by default", () => {
    expect(kokoroWasmBase("/")).toBe("/ort/");
  });

  it("respects a non-root Vite base path", () => {
    expect(kokoroWasmBase("/app/")).toBe("/app/ort/");
  });

  it("normalizes a base path that is missing its trailing slash", () => {
    expect(kokoroWasmBase("/app")).toBe("/app/ort/");
  });

  it("never points at a remote CDN", () => {
    for (const base of ["/", "/app/", "/app"]) {
      expect(kokoroWasmBase(base)).not.toMatch(/^https?:\/\//);
      expect(kokoroWasmBase(base)).not.toContain("cdn.jsdelivr.net");
    }
  });
});
