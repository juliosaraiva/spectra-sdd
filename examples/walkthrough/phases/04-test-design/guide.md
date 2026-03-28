# Phase 04: Test Design

This phase produces a test spec that maps test cases 1:1 to acceptance criteria. The test spec is not a test runner configuration — it is a structured declaration of what will be tested, which will later drive drift detection and coverage reporting. By the end you will have a signed `test-design` gate.

---

## Prerequisites

- Phase 03 complete (`design` gate approved for `feat:user-authentication`)

---

## Step 1 — Check the prerequisite gate

```bash
spectra gate check feat:user-authentication --phase test-design
```

Expected output:

```
✔ feat:user-authentication — test-design phase prerequisites met
  specify:  approved ✔
  design:   approved ✔
```

---

## Step 2 — Create the test spec

> **Note:** `spectra generate tests` is a planned command that requires an AI adapter configured in `config.yaml`. For this walkthrough the adapter is `none`, so the command is not available. Create the test spec file manually by copying the golden file:

```bash
cp examples/walkthrough/phases/04-test-design/golden/.spectra/tests/user-authentication.test.yaml \
   .spectra/tests/user-authentication.test.yaml
```

If you prefer to write it from scratch, create `.spectra/tests/user-authentication.test.yaml` with the content shown in Step 3 below.

---

## Step 3 — Test spec content

The golden file contains the following. Each test case has an `ac_ref` field binding it to exactly one acceptance criterion:

```yaml
spectra:
  version: "1.0"
  type: test
  id: "test:user-authentication"
  semver: "1.0.0"
  status: active
  created: "2026-03-28T11:00:00Z"
  updated: "2026-03-28T11:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"

test_cases:
  - id: TC-001
    ac_ref: AC-001
    title: Successful login returns JWT with correct shape and expiry
    given: a user with email "alice@example.com" and password "correct-horse" exists in the database
    when: POST /auth/sessions with body '{"email":"alice@example.com","password":"correct-horse"}'
    then:
      - response status is 201
      - response body contains "token" (a non-empty string)
      - response body contains "expires_at" (ISO 8601 timestamp ~24h from now)
      - response body contains "user_id" (a valid UUID)
      - a session row exists in the sessions table with matching user_id
      - an identity.user.authenticated event was emitted
    fixtures:
      - db/alice-user.sql

  - id: TC-002
    ac_ref: AC-002
    title: Wrong password returns 401 with generic message
    given: a user with email "alice@example.com" exists in the database
    when: POST /auth/sessions with body '{"email":"alice@example.com","password":"wrong-password"}'
    then:
      - response status is 401
      - response body is '{"error":"Invalid credentials"}'
      - response body does NOT contain the word "password"
      - response body does NOT contain the word "email"
      - a failed-attempt record is created for alice@example.com
    fixtures:
      - db/alice-user.sql

  - id: TC-003
    ac_ref: AC-003
    title: Unknown email returns 401 with same message as wrong password
    given: no user with email "ghost@example.com" exists in the database
    when: POST /auth/sessions with body '{"email":"ghost@example.com","password":"any-password"}'
    then:
      - response status is 401
      - response body is '{"error":"Invalid credentials"}' (identical to TC-002 response)
      - response time is within 50ms of the TC-002 response time (constant-time requirement)
    fixtures: []

  - id: TC-004
    ac_ref: AC-004
    title: Rate limiting blocks after 5 failures
    given: 5 failed login attempts from IP 127.0.0.1 have occurred within the last 10 minutes
    when: a sixth POST /auth/sessions attempt is made from IP 127.0.0.1
    then:
      - response status is 429
      - response includes header "Retry-After" with value "600"
      - response body contains an error message
    fixtures:
      - db/alice-user.sql
      - rate-limit/5-failures.json
```

---

## Step 4 — Validate all specs

> **Note:** `spectra validate test:user-authentication` is not currently supported — the ID lookup only resolves feature specs via `_index.yaml`. Use `--all` to validate all spec types including test specs.

```bash
spectra validate --all
```

Expected output:

```
PASS .spectra/constitution.yaml
PASS .spectra/features/user-authentication.spec.md
PASS .spectra/impl/user-authentication/auth-middleware.impl.md
PASS .spectra/impl/user-authentication/persistence-relational.impl.md
PASS .spectra/impl/user-authentication/transport-rest.impl.md

All 5 specs are valid.
```

> **Limitation:** The `--all` validation currently does not scan the `.spectra/tests/` directory. Test spec schema validation is handled internally when test specs are loaded by other commands. This is a known gap.
- Every test case has at least one `then` item

---

## Step 5 — Sign the test-design gate

```bash
spectra gate sign feat:user-authentication \
  --phase test-design \
  --signer "@you" \
  --comment "4 test cases mapped 1:1 to 4 ACs, all non-negotiable ACs covered"
```

Expected output:

```
✔ Gate signed: .spectra/gates/feat_user-authentication@1.0.0--test-design.gate.yaml
✔ trace.json updated
```

---

## 1:1 TC-to-AC mapping convention

SPECTRA enforces a strict convention: each test case maps to **exactly one** AC via `ac_ref`. This is intentional:

- It makes coverage analysis unambiguous — `spectra trace coverage` can show which ACs have test cases and which do not.
- It prevents "mega test cases" that verify multiple behaviors under a single ID.
- It does not prevent you from having **multiple** test cases per AC (e.g., a happy-path TC and an edge-case TC, both with `ac_ref: AC-001`).

---

## What test specs are not

Test specs describe **what** should be tested and **how** the test is structured in human-readable terms. They are not:

- Jest/Vitest configuration
- Supertest calls
- Fixture data

The connection between a test spec and actual running test code is established in Phase 05 via trace comments. A test file with `// @spectra feat:user-authentication@1.0.0 impl:test.integration gen:...` will be linked to this spec in the traceability matrix.

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 5 |
| **Commands run** | `spectra gate check`, file copy, `spectra validate`, `spectra gate sign` |
| **Files created** | `user-authentication.test.yaml`, `feat_user-authentication@1.0.0--test-design.gate.yaml` |
| **Concepts required** | `test:` ID format, `TC-NNN` / `ac_ref` mapping, test spec YAML schema, `feature_ref` binding |
| **New conventions** | 1:1 TC-to-AC mapping convention |

---

## Next

Proceed to **[Phase 05: Implement](../05-implement/guide.md)** to write the source files and link them to the spec via trace comments.
