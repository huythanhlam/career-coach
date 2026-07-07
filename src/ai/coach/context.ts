import type { UserProfile } from "@/types/userProfile";
import type { JobPosting } from "@/types/jobPosting";
import type { UserMemory } from "@/services/coachMemory";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import { buildPipelineSummary } from "@/lib/pipelineStats";

/**
 * Coach OS context assembler (Roadmap F1). Builds the full system instruction for
 * a coach turn by grounding the coach's persona in everything the app already
 * knows about the user: their profile baseline, their live pipeline, their latest
 * scores, and — new in F1 — the top-k durable memories written after past events
 * (`src/services/coachMemory.ts`). So the coach can reference "last week's mock
 * interview" without the user restating it.
 *
 * Pure function (all data is passed in) so it is trivially unit-testable; the
 * panel fetches `memories` via `topMemories()` on open. With no context at all it
 * returns the bare system instruction unchanged.
 */

/** Render the top-k memories as a compact, salience-ordered list. */
function buildMemoryBlock(memories: UserMemory[]): string {
  if (!memories.length) return "";
  const lines = memories.map((m) => `- (${m.kind}) ${m.content}`);
  return ["What you remember about this user from past sessions:", ...lines].join("\n");
}

export function assembleCoachContext(input: {
  systemInstruction: string;
  profile: UserProfile;
  postings: JobPosting[];
  memories: UserMemory[];
}): string {
  const { systemInstruction, profile, postings, memories } = input;

  const context = [
    buildProfileBaseline(profile),
    buildPipelineSummary(postings),
    profile.resumeScore != null ? `Latest resume score: ${profile.resumeScore}/100` : "",
    profile.linkedinScore != null ? `Latest LinkedIn score: ${profile.linkedinScore}/100` : "",
    buildMemoryBlock(memories),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!context) return systemInstruction;
  return `${systemInstruction}\n\nWHAT YOU ALREADY KNOW ABOUT THIS USER (from their profile and activity in the app — use it naturally, don't re-ask for it):\n${context}`;
}
