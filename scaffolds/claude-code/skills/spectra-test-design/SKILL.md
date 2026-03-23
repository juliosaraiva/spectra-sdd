---
name: spectra-test-design
description: "Generate test specs from feature acceptance criteria. Claude acts as the AI adapter for SPECTRA."
allowed-tools: Bash, Read, Write
---

# SPECTRA Test Design Phase

Generate a test specification from the feature spec's acceptance criteria, validate it, and sign the test-design gate.

**Phase:** `test-design` (3rd of 5)
**Gate prerequisite:** `specify` and `design` must be signed.

## Arguments

- `$ARGUMENTS` — Feature spec ID (e.g., `feat:user-authentication`)

## Steps

### 1. Check Enforcement

Read `.spectra/config.yaml` and check `ai_tools.enforcement`:
- If `strict` and gate prerequisites not met → STOP with explanation
- If `warn` and gate prerequisites not met → show warning, continue
- If `off` → skip gate checks

```
spectra gate check $ARGUMENTS --phase test-design
```

### 2. Load Feature Spec

```
spectra spec show $ARGUMENTS
```

Extract: spec ID, semver, acceptance criteria, domain tags.

### 3. Load Constitutional Constraints

```
cat .spectra/constitution.yaml
```

Select the 3-5 most relevant constraints for this feature's domain tags:
- Count domain tag overlaps between constraint and feature
- Add enforcement boost: MUST=+2, SHOULD=+1, MAY=+0
- Sort by score descending, take top 5

### 4. Generate Test Spec YAML

Generate a test specification following this exact schema:

```yaml
spectra:
  version: "1.0"
  type: test
  id: "test:<feature-name>"
  semver: "1.0.0"
  status: draft
  created: "<ISO8601 now>"
  updated: "<ISO8601 now>"
  authors: ["@claude-code"]
  feature_ref: "<feat-id>@<semver>"

test_cases:
  - id: TC-001
    ac_ref: AC-001
    title: "<derived from AC-001 title>"
    given: "<derived from AC-001 given>"
    when: "<derived from AC-001 when>"
    then:
      - "<derived from AC-001 then items>"
    fixtures: []
```

**Rules:**
- Generate exactly ONE test case per acceptance criterion
- Map AC IDs to TC IDs: AC-001 → TC-001, AC-002 → TC-002, etc.
- given/when/then must be direct derivations — no inference, no extras
- Do NOT add test cases beyond what is specified in acceptance criteria
- Respect constitutional constraints in test design

### 5. Write Test Spec

Write the generated YAML to:
```
.spectra/tests/<feature-name>.test.yaml
```

### 6. Validate

```
spectra validate test:<feature-name>
```

If validation fails, fix the YAML and retry once.

### 7. Lint

```
spectra lint test:<feature-name>
```

### 8. Update Trace

```
spectra trace update
```

### 9. Show Result and Confirm

Display the generated test spec to the user for review. Ask for confirmation before signing.

### 10. Sign Gate

```
spectra gate sign $ARGUMENTS --phase test-design --signer "@claude-code" --comment "Test spec generated and validated"
```

### 11. Next Step

Tell the user: "Test design phase complete. Ready to implement. Run `/spectra-implement $ARGUMENTS`"
