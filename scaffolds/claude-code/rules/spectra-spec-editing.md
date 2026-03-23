---
paths:
  - ".spectra/**/*.yaml"
  - ".spectra/**/*.yml"
---

# SPECTRA Spec Editing Rules

These rules apply when editing any YAML file in .spectra/.

## Content Hash — Never Modify Manually

The `hash.content_hash` field is computed by SPECTRA using SHA-256 with canonical key ordering.
NEVER write or modify the `hash` block directly. After editing a spec, run:
```
spectra spec rehash <spec-id>
```

## ID Format — Immutable After Creation

Spec IDs follow strict patterns and must NEVER be changed after creation:
- Feature: `feat:<lowercase-hyphenated-name>`
- Implementation: `impl:<feature-name>` (with `concern` field for the namespace)
- Test: `test:<feature-name>`
- Migration: `migration:<name>`

## Semver — Increment on Changes

When editing spec content:
- **Patch bump** (1.0.0 → 1.0.1): Typo fixes, wording improvements
- **Minor bump** (1.0.0 → 1.1.0): New acceptance criteria, new interfaces
- **Major bump** (1.0.0 → 2.0.0): Breaking interface changes, removed ACs

## Gate Invalidation Warning

Editing a spec after a gate has been signed will invalidate that gate (hash mismatch).
Before editing, check gate status: `spectra gate list <spec-id>`
After editing: `spectra gate expire <spec-id>` then re-sign the relevant phases.

## Acceptance Criteria Format

- `id`: Must be `AC-NNN` (three digits, sequential: AC-001, AC-002, AC-003)
- `given`: Concrete precondition — avoid vague words (fast, good, appropriate)
- `when`: Specific action or trigger
- `then`: Array of observable, measurable outcomes
- At least one AC must have `non_negotiable: true`
- Reference relevant constitution constraints via `constitution_constraints: [SEC-001]`

## Post-Edit Checklist

After ANY spec edit:
1. `spectra validate <spec-id>` — fix schema errors
2. `spectra lint <spec-id>` — fix quality issues
3. `spectra spec rehash <spec-id>` — update content hash
