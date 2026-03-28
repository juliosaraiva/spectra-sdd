# Phase 02: Specify

This phase captures the feature's requirements as a machine-readable spec. By the end you will have a signed `specify` gate that locks the spec hash and allows Phase 03 (Design) to begin.

---

## Prerequisites

- Phase 01 complete (`.spectra/` initialized)
- `feat:user-authentication` does not yet exist

---

## Step 1 — Create the spec scaffold

```bash
spectra spec new user-authentication
```

Expected output:

```
✔ Created .spectra/features/user-authentication.spec.md
✔ Updated .spectra/features/_index.yaml
```

This creates a skeleton `.spec.md` with placeholder frontmatter and a stub AC section. Open it and replace its contents entirely with the spec below.

---

## Step 2 — Edit the spec

Open `.spectra/features/user-authentication.spec.md` and replace all contents with:

```markdown
---
spectra:
  version: "1.0"
  type: feature
  id: "feat:user-authentication"
  semver: "1.0.0"
  status: active
  created: "2026-03-28T09:00:00Z"
  updated: "2026-03-28T09:00:00Z"
  authors:
    - "@you"
  reviewers: []
  constitution_ref: "const:v1.0"

identity:
  title: User Authentication
  domain:
    - identity
    - security
  tags:
    - auth
    - session
    - jwt
  summary: >
    Users authenticate with email and password and receive a short-lived JWT
    session token. The system enforces constant-time rejection to prevent
    email enumeration and applies rate limiting after repeated failures.

interfaces:
  inputs:
    - name: credentials
      schema:
        email: string
        password: string
      constraints:
        - "email must be a valid RFC 5322 address"
        - "password between 8 and 128 characters"
  outputs:
    - name: session
      schema:
        token: string
        expires_at: iso8601
        user_id: uuid
  events_emitted:
    - name: "identity.user.authenticated"
      schema_ref: "schema:identity.events.v1"
  events_consumed: []

non_functional:
  performance:
    - "p99 authentication latency < 200ms under 1000 concurrent users"
  security:
    - "passwords hashed with bcrypt, cost factor >= 12"
    - "tokens signed with HS256 using secret from environment variable"
  observability:
    - "authentication attempts logged with outcome, latency, and masked email"

hash:
  content_hash: sha256:0000000000000000000000000000000000000000000000000000000000000000
  signed_at: "2026-03-28T09:00:00Z"
  signed_by: "@you"
---

# User Authentication

Users authenticate with email and password and receive a short-lived JWT
session token. The system enforces constant-time rejection to prevent
email enumeration and applies rate limiting after repeated failures.

## AC-001: Successful login

> non_negotiable: true

**Given** a registered user with valid credentials
**When** the user submits their email and password to `POST /auth/sessions`
**Then:**
- HTTP 201 is returned with a JSON body containing `token`, `expires_at`, and `user_id`
- The token is a valid HS256 JWT expiring 24 hours from issuance
- A session record is persisted in the database
- An `identity.user.authenticated` event is emitted

## AC-002: Invalid password rejected

> non_negotiable: true | constitution_constraints: [SEC-002]

**Given** a registered user with a known email address
**When** the user submits the correct email with an incorrect password
**Then:**
- HTTP 401 is returned
- The response body contains a generic error message that does not reveal whether the email exists
- The failed attempt is recorded for rate-limit tracking

## AC-003: Unknown email rejected

> non_negotiable: true | constitution_constraints: [SEC-002]

**Given** no user exists with the submitted email address
**When** the user submits any password for that email
**Then:**
- HTTP 401 is returned with the same generic error message as AC-002
- The response time is indistinguishable from a real user's failed login (constant-time response)

## AC-004: Rate limiting after repeated failures

> non_negotiable: false | constitution_constraints: [SEC-002]

**Given** 5 failed login attempts from the same IP address within 10 minutes
**When** a sixth attempt is made from that IP
**Then:**
- HTTP 429 is returned
- The response includes a `Retry-After: 600` header
```

> **Note:** The `hash.content_hash` placeholder is intentional — you will compute the real hash in Step 5 using `spectra spec rehash`. Never hand-write a hash.

---

## Step 3 — Validate the spec

```bash
spectra validate feat:user-authentication
```

Expected output:

```
PASS .spectra/features/user-authentication.spec.md
```

If validation fails, check that:
- The `---` frontmatter delimiters are present and on their own lines
- Each AC heading matches exactly `## AC-NNN: Title`
- Each metadata blockquote uses `> non_negotiable: true|false`
- `**Given**`, `**When**`, and `**Then:**` are on separate lines with no trailing spaces

---

## Step 4 — Lint the spec

```bash
spectra lint feat:user-authentication
```

Expected output:

```
✔ feat:user-authentication — no lint issues
```

The linter checks things the schema cannot: at least one `non_negotiable: true` AC, no duplicate AC IDs, `constitution_constraints` referencing IDs that exist in the constitution, and domain tags matching the constitution vocabulary.

---

## Step 5 — Rehash the spec

```bash
spectra spec rehash feat:user-authentication
```

Expected output:

```
✔ feat:user-authentication — hash updated
  sha256:a3f9... written to .spectra/features/user-authentication.spec.md
```

This computes a canonical SHA-256 over the spec object (excluding the `hash` field itself) and writes the result back into the `hash.content_hash` frontmatter field.

**Why this matters:** When you sign a gate, SPECTRA records the spec's content hash inside the gate file. If you later edit the spec, all previously signed gates for that spec are automatically invalidated — the workflow forces you to re-sign after any change. The hash is the audit trail.

Run `spectra spec rehash` after every edit to the spec file.

---

## Step 6 — Sign the specify gate

```bash
spectra gate sign feat:user-authentication \
  --phase specify \
  --signer "@you" \
  --comment "User auth spec reviewed and approved — 4 ACs covering login, rejection, and rate limiting"
```

Expected output:

```
✔ Gate signed: .spectra/gates/feat_user-authentication@1.0.0--specify.gate.yaml
✔ trace.json updated
```

The gate file records who signed, when, the method (`cli`), your comment, and the spec's content hash at the time of signing.

---

## Step 7 — Verify

```bash
spectra gate list
```

```
feat:user-authentication@1.0.0
  specify    ✔ approved  @you  2026-03-28T09:10:00Z
  design     ○ pending
  test-design ○ pending
  implement  ○ pending
  reconcile  ○ pending
```

```bash
spectra status feat:user-authentication
```

```
feat:user-authentication@1.0.0 — active
  specify    ✔ approved
  design     ○ pending   ← next phase
  ACs: 4 (3 non-negotiable)
  Hash: sha256:a3f9...  (valid)
```

---

## Spec format reference

The `.spec.md` format combines YAML frontmatter with Markdown body. The parser in `src/core/frontmatter.ts` enforces these exact regex patterns:

| Element | Required format |
|---------|----------------|
| AC heading | `## AC-NNN: Title` |
| AC metadata | `> non_negotiable: true\|false` (optionally `\| constitution_constraints: [ID]`) |
| Given | `**Given** <text>` |
| When | `**When** <text>` |
| Then block | `**Then:**` followed by `- item` list items |

Deviating from these patterns will cause `spectra validate` to report zero ACs parsed.

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 7 |
| **Commands run** | `spectra spec new`, `spectra validate`, `spectra lint`, `spectra spec rehash`, `spectra gate sign`, `spectra gate list`, `spectra status` |
| **Files created/edited** | `user-authentication.spec.md`, `_index.yaml`, `feat_user-authentication@1.0.0--specify.gate.yaml` |
| **Concepts required** | YAML frontmatter, Given/When/Then AC format, `feat:` ID prefix, `AC-NNN` numbering, `non_negotiable` flag, content hashing, gate signing |
| **New conventions** | Rehash after every edit; gate signing records spec hash |

---

## Next

Proceed to **[Phase 03: Design](../03-design/guide.md)** to produce implementation specs for each concern.
