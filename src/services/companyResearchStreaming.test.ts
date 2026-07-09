import { describe, it, expect, vi, beforeEach } from "vitest";

const streamWorkflow = vi.fn();
vi.mock("@/ai/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/client")>();
  return { ...actual, streamWorkflow: (...a: unknown[]) => streamWorkflow(...a) };
});

import {
  researchCompanyProfileStreaming,
  researchCompanyNewsStreaming,
} from "@/services/geminiService";

/** A fake streamWorkflow that emits `raw` as a sequence of chunks, then resolves. */
function emits(...chunks: string[]) {
  return async (_wf: unknown, _input: unknown, opts?: { onToken?: (d: string) => void }) => {
    for (const c of chunks) opts?.onToken?.(c);
    return { text: chunks.join(""), sources: [], usage: {} };
  };
}

describe("researchCompanyProfileStreaming", () => {
  beforeEach(() => streamWorkflow.mockReset());

  it("calls onSection with the overview as soon as it closes, before the stream finishes", async () => {
    streamWorkflow.mockImplementation(
      emits(
        `{"overview": "Stripe builds payments infrastructure.", `,
        `"hiringValues": {"summary": "Customer obsession.", "bullets": []}, `,
        `"benefits": {"summary": "Great health plan.", "bullets": []}, `,
        `"interviewTips": {"summary": "", "bullets": []}, `,
        `"financials": {"summary": "", "bullets": []}}`,
      ),
    );
    const seenOverviews: string[] = [];
    await researchCompanyProfileStreaming(
      { jobTitle: "SRE", companyName: "Stripe", jobDescription: "" },
      (partial) => {
        if (partial.overview) seenOverviews.push(partial.overview);
      },
    );
    expect(seenOverviews).toContain("Stripe builds payments infrastructure.");
  });

  it("resolves with the same fully-validated shape the non-streaming path produces", async () => {
    streamWorkflow.mockImplementation(
      emits(
        `{"overview": "Stripe builds payments infrastructure.", ` +
          `"hiringValues": {"summary": "Customer obsession.", "bullets": ["a"]}, ` +
          `"benefits": {"summary": "Great health plan.", "bullets": []}, ` +
          `"interviewTips": {"summary": "Behavioral rounds.", "bullets": []}, ` +
          `"financials": {"summary": "Private.", "bullets": []}, ` +
          `"ticker": ""}`,
      ),
    );
    const result = await researchCompanyProfileStreaming({
      jobTitle: "SRE",
      companyName: "Stripe",
      jobDescription: "",
    });
    expect(result.overview).toBe("Stripe builds payments infrastructure.");
    expect(result.hiringValues.summary).toBe("Customer obsession.");
    expect(result.hiringValues.bullets).toEqual(["a"]);
  });
});

describe("researchCompanyNewsStreaming", () => {
  beforeEach(() => streamWorkflow.mockReset());

  it("calls onSection with the news summary as soon as it closes", async () => {
    streamWorkflow.mockImplementation(
      emits(`{"news": {"summary": "Stripe raised a new round.", "items": []}}`),
    );
    const seen: string[] = [];
    await researchCompanyNewsStreaming(
      { jobTitle: "SRE", companyName: "Stripe", jobDescription: "" },
      (partial) => {
        if (partial.news?.summary) seen.push(partial.news.summary);
      },
    );
    expect(seen).toContain("Stripe raised a new round.");
  });
});
