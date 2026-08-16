import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}

// TEMPORARY DEMO STUB — NOT REAL AUTH.
// There is no login/signup flow yet, so every request is treated as the
// same demo user (seeded in backend/schema.sql). This lets the games run
// end-to-end for a demo/launch build without a real auth system.
//
// TODO before this app takes real users/money: replace this with real
// token verification (JWT/session/whatever the client's auth provider is)
// that sets req.userId from a *verified* identity — never trust a
// client-supplied user id directly.
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? '00000000-0000-0000-0000-000000000001';

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  req.userId = DEMO_USER_ID;
  next();
}
