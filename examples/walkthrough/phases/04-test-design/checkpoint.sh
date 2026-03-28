#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 04: Test Design
# Validates that the test spec for user-authentication has been written and
# the test-design gate has been signed and approved.
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
echo "Phase 04 — Test Design checkpoint"
echo "Project root: $PROJECT_ROOT"
echo ""

if ! command -v spectra > /dev/null 2>&1; then
  echo "  [FAIL] 'spectra' binary not found in PATH."
  echo "         Install it first: npm install -g @spectra-sdd/cli"
  echo "         or run: npm link  (from the spectra repo)"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Results: 0 passed, 1 failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
pass "'spectra' binary found in PATH"

# ── Test spec file checks ────────────────────────────────────────────────────
TEST_FILE="$SPECTRA_DIR/tests/user-authentication.test.yaml"

require_file "$TEST_FILE"
require_content "$TEST_FILE" "type: test"       "test spec contains type: test"
require_content "$TEST_FILE" "TC-001"           "test spec contains TC-001"
require_content "$TEST_FILE" "TC-002"           "test spec contains TC-002"
require_content "$TEST_FILE" "TC-003"           "test spec contains TC-003"
require_content "$TEST_FILE" "TC-004"           "test spec contains TC-004"
require_content "$TEST_FILE" "ac_ref: AC-001"   "test spec contains ac_ref: AC-001"
require_content "$TEST_FILE" "ac_ref: AC-002"   "test spec contains ac_ref: AC-002"
require_content "$TEST_FILE" "ac_ref: AC-003"   "test spec contains ac_ref: AC-003"
require_content "$TEST_FILE" "ac_ref: AC-004"   "test spec contains ac_ref: AC-004"
require_content "$TEST_FILE" "feature_ref"      "test spec contains feature_ref"

# ── Gate checks ──────────────────────────────────────────────────────────────
GATE_FILE=$(ls "$SPECTRA_DIR/gates/feat_user-authentication"*"--test-design.gate.yaml" 2>/dev/null | head -1 || true)
if [ -n "$GATE_FILE" ] && [ -f "$GATE_FILE" ]; then
  pass "test-design gate file exists: $(basename "$GATE_FILE")"
  require_content "$GATE_FILE" "status: approved" "test-design gate is approved"
else
  fail "test-design gate file not found (expected feat_user-authentication*--test-design.gate.yaml in .spectra/gates/)"
  fail "test-design gate is approved (gate file missing)"
fi

# ── Command check ────────────────────────────────────────────────────────────
# Note: 'spectra validate test:user-authentication' is not supported —
# ID lookup only works for feature specs via _index.yaml.
# We validate all specs instead, which includes the test spec.
require_cmd_success "'spectra validate --all' exits 0" \
  spectra validate --all

summary
