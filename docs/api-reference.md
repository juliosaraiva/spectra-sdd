# API Reference

Exported TypeScript functions from SPECTRA's core and engine modules. All functions are async unless noted.

## `src/core/hash.ts`

### `canonicalize(obj: Record<string, unknown>): string`

*Synchronous.* Recursively sorts all object keys alphabetically, strips any key named `hash` at any depth, and returns `JSON.stringify()` of the result. Produces deterministic output regardless of input key order.

### `contentHash(obj: Record<string, unknown>): string`

*Synchronous.* Returns `sha256:<64 hex chars>` -- the SHA-256 hash of `canonicalize(obj)`.

### `verifyHash(obj: Record<string, unknown>, expected: string): boolean`

*Synchronous.* Returns `contentHash(obj) === expected`.

### `hashString(input: string): string`

*Synchronous.* Computes SHA-256 of a raw string value and returns `sha256:<hex>`. Useful for hashing file contents or template output without requiring object canonicalization.

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

Reads a spec file (YAML or Markdown+Frontmatter), auto-detects spec type (from `spectra.type` or filename pattern), validates against matching Zod schema. Returns `{ file, valid, errors[] }`.

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

Scans all feature spec files (`.spec.yaml`, `.spec.yml`, `.spec.md`) in `features/`, extracts metadata, counts impl files and test cases, computes content hash, writes `_index.yaml`. Tolerates parse failures.

---

## `src/core/frontmatter.ts`

### `parseFrontmatter(raw: string): ParsedFrontmatter`

*Synchronous.* Splits a Markdown+Frontmatter string into `{ meta: Record<string, unknown>, body: string }` using `---` delimiters. Throws if no valid frontmatter block is found.

### `parseMarkdownACs(body: string): AcceptanceCriterion[]`

*Synchronous.* Parses a Markdown body into an array of `AcceptanceCriterion` objects. Expects each AC as a `## AC-NNN: Title` heading followed by optional blockquote metadata (`> non_negotiable: true | constitution_constraints: [...]`), `**Given**`, `**When**`, and `**Then:**` / `**Then**` lines.

### `parseFeatureSpecMd(raw: string): Record<string, unknown>`

*Synchronous.* Parses a Markdown+Frontmatter feature spec. Calls `parseFrontmatter` to extract YAML metadata, then `parseMarkdownACs` to extract ACs from the body. Returns an object matching the shape expected by `FeatureSpecSchema`.

### `parseImplSpecMd(raw: string): Record<string, unknown>`

*Synchronous.* Parses a Markdown+Frontmatter impl spec. Frontmatter becomes the metadata; the body is stored as `design.description`. Returns an object matching the shape expected by `ImplSpecSchema`.

### `serializeFeatureSpec(spec: FeatureSpec): string`

*Synchronous.* Serializes a `FeatureSpec` to Markdown+Frontmatter format. Structured metadata (spectra, identity, interfaces, non_functional, dependencies, hash) goes in the YAML frontmatter block; acceptance criteria are rendered as Markdown sections in the body.

### `serializeImplSpec(impl: ImplSpec, designBody?: string): string`

*Synchronous.* Serializes an `ImplSpec` to Markdown+Frontmatter format. The frontmatter contains `spectra` metadata; the body is `designBody` if provided, otherwise `impl.design.description` (or a YAML code block for complex design objects).

---

## `src/core/spec-reader.ts`

### `isMarkdownSpec(filePath: string): boolean`

*Synchronous.* Returns `true` if the file path ends with `.spec.md` or `.impl.md`.

### `isFeatureSpec(fileName: string): boolean`

*Synchronous.* Returns `true` if the filename ends with `.spec.yaml`, `.spec.yml`, or `.spec.md`.

### `isImplSpec(fileName: string): boolean`

*Synchronous.* Returns `true` if the filename ends with `.impl.yaml`, `.impl.yml`, or `.impl.md`.

### `readSpecFile(filePath: string): Promise<{ raw: string; parsed: Record<string, unknown> }>`

Reads a spec file and parses it via `parseSpecContent`. Returns both the raw string and the parsed object, regardless of whether the file is YAML or Markdown+Frontmatter.

### `parseSpecContent(raw: string, filePath: string): Record<string, unknown>`

*Synchronous.* Parses spec content based on file extension: calls `parseFeatureSpecMd` for `.spec.md`, `parseImplSpecMd` for `.impl.md`, and `yaml.parse()` for all other extensions.

### `resolveSpecFile(basePath: string, name: string, type: "spec" | "impl"): Promise<string>`

Resolves a spec file path by probing for `.{type}.md`, then `.{type}.yaml`, then `.{type}.yml`. Returns the first path that exists, or the `.yaml` path as a default (which will fail with a clear error when read).

---

## `src/engine/generator.ts`

### `generate(projectRoot, options: GenerationOptions): Promise<GenerationResult>`

Full generation pipeline: load spec (`.spec.md` or `.spec.yaml` via `resolveSpecFile`), check lock, load template, select constraints, render, lock result. Options: `{ templateId, specId, specVersion, target, force? }`. Returns `{ success, output?, generation_id?, input_hash, template_hash, output_hash?, skipped?, error? }`.

---

## `src/engine/template-loader.ts`

### `registerHelpers(): void`

*Synchronous.* Registers 4 Handlebars helpers: `canonical_yaml`, `to_yaml`, `json`, `ac_to_testcase`. Called automatically on module load.

### `loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate>`

Compiles and caches a Handlebars template file.

### `loadTemplateById(projectRoot, templateId): Promise<HandlebarsTemplateDelegate | null>`

Resolution: project-local `.spectra/templates/<id>.tmpl` first, then built-in `templates/<id>.tmpl`. Returns null if not found.

### `loadTemplateRaw(projectRoot, templateId): Promise<string | null>`

Loads the raw template content (string) by ID without compiling. Uses the same resolution order as `loadTemplateById`. Returns null if not found. Used for computing template hashes.

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
