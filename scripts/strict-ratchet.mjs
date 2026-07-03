// Strict-mode TypeScript ratchet.
//
// Runs `tsc` with `strict: true` (tsconfig.strict.json) and compares the error
// count against the committed baseline in strict-baseline.json. CI fails if the
// count goes UP, so no new strict violations can land while the existing ones
// are burned down. When the count goes DOWN, it prints the command to lower the
// baseline (kept explicit so the ratchet only ever tightens).
//
// This is deliberately separate from `npm run lint` (tsconfig.json, non-strict),
// which stays green so the build and the PostToolUse typecheck hook are unaffected.
// When the baseline reaches 0, fold `strict: true` into tsconfig.json, delete
// tsconfig.strict.json + this script + the baseline, and drop the CI step.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "strict-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).maxErrors;

let output = "";
try {
  // tsc exits non-zero when there are errors; capture stdout either way.
  output = execSync("npx tsc --noEmit -p tsconfig.strict.json", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  output = `${err.stdout || ""}${err.stderr || ""}`;
}

const errorLines = output.split("\n").filter((line) => line.includes("error TS"));
const count = errorLines.length;

console.log(`strict-ratchet: ${count} error(s), baseline ${baseline}`);

if (count > baseline) {
  console.error(
    `\n✗ Strict errors increased ${baseline} → ${count}. New strict violations are not allowed.\n` +
      `  Fix the strict error(s) you introduced, or run \`npm run typecheck:strict -- --list\` to see them all.\n`,
  );
  if (process.argv.includes("--list")) console.error(output);
  process.exit(1);
}

if (count < baseline) {
  console.log(
    `\n✓ Nice — strict errors dropped ${baseline} → ${count}. Tighten the ratchet:\n` +
      `  set "maxErrors" to ${count} in strict-baseline.json.\n`,
  );
} else {
  console.log("✓ No increase in strict errors.");
}

if (process.argv.includes("--list")) console.log(output);
process.exit(0);
