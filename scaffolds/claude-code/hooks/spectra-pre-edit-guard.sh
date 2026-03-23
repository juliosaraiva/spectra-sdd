#!/usr/bin/env bash
# PreToolUse hook — enforces SPECTRA gate requirements before source file edits
# Exit 0: allow | Exit 2: block with message (stderr)
#
# Reads ai_tools.enforcement from .spectra/config.yaml:
#   strict — blocks edits if implement gate is not signed
#   warn   — prints warning but allows
#   off    — no enforcement

# Only run if this is a SPECTRA project
if [ ! -d ".spectra" ]; then
  exit 0
fi

# Read tool input from stdin
INPUT=$(cat)

# Extract file path from tool input JSON
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    print(ti.get('file_path', '') or ti.get('path', ''))
except:
    print('')
" 2>/dev/null)

# No file path — allow
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Always allow edits to .spectra/ and .claude/ files
case "$FILE_PATH" in
  *.spectra/*|*.claude/*)
    exit 0
    ;;
esac

# Read enforcement level from config
ENFORCEMENT=$(python3 -c "
import yaml, sys
try:
    with open('.spectra/config.yaml') as f:
        cfg = yaml.safe_load(f)
    print(cfg.get('ai_tools', {}).get('enforcement', 'warn'))
except:
    print('strict')
" 2>/dev/null || echo "strict")

# If enforcement is off, allow everything
if [ "$ENFORCEMENT" = "off" ]; then
  exit 0
fi

# Check skip_paths
SKIP=$(FILE_PATH="$FILE_PATH" python3 -c "
import yaml, sys, os
try:
    with open('.spectra/config.yaml') as f:
        cfg = yaml.safe_load(f)
    skip = cfg.get('ai_tools', {}).get('skip_paths', [])
    path = os.environ.get('FILE_PATH', '')
    for s in skip:
        if path.startswith(s):
            print('skip')
            sys.exit(0)
    print('check')
except:
    print('check')
" 2>/dev/null || echo "check")

if [ "$SKIP" = "skip" ]; then
  exit 0
fi

# Check if any implement gate is signed (approved)
IMPLEMENT_SIGNED="no"
shopt -s nullglob
for gate_file in .spectra/gates/*--implement.gate.yaml; do
  if [ -f "$gate_file" ]; then
    if grep -q "status: approved" "$gate_file" 2>/dev/null; then
      IMPLEMENT_SIGNED="yes"
      break
    fi
  fi
done

# If implement gate is signed, allow
if [ "$IMPLEMENT_SIGNED" = "yes" ]; then
  exit 0
fi

# Enforcement action
if [ "$ENFORCEMENT" = "strict" ]; then
  echo "SPECTRA ENFORCEMENT: Cannot edit source files without a signed implement gate." >&2
  echo "Sign the required gates first:" >&2
  echo "  spectra gate sign <spec-id> --phase implement" >&2
  echo "Or set enforcement to 'warn' or 'off' in .spectra/config.yaml" >&2
  exit 2
fi

# warn mode — print warning but allow
echo "=== SPECTRA Warning ==="
echo "No signed implement gate found. Edits may introduce untracked drift."
echo "Consider following the SDD workflow: /spectra-specify → /spectra-design → /spectra-test-design → /spectra-implement"
echo "=== End Warning ==="
exit 0
