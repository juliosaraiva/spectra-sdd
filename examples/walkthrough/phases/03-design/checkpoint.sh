#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 03: Design
# Validates that the implementation design specs have been written and
# the design gate for user-authentication has been signed and approved.
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
echo "Phase 03 — Design checkpoint"
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

# ── Impl spec file checks ────────────────────────────────────────────────────
IMPL_DIR="$SPECTRA_DIR/impl/user-authentication"
TRANSPORT_FILE="$IMPL_DIR/transport-rest.impl.md"
PERSISTENCE_FILE="$IMPL_DIR/persistence-relational.impl.md"
MIDDLEWARE_FILE="$IMPL_DIR/auth-middleware.impl.md"

require_file "$TRANSPORT_FILE"
require_file "$PERSISTENCE_FILE"
require_file "$MIDDLEWARE_FILE"

require_content "$TRANSPORT_FILE"   "feature_ref"             "transport-rest.impl.md contains feature_ref"
require_content "$TRANSPORT_FILE"   "concern: transport.rest"      "transport-rest.impl.md contains concern: transport.rest"
require_content "$PERSISTENCE_FILE" "concern: persistence.relational" "persistence-relational.impl.md contains concern: persistence.relational"
require_content "$MIDDLEWARE_FILE"  "concern: auth.middleware"     "auth-middleware.impl.md contains concern: auth.middleware"

# ── Gate checks ──────────────────────────────────────────────────────────────
GATE_FILE=$(ls "$SPECTRA_DIR/gates/feat_user-authentication"*"--design.gate.yaml" 2>/dev/null | head -1 || true)
if [ -n "$GATE_FILE" ] && [ -f "$GATE_FILE" ]; then
  pass "design gate file exists: $(basename "$GATE_FILE")"
  require_content "$GATE_FILE" "status: approved" "design gate is approved"
else
  fail "design gate file not found (expected feat_user-authentication*--design.gate.yaml in .spectra/gates/)"
  fail "design gate is approved (gate file missing)"
fi

# ── Command check ────────────────────────────────────────────────────────────
require_cmd_success "'spectra validate --all --cross-refs' exits 0" \
  spectra validate --all --cross-refs

summary
