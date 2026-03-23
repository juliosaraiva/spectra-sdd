#!/usr/bin/env bash
# PostToolUse hook — runs lint and drift detection after source file edits
# Always exits 0 (informational only, never blocks)

# Only run if this is a SPECTRA project
if [ ! -d ".spectra" ]; then
  exit 0
fi

# Read tool input from stdin
INPUT=$(cat)

# Extract file path
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    print(ti.get('file_path', '') or ti.get('path', ''))
except:
    print('')
" 2>/dev/null)

# Skip if we couldn't determine a file path (nothing meaningful to check)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Skip if file is in .spectra/ or .claude/ (spec/config edits don't need drift check)
case "$FILE_PATH" in
  .spectra/*|.claude/*)
    exit 0
    ;;
esac

echo "=== SPECTRA Post-Edit Check ==="

# Run lint (non-fatal)
echo "--- Lint ---"
spectra lint --all 2>&1 || true

echo ""

# Run drift detection (non-fatal)
echo "--- Drift ---"
spectra diff 2>&1 || true

echo "=== End SPECTRA Check ==="
exit 0
