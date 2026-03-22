# SPECTRA SDD

**Spec-Templated Execution with Composable Traceability and Reconciliation Architecture**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)

---

## What is SPECTRA?

SPECTRA is a CLI framework for **spec-driven development** (SDD). Instead of writing code first and documenting later, SPECTRA inverts the workflow: you write structured YAML specifications, then validate, lint, gate, trace, and generate code from them.

Every feature starts as a formal spec with typed interfaces, acceptance criteria, and constitutional constraints. Human review gates enforce phase ordering. A traceability matrix connects every generated artifact back to the spec that authorized it. Drift detection catches when implementation diverges from its specification.

The result is a development process where **nothing exists without a spec, and nothing drifts without detection**.

---

## Key Features

- **Multi-tier spec system** -- Constitution, feature, implementation, test, and migration specs form a traceable hierarchy
- **Constitutional constraints** -- Project-wide rules (MUST/SHOULD/MAY) that guide every spec and generation
- **Phase-ordered gates** -- Human review checkpoints bound to content hashes: `specify` > `design` > `test-design` > `implement` > `reconcile`
- **Drift detection** -- Three-layer analysis (structural, semantic, constitutional) with a normalized 0-1 drift score
- **Full traceability** -- Reverse-trace any file to its authorizing spec; forward-trace any spec to its artifacts
- **Smart linting** -- 8 quality rules catching vague language, stale hashes, untyped schemas, and unmeasurable NFRs
- **Template-based generation** -- Handlebars templates with constitutional constraint injection for AI-assisted code generation
- **Progressive disclosure** -- Lightweight `_index.yaml` for fast lookups without parsing every spec file

---

## Architecture Overview

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

**Spec hierarchy:**

| Tier | Type | Purpose | ID Pattern |
|------|------|---------|------------|
| 0 | Constitution | Project-wide constraints and vocabulary | `const:v1.0` |
| 1 | Feature | What the system should do (interfaces, ACs, NFRs) | `feat:<name>` |
| 2 | Implementation | How to build a specific concern (transport, persistence, auth) | `impl:<name>` |
| 3 | Test | Test cases derived 1:1 from acceptance criteria | `test:<name>` |
| 4 | Migration | Change strategy for breaking changes | `migration:<name>` |

---

## Quick Start

### Install

**One-line installer (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/install.sh | bash
```

This clones the repo to `~/.spectra-sdd/`, builds the CLI, and symlinks `spectra` into your PATH.

**Requirements:** Node.js >= 20.0.0, npm, git

**Via npm (alternative):**

```bash
npm install -g github:juliosaraiva/spectra-sdd
```

**Custom install location:**

```bash
SPECTRA_INSTALL_DIR=~/tools/spectra SPECTRA_BIN_DIR=~/.local/bin \
  curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/install.sh | bash
```

**Updating:**

Re-run the installer -- it pulls the latest changes and rebuilds:

```bash
curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/install.sh | bash
```

**Uninstalling:**

```bash
curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/uninstall.sh | bash
```

Or manually:

```bash
rm -f /usr/local/bin/spectra
rm -rf ~/.spectra-sdd
```

### Initialize a project

```bash
# New project
spectra init --project-id my-app

# Existing codebase (provisional constitution at v0.1.0)
spectra init --brownfield --project-id my-app
```

This creates the `.spectra/` directory with constitution, config, trace matrix, and spec directories.

### Create your first feature spec

```bash
spectra spec new user-authentication
```

This generates `.spectra/features/user-authentication.spec.yaml` with a scaffold you can fill in.

### Validate and lint

```bash
# Validate schema compliance
spectra validate --all

# Check quality rules
spectra lint --all
```

### Generate implementation scaffolds

```bash
spectra design feat:user-authentication --concerns "transport.rest,persistence.relational"
```

### Sign a gate

```bash
spectra gate sign feat:user-authentication --phase specify --comment "Spec reviewed in PR #42"
```

### Check project status

```bash
spectra status
```

---

## CLI Reference

### `spectra init`

Initialize a SPECTRA project in the current directory.

| Option | Description |
|--------|-------------|
| `--brownfield` | Initialize for an existing codebase (provisional constitution) |
| `--project-id <id>` | Project identifier (default: `my-project`) |

### `spectra spec`

Manage feature specifications.

| Subcommand | Description |
|------------|-------------|
| `spec new <name>` | Create a new feature spec and rebuild index |
| `spec list` | List all specs (ID, title, status, version, AC count) |
| `spec show <id>` | Print raw YAML of a spec |
| `spec rehash <id>` | Recompute and update the content hash |

**Options for `spec new`:**

| Option | Description |
|--------|-------------|
| `--prefix <prefix>` | ID prefix (default: `feat`) |

### `spectra design <feat-id>`

Generate implementation spec scaffolds for a feature.

| Option | Description |
|--------|-------------|
| `--concerns <list>` | Comma-separated concern namespaces (default: `transport.rest,persistence.relational,auth.middleware`) |

### `spectra validate [spec-id]`

Validate spec files against their Zod schemas.

| Option | Description |
|--------|-------------|
| `--all` | Validate all specs |
| `--cross-refs` | Also check that impl specs reference valid feature IDs |

### `spectra lint [spec-id]`

Lint spec files for quality issues beyond schema validity.

| Option | Description |
|--------|-------------|
| `--all` | Lint all specs |

### `spectra gate`

Manage human review gates.

| Subcommand | Description |
|------------|-------------|
| `gate sign <spec-id> --phase <phase>` | Sign (approve) a gate for a phase |
| `gate check <spec-id> --phase <phase>` | Check if prerequisites for a phase are met |
| `gate verify <spec-id> --phase <phase>` | Verify a gate is still valid against the current spec hash |
| `gate list [spec-id]` | List all gates (optionally filtered by spec) |
| `gate expire <spec-id>` | Expire all approved gates for a spec |

**Options for `gate sign`:**

| Option | Description |
|--------|-------------|
| `--phase <phase>` | **Required.** One of: `specify`, `design`, `test-design`, `implement`, `reconcile` |
| `--signer <name>` | Signer identity (default: `@$USER`) |
| `--comment <text>` | Optional approval comment |

### `spectra trace`

Traceability matrix operations.

| Subcommand | Description |
|------------|-------------|
| `trace why <file>` | Reverse-trace a file to its authorizing spec |
| `trace forward <spec-id>` | List all authorized artifacts for a spec |
| `trace coverage <spec-id>` | Show acceptance criteria test coverage |
| `trace update` | Rebuild the traceability index |

### `spectra diff`

Detect drift between specs and implementation.

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |
| `--save` | Save drift report to `.spectra/drift.json` |

### `spectra status [spec-id]`

Show spec health status. Without arguments, shows project overview. With a spec ID, shows detailed status including gates, coverage, and hash.

### `spectra generate`

Generate artifacts from specs using AI-assisted templates.

| Subcommand | Description |
|------------|-------------|
| `generate tests <feat-id>` | Generate test spec from feature acceptance criteria |
| `generate code <feat-id>` | Generate implementation code from impl specs |

### `spectra audit`

Audit framework properties.

| Subcommand | Description |
|------------|-------------|
| `audit determinism <feat-id>` | Verify generation determinism by re-running and comparing hashes |

---

## Spec Types

### Feature Spec

Defines **what** the system should do. Contains typed interfaces, acceptance criteria with given/when/then, and non-functional requirements.

```yaml
spectra:
  type: feature
  id: "feat:user-authentication"
  semver: "2.1.0"
  status: active
  constitution_ref: "const:v1.0"

identity:
  title: "User Authentication"
  domain: [identity, security, api]
  tags: [login, session, credentials]
  summary: "Authenticate users via email/password and issue session tokens"

interfaces:
  inputs:
    - name: credentials
      schema: "{ email: Email, password: string[8..128] }"
  outputs:
    - name: session
      schema: "{ token: JWT, expires_at: ISO8601, user_id: UUID }"
  events:
    emits: ["identity.user.authenticated"]

acceptance_criteria:
  - id: AC-001
    title: "Successful authentication"
    given: "A registered user with valid credentials"
    when: "The user submits correct email and password"
    then:
      - "System returns a valid JWT session token"
      - "Token expires within configured TTL"
      - "Event identity.user.authenticated is emitted"
    non_negotiable: true

  - id: AC-002
    title: "Failed authentication"
    given: "Any authentication attempt with invalid credentials"
    when: "The user submits incorrect email or password"
    then:
      - "System returns a 401 error"
      - "Error message does not reveal which field was incorrect"
    non_negotiable: true

  - id: AC-003
    title: "Rate limiting"
    given: "Multiple failed authentication attempts from the same IP"
    when: "Attempts exceed 5 failures within 15 minutes"
    then:
      - "System returns 429 Too Many Requests"
      - "Lockout duration is included in response headers"
    non_negotiable: false
    constitution_constraints: ["SEC-002"]

non_functional:
  performance: "p99 < 200ms under 1000 concurrent authentications"
  security: "Passwords must be compared using constant-time comparison"
  observability: "All authentication attempts must be logged with correlation ID"
```

### Implementation Spec

Defines **how** to build a specific concern for a feature.

```yaml
spectra:
  type: impl
  id: "impl:user-auth-rest"
  semver: "1.0.0"
  status: active

feature_ref: "feat:user-authentication@2.1.0"
concern: "transport.rest"

design:
  endpoint: "POST /auth/sessions"
  request_schema:
    content_type: "application/json"
    body:
      email: { type: "string", format: "email", required: true }
      password: { type: "string", minLength: 8, maxLength: 128, required: true }
  response_schema:
    success:
      status: 201
      body:
        token: { type: "string", format: "jwt" }
        expires_at: { type: "string", format: "iso8601" }
        user_id: { type: "string", format: "uuid" }
    errors:
      - status: 401
        code: "INVALID_CREDENTIALS"
        message: "Authentication failed"
      - status: 429
        code: "RATE_LIMITED"
        headers: ["Retry-After", "X-RateLimit-Reset"]
  middleware: ["rate-limiter", "request-logger"]
```

### Constitution

Project-wide constraints with enforcement levels.

```yaml
spectra:
  type: constitution
  id: "const:v1.0"
  semver: "1.0.0"
  status: active

vocabulary:
  - identity
  - security
  - transport
  - persistence
  - api

constraints:
  - id: "SEC-001"
    description: "No secrets, tokens, or credentials shall be stored in source code"
    enforcement: MUST
    domain: [security]

  - id: "SEC-002"
    description: "All external inputs must be validated before processing"
    enforcement: MUST
    domain: [security, api, transport]

  - id: "ARCH-001"
    description: "Each module must have a single, well-defined responsibility"
    enforcement: SHOULD
    domain: [architecture, persistence, transport]

  - id: "QUAL-001"
    description: "All public interfaces must have acceptance criteria"
    enforcement: MUST
    domain: [api, transport]

  - id: "QUAL-002"
    description: "All critical paths must have corresponding test specifications"
    enforcement: MUST
    domain: [security, identity, persistence]
```

---

## Constitution

The constitution is the **Tier 0** authority in SPECTRA. It defines:

- **Vocabulary** -- The valid domain terms for tagging specs
- **Constraints** -- Rules with enforcement levels:
  - `MUST` -- Non-negotiable. Violations are errors.
  - `SHOULD` -- Strongly recommended. Violations are warnings.
  - `MAY` -- Optional guidance.

Constraints follow the `[CATEGORY]-[NNN]` pattern (e.g., `SEC-001`, `ARCH-001`, `QUAL-002`).

### Constitution-guided generation

When generating code or tests, SPECTRA automatically selects the 3-5 most relevant constraints based on the feature's domain tags and injects them into the AI prompt. Research shows this achieves 96% constraint compliance.

### Amendments

Constitutions are append-only. Changes are recorded in `constitution.changelog` with timestamps, author, and before/after hashes:

```
[2026-03-22T10:00:00Z] AMEND by @lead-architect
  Description: Added OBS-001 observability constraint
  Previous hash: sha256:abc123...
  New hash: sha256:def456...
  Approved by: @team-lead, @security-lead
```

---

## Gates and Phases

Gates are human review checkpoints that enforce a strict phase ordering:

```
specify --> design --> test-design --> implement --> reconcile
```

Each gate:
- Is bound to a specific **content hash** of the spec at signing time
- Records the **signer**, **timestamp**, and **approval method** (`cli`, `github-pr`, `linear-issue`, `api`)
- **Expires automatically** if the spec content changes after signing

### Phase prerequisites

| Target Phase | Required Signed Phases |
|-------------|----------------------|
| `specify` | _(none -- always ready)_ |
| `design` | `specify` |
| `test-design` | `specify`, `design` |
| `implement` | `specify`, `design`, `test-design` |
| `reconcile` | `specify`, `design`, `test-design`, `implement` |

### Example workflow

```bash
# Write and review the spec
spectra gate sign feat:auth --phase specify --comment "Approved in sprint planning"

# Design the implementation
spectra design feat:auth --concerns "transport.rest,persistence.relational"
spectra gate sign feat:auth --phase design

# Design the tests
spectra gate sign feat:auth --phase test-design

# Implement
spectra gate sign feat:auth --phase implement

# Verify a gate is still valid
spectra gate verify feat:auth --phase design

# Check what's needed before implementation
spectra gate check feat:auth --phase implement
```

---

## Drift Detection

SPECTRA detects three types of drift between specs and implementation:

### Structural drift

Scans source files for `@spectra` trace comments and cross-references them with the traceability matrix:
- Files annotated with unknown spec IDs
- Files claiming spec authorization but not in the authorized artifacts list
- Active specs with zero authorized artifacts

### Semantic drift

Checks acceptance criteria coverage:
- Active specs where ACs have `covered: false` in the trace matrix

### Constitutional drift

Checks governance compliance:
- Active specs with no signed gates at all

### Drift score

Drift is normalized to a 0-1 score:

```
score = min(1, (errors * 3 + warnings) / (total_items * 3))
```

- `0.0` -- No drift detected
- `0.0-0.3` -- Minor drift
- `0.3-0.7` -- Significant drift
- `0.7-1.0` -- Critical drift

```bash
# View drift report
spectra diff

# Save as JSON for CI integration
spectra diff --json --save
```

---

## Traceability

The traceability matrix (`.spectra/trace.json`) is the master map connecting specs to their authorized artifacts.

### Trace comments

Generated source files include a trace comment on the first line:

```typescript
// @spectra feat:user-authentication@2.1.0 impl:transport.rest gen:a1b2c3d4
```

This enables reverse tracing from any file back to the spec that authorized it.

### Operations

```bash
# Where did this file come from?
spectra trace why src/routes/auth.ts

# What artifacts does this spec authorize?
spectra trace forward feat:user-authentication

# How well are acceptance criteria covered?
spectra trace coverage feat:user-authentication

# Rebuild the trace index
spectra trace update
```

### Trace entry structure

Each spec in the trace matrix tracks:
- **Authorized artifacts** -- File paths, content hashes, concerns, generation IDs
- **AC coverage** -- Per-criterion coverage status with test case IDs
- **Gate status** -- Current gate status per phase

---

## Code Generation

SPECTRA uses Handlebars templates to generate AI prompts for code and test generation.

### Built-in templates

| Template | Description |
|----------|-------------|
| `feature-to-tests` | Generate test spec YAML from feature acceptance criteria |
| `impl-to-code` | Generate implementation source code from impl specs |

### How it works

1. Load the feature spec and compute its content hash
2. Check the **generation lock** -- skip if the same input + template hash is already locked
3. Select the 3-5 most relevant **constitutional constraints** for the spec's domain tags
4. Render the Handlebars template with spec data and constitutional context
5. Compute output hash and write to `generate.lock`

### Generation lock

The lock file (`.spectra/generate.lock`) prevents redundant regeneration:

```json
{
  "feat:auth@2.1.0--transport.rest": {
    "template_id": "impl-to-code",
    "template_hash": "sha256:...",
    "input_spec_hash": "sha256:...",
    "output_hash": "sha256:...",
    "generation_id": "gen:a1b2c3d4",
    "generated_at": "2026-03-22T10:00:00Z"
  }
}
```

### Determinism auditing

```bash
spectra audit determinism feat:user-authentication
```

Re-runs generation with `force: true` and compares the new output hash against the locked hash. If they differ, the generation is non-deterministic.

### Custom templates

Place `.tmpl` files in `.spectra/templates/` to override built-in templates or add new ones.

**Available Handlebars helpers:**

| Helper | Description |
|--------|-------------|
| `{{canonical_yaml obj}}` | Canonical JSON string |
| `{{to_yaml obj}}` | YAML serialization |
| `{{json obj}}` | Pretty-printed JSON |
| `{{ac_to_testcase ac}}` | Transform `AC-001` to `TC-001` |

---

## Linter Rules

The linter enforces quality standards beyond schema validity:

| Rule | Severity | Description |
|------|----------|-------------|
| `SPEC-001` | error | Every AC must have non-empty `given`, `when`, and `then` fields |
| `SPEC-002` | warning | ACs must not use vague language (`fast`, `appropriate`, `should`, `might`, etc.) |
| `SPEC-003` | error | Interface schemas must not contain `any` or `unknown` types |
| `SPEC-004` | warning | Performance NFRs must contain a measurable numeric threshold |
| `SPEC-006` | error | If a content hash is present, it must match the current computed hash |
| `SPEC-007` | warning | At least one AC must be marked `non_negotiable: true` |
| `SPEC-008` | warning | Domain tags must exist in the constitution vocabulary |

---

## Project Structure

After running `spectra init`, the following structure is created:

```
.spectra/
  config.yaml                  # Project configuration
  constitution.yaml            # Constitutional constraints
  constitution.changelog       # Immutable amendment audit log
  trace.json                   # Traceability matrix
  generate.lock                # Generation lock file
  .gitignore                   # Ignores drift.json
  features/
    _index.yaml                # Progressive disclosure index
    *.spec.yaml                # Feature specs
  impl/
    <feature>/
      *.impl.yaml              # Implementation specs by concern
  tests/
    *.test.yaml                # Test specs
  migrations/
    *.migration.yaml           # Migration specs
  gates/
    *.gate.yaml                # Gate files (one per spec+phase)
  templates/
    *.tmpl                     # Project-local template overrides
  adapters/                    # AI adapter configurations
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev          # rebuild on change
npm run test:watch   # rerun tests on change

# Type check
npm run typecheck

# Run CLI in development
npm run spectra -- <command>
```

---

## License

MIT
