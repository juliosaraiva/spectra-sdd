# Linter Rules

SPECTRA's linter checks feature spec quality beyond schema validity. Run with `spectra lint`.

## Rules Overview

| Rule | Severity | Description |
|------|----------|-------------|
| SPEC-001 | error | AC fields must be non-empty |
| SPEC-002 | warning | No vague language in ACs |
| SPEC-003 | error | No `any` or `unknown` types in interface schemas |
| SPEC-004 | warning | Performance NFRs must have numeric thresholds |
| SPEC-006 | error | Content hash must match computed hash |
| SPEC-007 | warning | At least one AC must be `non_negotiable: true` |
| SPEC-008 | warning | Domain tags must exist in constitution vocabulary |

**Note:** SPEC-005 is reserved (cross-reference checking is handled by `spectra validate --cross-refs`).

---

## SPEC-001: AC Fields Must Be Non-Empty

**Severity:** error

Every acceptance criterion must have non-empty `given`, `when`, and `then` fields, with `then` containing at least one element.

**Failing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Login"
    given: ""
    when: "User logs in"
    then: []
```

**Passing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Login"
    given: "A registered user with valid credentials"
    when: "The user submits correct email and password"
    then:
      - "System returns a valid session token"
```

---

## SPEC-002: No Vague Language

**Severity:** warning

Acceptance criteria must not use vague words or weak modals. These make specs untestable.

**Vague words (22):**
`fast`, `quick`, `slow`, `appropriate`, `reasonable`, `adequate`, `sufficient`, `significant`, `considerable`, `proper`, `suitable`, `good`, `bad`, `nice`, `optimal`, `efficient`, `performant`, `scalable`, `robust`, `secure`, `reliable`, `maintainable`, `user-friendly`

**Weak modals (6):**
`should`, `may`, `might`, `could`, `would`, `can`

**Failing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Response time"
    given: "A user request"
    when: "The system processes the request"
    then:
      - "Response should be fast"
```

**Passing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Response time"
    given: "A user request under normal load"
    when: "The system processes the request"
    then:
      - "Response returns within 200ms at p99"
```

---

## SPEC-003: No `any` or `unknown` Types

**Severity:** error

Interface input and output schemas must not contain the strings `"any"` or `"unknown"`. These defeat the purpose of typed interfaces.

**Failing:**

```yaml
interfaces:
  inputs:
    - name: payload
      schema: "any"
```

**Passing:**

```yaml
interfaces:
  inputs:
    - name: payload
      schema: "{ email: string, password: string }"
```

---

## SPEC-004: Measurable Performance NFRs

**Severity:** warning

Performance requirements in the `non_functional` block must contain at least one numeric value, making them measurable and testable.

**Failing:**

```yaml
non_functional:
  performance: "The system must be fast under load"
```

**Passing:**

```yaml
non_functional:
  performance: "p99 < 200ms under 1000 concurrent requests"
```

---

## SPEC-006: Content Hash Must Match

**Severity:** error

If a spec has a `hash.content_hash` field, it must match the current computed hash. A mismatch means the spec was modified after the hash was recorded.

**Fix:** Run `spectra spec rehash <id>` to recompute the hash.

---

## SPEC-007: At Least One Non-Negotiable AC

**Severity:** warning

At least one acceptance criterion must have `non_negotiable: true`. This ensures the spec has clearly identified its most critical requirements.

**Failing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Login"
    given: "Valid credentials"
    when: "User submits login"
    then: ["Session token returned"]
    non_negotiable: false
```

**Passing:**

```yaml
acceptance_criteria:
  - id: AC-001
    title: "Login"
    given: "Valid credentials"
    when: "User submits login"
    then: ["Session token returned"]
    non_negotiable: true
```

---

## SPEC-008: Domain Tags Must Match Vocabulary

**Severity:** warning

Domain tags in `identity.domain` must exist in the constitution's `vocabulary` list. Unknown tags indicate a mismatch between the spec and the project's domain model.

**Fix:** Either add the term to the constitution's vocabulary or use an existing term.

**Failing** (if vocabulary is `[identity, security, api]`):

```yaml
identity:
  domain: [identity, networking]
```

**Passing:**

```yaml
identity:
  domain: [identity, security]
```
