#!/usr/bin/env bash
# SessionStart hook — shows SPECTRA project health at session start
# Always exits 0 (informational only)

# Only run if this is a SPECTRA project
if [ ! -d ".spectra" ]; then
  exit 0
fi

echo "=== SPECTRA Project Status ==="

# Project status overview
spectra status 2>/dev/null || echo "  (spectra not in PATH — run: npm install -g spectra-sdd)"

echo ""

# Pending gates
echo "--- Pending Gates ---"
spectra gate list 2>/dev/null | grep -i pending || echo "  No pending gates"

# Expired gates
EXPIRED=$(spectra gate list 2>/dev/null | grep -i expired)
if [ -n "$EXPIRED" ]; then
  echo ""
  echo "--- Expired Gates ---"
  echo "$EXPIRED"
fi

echo ""

# Quick drift check
echo "--- Drift ---"
spectra diff 2>/dev/null || echo "  Drift check unavailable"

echo "=== End SPECTRA Status ==="
exit 0
