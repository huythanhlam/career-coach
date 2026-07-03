import { describe, it, expect } from "vitest";
import { toMarkdown, htmlToMarkdown } from "./formatJobDescription";

describe("htmlToMarkdown", () => {
  it("converts headings, lists, and emphasis", () => {
    const html =
      "<h2>Responsibilities</h2><ul><li>Build <strong>features</strong></li><li>Ship code</li></ul>";
    const md = htmlToMarkdown(html);
    expect(md).toContain("## Responsibilities");
    expect(md).toContain("- Build **features**");
    expect(md).toContain("- Ship code");
  });

  it("converts links and decodes entities", () => {
    const md = htmlToMarkdown('<p>See <a href="https://x.com">our&nbsp;site</a> &amp; more</p>');
    expect(md).toContain("[our site](https://x.com)");
    expect(md).toContain("& more");
  });

  it("keeps paragraph breaks", () => {
    const md = htmlToMarkdown("<p>First para.</p><p>Second para.</p>");
    expect(md).toBe("First para.\n\nSecond para.");
  });
});

describe("toMarkdown (plain-text heuristics)", () => {
  it("turns bullet glyphs into markdown list items", () => {
    const md = toMarkdown("Requirements\n• 5 years experience\n• Strong communication");
    expect(md).toContain("## Requirements");
    expect(md).toContain("- 5 years experience");
    expect(md).toContain("- Strong communication");
  });

  it("promotes known section lines to headings", () => {
    const md = toMarkdown("About the Role\nWe are hiring.\nBenefits\nGreat health care");
    expect(md).toContain("## About the Role");
    expect(md).toContain("## Benefits");
  });

  it("detects HTML input automatically", () => {
    expect(toMarkdown("<ul><li>One</li></ul>")).toContain("- One");
  });

  it("handles empty/nullish input", () => {
    expect(toMarkdown("")).toBe("");
    expect(toMarkdown(null)).toBe("");
    expect(toMarkdown(undefined)).toBe("");
  });

  it("preserves the full content (no truncation of later sections)", () => {
    const long = "Responsibilities\n" + "x".repeat(9000) + "\nBenefits\nHealth insurance";
    const md = toMarkdown(long);
    expect(md).toContain("## Benefits");
    expect(md).toContain("Health insurance");
  });
});
