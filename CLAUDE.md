# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

SPECTRA (Spec-Templated Execution with Composable Traceability and Reconciliation Architecture) is a CLI tool for Spec-Driven Development. It enforces a phased workflow where specs are written first, then designs, tests, implementation, and reconciliation — each gated by signed checkpoints.

## Commands

```bash
npm run build          # Build with tsup (output: dist/index.js)
npm test               # Run all tests (vitest)
npm run test:coverage  # Tests with v8 coverage
npx vitest run tests/core/hash.test.ts  # Run a single test file
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run typecheck      # tsc --noEmit
npm run spectra        # Run CLI from source via tsx
```

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged `.ts` files automatically.

## Architecture

Three-layer design with strict one-directional dependencies:

```
src/cli/    → src/core/    → disk (.spectra/)
                 ↑
src/engine/ ────┘
```

- **`src/cli/`** — Commander commands. Pure presentation (chalk formatting). Delegates all logic to core/engine.
- **`src/core/`** — Domain logic and all `.spectra/` disk I/O. Zod schemas, validation, linting, hashing, gates, drift detection, traceability. Zero engine dependency.
- **`src/engine/`** — Generation concerns: Handlebars templates, generation locking, determinism auditing, schema enforcement. Imports from core but core never imports from engine.

### Phase Workflow

Strict linear lifecycle enforced by `PHASE_ORDER` in `spec-types.ts`:

```
specify → design → test-design → implement → reconcile
```

`checkPhaseReady()` in `core/gate.ts` blocks entry to any phase until all prior phases have `approved` gates. Gate signing stores the spec's content hash — editing a spec invalidates all its signed gates.

### Spec Tiers

| Tier | Type | ID Prefix | Key Property |
|------|------|-----------|-------------|
| 0 | Constitution | (none — singleton) | `vocabulary` + `constraints` |
| 1 | FeatureSpec | `feat:` | ACs, hash block |
| 2 | ImplSpec | `impl:` | `feature_ref`, `concern` namespace |
| 3 | TestSpec | `test:` | `feature_ref`, TC→AC mapping |
| 4 | MigrationSpec | `migration:` | Optional `feature_ref` |

All spec IDs must match `/^(feat|impl|test|migration):[a-z0-9-]+$/`.

### Constitution System

The constitution (`constitution.yaml`) defines project-wide invariants with `MUST/SHOULD/MAY` enforcement. `selectConstraints()` scores constraints by domain tag overlap + enforcement priority (MUST=+2, SHOULD=+1), picks the top 5, and injects them as `constitutional_context` into Handlebars templates during generation. This is how AI-generated code respects project invariants.

### Key Conventions

- **Spec ID → filename**: Colon replaced with `_` in gate filenames (`feat:auth` → `feat_auth@1.0.0--specify.gate.yaml`).
- **Impl organization**: `impl/<feature-name>/<concern-dashes>.impl.yaml` where `feature-name` = ID without `feat:` prefix, concern dots become dashes (`transport.rest` → `transport-rest`).
- **`_index.yaml`**: CLI commands look up specs via this index, not filesystem scanning. Must be rebuilt via `rebuildIndex()` after manual spec edits.
- **Content hashing**: `sha256:` prefix, computed over canonical JSON of the YAML object with the `hash` field excluded. Editing any spec field invalidates gates.
- **Drift trace comments**: Source files use `// @spectra <spec-ref>@<version> impl:<concern> gen:<id>` — structural drift detection depends entirely on these.
- **Template resolution**: Project-local `.spectra/templates/<id>.tmpl` takes priority over bundled `templates/`.
- **`trace.json`**: The only JSON file in `.spectra/` — everything else is YAML. Acts as denormalized cache of gate statuses (dual-written on gate sign).

### Scaffold System

`scaffolds/claude-code/` contains Claude Code integration files (skills, hooks, rules, commands, settings) copied to `.claude/` during `spectra init --claude`. The `findScaffoldsDir()` function tries two paths relative to `import.meta.url` to work both in dev (tsx) and production (bundled dist/).

### What's Not Wired Yet

The `generate` CLI command is a placeholder — it prints guidance but doesn't invoke the engine. The engine (`generator.ts`) is fully implemented but the CLI bridge is marked as "Phase 3".

## Testing

Tests live in `tests/` mirroring the `src/` structure. Vitest with `globals: true` (no explicit imports needed). Path alias `@spectra` → `src/` is configured in both `tsconfig.json` and `vitest.config.ts`.

## TypeScript

- ESM-only (`"type": "module"`)
- `.js` extensions required in imports (even for `.ts` files) due to ESM resolution
- `@typescript-eslint/no-explicit-any` is enforced as an error
- Use `type` imports (`consistent-type-imports` rule enforced)

## Pull Requests

When creating a pull request, ALWAYS assign it to `juliosaraiva` using `--assignee juliosaraiva`.

## Local Quality Gates

Claude Code hooks replicate CI checks locally to catch issues before push:

- **Pre-push gate** (`PreToolUse` on `git push`): Runs the full CI Quality Gate — typecheck, lint, format, tests with coverage, build. Blocks push on any failure.
- **Session start**: npm audit security check runs once per session (informational, non-blocking)
- **Pre-commit** (Husky): ESLint + Prettier on staged files (existing)

### When a quality gate fails

When `git push` is blocked by the quality gate, you MUST:
1. Read ALL failures reported in the gate output (it runs every check, not just the first failure)
2. Fix every issue — use `npm run lint:fix` and `npm run format` for auto-fixable issues
3. Commit the fixes
4. Retry `git push` — the gate runs again automatically
5. Repeat until all 5 checks pass

Do NOT skip the gate or use `--force` or `--no-verify`. Every push must pass: typecheck, lint, format, tests, build.

The quality gate script supports three modes:
```bash
bash .claude/hooks/quality-gate.sh --mode=quick     # lint + format (~3s)
bash .claude/hooks/quality-gate.sh --mode=full      # full CI mirror (~65s)
bash .claude/hooks/quality-gate.sh --mode=security  # npm audit (~5s)
```

CodeQL and Dependency Review remain CI-only (require GitHub infrastructure).
