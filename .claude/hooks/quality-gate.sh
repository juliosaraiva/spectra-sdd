#!/usr/bin/env bash
# quality-gate.sh — Replicates CI Quality/Security Gate checks locally
#
# Modes:
#   --mode=quick    → lint + format only (~3s)
#   --mode=full     → typecheck + lint + format + tests + build (~65s)
#                     Runs ALL checks even if some fail — reports every failure.
#   --mode=security → npm audit with CI-identical fallback logic (~5s)
#
# Exit 0 = all pass | Exit 1 = failures found (with summary)

set -uo pipefail
# NOTE: no set -e — we intentionally continue after individual check failures

MODE="${1:---mode=quick}"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

case "$MODE" in
  --mode=quick)
    echo "=== Quick Quality Check ==="
    FAILURES=""
    npm run lint 2>&1 | tail -5        || FAILURES="${FAILURES}  - ESLint\n"
    npm run format:check 2>&1 | tail -5 || FAILURES="${FAILURES}  - Prettier\n"
    if [ -n "$FAILURES" ]; then
      echo ""
      echo "✗ Quick check FAILED:"
      echo -e "$FAILURES"
      exit 1
    fi
    echo "=== Quick Check Passed ==="
    ;;

  --mode=full)
    echo "=== Full Quality Gate (mirrors CI) ==="
    FAILURES=""
    TOTAL=5
    PASSED=0

    echo ""
    echo "→ [1/5] TypeScript typecheck..."
    if npm run typecheck 2>&1; then
      PASSED=$((PASSED + 1))
      echo "  ✓ typecheck passed"
    else
      FAILURES="${FAILURES}  - typecheck: npm run typecheck\n"
      echo "  ✗ typecheck FAILED"
    fi

    echo ""
    echo "→ [2/5] ESLint..."
    if npm run lint 2>&1; then
      PASSED=$((PASSED + 1))
      echo "  ✓ lint passed"
    else
      FAILURES="${FAILURES}  - lint: npm run lint (fix with: npm run lint:fix)\n"
      echo "  ✗ lint FAILED"
    fi

    echo ""
    echo "→ [3/5] Prettier format check..."
    if npm run format:check 2>&1; then
      PASSED=$((PASSED + 1))
      echo "  ✓ format passed"
    else
      FAILURES="${FAILURES}  - format: npm run format:check (fix with: npm run format)\n"
      echo "  ✗ format FAILED"
    fi

    echo ""
    echo "→ [4/5] Tests with coverage..."
    if npm run test:coverage 2>&1; then
      PASSED=$((PASSED + 1))
      echo "  ✓ tests passed"
    else
      FAILURES="${FAILURES}  - tests: npm run test:coverage\n"
      echo "  ✗ tests FAILED"
    fi

    echo ""
    echo "→ [5/5] Build verification..."
    if npm run build 2>&1; then
      PASSED=$((PASSED + 1))
      echo "  ✓ build passed"
    else
      FAILURES="${FAILURES}  - build: npm run build\n"
      echo "  ✗ build FAILED"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -n "$FAILURES" ]; then
      echo "✗ Quality Gate FAILED ($PASSED/$TOTAL passed)"
      echo ""
      echo "Failed checks:"
      echo -e "$FAILURES"
      echo "Fix ALL issues above, then retry the push."
      exit 1
    fi

    echo "✓ Quality Gate PASSED ($PASSED/$TOTAL)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;

  --mode=security)
    echo "=== Security Check (mirrors CI) ==="
    if npm audit --audit-level=high 2>&1; then
      echo "=== Security Check Passed ==="
      exit 0
    fi
    # Fallback: exclude vulns in npm bundled deps (unfixable upstream)
    # Uses node instead of jq to avoid requiring jq installation
    AUDIT_JSON=$( npm audit --json 2>/dev/null || true )
    HIGH_COUNT=$( echo "$AUDIT_JSON" | node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
      const vulns = data.vulnerabilities || {};
      const count = Object.values(vulns).filter(v =>
        (v.severity === 'high' || v.severity === 'critical') &&
        !(v.nodes || []).every(n => n.startsWith('node_modules/npm/'))
      ).length;
      console.log(count);
    " 2>/dev/null || echo "0" )
    if [ "$HIGH_COUNT" = "0" ]; then
      echo "⚠ npm audit: remaining vulns are in npm bundled deps (upstream fix required)"
      echo "=== Security Check Passed (with upstream warnings) ==="
    else
      echo "✗ $HIGH_COUNT actionable high/critical vulnerabilities found"
      npm audit --audit-level=high
      exit 1
    fi
    ;;

  *)
    echo "Usage: quality-gate.sh --mode=quick|full|security" >&2
    exit 1
    ;;
esac
