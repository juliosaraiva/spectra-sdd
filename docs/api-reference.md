# API Reference

Exported TypeScript functions from SPECTRA's core and engine modules. All functions are async unless noted.

## `src/core/hash.ts`

### `canonicalize(obj: Record<string, unknown>): string`

*Synchronous.* Recursively sorts all object keys alphabetically, strips any key named `hash` at any depth, and returns `JSON.stringify()` of the result. Produces deterministic output regardless of input key order.

### `contentHash(obj: Record<string, unknown>): string`

*Synchronous.* Returns `sha256:<64 hex chars>` -- the SHA-256 hash of `canonicalize(obj)`.

### `verifyHash(obj: Record<string, unknown>, expected: string): boolean`

*Synchronous.* Returns `contentHash(obj) === expected`.

---

## `src/core/config.ts`

### Constants

- `SPECTRA_DIR = ".spectra"`

### `spectraDir(projectRoot: string): string`

*Synchronous.* Returns `join(projectRoot, ".spectra")`.

### `configPath(projectRoot: string): string`

*Synchronous.* Returns `join(spectraDir(projectRoot), "config.yaml")`.

### `loadConfig(projectRoot: string): Promise<Config>`

Reads and parses `.spectra/config.yaml`. Falls back to `DEFAULT_CONFIG` on any error.

### `resolveSpectraPath(projectRoot: string, ...segments: string[]): string`

*Synchronous.* Returns `join(spectraDir(projectRoot), ...segments)`.

---

## `src/core/constitution.ts`

### `loadConstitution(projectRoot: string): Promise<Constitution>`

Reads and validates `.spectra/constitution.yaml` against `ConstitutionSchema`.

### `selectConstraints(constitution: Constitution, domainTags: string[], maxCount?: number): Constraint[]`

*Synchronous.* Scores constraints by domain overlap + enforcement boost (MUST=+2, SHOULD=+1, MAY=+0). Returns top `maxCount` (default 5) constraints with score > 0, sorted descending.

### `validateAgainstConstitution(spec, constitution: Constitution): string[]`

*Synchronous.* Checks that `constitution_constraints` references in ACs exist in the constitution. Returns array of violation messages.

### `amendConstitution(projectRoot: string, amendment: {...}): Promise<void>`

Appends a structured entry to `constitution.changelog`. Amendment includes: action, author, description, approved_by, prev_hash, new_hash.

### `defaultConstitution(): Constitution`

*Synchronous.* Returns the default constitution with 5 constraints (SEC-001, SEC-002, ARCH-001, QUAL-001, QUAL-002).

### `constitutionToYaml(constitution: Constitution): string`

*Synchronous.* YAML serialization with lineWidth: 120.

---

## `src/core/validator.ts`

### `validateSpec(filePath: string): Promise<ValidationResult>`

Reads YAML file, auto-detects spec type (from `spectra.type` or filename pattern), validates against matching Zod schema. Returns `{ file, valid, errors[] }`.

### `validateAll(projectRoot: string): Promise<ValidationResult[]>`

Validates constitution + all feature specs + all impl specs.

### `validateCrossRefs(projectRoot: string): Promise<ValidationResult[]>`

Checks that impl specs' `feature_ref` values resolve to existing feature spec IDs.

---

## `src/core/linter.ts`

### `lintFeatureSpec(spec, filePath, constitutionVocabulary?, rawParsed?): LintResult[]`

*Synchronous.* Runs all SPEC-NNN rules against a feature spec. Returns `{ rule, severity, message, location }[]`.

### `lintAll(projectRoot: string): Promise<LintResult[]>`

Loads constitution vocabulary and runs `lintFeatureSpec()` on all feature specs.

---

## `src/core/gate.ts`

### `createGate(projectRoot, specId, specSemver, specHash, phase): Promise<Gate>`

Creates a gate file with status `pending`.

### `signGate(projectRoot, specId, specSemver, specHash, phase, signer, method?, comment?): Promise<Gate>`

Creates a gate file with status `approved` and approval metadata. Method defaults to `"cli"`.

### `verifyGate(projectRoot, specId, phase, currentSpecHash): Promise<GateVerification>`

Returns `{ valid: boolean, gate: Gate | null, reason?: string }`. Checks status is approved and hash matches.

### `expireGatesForSpec(projectRoot, specId): Promise<number>`

Sets all approved gates for a spec to `expired`. Returns count.

### `listGates(projectRoot, specId?): Promise<Gate[]>`

Returns all gate objects, optionally filtered by spec ID.

### `checkPhaseReady(targetPhase, signedPhases): PhaseReadiness`

*Synchronous.* Returns `{ ready: boolean, missing: Phase[] }`. Checks all prerequisite phases are signed.

---

## `src/core/trace.ts`

### `updateTrace(projectRoot, specId, specHash, status, artifacts[]): Promise<void>`

Upserts a spec entry in the trace matrix with its authorized artifacts.

### `traceWhy(projectRoot, filePath): Promise<TraceAncestry | null>`

Finds which spec authorized a file path. Returns spec_id, spec_hash, impl_ref, generation_id, concern.

### `traceForward(projectRoot, specId): Promise<TraceEntry | null>`

Returns the full trace entry for a spec (artifacts, coverage, gates).

### `computeCoverage(projectRoot, specId): Promise<ACCoverageReport | null>`

Returns total_acs, covered_acs, coverage_percent, uncovered AC IDs.

### `updateGateInTrace(projectRoot, specId, phase, status): Promise<void>`

Updates gate status for a phase in the trace entry.

---

## `src/core/drift.ts`

### `detectStructuralDrift(projectRoot, srcDirs?): Promise<DriftItem[]>`

Scans source files for `@spectra` trace comments and cross-references with trace matrix. Default srcDirs: `["src"]`. Scans `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.go`, `.rs`, `.java`.

### `detectSemanticDrift(trace: TraceMatrix): DriftItem[]`

*Synchronous.* Checks AC coverage for active specs.

### `detectConstitutionalDrift(trace: TraceMatrix): DriftItem[]`

*Synchronous.* Checks active specs have at least one gate.

### `computeDriftScore(items: DriftItem[]): number`

*Synchronous.* Returns normalized 0-1 score: `min(1, (errors*3 + warnings) / (total*3))`.

### `generateDriftReport(projectRoot): Promise<DriftReport>`

Runs all three detectors, groups by spec, returns full report with project_drift_score.

---

## `src/core/index-builder.ts`

### `rebuildIndex(projectRoot: string): Promise<SpecIndex>`

Scans all `.spec.yaml` files in `features/`, extracts metadata, counts impl files and test cases, computes content hash, writes `_index.yaml`. Tolerates parse failures.

---

## `src/engine/generator.ts`

### `generate(projectRoot, options: GenerationOptions): Promise<GenerationResult>`

Full generation pipeline: load spec, check lock, load template, select constraints, render, lock result. Options: `{ templateId, specId, specVersion, target, force? }`. Returns `{ success, output?, generation_id?, input_hash, template_hash, output_hash?, skipped?, error? }`.

---

## `src/engine/template-loader.ts`

### `registerHelpers(): void`

*Synchronous.* Registers 4 Handlebars helpers: `canonical_yaml`, `to_yaml`, `json`, `ac_to_testcase`. Called automatically on module load.

### `loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate>`

Compiles and caches a Handlebars template file.

### `loadTemplateById(projectRoot, templateId): Promise<HandlebarsTemplateDelegate | null>`

Resolution: project-local `.spectra/templates/<id>.tmpl` first, then built-in `templates/<id>.tmpl`. Returns null if not found.

### `listTemplates(projectRoot): Promise<string[]>`

Lists `.tmpl` files in `.spectra/templates/`, returns basenames without extension.

---

## `src/engine/lock.ts`

### `lockGeneration(projectRoot, specId, specVersion, target, entry): Promise<LockEntry>`

Writes a lock entry with auto-generated `generation_id` (`gen:<8-hex>`) and timestamp.

### `isLocked(projectRoot, specId, specVersion, target, inputHash, templateHash): Promise<boolean>`

Returns true only if entry exists AND both hashes match.

### `readLockEntry(projectRoot, specId, specVersion, target): Promise<LockEntry | null>`

Returns the lock entry or null.

---

## `src/engine/determinism.ts`

### `auditDeterminism(projectRoot, specId, specVersion, target): Promise<DeterminismResult>`

Re-runs generation with `force: true`, compares output hash against lock. Returns `{ deterministic, spec_id, target, locked_hash?, regenerated_hash?, message }`.

---

## `src/engine/schema-enforcer.ts`

### `enforceSchema(output: string, schema: ZodType): EnforcementResult`

*Synchronous.* Tries YAML parse, then JSON parse, validates against Zod schema. Returns `{ valid, parsed?, errors?, attempts }`.

### `enforceWithRetry(output, schema, maxAttempts?): EnforcementResult`

Currently single-attempt (retry logic awaits AI adapter). Default maxAttempts: 3.
