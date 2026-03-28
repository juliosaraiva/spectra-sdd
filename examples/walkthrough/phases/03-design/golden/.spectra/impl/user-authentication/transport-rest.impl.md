---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication-transport-rest"
  semver: "1.0.0"
  status: draft
  created: "2026-03-28T00:00:00Z"
  updated: "2026-03-28T00:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: transport.rest
---

# transport.rest

## Endpoint

`POST /auth/sessions`

Handles user authentication via email and password. Returns a signed JWT session token on success.

## Request

**Content-Type:** `application/json`

```json
{
  "email": "alice@example.com",
  "password": "s3cr3tP@ssword"
}
```

Both fields are required. The handler returns `400 Bad Request` if either is missing.

## Responses

### 201 Created — Successful authentication

```json
{
  "token": "<signed-jwt>",
  "expires_at": "2026-03-29T00:00:00Z",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 401 Unauthorized — Invalid credentials (wrong password or unknown email)

```json
{
  "error": "Invalid credentials"
}
```

The same response body and comparable response time is returned for both wrong password (AC-002) and unknown email (AC-003) to prevent user enumeration.

### 429 Too Many Requests — Rate limit exceeded (AC-004)

```json
{
  "error": "Too many requests"
}
```

The `Retry-After` header is set to `600` (seconds). Authentication logic is short-circuited before any database call.

## Rate Limiting Middleware (AC-004)

Uses `express-rate-limit` applied to the `POST /auth/sessions` route only:

```
windowMs:  600000   // 10 minutes
max:       5        // maximum 5 failed attempts per IP
skipSuccessfulRequests: true
standardHeaders: true
legacyHeaders: false
handler: respond with 429 and Retry-After: 600
```

The limiter is keyed by `req.ip` and counts only failed attempts via `skipSuccessfulRequests: true`.

## Middleware Stack (ordered)

1. `rateLimiter` — express-rate-limit (AC-004)
2. Input validation — check email and password present and non-empty
3. `findUserByEmail` — look up user record
4. `verifyPassword` — bcrypt comparison (constant-time; satisfies AC-003 timing parity)
5. `signToken` — create HS256 JWT (24h expiry)
6. `createSession` — persist session record
7. Emit `identity.user.authenticated` event
8. Respond 201
