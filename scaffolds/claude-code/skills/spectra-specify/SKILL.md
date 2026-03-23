---
name: spectra-specify
description: "Create or refine a feature spec, validate, lint, and sign the specify gate. The entry point to the SDD lifecycle."
allowed-tools: Bash, Read, Write, Edit
---

# SPECTRA Specify Phase

Create a feature specification with acceptance criteria, validate it, lint it, and sign the specify gate.

**Phase:** `specify` (1st of 5)
**Gate prerequisite:** None — this is the entry point.

## Arguments

- `$ARGUMENTS` — Feature name (e.g., `user-authentication`) or existing spec ID (e.g., `feat:user-authentication`)

## Steps

### 1. Create or Load Spec

If `$ARGUMENTS` looks like a new feature name (no `feat:` prefix):
```
spectra spec new $ARGUMENTS
```
Then read the created scaffold:
```
cat .spectra/features/$ARGUMENTS.spec.yaml
```

If `$ARGUMENTS` is an existing spec ID:
```
spectra spec show $ARGUMENTS
```

### 2. Guide Spec Authoring

Help the user fill in the spec. A complete feature spec requires:

**identity** (required):
- `title` — Clear, concise feature name
- `domain` — Array of domain tags from the constitution vocabulary (e.g., `[identity, security, api]`)
- `tags` — Descriptive tags for search
- `summary` — One-sentence description of what the feature does

**acceptance_criteria** (required, at least 1):
Each AC must follow Given/When/Then format:
- `id` — Sequential: AC-001, AC-002, AC-003...
- `title` — Short descriptive name
- `given` — Precondition (concrete, not vague)
- `when` — Action or trigger
- `then` — Array of observable outcomes (specific, measurable)
- `non_negotiable` — At least ONE AC must be `true`
- `constitution_constraints` — Reference relevant constraint IDs (e.g., `[SEC-001, SEC-002]`)

**interfaces** (recommended):
- `inputs` — Input schemas with names and types
- `outputs` — Output schemas
- `events_emitted` / `events_consumed` — Event contracts

**non_functional** (recommended):
- `performance` — Must include numeric thresholds (e.g., "p99 < 200ms")
- `security` — Specific security requirements
- `observability` — Logging/monitoring requirements

### 3. Validate

```
spectra validate $SPEC_ID
```

If validation fails, fix the schema errors and re-validate.

### 4. Lint

```
spectra lint $SPEC_ID
```

Fix any issues:
- **SPEC-001** (error): Empty given/when/then
- **SPEC-002** (warning): Vague language ("fast", "scalable", "appropriate")
- **SPEC-003** (error): `any` or `unknown` in interface schemas
- **SPEC-004** (warning): Performance NFR without numeric threshold
- **SPEC-006** (error): Stale content hash
- **SPEC-007** (warning): No AC marked `non_negotiable: true`
- **SPEC-008** (warning): Domain tag not in constitution vocabulary

### 5. Rehash

```
spectra spec rehash $SPEC_ID
```

### 6. Confirm and Sign Gate

Show the spec summary to the user and ask for confirmation before signing.

```
spectra gate sign $SPEC_ID --phase specify --signer "@claude-code" --comment "Spec validated and linted"
```

### 7. Show Status

```
spectra status $SPEC_ID
```

### 8. Next Step

Tell the user: "Specify phase complete. Ready for design. Run `/spectra-design $SPEC_ID`"
