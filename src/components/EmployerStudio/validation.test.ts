import { describe, it, expect } from "vitest";
import { isValidHttpUrl, validateCompanyDraft } from "./validation";

describe("isValidHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(isValidHttpUrl("https://acme.com")).toBe(true);
    expect(isValidHttpUrl("http://acme.com/logo.png")).toBe(true);
  });

  it("rejects non-http(s) or malformed URLs", () => {
    expect(isValidHttpUrl("acme.com")).toBe(false);
    expect(isValidHttpUrl("ftp://acme.com")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});

describe("validateCompanyDraft", () => {
  it("requires a name", () => {
    expect(validateCompanyDraft({}).name).toBeTruthy();
    expect(validateCompanyDraft({ name: "   " }).name).toBeTruthy();
  });

  it("passes with just a name", () => {
    expect(validateCompanyDraft({ name: "Acme" })).toEqual({});
  });

  it("flags an invalid website or logo URL", () => {
    expect(validateCompanyDraft({ name: "Acme", website: "acme.com" }).website).toBeTruthy();
    expect(validateCompanyDraft({ name: "Acme", logoUrl: "blob:x" }).logoUrl).toBeTruthy();
  });

  it("accepts valid URLs", () => {
    const errors = validateCompanyDraft({ name: "Acme", website: "https://acme.com", logoUrl: "https://acme.com/l.png" });
    expect(errors).toEqual({});
  });
});
