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

# Extract file path from tool input JSON (uses only python3 stdlib — no pip deps)
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

# Read enforcement level from config using grep/awk (no PyYAML dependency)
# Looks for 'enforcement:' under the 'ai_tools:' section
ENFORCEMENT=$(awk '
  /^ai_tools:/ { in_section=1; next }
  in_section && /^[^ ]/ { in_section=0 }
  in_section && /enforcement:/ { gsub(/.*enforcement: */, ""); gsub(/"/, ""); print; exit }
' .spectra/config.yaml 2>/dev/null)

# Default to warn if parsing fails (matches ConfigSchema default)
if [ -z "$ENFORCEMENT" ]; then
  ENFORCEMENT="warn"
fi

# If enforcement is off, allow everything
if [ "$ENFORCEMENT" = "off" ]; then
  exit 0
fi

# Check skip_paths using grep/awk (no PyYAML dependency)
# Reads the skip_paths array items and checks if FILE_PATH starts with any
IN_SKIP_SECTION=0
while IFS= read -r line; do
  case "$line" in
    *"skip_paths:"*)
      IN_SKIP_SECTION=1
      continue
      ;;
  esac
  if [ "$IN_SKIP_SECTION" = "1" ]; then
    # End of array: line doesn't start with whitespace+dash
    case "$line" in
      "  - "*)
        SKIP_PATH=$(echo "$line" | sed 's/^  - //' | sed 's/^"//' | sed 's/"$//')
        case "$FILE_PATH" in
          "$SKIP_PATH"*)
            exit 0
            ;;
        esac
        ;;
      *)
        IN_SKIP_SECTION=0
        ;;
    esac
  fi
done < .spectra/config.yaml 2>/dev/null

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
shopt -u nullglob

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
