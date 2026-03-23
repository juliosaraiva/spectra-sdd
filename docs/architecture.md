# Architecture

Technical deep-dive into how SPECTRA's modules connect and data flows through the system.

## System Layers

SPECTRA has three architectural layers:

```
CLI Layer (src/cli/)
  User-facing commands, I/O formatting, orchestration
  |
Core Layer (src/core/)
  Domain logic, schemas, pure functions
  |
Engine Layer (src/engine/)
  Generation pipeline, template rendering, locking
```

## The 5-Tier Spec Hierarchy

```
                    CONSTITUTION (Tier 0)
                 Project-wide constraints
                SEC-001, ARCH-001, QUAL-001
                          |
                +---------+---------+
                |                   |
           FEATURE SPEC        constrains
           (Tier 1)            every tier
           What to build            |
                |                   |
      +---------+---------+         |
      |                   |         |
 IMPL SPEC          TEST SPEC      |
 (Tier 2)           (Tier 3)       |
 How to build       How to verify  |
      |                   |         |
      +------- GATES -----+         |
      |   Phase-ordered   |         |
      |   human review    |         |
      |                   |         |
      +--- TRACEABILITY --+         |
      |   Spec -> Artifact|         |
      |   mapping         |         |
      |                   |         |
      +- DRIFT DETECTION -+---------+
          Structural | Semantic | Constitutional
```

| Tier | Type | Owns | ID Pattern |
|------|------|------|------------|
| 0 | Constitution | Vocabulary + constraints | `const:v1.0` |
| 1 | Feature | Interfaces, ACs, NFRs | `feat:<name>` |
| 2 | Implementation | Design per concern | `impl:<name>` |
| 3 | Test | Test cases (1:1 with ACs) | `test:<name>` |
| 4 | Migration | Change strategy | `migration:<name>` |

## Module Map

### Core Modules

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `spec-types.ts` | Single source of truth for all Zod schemas and types | All schema validators and inferred types |
| `config.ts` | Config loading and path utilities | `spectraDir()`, `loadConfig()`, `resolveSpectraPath()` |
| `hash.ts` | Deterministic content hashing | `canonicalize()`, `contentHash()`, `verifyHash()` |
| `constitution.ts` | Constitution loading and constraint selection | `loadConstitution()`, `selectConstraints()`, `amendConstitution()` |
| `linter.ts` | 7 quality rules for feature specs | `lintFeatureSpec()`, `lintAll()` |
| `gate.ts` | Gate lifecycle management | `signGate()`, `verifyGate()`, `checkPhaseReady()` |
| `trace.ts` | Traceability matrix operations | `traceWhy()`, `traceForward()`, `computeCoverage()` |
| `drift.ts` | Three-layer drift detection | `generateDriftReport()`, `computeDriftScore()` |
| `validator.ts` | Schema validation for all spec types | `validateSpec()`, `validateAll()`, `validateCrossRefs()` |
| `index-builder.ts` | Progressive disclosure index | `rebuildIndex()` |

### Engine Modules

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `generator.ts` | Template rendering orchestration | `generate()` |
| `template-loader.ts` | Handlebars loading + custom helpers | `loadTemplateById()`, `registerHelpers()` |
| `lock.ts` | Generation lock file management | `lockGeneration()`, `isLocked()` |
| `determinism.ts` | Determinism auditing | `auditDeterminism()` |
| `schema-enforcer.ts` | Post-generation schema validation | `enforceSchema()` |

## Module Dependency Graph

```
spec-types.ts    (no internal deps — only zod)
     |
     +---> config.ts
     |       |
     +---> hash.ts (no internal deps — only node:crypto)
     |       |
     +-------+---> constitution.ts
     |       |            |
     +-------+---> linter.ts
     |       |
     +-------+---> gate.ts
     |       |
     +-------+---> trace.ts ---> drift.ts
     |       |
     +-------+---> validator.ts
     |       |
     +-------+---> index-builder.ts
     |
     +---> engine/template-loader.ts ---> engine/generator.ts
     |                                         |
     +---> engine/lock.ts --------------------+---> engine/determinism.ts
     |
     +---> engine/schema-enforcer.ts
```

`spec-types.ts` and `hash.ts` are leaf modules with no internal dependencies. Everything else builds on top of them.

## Data Flow: Feature Lifecycle

```
spectra init
  |
  +-> Creates .spectra/ directory tree
  +-> Writes config.yaml, constitution.yaml, trace.json, etc.
  |
spectra spec new <name>
  |
  +-> Writes features/<name>.spec.yaml (scaffold)
  +-> rebuildIndex() -> writes _index.yaml
  |
spectra validate / lint
  |
  +-> Reads spec file, validates against Zod schema
  +-> Linter runs 7 rules, reports errors/warnings
  |
spectra gate sign --phase specify
  |
  +-> contentHash(spec) -> sha256:...
  +-> Writes gates/<id>@<ver>--specify.gate.yaml
  +-> updateGateInTrace() -> updates trace.json
  |
spectra design --concerns "transport.rest,..."
  |
  +-> Writes impl/<feature>/<concern>.impl.yaml per concern
  |
spectra generate tests <feat-id>
  |
  +-> loadTemplateById("feature-to-tests")
  +-> selectConstraints(constitution, domain_tags)
  +-> Render Handlebars template with spec + constraints
  +-> lockGeneration() -> writes generate.lock
  |
spectra diff
  |
  +-> detectStructuralDrift()  (scans source files for @spectra comments)
  +-> detectSemanticDrift()    (checks ac_coverage in trace.json)
  +-> detectConstitutionalDrift() (checks for unsigned active specs)
  +-> computeDriftScore()      (errors*3 + warnings) / (total*3)
```

## Content Hashing Design

Gates are bound to a content hash, not a version number. This is intentional:

1. `canonicalize(spec)` sorts all keys recursively, strips the `hash` key
2. `SHA-256(canonical JSON)` produces a deterministic 64-char hex string
3. Format: `sha256:<64 hex chars>`

**Key property:** If a spec's content changes by even one character, the hash changes, and all gates bound to the old hash become invalid.

## Progressive Disclosure Index

**Problem:** Parsing hundreds of YAML spec files for `spectra spec list` is slow.

**Solution:** `_index.yaml` is a lightweight cache containing only metadata: id, title, status, semver, domain, summary, ac_count, impl_count, test_count, hash, file.

**Rebuild triggers:** `spec new`, `spec rehash`, `trace update`.

**Consumers:** `spec list`, `validate`, `lint`, `gate sign`, `status`, `design`.

## Generation Lock Semantics

Lock key format: `<specId>@<specVersion>--<target>`

A lock entry is valid when both conditions hold:
- `input_spec_hash` matches the current spec hash
- `template_hash` matches the current template hash

If either changes, generation is re-run. The `--force` flag bypasses the lock (used by `audit determinism`).

## Build System

- **tsup** bundles `src/cli/index.ts` into `dist/index.js` (single ESM file, ~66KB)
- `#!/usr/bin/env node` banner makes it directly executable
- `templates/` directory is included via `"files"` in `package.json`
- Template loader resolves built-in templates via `import.meta.url` relative path
