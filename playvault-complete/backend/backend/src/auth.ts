import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const secret: string = process.env.JWT_SECRET ?? '';
const WEAK_SECRETS = new Set(['change-this-to-a-long-random-secret', 'secret', 'changeme']);
if (!secret) throw new Error('JWT_SECRET is required');
if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long');
if (WEAK_SECRETS.has(secret)) throw new Error('JWT_SECRET is still set to the example placeholder — generate a real random secret');

export type AuthRequest = Request & { userId?: string };

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') throw new Error('Invalid token');
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
