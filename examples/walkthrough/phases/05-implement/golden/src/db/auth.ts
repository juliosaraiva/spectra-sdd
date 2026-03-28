// @spectra feat:user-authentication@1.0.0 impl:persistence.relational gen:walk02

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

// In-memory store for walkthrough purposes
const users = new Map<string, User>([
  [
    "alice@example.com",
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "alice@example.com",
      // bcrypt hash of "correct-password" with cost 12
      password_hash: "$2b$12$examplehashforwalkthroughonly",
      created_at: new Date("2026-01-01T00:00:00Z"),
    },
  ],
]);

export async function findUserByEmail(email: string): Promise<User | null> {
  return users.get(email) ?? null;
}

export async function createSession(userId: string): Promise<Session> {
  const now = new Date();
  const expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: now,
    expires_at,
  };
}
