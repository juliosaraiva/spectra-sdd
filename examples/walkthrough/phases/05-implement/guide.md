# Phase 05: Implement

This phase writes the source code and links each file to its authorizing spec via trace comments. SPECTRA's drift detector reads these comments to verify that the code structure still matches the spec. By the end you will have 3 source files, an updated traceability matrix, and a signed `implement` gate.

> **Note:** This is the highest-friction phase in a manual workflow. When using the Claude Code integration (`ai.adapter: claude-code` in `config.yaml`), the trace comment is written automatically and `trace.json` is updated by a post-write hook. Without the adapter, the trace.json update is a manual step — see Step 4.

---

## Prerequisites

- Phase 04 complete (`test-design` gate approved for `feat:user-authentication`)
- Node.js ≥ 20, npm available in the project directory

---

## Step 1 — Check the prerequisite gate

```bash
spectra gate check feat:user-authentication --phase implement
```

Expected output:

```
✔ feat:user-authentication — implement phase prerequisites met
  specify:     approved ✔
  design:      approved ✔
  test-design: approved ✔
```

---

## Step 2 — Install dependencies

```bash
npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken
```

---

## Step 3 — Create the source files

Create the three source files below. **Line 1 of every file must be the trace comment** — the drift detector will not recognize the file otherwise.

### `src/routes/auth.ts`

```typescript
// @spectra feat:user-authentication@1.0.0 impl:transport.rest gen:walk01
import { Router, type Request, type Response } from "express";
import { findUserByEmail, createSession } from "../db/auth.js";
import { verifyPassword, signToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/auth/sessions", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  // Look up user — same code path for unknown email and wrong password (AC-003)
  const user = await findUserByEmail(email);
  const hashToCheck = user?.password_hash ?? "$2b$12$invalidhashtopreventtimingattacks";
  const valid = await verifyPassword(password, hashToCheck);

  if (!user || !valid) {
    // AC-002, AC-003: generic message, no email existence leak
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // AC-001: issue JWT and persist session
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await createSession(user.id, expiresAt);
  const token = signToken(user.id, expiresAt);

  res.status(201).json({
    token,
    expires_at: expiresAt.toISOString(),
    user_id: session.user_id,
  });
});
```

### `src/db/auth.ts`

```typescript
// @spectra feat:user-authentication@1.0.0 impl:persistence.relational gen:walk02
import type { Pool } from "pg";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

// Injected at startup — never import directly to keep this module testable
let pool: Pool;
export function setPool(p: Pool): void {
  pool = p;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>(
    "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function createSession(userId: string, expiresAt: Date): Promise<Session> {
  const result = await pool.query<Session>(
    "INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING *",
    [userId, expiresAt]
  );
  return result.rows[0];
}
```

### `src/middleware/auth.ts`

```typescript
// @spectra feat:user-authentication@1.0.0 impl:auth.middleware gen:walk03
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"]; // SEC-001: read from env, never hardcode

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare is constant-time — prevents timing attacks (AC-002, AC-003)
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string, expiresAt: Date): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    (req as Request & { user?: string }).user = payload["sub"];
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
```

---

## Step 4 — Update the traceability matrix

> **Note:** `spectra trace update` rebuilds the `_index.yaml` but does **not** automatically populate `authorized_artifacts`. The CLI can scan for trace comments in source files, but the `authorized_artifacts` array in `trace.json` must be written explicitly — this is by design, because SPECTRA requires a deliberate authorization step rather than silent auto-discovery.

Run the index rebuild first:

```bash
spectra trace update
```

Then open `.spectra/trace.json` and add the following under `specs["feat:user-authentication"].authorized_artifacts`. If the entry does not exist yet, add the full structure:

```json
{
  "version": "1.0",
  "updated_at": "2026-03-28T12:00:00Z",
  "specs": {
    "feat:user-authentication": {
      "hash": "<the sha256 hash from user-authentication.spec.md>",
      "status": "active",
      "authorized_artifacts": [
        {
          "path": "src/routes/auth.ts",
          "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "concern": "transport.rest",
          "impl_ref": "impl:user-authentication.transport-rest",
          "generation_id": "walk01",
          "type": "source"
        },
        {
          "path": "src/db/auth.ts",
          "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "concern": "persistence.relational",
          "impl_ref": "impl:user-authentication.persistence-relational",
          "generation_id": "walk02",
          "type": "source"
        },
        {
          "path": "src/middleware/auth.ts",
          "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "concern": "auth.middleware",
          "impl_ref": "impl:user-authentication.auth-middleware",
          "generation_id": "walk03",
          "type": "source"
        }
      ],
      "ac_coverage": {
        "AC-001": { "covered": true, "test_ids": ["TC-001"] },
        "AC-002": { "covered": true, "test_ids": ["TC-002"] },
        "AC-003": { "covered": true, "test_ids": ["TC-003"] },
        "AC-004": { "covered": true, "test_ids": ["TC-004"] }
      },
      "gates": {
        "specify": "approved",
        "design": "approved",
        "test-design": "approved",
        "implement": "pending",
        "reconcile": "pending"
      }
    }
  }
}
```

Replace the `hash` values with actual SHA-256 hashes computed over the file contents, or leave the placeholder zeros — SPECTRA will recalculate them on the next `spectra diff` run.

> **When using Claude Code integration:** The post-write hook calls `spectra trace update --authorize` automatically, which computes real hashes and appends the artifact entry. The manual edit above is only needed in the no-adapter workflow.

---

## Step 5 — Run drift detection

```bash
spectra diff
```

Expected output when trace is correctly populated:

```
feat:user-authentication@1.0.0
  transport.rest         → src/routes/auth.ts         drift: 0.00 ✔
  persistence.relational → src/db/auth.ts             drift: 0.00 ✔
  auth.middleware        → src/middleware/auth.ts      drift: 0.00 ✔

Overall drift score: 0.00
```

A non-zero drift score means the structural content of the source file diverges from what the impl spec describes. Common causes: missing exported functions, renamed endpoints, or removed route handlers. Fix the code (or update the spec and re-sign the gate) until the score reaches 0.00.

---

## Step 6 — Verify traceability

Forward trace — given a spec, show what files implement it:

```bash
spectra trace forward feat:user-authentication
```

```
feat:user-authentication@1.0.0
  impl:transport.rest        → src/routes/auth.ts
  impl:persistence.relational → src/db/auth.ts
  impl:auth.middleware        → src/middleware/auth.ts
```

Reverse trace — given a file, show which spec authorized it:

```bash
spectra trace why src/routes/auth.ts
```

```
src/routes/auth.ts
  authorized by: feat:user-authentication@1.0.0
  concern:       transport.rest
  impl_ref:      impl:user-authentication.transport-rest
  generation_id: walk01
```

---

## Step 7 — Sign the implement gate

```bash
spectra gate sign feat:user-authentication \
  --phase implement \
  --signer "@you" \
  --comment "3 source files with trace comments, drift score 0.00"
```

Expected output:

```
✔ Gate signed: .spectra/gates/feat_user-authentication@1.0.0--implement.gate.yaml
✔ trace.json updated
```

---

## Trace comment format

The drift detector depends entirely on line-1 trace comments. The format is:

```
// @spectra <feat-id>@<semver> impl:<concern> gen:<generation-id>
```

| Token | Example | Meaning |
|-------|---------|---------|
| `<feat-id>` | `feat:user-authentication` | The feature spec ID |
| `<semver>` | `1.0.0` | The spec version this file was generated from |
| `impl:<concern>` | `impl:transport.rest` | The concern namespace |
| `gen:<id>` | `gen:walk01` | A short generation run ID (any unique string) |

If the trace comment is missing or malformed, `spectra diff` reports the file as untracked and assigns a drift score of `1.00`.

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 8 |
| **Commands run** | `spectra gate check`, `npm install`, file creation, `spectra trace update`, trace.json edit, `spectra diff`, `spectra trace forward`, `spectra trace why`, `spectra gate sign` |
| **Files created** | `src/routes/auth.ts`, `src/db/auth.ts`, `src/middleware/auth.ts`, `feat_user-authentication@1.0.0--implement.gate.yaml` |
| **Concepts required** | `@spectra` trace comment format, `authorized_artifacts` in trace.json, drift score interpretation, bidirectional traceability |
| **New conventions** | Line-1 trace comment `// @spectra <id>@<ver> impl:<concern> gen:<id>` |

---

## Next

Proceed to **[Phase 06: Reconcile](../06-reconcile/guide.md)** to close the loop and confirm full traceability.
