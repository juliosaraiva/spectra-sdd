# SPECTRA Walkthrough Scorecard

Aggregated metrics from the "User Authentication with JWT" walkthrough — a realistic feature requiring REST endpoints, database persistence, and auth middleware.

## Step Count by Phase

| Phase | Steps | SPECTRA Commands | Files Created/Edited |
|-------|-------|-----------------|---------------------|
| 01 Configure | 5 | 2 | 8 (.spectra/ tree) |
| 02 Specify | 7 | 6 | 3 (spec, index, gate) |
| 03 Design | 6 | 4 | 4 (3 impl specs, gate) |
| 04 Test Design | 5 | 3 | 2 (test spec, gate) |
| 05 Implement | 8 | 5 | 4 (3 source files, gate) |
| 06 Reconcile | 7 | 7 | 1 (gate only) |
| **Total** | **38** | **27** | **22** |

## Cognitive Load Breakdown

### Format Conventions (8)

These are SPECTRA-specific formats and naming patterns you need to learn:

1. **YAML+Markdown frontmatter** — `.spec.md` and `.impl.md` use YAML frontmatter with Markdown body
2. **AC format** — `## AC-NNN: Title` + `> metadata` + `**Given**/**When**/**Then:**` + `- items`
3. **Spec ID prefixes** — `feat:`, `impl:`, `test:`, `migration:` followed by `[a-z0-9-]+`
4. **AC/TC numbering** — `AC-001`, `TC-001` (zero-padded to 3 digits)
5. **Gate file naming** — `feat_user-authentication@1.0.0--specify.gate.yaml`
6. **Concern namespaces** — `transport.rest`, `persistence.relational`, `auth.middleware`
7. **Trace comment** — `// @spectra <id>@<ver> impl:<concern> gen:<id>` on line 1
8. **Content hash format** — `sha256:` prefix on 64-char hex digest

### Core Concepts (9)

These are the ideas you need to understand to use SPECTRA effectively:

1. **Content hashing** — SHA-256 of canonical JSON, binds gates to spec content
2. **Gate signing** — Human approval checkpoint recorded with signer, timestamp, and spec hash
3. **Phase ordering** — specify -> design -> test-design -> implement -> reconcile (enforced)
4. **Concern decomposition** — Splitting a feature into implementation concerns (REST, DB, auth)
5. **Traceability matrix** — Bidirectional links between specs and source files via trace.json
6. **Drift detection** — Three types: structural (missing traces), semantic (uncovered ACs), constitutional (unsigned gates)
7. **Constitutional constraints** — Project-wide invariants (MUST/SHOULD/MAY) injected into generation
8. **Cross-reference validation** — Impl specs must reference existing feature specs
9. **Spec coverage** — AC-to-TC mapping completeness (spec-level, not runtime)

### Workflow Patterns (5)

These are recurring actions you perform as part of the SPECTRA workflow:

1. **Rehash after edit** — Run `spectra spec rehash` after any spec content change
2. **Trace update after code** — Run `spectra trace update` after writing source files
3. **Gate check before phase** — Run `spectra gate check` before starting a new phase
4. **Validate then lint** — Run `spectra validate` followed by `spectra lint` for quality assurance
5. **Drift check before reconcile** — Run `spectra diff` to confirm clean state before final sign-off

## Where Time Is Spent

Based on the walkthrough, effort distributes roughly as:

- **~60% Spec authoring** (Phases 02-04) — Writing acceptance criteria, design decisions, and test cases. This is the intellectual core of the workflow.
- **~20% Tool ceremony** (across all phases) — Gate signings, rehashing, validation, linting. Mechanical steps that enforce the discipline.
- **~20% Implementation and verification** (Phases 05-06) — Writing code, updating traces, checking drift. The traditional "coding" portion is the smallest slice.

## Friction Points

These are the areas where the current workflow creates the most overhead:

### High Friction

- **Manual `spectra spec rehash`** — Must be run after every spec edit. Forgetting produces lint errors (SPEC-006). No auto-rehash on save.
- **Manual trace.json editing** — Without an AI adapter, source files must be manually added to `authorized_artifacts`. The Claude Code integration automates this.

### Medium Friction

- **5 gate signings per feature** — Each phase requires an explicit `spectra gate sign` command. Cannot be batched or auto-signed.
- **`spectra generate` is a stub** — Test spec and code generation require manual authoring or copying from templates.

### Low Friction

- **Gate invalidation is lazy** — Editing a spec after signing a gate silently invalidates it. You won't know until running `spectra gate verify`.
- **AC coverage is spec-level only** — `spectra trace coverage` checks TC-to-AC mapping, not runtime test execution.

## Comparison: With vs Without Claude Code

| Aspect | Pure CLI (this walkthrough) | With Claude Code Integration |
|--------|---------------------------|------------------------------|
| Spec authoring | Manual in editor | AI-guided via `/spectra-specify` skill |
| Design scaffolds | Manual editing | AI-assisted via `/spectra-design` skill |
| Test spec creation | Copy from golden file | AI-generated from ACs via `/spectra-test-design` skill |
| Source file creation | Manual coding | AI-generated with trace comments via `/spectra-implement` skill |
| Trace update | Manual trace.json edit | Automated by post-edit hook |
| Drift detection | Manual `spectra diff` | Automated after every file edit |
| Gate signing | Manual per phase | Manual per phase (intentionally not automated) |

Gate signing remains manual in both paths — this is by design, as it represents a human review checkpoint.
