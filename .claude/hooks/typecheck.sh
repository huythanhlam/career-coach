#!/usr/bin/env bash
# PostToolUse hook: typecheck the project after any .ts/.tsx edit.
# Exit 2 feeds the tsc errors back to Claude so it fixes them immediately.

input=$(cat)
file_path=$(printf '%s' "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
# Skip silently when deps aren't installed (fresh container) — the
# SessionStart hook handles installation; failing here would just be noise.
[ -d node_modules ] || exit 0

errors=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "Typecheck failed after editing $file_path:"
    printf '%s\n' "$errors" | head -30
  } >&2
  exit 2
fi
exit 0
