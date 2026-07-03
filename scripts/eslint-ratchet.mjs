// ESLint warning ratchet.
//
// Runs ESLint against src/ and compares the warning count against
// eslint-baseline.json. CI fails if warnings increase, so no new violations
// can land while existing ones are burned down. When the count drops, it
// prints the command to lower the baseline (ratchet only tightens).
//
// errors (react-hooks/rules-of-hooks etc.) must always be 0 — they block CI
// regardless of the baseline.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "eslint-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).maxWarnings;

let raw = "[]";
try {
  raw = execSync('npx eslint "src/**/*.{ts,tsx}" --format json', {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 50 * 1024 * 1024, // 50 MB — ESLint JSON output can be large
  });
} catch (err) {
  if (err.code === "ENOBUFS") {
    console.error("eslint-ratchet: ESLint output exceeded maxBuffer. Increase maxBuffer in scripts/eslint-ratchet.mjs.");
    process.exit(2);
  }
  raw = err.stdout || "[]";
}

const results = JSON.parse(raw);
const warnings = results.reduce((s, f) => s + f.warningCount, 0);
const errors = results.reduce((s, f) => s + f.errorCount, 0);

console.log(`eslint-ratchet: ${warnings} warning(s), ${errors} error(s), baseline ${baseline}`);

if (errors > 0) {
  console.error(`\n✗ ${errors} ESLint error(s) — fix before merging.\n`);
  if (process.argv.includes("--list")) {
    results
      .filter((f) => f.errorCount > 0)
      .forEach((f) => {
        f.messages
          .filter((m) => m.severity === 2)
          .forEach((m) =>
            console.error(`  ${f.filePath}:${m.line} [${m.ruleId}] ${m.message}`),
          );
      });
  }
  process.exit(1);
}

if (warnings > baseline) {
  console.error(
    `\n✗ ESLint warnings increased ${baseline} → ${warnings}. Fix the warnings you introduced.\n` +
      `  Run \`npm run lint:eslint -- --list\` to see them all.\n`,
  );
  if (process.argv.includes("--list")) {
    results
      .filter((f) => f.warningCount > 0)
      .forEach((f) => {
        f.messages
          .filter((m) => m.severity === 1)
          .forEach((m) =>
            console.error(`  ${f.filePath}:${m.line} [${m.ruleId}] ${m.message}`),
          );
      });
  }
  process.exit(1);
}

if (warnings < baseline) {
  console.log(
    `\n✓ Nice — ESLint warnings dropped ${baseline} → ${warnings}. Tighten the ratchet:\n` +
      `  set "maxWarnings" to ${warnings} in eslint-baseline.json.\n`,
  );
} else {
  console.log("✓ No increase in ESLint warnings.");
}

if (process.argv.includes("--list")) {
  results
    .filter((f) => f.warningCount > 0)
    .forEach((f) => {
      f.messages
        .filter((m) => m.severity === 1)
        .forEach((m) =>
          console.log(`  ${f.filePath}:${m.line} [${m.ruleId}] ${m.message}`),
        );
    });
}

process.exit(0);
