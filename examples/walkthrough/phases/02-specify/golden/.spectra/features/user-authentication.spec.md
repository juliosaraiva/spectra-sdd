---
spectra:
  version: "1.0"
  type: feature
  id: feat:user-authentication
  semver: 1.0.0
  status: active
  created: 2026-03-28T00:00:00Z
  updated: 2026-03-28T00:00:00Z
  authors:
    - "@you"
  reviewers: []
  constitution_ref: const:v1.0
identity:
  title: User Authentication
  domain:
    - identity
    - security
  tags:
    - jwt
    - session
    - login
  summary: Users authenticate via email and password to receive a signed JWT session token
interfaces:
  inputs:
    - name: credentials
      schema:
        email: string
        password: string
      constraints:
        - email must be valid RFC 5322 format
        - password must be 8-128 characters
  outputs:
    - name: session
      schema:
        token: string
        expires_at: string
        user_id: string
  events_emitted:
    - name: identity.user.authenticated
  events_consumed: []
non_functional:
  performance:
    - p99 authentication latency under 200ms at 500 concurrent users
  security:
    - passwords stored as bcrypt hash with cost factor 12 or higher
    - tokens signed with HS256 and expire after 24 hours
  observability:
    - each authentication attempt logged with result, latency, and client IP
  scalability: []
dependencies:
  feature_refs: []
  schema_refs: []
hash:
  content_hash: sha256:cd906950d6a479b348a3a4a6211cd0af69c994089cf3c3fcbb2ad5dd5431c8d2
  signed_at: 2026-03-28T15:26:12.433Z
  signed_by: "@juliosaraiva"
---


# User Authentication

Users authenticate via email and password to receive a signed JWT session token

## AC-001: Successful login

> non_negotiable: true

**Given** a registered user with email alice@example.com and a valid bcrypt-hashed password
**When** the user submits correct email and password to POST /auth/sessions
**Then:**
- HTTP 201 returned
- signed JWT in response body
- expires_at is 24 hours from now
- session record persisted to database
- identity.user.authenticated event emitted

## AC-002: Invalid password rejected

> non_negotiable: true | constitution_constraints: [SEC-002]

**Given** a registered user exists with email alice@example.com
**When** the user submits correct email but wrong password to POST /auth/sessions
**Then:**
- HTTP 401 returned
- response body is {"error": "Invalid credentials"}
- response does not reveal whether the email exists
- failed attempt is recorded

## AC-003: Unknown email rejected

> non_negotiable: true | constitution_constraints: [SEC-002]

**Given** no user with the given email exists in the database
**When** any caller submits a non-existent email with any password to POST /auth/sessions
**Then:**
- HTTP 401 returned with same "Invalid credentials" message
- response time is not measurably different from AC-002

## AC-004: Rate limiting

> non_negotiable: false | constitution_constraints: [SEC-002]

**Given** 5 consecutive failed attempts recorded from the same IP within 10 minutes
**When** a sixth attempt is made from that IP
**Then:**
- HTTP 429 returned
- Retry-After header is 600
- no authentication logic is executed
