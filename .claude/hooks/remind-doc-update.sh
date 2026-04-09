#!/usr/bin/env bash
# Stop hook — fired when Claude finishes responding.
# If pending-doc-updates.txt has entries, prints a reminder so Claude
# sees it as hook feedback and updates the CLAUDE.md files.

set -euo pipefail

PENDING_FILE="$(dirname "$0")/../pending-doc-updates.txt"

if [[ ! -f "$PENDING_FILE" ]]; then
  exit 0
fi

# Deduplicate and count
CHANGED=$(sort -u "$PENDING_FILE")
COUNT=$(echo "$CHANGED" | grep -c . || true)

if [[ "$COUNT" -eq 0 ]]; then
  rm -f "$PENDING_FILE"
  exit 0
fi

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  CLAUDE.md UPDATE REMINDER                                  │"
echo "│  $COUNT source file(s) were modified this session.              │"
echo "│  If any changes affect architecture, pitfalls, or rules,   │"
echo "│  update the relevant CLAUDE.md files before finishing.      │"
echo "│                                                             │"
echo "│  Changed files:                                             │"
echo "$CHANGED" | while IFS= read -r line; do
  printf "│    %-59s│\n" "$(basename "$line")"
done
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

# Clear the pending list
rm -f "$PENDING_FILE"

exit 0
