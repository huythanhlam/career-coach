import { describe, it, expect } from "vitest";
import { extractCompleteStringFields } from "@/ai/partialJson";

describe("extractCompleteStringFields", () => {
  it("does not extract a top-level string field that hasn't closed yet", () => {
    const buffer = `{"overview": "Stripe is a payments compan`;
    const result = extractCompleteStringFields(buffer, ["overview"]);
    expect(result.overview).toBeUndefined();
  });

  it("extracts a top-level string field once its closing quote arrives", () => {
    const buffer = `{"overview": "Stripe is a payments company.", "ticker": "n`;
    const result = extractCompleteStringFields(buffer, ["overview"]);
    expect(result.overview).toBe("Stripe is a payments company.");
  });

  it("unescapes escaped quotes and newlines within the extracted value", () => {
    const buffer = `{"overview": "Line one.\\nThey call it \\"Stripe\\"."}`;
    const result = extractCompleteStringFields(buffer, ["overview"]);
    expect(result.overview).toBe('Line one.\nThey call it "Stripe".');
  });

  it("does not extract a nested section field before its parent key appears", () => {
    const buffer = `{"overview": "..."`;
    const result = extractCompleteStringFields(buffer, ["hiringValues.summary"]);
    expect(result["hiringValues.summary"]).toBeUndefined();
  });

  it("extracts a nested section's summary once it closes, scoped to its own parent", () => {
    const buffer =
      `{"overview": "...", ` +
      `"hiringValues": {"summary": "Values customer obsession.", "bullets": [` +
      `"benefits": {"summary": "Great health coverage`;
    const result = extractCompleteStringFields(buffer, [
      "hiringValues.summary",
      "benefits.summary",
    ]);
    expect(result["hiringValues.summary"]).toBe("Values customer obsession.");
    expect(result["benefits.summary"]).toBeUndefined();
  });

  it("returns an empty object for an empty or garbage buffer without throwing", () => {
    expect(extractCompleteStringFields("", ["overview"])).toEqual({});
    expect(extractCompleteStringFields("not json at all", ["overview"])).toEqual({});
  });
});
