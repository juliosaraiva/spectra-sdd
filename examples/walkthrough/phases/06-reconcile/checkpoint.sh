#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 06: Reconcile
# Validates that all 5 lifecycle gates (specify, design, test-design,
# implement, reconcile) are present and approved for user-authentication.
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

# Locate and verify a gate file for the given phase.
# Registers a PASS/FAIL for file existence and a PASS/FAIL for approval status.
check_gate() {
  local phase="$1"
  local gate_file
  gate_file=$(ls "$SPECTRA_DIR/gates/feat_user-authentication"*"--${phase}.gate.yaml" 2>/dev/null | head -1 || true)
  if [ -n "$gate_file" ] && [ -f "$gate_file" ]; then
    pass "$phase gate file exists: $(basename "$gate_file")"
    require_content "$gate_file" "status: approved" "$phase gate is approved"
  else
    fail "$phase gate file not found (expected feat_user-authentication*--${phase}.gate.yaml in .spectra/gates/)"
    fail "$phase gate is approved (gate file missing)"
  fi
}

# ── Upfront check ────────────────────────────────────────────────────────────
echo "Phase 06 — Reconcile checkpoint"
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

# ── Gate checks (all 5 lifecycle phases) ────────────────────────────────────
check_gate "specify"
check_gate "design"
check_gate "test-design"
check_gate "implement"
check_gate "reconcile"

# ── Count of approved gate files ─────────────────────────────────────────────
# We expect exactly 5 approved gates for feat_user-authentication.
APPROVED_COUNT=0
while IFS= read -r gate_file; do
  if grep -qF "status: approved" "$gate_file" 2>/dev/null; then
    APPROVED_COUNT=$((APPROVED_COUNT + 1))
  fi
done < <(ls "$SPECTRA_DIR/gates/feat_user-authentication"*".gate.yaml" 2>/dev/null || true)

if [ "$APPROVED_COUNT" -eq 5 ]; then
  pass "exactly 5 approved gates found for feat:user-authentication"
else
  fail "expected 5 approved gates for feat:user-authentication, found $APPROVED_COUNT"
fi

summary
