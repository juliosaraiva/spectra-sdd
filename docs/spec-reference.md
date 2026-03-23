# Spec Reference

Complete YAML schema documentation for every SPECTRA spec type. All schemas are defined as Zod validators in `src/core/spec-types.ts`.

## Shared Primitives

| Type | Format | Example |
|------|--------|---------|
| `SpecId` | `/^(feat\|impl\|test\|migration):[a-z0-9-]+$/` | `feat:user-authentication` |
| `ContentHash` | `/^sha256:[a-f0-9]{64}$/` | `sha256:a1b2c3...` |
| `SemVer` | `/^\d+\.\d+\.\d+$/` | `2.1.0` |
| `Iso8601` | ISO 8601 datetime | `2026-03-22T10:00:00Z` |
| `ConcernNamespace` | `/^[a-z]+(\.[a-z]+)*$/` | `transport.rest` |

## Spec Status Values

`draft` | `review` | `active` | `deprecated` | `archived`

## Common `spectra` Header

Shared by feature, impl, test, and migration specs:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | string | no | `"1.0"` | Schema version |
| `type` | enum | yes | -- | `constitution`, `feature`, `impl`, `test`, or `migration` |
| `id` | string | yes | -- | Spec identifier (should follow SpecId pattern) |
| `semver` | SemVer | yes | -- | Spec version |
| `status` | SpecStatus | yes | -- | Lifecycle status |
| `created` | string | no | -- | ISO 8601 creation timestamp |
| `updated` | string | no | -- | ISO 8601 last-updated timestamp |
| `authors` | string[] | yes | -- | At least 1 author |
| `reviewers` | string[] | no | `[]` | Reviewer list |
| `constitution_ref` | string | no | -- | Reference to constitution (e.g., `const:v1.0`) |

---

## Tier 0: Constitution

**File:** `.spectra/constitution.yaml`

### `spectra` block (constitution-specific)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | no | Default `"1.0"` |
| `type` | literal | yes | Must be `"constitution"` |
| `semver` | SemVer | yes | Constitution version |
| `updated` | Iso8601 | yes | Last updated timestamp |
| `stewards` | string[] | yes | Min 1. Maintainers of the constitution |

### `vocabulary`

`string[]` -- min 1 element. Valid domain terms for spec `identity.domain` tags.

### `constraints`

Array of constraint objects, min 1:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Pattern: `/^[A-Z]+-\d{3}$/` (e.g., `SEC-001`) |
| `title` | string | yes | Short title |
| `description` | string | yes | Full description |
| `domain` | string[] | yes | Min 1. Which vocabulary terms this applies to |
| `enforcement` | enum | yes | `MUST`, `SHOULD`, or `MAY` |
| `rationale` | string | no | Explanation of why this constraint exists |

### Example

```yaml
spectra:
  type: constitution
  semver: "1.0.0"
  updated: "2026-03-22T10:00:00Z"
  stewards: ["@lead-architect"]

vocabulary:
  - identity
  - security
  - transport
  - persistence
  - api

constraints:
  - id: "SEC-001"
    title: "No hardcoded secrets"
    description: "No secrets, tokens, or credentials shall be stored in source code"
    enforcement: MUST
    domain: [security]
```

---

## Tier 1: Feature Spec

**File:** `.spectra/features/<name>.spec.yaml`

### `identity` block

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | yes | -- | Feature title |
| `domain` | string[] | yes | -- | Min 1. Must match constitution vocabulary (SPEC-008) |
| `tags` | string[] | no | `[]` | Descriptive tags |
| `summary` | string | yes | -- | One-line summary |

### `interfaces` block (optional)

**`inputs`:** Array of input interfaces

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Input name |
| `schema` | object | yes | Min 1 key. Must not contain `"any"` or `"unknown"` (SPEC-003) |
| `constraints` | string[] | no | Human-readable input constraints |

**`outputs`:** Array of output interfaces (same structure as inputs, without `constraints`)

**`events_emitted` / `events_consumed`:** Array of event objects

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Event name (e.g., `identity.user.authenticated`) |
| `schema_ref` | string | no | External schema reference |

### `acceptance_criteria`

Array, min 1 element:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | -- | Pattern: `/^AC-\d{3}$/` |
| `title` | string | yes | -- | Criterion title |
| `given` | string | yes | -- | Initial context. No vague words (SPEC-002) |
| `when` | string | yes | -- | Triggering action. No vague words (SPEC-002) |
| `then` | string[] | yes | -- | Min 1. Expected outcomes. No vague words (SPEC-002) |
| `non_negotiable` | boolean | no | `false` | At least one AC must be true (SPEC-007) |
| `constitution_constraints` | string[] | no | -- | Constraint IDs (e.g., `["SEC-002"]`) |

### `non_functional` block (optional)

| Field | Type | Description |
|-------|------|-------------|
| `performance` | string/string[] | Must contain a numeric threshold (SPEC-004) |
| `security` | string/string[] | Security requirements |
| `observability` | string/string[] | Logging/monitoring requirements |
| `scalability` | string/string[] | Scalability requirements |

### `dependencies` block (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `feature_refs` | string[] | `[]` | IDs of dependent feature specs |
| `schema_refs` | string[] | `[]` | External schema identifiers |

### `hash` block (optional)

Added by `spectra spec rehash`. If present, the linter (SPEC-006) verifies it matches the current computed hash.

| Field | Type | Description |
|-------|------|-------------|
| `content_hash` | ContentHash | SHA-256 of canonical spec content |
| `signed_at` | string | When the hash was computed |
| `signed_by` | string | Who computed it |

---

## Tier 2: Implementation Spec

**File:** `.spectra/impl/<feature-name>/<concern>.impl.yaml`

### Additional `spectra` fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | literal | yes | Must be `"impl"` |
| `feature_ref` | string | yes | Format: `<feat-id>@<semver>` (cross-ref validated by `--cross-refs`) |
| `concern` | ConcernNamespace | yes | Dot-separated namespace (e.g., `transport.rest`) |

### `design` block

`Record<string, unknown>` -- Free-form YAML. No schema enforcement on design content (intentional flexibility for different tech stacks).

**Conventions:** Describe endpoints, request/response schemas, middleware, data models, etc.

### Example

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
    body:
      email: { type: "string", format: "email" }
      password: { type: "string", minLength: 8, maxLength: 128 }
  response_schema:
    success: { status: 201 }
    errors:
      - { status: 401, code: "INVALID_CREDENTIALS" }
      - { status: 429, code: "RATE_LIMITED" }
  middleware: ["rate-limiter", "request-logger"]
```

---

## Tier 3: Test Spec

**File:** `.spectra/tests/<name>.test.yaml`

### Additional `spectra` fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | literal | yes | Must be `"test"` |
| `feature_ref` | string | yes | Format: `<feat-id>@<semver>` |

### `test_cases`

Array, min 1:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | -- | Pattern: `/^TC-\d{3}$/` (maps 1:1: AC-001 -> TC-001) |
| `ac_ref` | string | yes | -- | Pattern: `/^AC-\d{3}$/` (which AC this validates) |
| `title` | string | yes | -- | Test case title |
| `given` | string | yes | -- | Derived from AC.given |
| `when` | string | yes | -- | Derived from AC.when |
| `then` | string[] | yes | -- | Min 1. Derived from AC.then |
| `fixtures` | string[] | no | `[]` | Test data references |

---

## Tier 4: Migration Spec

**File:** `.spectra/migrations/<name>.migration.yaml`

### Additional `spectra` fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | literal | yes | Must be `"migration"` |
| `feature_ref` | string | no | Related feature spec |

### Migration-specific fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `current_state.description` | string | yes | -- | Description of current state |
| `current_state.files` | string[] | yes | -- | Affected file paths |
| `current_state.behavior` | string | yes | -- | Current behavior |
| `desired_state.description` | string | yes | -- | Target state |
| `desired_state.feature_ref` | string | no | -- | Feature driving the change |
| `strategy` | enum | yes | -- | `additive`, `breaking`, or `deprecation` |
| `rollback` | string | no | -- | Rollback plan |
| `validation_checkpoints` | string[] | no | `[]` | Steps to validate the migration |

---

## Gate Spec

**File:** `.spectra/gates/<safeId>@<semver>--<phase>.gate.yaml`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gate.spec_id` | string | yes | Spec ID |
| `gate.spec_semver` | SemVer | yes | Spec version at signing |
| `gate.spec_hash` | ContentHash | yes | Content hash at signing |
| `gate.phase` | Phase | yes | `specify`, `design`, `test-design`, `implement`, or `reconcile` |
| `gate.status` | GateStatus | yes | `pending`, `approved`, `rejected`, or `expired` |
| `approval.approved_by` | string | if approved | Signer identity |
| `approval.approved_at` | Iso8601 | if approved | Signing timestamp |
| `approval.method` | enum | if approved | `cli`, `github-pr`, `linear-issue`, or `api` |
| `approval.comment` | string | no | Approval comment |
| `artifacts_reviewed` | array | yes | `[{ path, hash }]` reviewed artifacts |
| `expiry.expires_if_spec_changes` | boolean | no | Default `true` |
| `expiry.manual_expiry` | string | no | Default `null` |
