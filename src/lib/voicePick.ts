/**
 * Choose the most natural-sounding available speech-synthesis voice. Browser
 * Web Speech voices vary wildly in quality — from rich neural voices down to
 * robotic novelty ones. This scores the installed voices so the interviewer
 * uses the friendliest human-sounding option the OS/browser offers (no cloud
 * TTS). Pure, so it can be unit-tested without a real `speechSynthesis`.
 */

/** Minimal shape of a SpeechSynthesisVoice — enough to rank one. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

// High-quality engine markers and known warm, human-sounding voice names.
const QUALITY_MARKERS = ["neural", "natural", "premium", "enhanced", "google", "online"];
const FRIENDLY_NAMES = [
  "samantha", "ava", "allison", "aria", "jenny", "serena", "sonia",
  "joanna", "kendra", "salli", "nicole", "emma", "zira", "michelle", "siri",
];
// Robotic / novelty voices to avoid.
const ROBOTIC_NAMES = [
  "albert", "fred", "zarvox", "trinoids", "bad news", "good news", "bahh",
  "bells", "boing", "bubbles", "cellos", "deranged", "hysterical", "jester",
  "organ", "superstar", "whisper", "wobble", "grandma", "grandpa", "rocko",
  "shelley", "eddy", "flo", "reed", "sandy", "junior", "ralph", "kathy",
];

/** Score a single voice; higher is more natural/preferred. */
export function scoreVoice(v: VoiceLike): number {
  const name = (v.name || "").toLowerCase();
  const lang = (v.lang || "").toLowerCase();
  let score = 0;

  // Language: strongly prefer US English, then any English.
  if (/^en[-_]us/.test(lang)) score += 40;
  else if (/^en/.test(lang)) score += 25;
  else score -= 20;

  // Engine quality markers.
  if (QUALITY_MARKERS.some((m) => name.includes(m))) score += 30;

  // Known friendly human voices.
  if (FRIENDLY_NAMES.some((n) => name.includes(n))) score += 20;

  // Penalize robotic / novelty voices heavily.
  if (ROBOTIC_NAMES.some((n) => name.includes(n))) score -= 50;

  // Gentle nudge toward the platform default when otherwise tied.
  if (v.default) score += 3;

  return score;
}

/** Pick the best-sounding voice, or null if none are available. */
export function pickVoice<T extends VoiceLike>(voices: T[]): T | null {
  if (!voices || voices.length === 0) return null;
  let best = voices[0];
  let bestScore = scoreVoice(best);
  for (let i = 1; i < voices.length; i++) {
    const s = scoreVoice(voices[i]);
    if (s > bestScore) {
      best = voices[i];
      bestScore = s;
    }
  }
  return best;
}
