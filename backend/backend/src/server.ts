import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';
import { requireAuth, signToken, type AuthRequest } from './auth.js';
import { slotSpin, diceRoll, plinkoDrop, wheelSpin, minesStart, minesReveal, minesCashout, coinFlipFlip, crashStart, crashCashout, crashStatus, limboBet, kenoDraw, hiloStart, hiloGuess, hiloCashout, sicBoPlaceBets, roulettePlaceBets, blackjackStart, blackjackHit, blackjackStand, blackjackDoubleDown, baccaratPlaceBets, teenPattiPlay, diceTablePlay, gameShowPlay } from './games.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

// Required for correct client IPs (and thus correct rate limiting) when
// running behind a load balancer / reverse proxy under heavy load.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: frontendOrigin, credentials: false }));
app.use(express.json({ limit: '100kb' }));

// General API limiter: protects the server/DB from being overwhelmed.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Tighter limiter on auth endpoints to slow down brute-force / signup spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
app.use('/api/auth/signin', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const username = String(req.body?.username ?? '').trim();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-24 letters, numbers or underscores' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM users WHERE email=$1 OR lower((SELECT username FROM profiles WHERE profiles.id=users.id))=lower($2) LIMIT 1', [email, username]);
    if (exists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await client.query<{id:string}>('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id', [email, passwordHash]);
    const userId = user.rows[0].id;
    const profile = await client.query('INSERT INTO profiles(id,username,balance) VALUES($1,$2,1000.00) RETURNING id,username,balance,created_at', [userId, username]);
    await client.query('INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,1000.00,1000.00,$2)', [userId, 'signup_bonus']);
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(userId), user: { id: userId, email }, profile: profile.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return res.status(409).json({ error: 'Email or username already exists' });
    console.error(error);
    res.status(500).json({ error: 'Unable to create account' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const result = await query<{id:string;email:string;password_hash:string}>('SELECT id,email,password_hash FROM users WHERE email=$1', [email]);
  if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const profile = await query('SELECT id,username,balance,created_at FROM profiles WHERE id=$1', [result.rows[0].id]);
  res.json({ token: signToken(result.rows[0].id), user: { id: result.rows[0].id, email: result.rows[0].email }, profile: profile.rows[0] ?? null });
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  const result = await query<{id:string;email:string;username:string;balance:string;created_at:string}>(
    'SELECT u.id,u.email,p.username,p.balance,p.created_at FROM users u JOIN profiles p ON p.id=u.id WHERE u.id=$1',
    [req.userId]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'User not found' });
  const row = result.rows[0];
  res.json({ user: { id: row.id, email: row.email }, profile: { id: row.id, username: row.username, balance: Number(row.balance), created_at: row.created_at } });
});

app.post('/api/auth/signout', (_req, res) => res.json({ ok: true }));

app.get('/api/history', requireAuth, async (req: AuthRequest, res) => {
  const result = await query('SELECT id,user_id,game,bet,payout,multiplier,details,created_at FROM game_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
  res.json({ history: result.rows.map((r: any) => ({ ...r, bet: Number(r.bet), payout: Number(r.payout), multiplier: Number(r.multiplier) })) });
});

async function changeBalance(userId: string, delta: number, reason: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result;
    if (delta < 0) {
      result = await client.query<{balance:string}>('UPDATE profiles SET balance=balance+$1 WHERE id=$2 AND balance >= $3 RETURNING balance', [delta, userId, Math.abs(delta)]);
    } else {
      result = await client.query<{balance:string}>('UPDATE profiles SET balance=balance+$1 WHERE id=$2 RETURNING balance', [delta, userId]);
    }
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const balance = Number(result.rows[0].balance);
    await client.query('INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)', [userId, delta, balance, reason]);
    await client.query('COMMIT');
    return balance;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Server-authoritative game endpoints (Slot, Dice, Plinko, Wheel, Mines).
// Outcome + payout are computed here, inside games.ts — never trusted from
// the client. This replaces the old pattern of the frontend computing its
// own result and then calling /api/wallet/change to self-report a payout.
// ---------------------------------------------------------------------------
const gameLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/games', gameLimiter);

app.post('/api/games/slot/spin', requireAuth, slotSpin);
app.post('/api/games/dice/roll', requireAuth, diceRoll);
app.post('/api/games/plinko/drop', requireAuth, plinkoDrop);
app.post('/api/games/wheel/spin', requireAuth, wheelSpin);
app.post('/api/games/mines/start', requireAuth, minesStart);
app.post('/api/games/mines/reveal', requireAuth, minesReveal);
app.post('/api/games/mines/cashout', requireAuth, minesCashout);
app.post('/api/games/coinflip/flip', requireAuth, coinFlipFlip);
app.post('/api/games/crash/start', requireAuth, crashStart);
app.post('/api/games/crash/cashout', requireAuth, crashCashout);
app.get('/api/games/crash/status', requireAuth, crashStatus);
app.post('/api/games/limbo/bet', requireAuth, limboBet);
app.post('/api/games/keno/draw', requireAuth, kenoDraw);
app.post('/api/games/hilo/start', requireAuth, hiloStart);
app.post('/api/games/hilo/guess', requireAuth, hiloGuess);
app.post('/api/games/hilo/cashout', requireAuth, hiloCashout);
app.post('/api/games/sicbo/bet', requireAuth, sicBoPlaceBets);
app.post('/api/games/roulette/bet', requireAuth, roulettePlaceBets);
app.post('/api/games/blackjack/start', requireAuth, blackjackStart);
app.post('/api/games/blackjack/hit', requireAuth, blackjackHit);
app.post('/api/games/blackjack/stand', requireAuth, blackjackStand);
app.post('/api/games/blackjack/double', requireAuth, blackjackDoubleDown);
app.post('/api/games/baccarat/bet', requireAuth, baccaratPlaceBets);
app.post('/api/games/teenpatti/play', requireAuth, teenPattiPlay);
app.post('/api/games/dicetable/play', requireAuth, diceTablePlay);
app.post('/api/games/gameshow/play', requireAuth, gameShowPlay);

app.post('/api/wallet/change', requireAuth, async (req: AuthRequest, res) => {
  const delta = Number(req.body?.delta);
  const reason = String(req.body?.reason ?? 'game');
  // As of the live-table migration, every catalog game (slots through
  // Roulette/Blackjack/Baccarat/Teen Patti/Dice-table/Game Show) settles
  // through its own server-authoritative endpoint above. This endpoint
  // should no longer be reachable from any current frontend game screen —
  // it's kept only as a safety net / for any manual admin balance
  // adjustments, and stays capped and rate-limited in case something still
  // calls it. If nothing in the frontend calls this anymore, consider
  // removing it entirely rather than leaving an unused privileged route.
  const MAX_CLAIMED_PAYOUT = 5_000;
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'Invalid balance change' });
  if (delta > MAX_CLAIMED_PAYOUT) return res.status(400).json({ error: 'Balance change exceeds allowed limit' });
  if (delta < -1_000_000) return res.status(400).json({ error: 'Invalid balance change' });
  const balance = await changeBalance(req.userId!, Math.round(delta * 100) / 100, reason.slice(0, 80));
  if (balance === null) return res.status(400).json({ error: 'Insufficient balance' });
  res.json({ balance });
});

app.post('/api/history', requireAuth, async (req: AuthRequest, res) => {
  const game = String(req.body?.game ?? '').trim().slice(0, 120);
  const bet = Number(req.body?.bet);
  const payout = Number(req.body?.payout ?? 0);
  const multiplier = Number(req.body?.multiplier ?? 0);
  const details = req.body?.details && typeof req.body.details === 'object' ? req.body.details : {};
  if (!game || !Number.isFinite(bet) || bet < 0 || !Number.isFinite(payout) || payout < 0 || !Number.isFinite(multiplier)) {
    return res.status(400).json({ error: 'Invalid history entry' });
  }
  const result = await query('INSERT INTO game_history(user_id,game,bet,payout,multiplier,details) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,user_id,game,bet,payout,multiplier,details,created_at', [req.userId, game, bet, payout, multiplier, JSON.stringify(details)]);
  const row: any = result.rows[0];
  res.status(201).json({ history: { ...row, bet: Number(row.bet), payout: Number(row.payout), multiplier: Number(row.multiplier) } });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => console.log(`PlayVault local backend running at http://localhost:${port}`));

// Graceful shutdown: let in-flight requests finish and close DB connections
// cleanly instead of dropping them, important for rolling deploys under load.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
