#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 05: Implement
# Validates that the source files exist with correct @spectra trace comments
# and the implement gate has been signed and approved.
#
# NOTE: This script does NOT check 'spectra diff' exit code because drift
# detection requires trace.json to have authorized_artifacts populated, which
# is a manual step performed after running 'spectra generate'.
#
# Usage:
#   ./checkpoint.sh [project-root]
#   (defaults to $PWD if no argument is given)
#
# Make executable: chmod +x checkpoint.sh
set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0
PROJECT_ROOT="${1:-$PWD}"
SPECTRA_DIR="$PROJECT_ROOT/.spectra"

pass() { echo "  [PASS] $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  [FAIL] $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

require_file() {
  if [ -f "$1" ]; then pass "exists: $(basename "$1")"; else fail "missing: $1"; fi
}

require_dir() {
  if [ -d "$1" ]; then pass "dir exists: $(basename "$1")"; else fail "missing dir: $1"; fi
}

require_content() {
  local file="$1" pattern="$2" label="$3"
  if grep -qF "$pattern" "$file" 2>/dev/null; then
    pass "$label"
  else
    fail "$label (pattern not found in $(basename "$file"))"
  fi
}

require_cmd_success() {
  local label="$1"; shift
  if (cd "$PROJECT_ROOT" && "$@") > /dev/null 2>&1; then
    pass "$label"
  else
    fail "$label"
  fi
}

# Check that the first line of a file contains a pattern.
require_line1_content() {
  local file="$1" pattern="$2" label="$3"
  local first_line
  first_line=$(head -1 "$file" 2>/dev/null || true)
  if echo "$first_line" | grep -qF "$pattern" 2>/dev/null; then
    pass "$label"
  else
    fail "$label (pattern '$pattern' not on line 1 of $(basename "$file"))"
  fi
}

summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  [ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
}

# ── Upfront check ────────────────────────────────────────────────────────────
echo "Phase 05 — Implement checkpoint"
echo "Project root: $PROJECT_ROOT"
echo ""

if ! command -v spectra > /dev/null 2>&1; then
  echo "  [FAIL] 'spectra' binary not found in PATH."
  echo "         Install it first: npm install -g spectra-sdd"
  echo "         or run: npm link  (from the spectra repo)"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Results: 0 passed, 1 failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
pass "'spectra' binary found in PATH"

# ── Source file existence checks ─────────────────────────────────────────────
ROUTES_FILE="$PROJECT_ROOT/src/routes/auth.ts"
DB_FILE="$PROJECT_ROOT/src/db/auth.ts"
MIDDLEWARE_FILE="$PROJECT_ROOT/src/middleware/auth.ts"

require_file "$ROUTES_FILE"
require_file "$DB_FILE"
require_file "$MIDDLEWARE_FILE"

# ── Trace comment checks (line 1) ────────────────────────────────────────────
require_line1_content "$ROUTES_FILE"     "@spectra feat:user-authentication" \
  "src/routes/auth.ts line 1 contains @spectra feat:user-authentication"
require_line1_content "$ROUTES_FILE"     "impl:transport.rest" \
  "src/routes/auth.ts line 1 contains impl:transport.rest"
require_line1_content "$DB_FILE"         "@spectra feat:user-authentication" \
  "src/db/auth.ts line 1 contains @spectra feat:user-authentication"
require_line1_content "$MIDDLEWARE_FILE" "@spectra feat:user-authentication" \
  "src/middleware/auth.ts line 1 contains @spectra feat:user-authentication"

# ── Gate checks ──────────────────────────────────────────────────────────────
GATE_FILE=$(ls "$SPECTRA_DIR/gates/feat_user-authentication"*"--implement.gate.yaml" 2>/dev/null | head -1 || true)
if [ -n "$GATE_FILE" ] && [ -f "$GATE_FILE" ]; then
  pass "implement gate file exists: $(basename "$GATE_FILE")"
  require_content "$GATE_FILE" "status: approved" "implement gate is approved"
else
  fail "implement gate file not found (expected feat_user-authentication*--implement.gate.yaml in .spectra/gates/)"
  fail "implement gate is approved (gate file missing)"
fi

summary
