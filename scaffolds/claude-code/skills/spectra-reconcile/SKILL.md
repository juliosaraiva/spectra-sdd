---
name: spectra-reconcile
description: "Final quality gate: full drift check, trace coverage analysis, and reconcile gate signing."
allowed-tools: Bash, Read
---

# SPECTRA Reconcile Phase

Perform a full drift analysis, verify trace coverage, and sign the final reconcile gate.

**Phase:** `reconcile` (5th of 5 — final phase)
**Gate prerequisite:** `specify`, `design`, `test-design`, and `implement` must be signed.

## Arguments

- `$ARGUMENTS` — Feature spec ID (e.g., `feat:user-authentication`)

## Steps

### 1. Check Gate Prerequisites

```
spectra gate check $ARGUMENTS --phase reconcile
```

If the implement gate is NOT signed, STOP and tell the user which phases are missing.

### 2. Full Drift Report

```
spectra diff
```

Review the drift report:
- **Structural drift** — Files with `@spectra` trace comments that don't match the trace matrix
- **Semantic drift** — Acceptance criteria not covered by test cases
- **Constitutional drift** — Active specs without signed gates

### 3. Trace Coverage

```
spectra trace coverage $ARGUMENTS
```

Report:
- Total ACs
- Covered ACs (with test IDs)
- Coverage percentage
- Uncovered AC IDs (if any)

### 4. Forward Trace

```
spectra trace forward $ARGUMENTS
```

Show all authorized artifacts for this spec: file paths, concerns, generation IDs, gate status per phase.

### 5. Verify Implementation Gate Integrity

```
spectra gate verify $ARGUMENTS --phase implement
```

Ensure the spec hasn't changed since the implement gate was signed.

### 6. Quality Assessment

Evaluate the reconciliation results:

- **Drift score > 0.3** → WARN: Significant drift detected. Suggest the user fix issues before signing.
- **AC coverage < 100%** → WARN: Not all acceptance criteria have test coverage. Show uncovered ACs.
- **Gate verify fails** → STOP: Spec was modified after implementation. Gates need to be re-signed.

### 7. Sign Reconcile Gate

If all checks pass (or user acknowledges warnings):

```
spectra gate sign $ARGUMENTS --phase reconcile --signer "@claude-code" --comment "Reconciliation complete"
```

### 8. Final Status

```
spectra status $ARGUMENTS
```

Show the final state: all 5 gates should be signed.

Tell the user: "Feature `$ARGUMENTS` is fully reconciled. All phases complete. The spec-to-code lifecycle is closed."
