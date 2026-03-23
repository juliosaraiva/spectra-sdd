# Core Concepts

This document explains the fundamental concepts that make SPECTRA's spec-driven development work.

## Constitution

The constitution is the **Tier 0** authority -- a project-wide set of constraints that govern every spec and generation.

### Structure

A constitution defines:
- **Vocabulary** -- Valid domain terms for tagging specs (e.g., `identity`, `security`, `transport`)
- **Constraints** -- Rules with enforcement levels

### Enforcement Levels

| Level | Meaning |
|-------|---------|
| `MUST` | Non-negotiable. Violations are errors. |
| `SHOULD` | Strongly recommended. Violations are warnings. |
| `MAY` | Optional guidance. |

Constraint IDs follow the `[CATEGORY]-[NNN]` pattern: `SEC-001`, `ARCH-001`, `QUAL-002`.

### Constraint Selection Algorithm

When generating code or tests, SPECTRA selects the 3-5 most relevant constraints for the feature's domain tags using a scoring algorithm:

1. For each constraint, count domain tag overlaps with the feature's `identity.domain`
2. Add enforcement boost: `MUST` = +2, `SHOULD` = +1, `MAY` = +0
3. Filter constraints with score > 0
4. Sort by score descending, take top 5

This prevents low-priority constraints from crowding out high-priority ones.

### Amendments

Constitutions are append-only. Changes are recorded in `constitution.changelog`:

```
[2026-03-22T10:00:00Z] AMEND by @lead-architect
  Description: Added OBS-001 observability constraint
  Previous hash: sha256:abc123...
  New hash: sha256:def456...
  Approved by: @team-lead, @security-lead
```

### Default Constraints

`spectra init` creates a constitution with 5 constraints:

| ID | Enforcement | Domain | Description |
|----|-------------|--------|-------------|
| SEC-001 | MUST | security | No secrets in source code |
| SEC-002 | MUST | security, api, transport | Validate all external inputs |
| ARCH-001 | SHOULD | architecture, persistence, transport | Single responsibility per module |
| QUAL-001 | MUST | api, transport | Public interfaces must have acceptance criteria |
| QUAL-002 | MUST | security, identity, persistence | Critical paths must have test specs |

---

## Gates and Phases

Gates are human review checkpoints that enforce a strict phase ordering in the development lifecycle.

### Phase Order

```
specify --> design --> test-design --> implement --> reconcile
```

| Target Phase | Required Signed Phases |
|-------------|----------------------|
| `specify` | _(none -- always ready)_ |
| `design` | `specify` |
| `test-design` | `specify`, `design` |
| `implement` | `specify`, `design`, `test-design` |
| `reconcile` | `specify`, `design`, `test-design`, `implement` |

### Hash Binding

Each gate is bound to a specific **content hash** of the spec at signing time. This is the key insight: gates don't just record that someone approved -- they record *what* they approved.

If the spec content changes after signing:
- `spectra gate verify` reports the gate as invalid
- The drift detector flags it as constitutional drift
- The gate must be re-signed for the new content

### Gate Properties

Each gate file records:
- **Spec binding** -- spec ID, semver, and content hash
- **Phase** -- which lifecycle phase was approved
- **Signer** -- who approved (`@username`)
- **Method** -- how it was approved (`cli`, `github-pr`, `linear-issue`, `api`)
- **Timestamp** -- when it was signed
- **Comment** -- optional approval note

### Expiry

Gates expire when:
- The spec content changes (hash mismatch) and `expires_if_spec_changes` is true (default)
- `spectra gate expire <spec-id>` is run manually

---

## Content Hashing

SPECTRA uses SHA-256 content hashing to detect changes and bind gates to specific spec content.

### Canonicalization Algorithm

The `canonicalize()` function produces a deterministic string from any object:

1. **Sort keys** recursively at every depth (alphabetical order)
2. **Strip the `hash` key** at any depth (prevents self-referential hashing)
3. **Preserve arrays** in their original order (but sort keys within array elements)
4. Pass `null` and `undefined` through unchanged
5. `JSON.stringify()` the result

### Properties

- **Key-order independent** -- `{b: 1, a: 2}` and `{a: 2, b: 1}` produce the same hash
- **Self-reference safe** -- the `hash` field is excluded, so a spec's stored hash doesn't affect its computed hash
- **Deterministic** -- the same content always produces the same hash (verified over 100+ iterations in tests)

### Hash Format

All content hashes use the format: `sha256:<64 hex characters>`

Example: `sha256:a1b2c3d4e5f6...` (64 hex chars)

---

## Traceability

The traceability matrix (`.spectra/trace.json`) connects specs to their authorized artifacts, providing full forward and reverse tracing.

### Trace Matrix Structure

```json
{
  "version": "1.0",
  "updated_at": "2026-03-22T10:00:00Z",
  "specs": {
    "feat:user-authentication": {
      "hash": "sha256:...",
      "status": "active",
      "authorized_artifacts": [
        {
          "path": "src/routes/auth.ts",
          "hash": "sha256:...",
          "concern": "transport.rest",
          "impl_ref": "impl:user-auth-rest",
          "generation_id": "gen:a1b2c3d4",
          "type": "source"
        }
      ],
      "ac_coverage": {
        "AC-001": { "covered": true, "test_ids": ["TC-001"] },
        "AC-002": { "covered": true, "test_ids": ["TC-002"] },
        "AC-003": { "covered": false, "test_ids": [] }
      },
      "gates": {
        "specify": "approved",
        "design": "approved"
      }
    }
  }
}
```

### Trace Comments

Generated source files include a trace comment on the first line:

```typescript
// @spectra feat:user-authentication@2.1.0 impl:transport.rest gen:a1b2c3d4
```

The structural drift detector scans source files for these comments and cross-references them with the trace matrix.

### Operations

| Command | What it does |
|---------|-------------|
| `spectra trace why <file>` | Find which spec authorized a file |
| `spectra trace forward <spec-id>` | List all artifacts for a spec |
| `spectra trace coverage <spec-id>` | Show AC test coverage |
| `spectra trace update` | Rebuild the spec index |

---

## Drift Detection

SPECTRA detects three types of drift between specifications and implementation.

### Structural Drift

Scans source files (`.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.go`, `.rs`, `.java`) in `src/` for `@spectra` trace comments. Flags:

- Files annotated with unknown spec IDs
- Files claiming spec authorization but not in the authorized artifacts list
- Active specs with zero authorized artifacts

### Semantic Drift

Checks acceptance criteria coverage in the trace matrix. Flags:

- Active specs where ACs have `covered: false`

### Constitutional Drift

Checks governance compliance. Flags:

- Active specs with no signed gates at all

### Drift Score

Drift is normalized to a 0-1 score:

```
score = min(1, (errors * 3 + warnings) / (total_items * 3))
```

Errors are weighted 3x more than warnings.

| Range | Meaning |
|-------|---------|
| 0.0 | Clean -- no drift detected |
| 0.0 - 0.3 | Minor drift |
| 0.3 - 0.7 | Significant drift |
| 0.7 - 1.0 | Critical drift |

### CI Integration

```bash
# Save drift report as JSON for CI pipelines
spectra diff --json --save

# The report is saved to .spectra/drift.json (gitignored by default)
```

---

## Progressive Disclosure

The `_index.yaml` file in `.spectra/features/` is a lightweight cache of all feature spec metadata. It enables fast lookups without parsing every spec file.

### Index Entry Fields

Each entry contains: `id`, `title`, `status`, `semver`, `domain`, `summary`, `ac_count`, `impl_count`, `test_count`, `hash`, `file`.

### When It's Rebuilt

The index is automatically rebuilt by:
- `spectra spec new` -- after creating a new spec
- `spectra spec rehash` -- after recomputing a hash
- `spectra trace update` -- on explicit request

### Which Commands Use It

`spectra spec list`, `spectra validate`, `spectra lint`, `spectra gate sign`, `spectra status`, and `spectra design` all read from the index rather than scanning the filesystem directly.
