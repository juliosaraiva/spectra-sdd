---
name: spectra-implement
description: "Generate implementation code from specs. Claude acts as the AI adapter. Enforces gate prerequisites and constitutional constraints."
allowed-tools: Bash, Read, Write, Edit
---

# SPECTRA Implement Phase

Generate implementation code from the feature and impl specs, respecting constitutional constraints, and sign the implement gate.

**Phase:** `implement` (4th of 5)
**Gate prerequisite:** `specify`, `design`, and `test-design` must be signed.

## Arguments

- `$ARGUMENTS` — Feature spec ID (e.g., `feat:user-authentication`)

## Steps

### 1. Check Enforcement

Read `.spectra/config.yaml` and check `ai_tools.enforcement`:
- If `strict` and gate prerequisites not met → STOP with explanation
- If `warn` and gate prerequisites not met → show warning, continue
- If `off` → skip gate checks

```
spectra gate check $ARGUMENTS --phase implement
```

### 2. Load All Specs

Load the feature spec:
```
spectra spec show $ARGUMENTS
```

Load all impl specs:
```
ls .spectra/impl/<feature-name>/
cat .spectra/impl/<feature-name>/*.impl.yaml
```

Extract: spec ID, semver, acceptance criteria, design decisions, concern namespaces.

### 3. Load Constitutional Constraints

```
cat .spectra/constitution.yaml
```

Select relevant constraints for the feature's domain (same scoring as test-design phase).

### 4. Generate Code

For each impl concern, generate source code that:

**MANDATORY — Trace Comment (line 1):**
```
// @spectra <feat-id>@<semver> impl:<concern> gen:<generation-id>
```
The `generation-id` is a unique hex string (e.g., `gen:a1b2c3d4`).

**Implementation Rules:**
- Implement ALL acceptance criteria marked `non_negotiable: true`
- Respect ALL constitutional constraints with enforcement `MUST`
- Follow the design decisions from the impl spec exactly
- Do NOT add features, endpoints, or behaviors not specified in the ACs
- Do NOT hardcode secrets, credentials, or tokens (SEC-001)
- Validate all external inputs (SEC-002)
- Each module should have a single responsibility (ARCH-001)

### 5. Save Files

Ask the user where to save the generated files (suggest paths based on concern namespaces, e.g., `src/routes/` for `transport.rest`).

### 6. Validate and Check Quality

```
spectra validate $ARGUMENTS
spectra lint $ARGUMENTS
spectra diff
```

### 7. Update Trace

```
spectra trace update
```

### 8. Show Summary

Report:
- Files created (paths and concerns)
- Validation status (pass/fail)
- Drift score
- ACs implemented

Ask the user for confirmation before signing.

### 9. Sign Gate

```
spectra gate sign $ARGUMENTS --phase implement --signer "@claude-code" --comment "Code generated from specs"
```

### 10. Next Step

Tell the user: "Implementation phase complete. Ready for reconciliation. Run `/spectra-reconcile $ARGUMENTS`"
