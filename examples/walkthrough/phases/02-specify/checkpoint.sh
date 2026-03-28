#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 02: Specify
# Validates that the user-authentication feature spec has been written and
# its specify gate has been signed and approved.
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

summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  [ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
}

# ── Upfront check ────────────────────────────────────────────────────────────
echo "Phase 02 — Specify checkpoint"
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

# ── Spec file checks ─────────────────────────────────────────────────────────
SPEC_FILE="$SPECTRA_DIR/features/user-authentication.spec.md"

require_file "$SPEC_FILE"
require_content "$SPEC_FILE" "feat:user-authentication" "spec contains feat:user-authentication"
require_content "$SPEC_FILE" "AC-001" "spec contains AC-001"
require_content "$SPEC_FILE" "AC-002" "spec contains AC-002"
require_content "$SPEC_FILE" "AC-003" "spec contains AC-003"
require_content "$SPEC_FILE" "AC-004" "spec contains AC-004"
require_content "$SPEC_FILE" "non_negotiable: true" "spec contains non_negotiable: true"
require_content "$SPEC_FILE" "content_hash: sha256:" "spec contains content_hash: sha256:"

# ── Gate checks ──────────────────────────────────────────────────────────────
GATE_FILE=$(ls "$SPECTRA_DIR/gates/feat_user-authentication"*"--specify.gate.yaml" 2>/dev/null | head -1 || true)
if [ -n "$GATE_FILE" ] && [ -f "$GATE_FILE" ]; then
  pass "specify gate file exists: $(basename "$GATE_FILE")"
  require_content "$GATE_FILE" "status: approved" "specify gate is approved"
else
  fail "specify gate file not found (expected feat_user-authentication*--specify.gate.yaml in .spectra/gates/)"
  fail "specify gate is approved (gate file missing)"
fi

# ── Command check ────────────────────────────────────────────────────────────
require_cmd_success "'spectra validate feat:user-authentication' exits 0" \
  spectra validate feat:user-authentication

summary
