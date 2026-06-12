#!/usr/bin/env bash
# SessionStart hook: remote/cloud containers start without node_modules.
# Install dependencies up front so lint/test/hooks work from the first turn.
# stdout becomes session context, so keep it to one informative line.

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if [ -f package-lock.json ] && [ ! -d node_modules ]; then
  if npm ci --silent >/tmp/ensure-deps.log 2>&1; then
    echo "Dependencies installed via npm ci (node_modules was missing)."
  else
    echo "WARNING: npm ci failed (see /tmp/ensure-deps.log) — run it manually before lint/test."
  fi
fi
exit 0
