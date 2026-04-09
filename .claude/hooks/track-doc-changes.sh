#!/usr/bin/env bash
# PostToolUse hook — fired after every Edit or Write.
# Reads the edited file path from tool_input JSON on stdin.
# If the file is a source file (not already a doc), appends it to
# .claude/pending-doc-updates.txt so the Stop hook can act on it.

set -euo pipefail

PENDING_FILE="$(dirname "$0")/../pending-doc-updates.txt"

# Read file path from tool_input JSON passed on stdin
FILE_PATH="$(cat | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)"

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Skip CLAUDE.md files themselves, docs/, and non-source files
if echo "$FILE_PATH" | grep -qE '(CLAUDE\.md|/docs/|\.json$|\.md$|\.sh$|\.svg$|\.css$|\.html$)'; then
  exit 0
fi

# Only track source files we care about
if echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  echo "$FILE_PATH" >> "$PENDING_FILE"
fi

exit 0
