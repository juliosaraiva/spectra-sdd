// @spectra feat:user-authentication@1.0.0 impl:transport.rest gen:walk01
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { findUserByEmail, createSession } from "../db/auth.js";
import { verifyPassword, signToken, SENTINEL_HASH } from "../middleware/auth.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 600_000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.set("Retry-After", "600").status(429).json({ error: "Too many requests" });
  },
});

router.post("/auth/sessions", limiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = await findUserByEmail(email);
  const hash = user?.password_hash ?? SENTINEL_HASH;
  const valid = await verifyPassword(password, hash);

  if (!user || !valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken(user.id);
  const session = await createSession(user.id);

  res.status(201).json({
    token,
    expires_at: session.expires_at.toISOString(),
    user_id: user.id,
  });
});

export default router;
