---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-authentication-persistence-relational"
  semver: "1.0.0"
  status: draft
  created: "2026-03-28T00:00:00Z"
  updated: "2026-03-28T00:00:00Z"
  authors:
    - "@you"
  reviewers: []
  feature_ref: "feat:user-authentication@1.0.0"
  concern: persistence.relational
---

# persistence.relational

## Schema

### `users` table

```sql
CREATE TABLE users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,
  created_at   TIMESTAMP   DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
```

`email` carries a unique constraint to enforce one account per address. `password_hash` stores the bcrypt digest (cost factor 12+, per the non-functional security requirement).

### `sessions` table

```sql
CREATE TABLE sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP   DEFAULT now(),
  expires_at TIMESTAMP   NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
```

`expires_at` is set to `created_at + INTERVAL '24 hours'` at insert time, mirroring the JWT expiry.

## Data Access Functions

### `findUserByEmail(email: string): Promise<User | null>`

Performs a `SELECT id, email, password_hash FROM users WHERE email = $1` parameterised query. Returns `null` when no row is found — the caller treats this identically to a wrong-password result (AC-003).

### `createSession(userId: string): Promise<Session>`

Inserts a new row into `sessions` with `expires_at = NOW() + INTERVAL '24 hours'`. Returns `{ id, user_id, created_at, expires_at }`.

## Types

```typescript
interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

interface Session {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}
```
