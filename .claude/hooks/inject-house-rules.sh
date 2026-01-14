#!/bin/bash
# Inject house rules into context after compaction

RULES_FILE="${CLAUDE_PROJECT_DIR}/docs/house-rules.md"

if [ -f "$RULES_FILE" ]; then
  echo "=== MAY I? HOUSE RULES (Re-injected after compaction) ==="
  echo ""
  cat "$RULES_FILE"
  echo ""
fi

exit 0
