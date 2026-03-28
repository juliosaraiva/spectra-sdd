// @spectra feat:user-authentication@1.0.0 impl:auth.middleware gen:walk03
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// Pre-computed sentinel hash — used when the user is not found (AC-003 timing parity)
export const SENTINEL_HASH = "$2b$12$sentinelhashforwalkthroughonlyx";

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ sub: userId }, secret, { algorithm: "HS256", expiresIn: "24h" });
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET ?? "";
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    (req as Request & { user: { userId: string } }).user = { userId: String(payload["sub"]) };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
