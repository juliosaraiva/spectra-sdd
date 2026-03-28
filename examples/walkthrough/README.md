# SPECTRA Walkthrough: Evaluate the Developer Experience

A hands-on, phase-by-phase walkthrough that lets you experience SPECTRA's spec-driven development workflow from start to finish. By the end, you'll have taken a simple feature idea through all 5 phases — specify, design, test-design, implement, reconcile — and understand the exact step count and cognitive load at each stage.

## Who This Is For

Developers and teams evaluating whether to adopt SPECTRA for their projects. Instead of reading about what SPECTRA does, you'll run real commands against a real project and see the workflow firsthand.

## Prerequisites

- **Node.js** >= 20
- **SPECTRA** installed globally: `npm install -g spectra-sdd`
- **git** (for version control)

## Quick Setup

```bash
# 1. Copy the starter project to a working directory
cp -r examples/walkthrough/starter ~/taskflow-api
cd ~/taskflow-api
npm install

# 2. Follow the phases in order (start with Phase 01)
```

## The Walkthrough

You'll implement **User Authentication with JWT** — a realistic feature that touches REST endpoints, database persistence, and auth middleware.

| Phase | Guide | What You'll Do | Steps |
|-------|-------|---------------|-------|
| 01 | [Configure](phases/01-configure/guide.md) | Initialize SPECTRA in the project | 5 |
| 02 | [Specify](phases/02-specify/guide.md) | Write the feature spec with 4 acceptance criteria | 7 |
| 03 | [Design](phases/03-design/guide.md) | Create implementation specs for 3 concerns | 6 |
| 04 | [Test Design](phases/04-test-design/guide.md) | Map test cases to acceptance criteria | 5 |
| 05 | [Implement](phases/05-implement/guide.md) | Write source code with traceability | 8 |
| 06 | [Reconcile](phases/06-reconcile/guide.md) | Verify drift-free, close all gates | 7 |

**Total: 38 steps, 27 SPECTRA commands, 22 concepts to learn**

See the full metrics breakdown in [summary/scorecard.md](summary/scorecard.md).

## Checkpoint Scripts

Each phase includes a `checkpoint.sh` script that validates your project is in the correct state:

```bash
# After completing a phase, run its checkpoint
chmod +x phases/01-configure/checkpoint.sh
./phases/01-configure/checkpoint.sh ~/taskflow-api
```

The script prints `[PASS]` or `[FAIL]` for each check and exits with code 0 if everything passes.

## Golden Files

Each phase includes a `golden/` directory with reference files showing the expected state after completing that phase. You can use these to:

- **Verify your work** — compare your files against the golden reference
- **Skip ahead** — copy golden files into your project to jump to any phase
- **Recover from mistakes** — reset to a known-good state without starting over

```bash
# Example: skip to Phase 03 by copying golden files from Phase 02
cp -r phases/02-specify/golden/.spectra/* ~/taskflow-api/.spectra/
```

## What You'll Learn

By completing this walkthrough, you'll understand:

- How SPECTRA enforces a spec-first development discipline
- What it takes to write a feature spec with structured acceptance criteria
- How phase gates prevent skipping steps in the development lifecycle
- How content hashing detects when specs change after gates are signed
- How traceability links source files back to their authorizing specifications
- The real step count and cognitive overhead of each phase

## Honest Limitations

This walkthrough surfaces real friction points in the current SPECTRA workflow:

- The `spectra generate` command requires an AI adapter that is not yet wired (Phase 04 works around this)
- Source file registration in `trace.json` is manual without an AI adapter (Phase 05 notes this)
- `spectra spec rehash` must be run after every spec edit (no auto-rehash)
- Each feature requires 5 separate gate signings

These limitations are documented at each phase where they appear, with notes on how the Claude Code integration addresses them.
