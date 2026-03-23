# Contributing to SPECTRA SDD

Thank you for your interest in contributing to SPECTRA. This guide covers everything you need to get started.

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** (comes with Node.js)
- **git**
- TypeScript knowledge

## Development Setup

```bash
git clone https://github.com/juliosaraiva/spectra-sdd.git
cd spectra-sdd
npm install
npm run build
npm test
```

### Useful commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build the CLI bundle |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check without emitting |
| `npm run spectra -- <cmd>` | Run CLI in development mode |

## Repository Structure

```
src/
  cli/
    index.ts              CLI entry point (Commander.js)
    commands/             One file per command (init.ts, spec.ts, gate.ts, ...)
  core/
    spec-types.ts         All Zod schemas and TypeScript types (single source of truth)
    config.ts             Config loading and path utilities
    hash.ts               SHA-256 content hashing
    constitution.ts       Constitution loading and constraint selection
    linter.ts             8 lint rules for feature specs
    gate.ts               Gate creation, signing, verification
    trace.ts              Traceability matrix operations
    drift.ts              Drift detection (structural/semantic/constitutional)
    validator.ts          Schema validation for all spec types
    index-builder.ts      Progressive disclosure index builder
  engine/
    generator.ts          Template rendering orchestration
    template-loader.ts    Handlebars template loading + custom helpers
    lock.ts               Generation lock file management
    determinism.ts        Determinism auditing
    schema-enforcer.ts    Post-generation schema validation
templates/                Built-in Handlebars prompt templates
tests/                    Vitest test suite (mirrors src/ structure)
docs/                     Documentation
examples/                 Example YAML spec files
```

## Code Style

- **TypeScript strict mode** -- no `any` types
- **ESM modules** throughout -- always use `.js` extensions in imports
- **Named exports only** -- no default exports
- **Zod schemas** co-located with their TypeScript types in `spec-types.ts`
- **chalk** for all terminal output -- no raw ANSI escape codes
- Functions should be pure where possible; side effects isolated to CLI layer

## Running Tests

Tests use [Vitest](https://vitest.dev/) with globals enabled.

```bash
# Single run
npm test

# Watch mode
npm run test:watch
```

**Test organization:**
- `tests/core/` -- Unit tests for core modules
- `tests/cli/` -- Integration tests using `execSync` + temp directories

**Note:** `tests/cli/init.test.ts` spawns a real process and creates temp directories. Do not change this pattern -- it tests the actual CLI binary.

## How to Add a New CLI Command

1. Create `src/cli/commands/<name>.ts`
2. Export a `Command` instance (e.g., `export const myCommand = ...`)
3. Register it in `src/cli/index.ts` with `program.addCommand(myCommand)`
4. Add tests in `tests/cli/<name>.test.ts`
5. Document it in `docs/cli-reference.md`

## How to Add a Lint Rule

1. Add the rule to `lintFeatureSpec()` in `src/core/linter.ts`
2. Use the `SPEC-NNN` naming convention, incrementing from the current max (`SPEC-008`)
3. Add unit tests in `tests/core/linter.test.ts`
4. Document the rule in `docs/linter-rules.md` with pass/fail YAML examples

## How to Add a Spec Type

1. Define the Zod schema in `src/core/spec-types.ts`
2. Add type detection in the `schemaMap` in `src/core/validator.ts`
3. Update `docs/spec-reference.md`

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix a bug
docs: documentation changes
refactor: code refactoring (no behavior change)
test: add or update tests
chore: maintenance tasks
```

Scope is optional: `feat(gate): add --method option to gate sign command`

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes
3. Ensure `npm test` passes
4. Ensure `npm run typecheck` passes
5. Update relevant `docs/` pages if your change affects user-facing behavior
6. Submit a PR with a clear description

## Reporting Issues

Open an issue on GitHub. Please include:
- SPECTRA version (`spectra --version`)
- Node.js version (`node --version`)
- Operating system
- Full command and output
- Contents of `.spectra/config.yaml` (redact sensitive fields)
