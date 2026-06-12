---
name: verify-ci
description: Run the full CI gauntlet locally (typecheck, tests, build, prod-dependency audit) and report results. Use before pushing, or whenever asked to verify the branch is CI-green.
---

# Verify CI locally

Run the exact checks `.github/workflows/ci.yml` runs, in order, and report pass/fail for each. Don't stop at the first failure — run all four so the report is complete.

```bash
npm run lint                                  # tsc --noEmit
npm test                                      # vitest run
npm run build                                 # vite build
npm audit --omit=dev --audit-level=high      # prod deps only
```

If `node_modules` is missing, run `npm ci` first (never `npm install` — the lockfile is exact and `.npmrc` disables install scripts).

## Report format

One line per check with ✅/❌. On failure, include the relevant error excerpt (not the full log) and fix the failures if they were caused by changes in this session; otherwise report them as pre-existing.

Note: `npm audit` requires network access and may fail in offline sandboxes — report that as "skipped (no network)", not as a failure.
