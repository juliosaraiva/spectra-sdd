---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication-auth-middleware"
  semver: "1.0.0"
  status: draft
  created: "2026-03-28T00:00:00Z"
  updated: "2026-03-28T00:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: auth.middleware
---

# auth.middleware

## Password Verification

`verifyPassword(password: string, hash: string): Promise<boolean>`

Delegates to `bcrypt.compare(password, hash)` from the `bcryptjs` library. The comparison is constant-time by library design — timing is indistinguishable whether the hash matches or not. This satisfies the AC-003 requirement that an unknown-email response must not be measurably faster than a wrong-password response (both paths call `verifyPassword` against a sentinel hash when the user is not found).

## Token Signing

`signToken(userId: string): string`

Uses `jsonwebtoken` with algorithm `HS256`. The signing secret is read from `process.env.JWT_SECRET` at call time (never hardcoded — satisfies SEC-001). Token payload:

```json
{
  "sub": "<userId>",
  "iat": <issued-at-unix>,
  "exp": <issued-at + 86400>
}
```

Expiry is 86400 seconds (24 hours), matching the non-functional security requirement and the `expires_at` value stored in the `sessions` table.

## Token Verification Middleware

`verifyToken(req, res, next): void`

An Express middleware for protecting routes that require authentication.

1. Reads the `Authorization` header.
2. Expects the format `Bearer <token>`.
3. Calls `jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })`.
4. On success: attaches `{ userId: payload.sub }` to `req.user` and calls `next()`.
5. On failure (missing header, malformed token, expired): responds `401 Unauthorized`.

## Sentinel Hash (AC-003 timing parity)

A static bcrypt hash of a dummy password is exported as `SENTINEL_HASH`. When `findUserByEmail` returns `null`, the route handler calls `verifyPassword(submittedPassword, SENTINEL_HASH)` before returning 401. This ensures the response time for an unknown email is indistinguishable from a wrong password, preventing user enumeration via timing side-channels.
