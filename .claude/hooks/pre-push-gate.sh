#!/usr/bin/env bash
# PreToolUse hook — runs Full Quality Gate before any git push
# Matches: Bash tool calls containing "git push"
# Exit 0 = allow push | Exit 2 = block push (Claude must fix and retry)
#
# This ensures the same checks that run in CI Quality Gate
# pass locally BEFORE code reaches GitHub.

set -uo pipefail

# Read tool input from stdin
INPUT=$(cat)

# Extract the bash command from tool input JSON
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    print(ti.get('command', ''))
except:
    print('')
" 2>/dev/null || echo "")

# Only trigger on git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+push'; then
  exit 0
fi

# Only run if this is a SPECTRA project
if [ ! -d ".spectra" ]; then
  exit 0
fi

echo "=== Pre-Push Quality Gate ==="
echo "Running full CI checks before push..."
echo ""

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

if bash "$HOOK_DIR/quality-gate.sh" --mode=full; then
  echo ""
  echo "=== Pre-Push Gate Passed — push allowed ==="
  exit 0
fi

# Gate failed — block push and instruct Claude to fix
echo "" >&2
echo "╔══════════════════════════════════════════════════════════╗" >&2
echo "║              PUSH BLOCKED — Quality Gate Failed         ║" >&2
echo "╠══════════════════════════════════════════════════════════╣" >&2
echo "║ Fix ALL failed checks listed above.                     ║" >&2
echo "║ Then commit the fixes and retry: git push               ║" >&2
echo "║                                                         ║" >&2
echo "║ Useful commands:                                        ║" >&2
echo "║   npm run lint:fix      — auto-fix ESLint issues        ║" >&2
echo "║   npm run format        — auto-fix Prettier issues      ║" >&2
echo "║   npm run typecheck     — check types                   ║" >&2
echo "║   npm run test:coverage — run tests with coverage        ║" >&2
echo "╚══════════════════════════════════════════════════════════╝" >&2
exit 2
