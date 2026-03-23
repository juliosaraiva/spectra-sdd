# Getting Started

This tutorial walks you through the complete SPECTRA SDD workflow -- from initializing a project to detecting drift.

## Prerequisites

- Node.js >= 20.0.0
- npm
- git (optional)

## Installation

**One-line installer:**

```bash
curl -fsSL https://raw.githubusercontent.com/juliosaraiva/spectra-sdd/main/install.sh | bash
```

**Or via npm:**

```bash
npm install -g github:juliosaraiva/spectra-sdd
```

Verify the installation:

```bash
spectra --version
```

## What We're Building

We'll spec out a **user authentication** feature for a REST API and walk through the full SDD lifecycle: specify, validate, lint, gate, design, and detect drift.

## Step 1: Initialize a Project

```bash
mkdir my-api && cd my-api
spectra init --project-id my-api
```

This creates the `.spectra/` directory:

```
.spectra/
  config.yaml              Project configuration
  constitution.yaml        5 default constraints (SEC-001, SEC-002, ARCH-001, QUAL-001, QUAL-002)
  constitution.changelog   Immutable amendment audit log
  trace.json               Empty traceability matrix
  generate.lock            Empty generation lock
  features/
    _index.yaml            Empty spec index
  impl/                    Implementation specs (empty)
  tests/                   Test specs (empty)
  migrations/              Migration specs (empty)
  gates/                   Gate files (empty)
  templates/               Project-local template overrides (empty)
  adapters/                AI adapter configs (empty)
```

For an existing codebase, use `--brownfield` to create a provisional constitution at v0.1.0.

## Step 2: Explore the Constitution

View the default constraints:

```bash
cat .spectra/constitution.yaml
```

The default constitution includes:

| Constraint | Enforcement | Description |
|-----------|-------------|-------------|
| SEC-001 | MUST | No secrets in source code |
| SEC-002 | MUST | Validate all external inputs |
| ARCH-001 | SHOULD | Single responsibility per module |
| QUAL-001 | MUST | Public interfaces must have acceptance criteria |
| QUAL-002 | MUST | Critical paths must have test specifications |

These constraints are automatically injected into AI generation prompts. See [Core Concepts](core-concepts.md#constitution) for details.

## Step 3: Create a Feature Spec

```bash
spectra spec new user-authentication
```

This creates `.spectra/features/user-authentication.spec.yaml` with a scaffold. Edit it to define your feature:

```yaml
spectra:
  version: "1.0"
  type: feature
  id: "feat:user-authentication"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors: ["@your-name"]
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

acceptance_criteria:
  - id: AC-001
    title: "Successful authentication"
    given: "A registered user with valid credentials"
    when: "The user submits correct email and password"
    then:
      - "System returns a valid JWT session token"
      - "Token expires within configured TTL"
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
```

## Step 4: Validate the Spec

```bash
spectra validate feat:user-authentication
```

Expected output:

```
PASS  .spectra/features/user-authentication.spec.yaml
```

If there are schema errors, you'll see:

```
FAIL  .spectra/features/user-authentication.spec.yaml
  ERROR  acceptance_criteria.0.then — Array must contain at least 1 element(s)
```

To validate all specs at once:

```bash
spectra validate --all --cross-refs
```

## Step 5: Lint the Spec

```bash
spectra lint feat:user-authentication
```

The linter checks quality beyond schema validity. Common issues:

```
WARN  [SPEC-002] .spectra/features/user-authentication.spec.yaml:acceptance_criteria.AC-003.then
      Vague language detected: "appropriate" — use precise, measurable terms

WARN  [SPEC-004] .spectra/features/user-authentication.spec.yaml:non_functional.performance
      Performance requirement lacks measurable threshold — include a number
```

Fix by replacing vague words with specific values. See [Linter Rules](linter-rules.md) for all rules.

## Step 6: Sign the Specify Gate

Once the spec is reviewed, sign the `specify` gate:

```bash
spectra gate sign feat:user-authentication --phase specify --comment "Reviewed in sprint planning"
```

This creates a gate file in `.spectra/gates/` binding your approval to the current spec content hash. If the spec changes later, this gate becomes invalid.

```bash
spectra gate list
```

```
Spec                        Phase     Status    Signer     Date
feat:user-authentication    specify   approved  @you       2026-03-22
```

## Step 7: Design Implementation Specs

```bash
spectra design feat:user-authentication --concerns "transport.rest,persistence.relational"
```

This creates scaffold files:

```
.spectra/impl/user-authentication/
  transport-rest.impl.yaml
  persistence-relational.impl.yaml
```

Edit each impl spec to describe how the concern is implemented. For example, `transport-rest.impl.yaml` might define the REST endpoint, request/response schemas, and middleware.

## Step 8: Sign the Design Gate

```bash
spectra gate sign feat:user-authentication --phase design
```

Check what phases are ready:

```bash
spectra gate check feat:user-authentication --phase implement
```

```
Not ready for phase: implement
Missing gates: test-design
```

## Step 9: Check Project Status

```bash
spectra status
```

Shows a project overview: total specs by status, gate counts.

```bash
spectra status feat:user-authentication
```

Shows detailed status for one spec: title, version, gates, AC coverage.

## Step 10: Detect Drift

Simulate spec drift by editing an acceptance criterion after the gate was signed:

```bash
spectra gate verify feat:user-authentication --phase specify
```

If the spec changed:

```
Gate INVALID for feat:user-authentication phase specify
Reason: Spec hash mismatch — spec was modified after signing
```

Run the full drift report:

```bash
spectra diff
```

```
Drift Report
Score: 0.33 (significant)
Items: 2

feat:user-authentication [DRIFTED]
  [constitutional] Active spec has no signed gates for current content
  [semantic]       AC-003 is not covered by any test case
```

Save for CI integration:

```bash
spectra diff --json --save
```

## Next Steps

- [CLI Reference](cli-reference.md) -- Every command and option
- [Spec Reference](spec-reference.md) -- Full YAML schemas for all spec types
- [Core Concepts](core-concepts.md) -- Deep dives into gates, traceability, and drift
- [Template Guide](template-guide.md) -- AI-assisted code generation
