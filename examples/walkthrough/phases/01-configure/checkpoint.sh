#!/usr/bin/env bash
# SPECTRA Walkthrough — Phase 01: Configure
# Validates that the project has been correctly initialized with spectra init.
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
echo "Phase 01 — Configure checkpoint"
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

# ── File / directory checks ──────────────────────────────────────────────────
require_dir  "$SPECTRA_DIR"
require_file "$SPECTRA_DIR/config.yaml"
require_content "$SPECTRA_DIR/config.yaml" "project_id" "config.yaml contains project_id"
require_file "$SPECTRA_DIR/constitution.yaml"
require_content "$SPECTRA_DIR/constitution.yaml" "SEC-001" "constitution.yaml contains SEC-001"
require_file "$SPECTRA_DIR/features/_index.yaml"
require_file "$SPECTRA_DIR/trace.json"
require_dir  "$SPECTRA_DIR/gates"

# ── Command check ────────────────────────────────────────────────────────────
require_cmd_success "'spectra status' exits 0" spectra status

summary
