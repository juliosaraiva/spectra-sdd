# Phase 03: Design

This phase decomposes the feature spec into implementation specs — one per concern. Each impl spec answers "how will this be built?" for a specific layer of the system. By the end you will have 3 signed impl specs and an approved `design` gate.

---

## Prerequisites

- Phase 02 complete (`specify` gate approved for `feat:user-authentication`)

---

## Step 1 — Check the prerequisite gate

```bash
spectra gate check feat:user-authentication --phase design
```

Expected output:

```
✔ feat:user-authentication — design phase prerequisites met
  specify: approved ✔
```

If this fails, return to Phase 02 and ensure the `specify` gate is signed.

---

## Step 2 — Generate impl scaffolds

```bash
spectra design feat:user-authentication \
  --concerns "transport.rest,persistence.relational,auth.middleware"
```

Expected output:

```
✔ Created .spectra/impl/user-authentication/transport-rest.impl.md
✔ Created .spectra/impl/user-authentication/persistence-relational.impl.md
✔ Created .spectra/impl/user-authentication/auth-middleware.impl.md
```

> **Note:** Concern namespaces use dotted notation (`transport.rest`) in spec IDs but become dashes in filenames (`transport-rest.impl.md`). This is a SPECTRA convention — the colon in `impl:` IDs is also replaced with `_` in gate filenames.

---

## Step 3 — Edit the impl specs

Replace the scaffolded contents of each file with the following. The frontmatter `feature_ref` must match the feature spec's `id@semver` exactly.

### `transport-rest.impl.md`

```markdown
---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication.transport-rest"
  semver: "1.0.0"
  status: active
  created: "2026-03-28T10:00:00Z"
  updated: "2026-03-28T10:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: transport.rest
---

# Transport: REST Endpoint

## Endpoint

`POST /auth/sessions`

Content-Type: `application/json`

## Request Schema

```json
{
  "email": "string (RFC 5322)",
  "password": "string (8–128 chars)"
}
```

## Response Schemas

| Status | Condition | Body |
|--------|-----------|------|
| `201 Created` | Valid credentials | `{ token, expires_at, user_id }` |
| `401 Unauthorized` | Invalid credentials (wrong password or unknown email) | `{ error: "Invalid credentials" }` |
| `429 Too Many Requests` | Rate limit exceeded | `{ error: "Too many attempts" }` + `Retry-After: 600` header |

## Middleware Stack

1. `express-rate-limit` — 5 failures per IP per 10 minutes (AC-004)
2. `request-logger` — log method, path, status, latency, masked email

## AC Coverage

- AC-001: POST /auth/sessions → 201 + session body
- AC-002: wrong password → 401 generic message
- AC-003: unknown email → 401 same message
- AC-004: 6th attempt from same IP → 429 + Retry-After
```

### `persistence-relational.impl.md`

```markdown
---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication.persistence-relational"
  semver: "1.0.0"
  status: active
  created: "2026-03-28T10:00:00Z"
  updated: "2026-03-28T10:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: persistence.relational
---

# Persistence: Relational Schema

## Tables

### `users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PRIMARY KEY, default `gen_random_uuid()` |
| `email` | `TEXT` | UNIQUE NOT NULL |
| `password_hash` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMP` | NOT NULL, default `now()` |

### `sessions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PRIMARY KEY, default `gen_random_uuid()` |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `created_at` | `TIMESTAMP` | NOT NULL, default `now()` |
| `expires_at` | `TIMESTAMP` | NOT NULL |

## Query Functions

- `findUserByEmail(email: string): Promise<User | null>` — used in AC-001, AC-002, AC-003
- `createSession(userId: string, expiresAt: Date): Promise<Session>` — used in AC-001

## AC Coverage

- AC-001: `createSession` persists the session record
- AC-002 / AC-003: `findUserByEmail` returns null for unknown email (allows constant-time path)
```

### `auth-middleware.impl.md`

```markdown
---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication.auth-middleware"
  semver: "1.0.0"
  status: active
  created: "2026-03-28T10:00:00Z"
  updated: "2026-03-28T10:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: auth.middleware
---

# Auth Middleware

## Password Verification

Use `bcrypt.compare(plaintext, hash)` for constant-time comparison. This ensures
AC-002 and AC-003 have identical response timing regardless of whether the email
exists — preventing timing-based email enumeration.

bcrypt cost factor: **≥ 12** (non_functional.security requirement).

## Token Signing

Library: `jsonwebtoken`
Algorithm: `HS256`
Secret: `process.env.JWT_SECRET` — never hardcoded (SEC-001)
TTL: 24 hours (`expiresIn: "24h"`)

Payload:
```json
{
  "sub": "<user_id>",
  "iat": <issued-at>,
  "exp": <expires-at>
}
```

## Token Verification Middleware

`verifyToken(req, res, next)` — extracts Bearer token from `Authorization` header,
verifies signature and expiry, attaches `req.user` for downstream handlers.

## AC Coverage

- AC-001: `signToken` produces the JWT returned in the 201 response
- AC-002 / AC-003: `verifyPassword` + constant-time bcrypt prevents enumeration
```

---

## Step 4 — Validate with cross-references

```bash
spectra validate --all --cross-refs
```

Expected output:

```
✔ feat:user-authentication@1.0.0 — valid
✔ impl:user-authentication.transport-rest@1.0.0 — valid
    feature_ref: feat:user-authentication@1.0.0 ✔
✔ impl:user-authentication.persistence-relational@1.0.0 — valid
    feature_ref: feat:user-authentication@1.0.0 ✔
✔ impl:user-authentication.auth-middleware@1.0.0 — valid
    feature_ref: feat:user-authentication@1.0.0 ✔

Cross-reference check: all feature_refs resolve ✔
```

The `--cross-refs` flag checks that every `feature_ref` in an impl spec points to a feature spec that actually exists in the index. This catches typos in IDs before they reach the gate.

---

## Step 5 — Sign the design gate

```bash
spectra gate sign feat:user-authentication \
  --phase design \
  --signer "@you" \
  --comment "3 concerns designed: transport.rest, persistence.relational, auth.middleware"
```

Expected output:

```
✔ Gate signed: .spectra/gates/feat_user-authentication@1.0.0--design.gate.yaml
✔ trace.json updated
```

---

## Concern namespace conventions

| Concern | What it covers |
|---------|---------------|
| `transport.rest` | HTTP routes, request/response schemas, middleware |
| `transport.grpc` | Protobuf services and RPC methods |
| `persistence.relational` | SQL tables, indexes, query functions |
| `persistence.document` | NoSQL collections and document shapes |
| `auth.middleware` | Authentication, authorization, token handling |
| `event.publisher` | Domain event publishing |
| `event.consumer` | Event subscription and handler logic |

Keep concern names narrow. If a concern is doing more than one thing, split it.

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 6 |
| **Commands run** | `spectra gate check`, `spectra design`, `spectra validate --all --cross-refs`, `spectra gate sign` |
| **Files created/edited** | `transport-rest.impl.md`, `persistence-relational.impl.md`, `auth-middleware.impl.md`, `feat_user-authentication@1.0.0--design.gate.yaml` |
| **Concepts required** | Concern namespaces (`transport.rest`), impl spec `feature_ref` binding, cross-reference validation |
| **New conventions** | `impl:` ID format `impl:<feature>.<concern>`; concern-to-code-layer mapping |

---

## Next

Proceed to **[Phase 04: Test Design](../04-test-design/guide.md)** to map test cases to acceptance criteria.
