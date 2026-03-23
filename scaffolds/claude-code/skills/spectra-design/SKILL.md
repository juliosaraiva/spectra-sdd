---
name: spectra-design
description: "Generate impl spec scaffolds from a feature spec, guide editing, and sign the design gate."
allowed-tools: Bash, Read, Write, Edit
---

# SPECTRA Design Phase

Generate implementation spec scaffolds for each concern, guide the user through design decisions, and sign the design gate.

**Phase:** `design` (2nd of 5)
**Gate prerequisite:** `specify` must be signed.

## Arguments

- `$ARGUMENTS` — Feature spec ID (e.g., `feat:user-authentication`)

## Steps

### 1. Check Gate Prerequisite

```
spectra gate check $ARGUMENTS --phase design
```

If the specify gate is NOT signed, STOP and tell the user:
"The specify gate must be signed first. Run `/spectra-specify $ARGUMENTS`"

### 2. Load the Feature Spec

```
spectra spec show $ARGUMENTS
```

Review the spec's `identity.domain`, `interfaces`, and `acceptance_criteria` to suggest appropriate concern namespaces.

### 3. Determine Concerns

Ask the user for concern namespaces, or suggest defaults based on the spec:
- If spec has REST interfaces → suggest `transport.rest`
- If spec mentions database/storage → suggest `persistence.relational`
- If spec domain includes `security`/`identity` → suggest `auth.middleware`
- If spec has events → suggest `messaging.events`

### 4. Generate Scaffolds

```
spectra design $ARGUMENTS --concerns "<comma-separated concerns>"
```

### 5. Show Created Files

```
ls .spectra/impl/<feature-name>/
```

For each impl spec file, read it and explain what to fill in:
- `design` section — the design decisions for this concern
- `feature_ref` — already set to reference the parent feature

### 6. Guide Design Editing

Help the user fill in the design sections of each impl spec. The design should describe:
- Architecture decisions (patterns, components)
- Technology choices (frameworks, libraries)
- Data models and schemas
- API contracts
- Error handling strategy

### 7. Validate Cross-References

```
spectra validate --all --cross-refs
```

Verify that all impl `feature_ref` fields point to valid feature specs.

### 8. Confirm and Sign Gate

Show a summary of all impl specs and ask for user confirmation.

```
spectra gate sign $ARGUMENTS --phase design --signer "@claude-code" --comment "Design reviewed"
```

### 9. Next Step

Tell the user: "Design phase complete. Ready for test design. Run `/spectra-test-design $ARGUMENTS`"
