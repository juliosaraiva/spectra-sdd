# CLI Reference

Complete reference for all SPECTRA CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `--version` | Print version and exit |
| `--help` | Print help for any command |

---

## `spectra init`

Initialize a SPECTRA project in the current directory.

```bash
spectra init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--brownfield` | Initialize for existing codebase (provisional constitution at v0.1.0) | `false` |
| `--project-id <id>` | Project identifier | `my-project` |

**Behavior:**
- Creates the `.spectra/` directory with all subdirectories and config files
- Writes a default constitution with 5 constraints
- Idempotent: exits with "already initialized" message if `.spectra/` exists

**Files created:**

```
.spectra/
  config.yaml, constitution.yaml, constitution.changelog,
  trace.json, generate.lock, .gitignore,
  features/_index.yaml,
  features/, impl/, tests/, migrations/, gates/, templates/, adapters/
```

---

## `spectra spec`

Manage feature specifications.

### `spectra spec new <name>`

Create a new feature spec scaffold.

```bash
spectra spec new user-authentication [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--prefix <prefix>` | ID prefix | `feat` |

Creates `.spectra/features/<name>.spec.yaml` with a TODO scaffold. The ID is formed as `<prefix>:<name>`. Rebuilds `_index.yaml` after creation.

### `spectra spec list`

List all feature specs in a table.

```bash
spectra spec list
```

Output columns: ID, Title, Status, Version, ACs. Status is color-coded: active=green, draft=yellow, deprecated=red.

### `spectra spec show <id>`

Print the raw YAML of a spec.

```bash
spectra spec show feat:user-authentication
```

Looks up the spec by ID in `_index.yaml` and prints the file content.

### `spectra spec rehash <id>`

Recompute and update the content hash.

```bash
spectra spec rehash feat:user-authentication
```

Reads the spec file, computes `sha256:...` using canonical key ordering (excluding the `hash` field itself), writes the hash back into the spec's `hash` section, and rebuilds the index.

---

## `spectra design <feat-id>`

Generate implementation spec scaffolds for a feature.

```bash
spectra design feat:user-authentication [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--concerns <list>` | Comma-separated concern namespaces | `transport.rest,persistence.relational,auth.middleware` |

**Behavior:**
- Looks up the feature in `_index.yaml`
- Creates `.spectra/impl/<feature-name>/` directory
- For each concern, generates a scaffold `.impl.yaml` file
- Concern dots are replaced with dashes in filenames (e.g., `transport.rest` becomes `transport-rest.impl.yaml`)
- Each impl spec includes `feature_ref: "<feat-id>@<semver>"` linking to the parent feature

---

## `spectra validate [spec-id]`

Validate spec files against their Zod schemas.

```bash
spectra validate [spec-id] [options]
```

| Option | Description |
|--------|-------------|
| `--all` | Validate all specs (constitution + features + impl) |
| `--cross-refs` | Also check that impl specs reference valid feature IDs |

**Type detection:** Reads `spectra.type` from the YAML, or falls back to filename pattern:
- `.spec.yaml` = feature
- `.impl.yaml` = implementation
- `.test.yaml` = test
- `.migration.yaml` = migration
- `.gate.yaml` = gate
- `constitution` in filename = constitution

**Output:**

```
PASS  .spectra/features/user-authentication.spec.yaml
FAIL  .spectra/impl/user-auth/transport-rest.impl.yaml
  ERROR  spectra.concern — Invalid concern namespace format
```

---

## `spectra lint [spec-id]`

Lint spec files for quality issues beyond schema validity.

```bash
spectra lint [spec-id] [options]
```

| Option | Description |
|--------|-------------|
| `--all` | Lint all feature specs |

Runs 7 active rules (SPEC-001 through SPEC-008). See [Linter Rules](linter-rules.md) for details.

**Output:**

```
WARN  [SPEC-002] .spectra/features/auth.spec.yaml:acceptance_criteria.AC-001.then
      Vague language detected: "fast"
ERROR [SPEC-003] .spectra/features/auth.spec.yaml:interfaces.inputs.0.schema
      Schema contains "any" type

1 error(s), 1 warning(s)
```

---

## `spectra gate`

Manage human review gates.

### `spectra gate sign <spec-id>`

Sign (approve) a gate for a specific phase.

```bash
spectra gate sign feat:user-authentication --phase specify [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--phase <phase>` | **Required.** `specify`, `design`, `test-design`, `implement`, or `reconcile` | -- |
| `--signer <name>` | Signer identity | `@$USER` |
| `--comment <text>` | Approval comment | -- |

Computes the current spec content hash, writes a `.gate.yaml` file to `.spectra/gates/`, and updates the gate status in `trace.json`.

Gate file naming: `<safeId>@<semver>--<phase>.gate.yaml` (colons replaced with underscores).

### `spectra gate check <spec-id>`

Check if prerequisites for a target phase are met.

```bash
spectra gate check feat:user-authentication --phase implement
```

| Option | Description |
|--------|-------------|
| `--phase <phase>` | **Required.** Target phase to check readiness for |

Reports which prerequisite phases are missing.

### `spectra gate verify <spec-id>`

Verify a gate is still valid against the current spec content.

```bash
spectra gate verify feat:user-authentication --phase specify
```

| Option | Description |
|--------|-------------|
| `--phase <phase>` | **Required.** Phase to verify |

Recomputes the spec hash and compares it to the hash stored in the gate file. Reports valid or invalid with a reason.

### `spectra gate list [spec-id]`

List all gates, optionally filtered by spec.

```bash
spectra gate list
spectra gate list feat:user-authentication
```

Output columns: Spec, Phase, Status, Signer, Date. Color-coded: approved=green, expired=red, pending=yellow.

### `spectra gate expire <spec-id>`

Expire all approved gates for a spec.

```bash
spectra gate expire feat:user-authentication
```

Sets status to `expired` on all approved gates. Returns the count of expired gates. Use after amending a spec to invalidate all existing approvals.

---

## `spectra trace`

Traceability matrix operations.

### `spectra trace why <file>`

Reverse-trace a file to its authorizing spec.

```bash
spectra trace why src/routes/auth.ts
```

Searches `trace.json` for a matching path in authorized artifacts. Returns: spec ID, spec hash, impl ref, concern, generation ID.

### `spectra trace forward <spec-id>`

List all authorized artifacts for a spec.

```bash
spectra trace forward feat:user-authentication
```

Shows the full trace entry: status, hash, artifact list (path, type, concern, impl ref), and gate status per phase.

### `spectra trace coverage <spec-id>`

Show acceptance criteria test coverage.

```bash
spectra trace coverage feat:user-authentication
```

Reports: total ACs, covered ACs, coverage percentage, and list of uncovered AC IDs.

### `spectra trace update`

Rebuild the spec index.

```bash
spectra trace update
```

Scans all feature spec files and rebuilds `_index.yaml`.

---

## `spectra diff`

Detect drift between specs and implementation.

```bash
spectra diff [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output raw JSON drift report |
| `--save` | Save report to `.spectra/drift.json` |

Runs all three drift detectors (structural, semantic, constitutional) and produces a report with a normalized 0-1 drift score. See [Core Concepts](core-concepts.md#drift-detection) for details.

---

## `spectra status [spec-id]`

Show spec health status.

```bash
spectra status
spectra status feat:user-authentication
```

**Without arguments:** Project overview -- total specs by status, total gates (approved/pending/expired).

**With spec ID:** Detailed view -- title, version, status, AC count, impl count, test count, content hash, gates per phase, AC coverage.

---

## `spectra generate`

Generate artifacts from specs using AI-assisted templates.

**Note:** The current version outputs guidance for manual AI usage. Full AI adapter integration is planned for a future release.

### `spectra generate tests <feat-id>`

Generate a test spec from feature acceptance criteria.

```bash
spectra generate tests feat:user-authentication
```

### `spectra generate code <feat-id>`

Generate implementation code from impl specs.

```bash
spectra generate code feat:user-authentication
```

---

## `spectra audit`

Audit framework properties.

### `spectra audit determinism <feat-id>`

Verify generation determinism.

```bash
spectra audit determinism feat:user-authentication
```

Re-runs generation with `force: true` and compares the output hash against the locked hash. Reports whether the generation is deterministic.

**Requires:** An existing `generate.lock` entry for the spec and a configured AI adapter.
