# Changelog

All notable changes to SPECTRA SDD will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-22

### Added

- 11-command CLI: `init`, `spec`, `design`, `validate`, `lint`, `gate`, `trace`, `diff`, `status`, `generate`, `audit`
- 5-tier spec hierarchy: constitution, feature, implementation, test, migration
- Zod-based schema validation for all spec types
- 7 active linter rules (SPEC-001 through SPEC-008) for spec quality enforcement
- Phase-ordered gates: `specify` > `design` > `test-design` > `implement` > `reconcile`
- SHA-256 content hashing with canonical key ordering and self-referential hash exclusion
- Three-layer drift detection (structural, semantic, constitutional) with normalized 0-1 score
- Full traceability matrix (`trace.json`) with reverse and forward tracing
- Progressive disclosure index (`_index.yaml`) for fast spec lookups
- Generation lock (`generate.lock`) for idempotent template rendering
- Two built-in Handlebars templates: `feature-to-tests`, `impl-to-code`
- Constitutional constraint injection for AI-assisted generation (3-5 constraints per request)
- Brownfield initialization mode for existing codebases
- One-line installer script (`install.sh`) and uninstaller (`uninstall.sh`)
- Comprehensive documentation suite in `docs/`
