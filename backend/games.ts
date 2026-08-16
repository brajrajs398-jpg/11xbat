import type { Response } from 'express';
import { pool } from './db.js';
import type { AuthRequest } from './auth.js';

// ---------------------------------------------------------------------------
// Every game engine's outcome, RNG, and payout math lives here, server-side.
// The client only ever sends a bet amount (and, for Mines, which tile it
// wants to reveal). It never sends — and the server never trusts — a
// pre-computed result or payout. This mirrors the math in the frontend game
// components exactly, so gameplay/odds are unchanged, but a player can no
// longer forge a win by calling the API directly.
// ---------------------------------------------------------------------------

const SLOT_VALUES = [100, 50, 25, 15, 10, 5, 3]; // fixed across every symbol pack (7 symbols/pack)

function computeSlotPayout(bet: number) {
  const reels = Array.from({ length: 5 }, () => Math.floor(Math.random() * SLOT_VALUES.length));
  const counts: Record<number, number> = {};
  reels.forEach((r) => (counts[r] = (counts[r] ?? 0) + 1));

  let maxMatch = 1;
  let matchedIdx = 0;
  for (const [idx, count] of Object.entries(counts)) {
    if (count > maxMatch) {
      maxMatch = count;
      matchedIdx = Number(idx);
    }
  }

  const value = SLOT_VALUES[matchedIdx];
  let multiplier = 0;
  if (maxMatch === 5) multiplier = value * 5;
  else if (maxMatch === 4) multiplier = value * 2;
  else if (maxMatch === 3) multiplier = Math.max(2, Math.floor(value * 0.5));
  else if (maxMatch === 2 && value >= 25) multiplier = 1.5;

  const payout = Math.floor(bet * multiplier);
  return { reels, multiplier, payout };
}

function computeDicePayout(bet: number, target: number, isOver: boolean) {
  const winChance = isOver ? 100 - target : target;
  const multiplierPayout = 99 / winChance;
  const result = Math.random() * 100;
  const won = isOver ? result >= target : result < target;
  const payout = won ? bet * multiplierPayout : 0;
  return { result, won, multiplier: won ? multiplierPayout : 0, payout };
}

const PLINKO_MULTIPLIERS = [16, 9, 4, 2, 1.4, 1.1, 1, 0.8, 1, 1.1, 1.4, 2, 4, 9, 16];
const PLINKO_ROWS = 12;
const PLINKO_COLS = 9;

// --- Plinko Variants ---
// Different row counts for different risk profiles
const PLINKO_VARIANTS = {
  low: 8,     // fewer rows = lower risk, lower max multiplier
  medium: 12, // default
  high: 16,   // more rows = higher risk, higher max multiplier
};

type PlinkoVariant = 'low' | 'medium' | 'high';

const PLINKO_MULTIPLIERS_VARIANTS = {
  low: [16, 9, 4, 2, 1.4, 1.1, 1, 0.8, 1, 1.1, 1.4, 2],  // adjusted for 8 rows (12 slots)
  medium: [16, 9, 4, 2, 1.4, 1.1, 1, 0.8, 1, 1.1, 1.4, 2, 4, 9, 16],  // 12 rows original
  high: [32, 18, 10, 5, 2.5, 1.8, 1, 0.5, 1, 1.8, 2.5, 5, 10, 18, 32],  // adjusted for 16 rows (16 slots)
};

function getPlinkoMultipliers(variant: PlinkoVariant): number[] {
  return PLINKO_MULTIPLIERS_VARIANTS[variant] ?? PLINKO_MULTIPLIERS_VARIANTS.medium;
}

function getPlinkoRows(variant: PlinkoVariant): number {
  return PLINKO_VARIANTS[variant] ?? PLINKO_VARIANTS.medium;
}

function computePlinkoPayoutWithVariant(bet: number, variant: PlinkoVariant) {
  const rows = getPlinkoRows(variant);
  const multipliers = getPlinkoMultipliers(variant);
  let currentX = 50;
  for (let row = 0; row < rows; row++) {
    currentX += (Math.random() - 0.5) * (100 / PLINKO_COLS);
    currentX = Math.max(8, Math.min(92, currentX));
  }
  const slot = Math.max(0, Math.min(multipliers.length - 1, Math.round((currentX / 100) * (multipliers.length - 1))));
  const multiplier = multipliers[slot];
  const payout = bet * multiplier;
  return { slot, multiplier, payout, rows };
}

const WHEEL_SEGMENTS = [1.5, 2, 0, 3, 1.5, 0, 5, 2, 0, 1.5, 10, 0];

// --- Wheel Variants ---
// Different segment configurations per wheel group
const WHEEL_VARIANTS = {
  standard: [1.5, 2, 0, 3, 1.5, 0, 5, 2, 0, 1.5, 10, 0],   // 12 segments (original)
  extended: [1.5, 2, 0, 3, 1.5, 0, 5, 2, 0, 1.5, 10, 0, 1.5, 2, 0],  // 14 segments
  reduced: [1.5, 2, 0, 3, 1.5, 0, 5],  // 7 segments, higher volatility
};

type WheelVariant = 'standard' | 'extended' | 'reduced';

function getWheelSegments(variant: WheelVariant): number[] {
  return WHEEL_VARIANTS[variant] ?? WHEEL_VARIANTS.standard;
}

function computeWheelPayoutWithVariant(bet: number, variant: WheelVariant) {
  const segments = getWheelSegments(variant);
  const winningIndex = Math.floor(Math.random() * segments.length);
  const multiplier = segments[winningIndex];
  const payout = bet * multiplier;
  return { winningIndex, multiplier, payout, segmentCount: segments.length };
}

const MINES_GRID_SIZE = 25;

function calculateMinesMultiplier(mineCount: number, gemsRevealed: number): number {
  if (gemsRevealed === 0) return 1;
  let m = 1;
  const safeTiles = MINES_GRID_SIZE - mineCount;
  for (let i = 0; i < gemsRevealed; i++) {
    m *= (MINES_GRID_SIZE - i) / (safeTiles - i);
  }
  return m * 0.99;
}

function computeCoinFlipPayout(bet: number, choice: 'heads' | 'tails') {
  const outcome: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = outcome === choice;
  const multiplier = won ? 1.96 : 0;
  const payout = bet * multiplier;
  return { outcome, won, multiplier, payout };
}

// Crash: multiplier grows as m(t) = e^(GROWTH_RATE * t) until it hits the
// hidden crash_point. Same growth curve and crash-point distribution as the
// original client-side implementation — only *where* the crash point is
// decided and revealed has changed.
// Crash: multiplier grows as m(t) = e^(GROWTH_RATE * t) until it hits the
// hidden crash_point. Same growth curve and crash-point distribution as the
// original client-side implementation — only *where* the crash point is
// decided and revealed has changed.
// --- Crash Variants ---
// Different growth rates for "slow build" vs "fast rocket" games
const CRASH_GROWTH_RATES = {
  slow: 0.04,
  normal: 0.06,  // default
  fast: 0.09,
};

// Crash max multiplier (cap for all variants)
const CRASH_MAX_MULTIPLIER = 100;

// Crash variant config per catalog entry
// Each catalog entry can have a crashGrowthRate variant
type CrashGrowthRate = 'slow' | 'normal' | 'fast';

function getCrashGrowthRate(variant: CrashGrowthRate): number {
  return CRASH_GROWTH_RATES[variant] ?? CRASH_GROWTH_RATES.normal;
}

// Modified: now accepts growthRate parameter
function currentCrashMultiplier(startedAt: Date, growthRate: CrashGrowthRate = 'normal'): number {
  const elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;
  const rate = getCrashGrowthRate(growthRate);
  return Math.pow(Math.E, rate * elapsedSeconds);
}

// Generate crash point using the selected growth rate
function generateCrashPoint(growthRate: CrashGrowthRate = 'normal'): number {
  const r = Math.random();
  if (r < 0.03) return 1.0;
  const houseEdge = 0.99;
  const point = houseEdge / (1 - r);
  return Math.max(1.0, Math.min(point, CRASH_MAX_MULTIPLIER));
}

async function recordHistory(client: import('pg').PoolClient, userId: string, game: string, bet: number, payout: number, multiplier: number, details: Record<string, unknown>) {
  await client.query(
    'INSERT INTO game_history(user_id,game,bet,payout,multiplier,details) VALUES($1,$2,$3,$4,$5,$6)',
    [userId, game, bet, payout, multiplier, JSON.stringify(details)],
  );
}

function validateBet(bet: unknown): bet is number {
  return typeof bet === 'number' && Number.isFinite(bet) && bet > 0 && bet <= 1_000_000;
}

// Deduct bet, run the round, credit any payout, log history — all atomic.
async function settleInstantRound(
  userId: string,
  bet: number,
  gameLabel: string,
  compute: () => { multiplier: number; payout: number; [k: string]: unknown },
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [bet, userId],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    const outcome = compute();
    let balance = Number(debit.rows[0].balance);

    if (outcome.payout > 0) {
      const credit = await client.query<{ balance: string }>(
        'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
        [outcome.payout, userId],
      );
      balance = Number(credit.rows[0].balance);
    }

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [userId, outcome.payout - bet, balance, `${gameLabel}_round`],
    );
    await recordHistory(client, userId, gameLabel, bet, outcome.payout, outcome.multiplier, outcome);

    await client.query('COMMIT');
    return { ...outcome, balance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function slotSpin(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Slot').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const result = await settleInstantRound(req.userId!, bet, game, () => computeSlotPayout(bet));
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function diceRoll(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const target = Number(req.body?.target);
  const isOver = Boolean(req.body?.isOver);
  const game = String(req.body?.game ?? 'Dice').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });
  if (!Number.isFinite(target) || target < 2 || target > 98) return res.status(400).json({ error: 'Invalid target' });

  const result = await settleInstantRound(req.userId!, bet, game, () => {
    const r = computeDicePayout(bet, target, isOver);
    return { multiplier: r.multiplier, payout: r.payout, result: r.result, won: r.won, target, isOver };
  });
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function plinkoDrop(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Plinko').slice(0, 120);
  const variant = req.body?.variant || 'medium';  // support variant selection
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const result = await settleInstantRound(req.userId!, bet, game, () => computePlinkoPayoutWithVariant(bet, variant as PlinkoVariant));
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function wheelSpin(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Wheel').slice(0, 120);
  const variant = req.body?.variant || 'standard';  // support variant selection
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const result = await settleInstantRound(req.userId!, bet, game, () => computeWheelPayoutWithVariant(bet, variant as WheelVariant));
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function coinFlipFlip(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const choice = req.body?.choice;
  const game = String(req.body?.game ?? 'Coin Flip').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });
  if (choice !== 'heads' && choice !== 'tails') return res.status(400).json({ error: 'Invalid choice' });

  const result = await settleInstantRound(req.userId!, bet, game, () => {
    const r = computeCoinFlipPayout(bet, choice);
    return { multiplier: r.multiplier, payout: r.payout, outcome: r.outcome, won: r.won, choice };
  });
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function crashStart(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Crash').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM crash_rounds WHERE user_id=$1 AND status=$2 LIMIT 1', [req.userId, 'active']);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A round is already in progress' });
    }

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [bet, req.userId],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const crashPoint = generateCrashPoint();
    const round = await client.query<{ id: string; started_at: string }>(
      'INSERT INTO crash_rounds(user_id,bet,crash_point,game_name) VALUES($1,$2,$3,$4) RETURNING id, started_at',
      [req.userId, bet, crashPoint, game],
    );

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId, -bet, Number(debit.rows[0].balance), 'crash_bet'],
    );

    await client.query('COMMIT');
    res.status(201).json({ roundId: round.rows[0].id, startedAt: round.rows[0].started_at, balance: Number(debit.rows[0].balance) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to start round' });
  } finally {
    client.release();
  }
}

// Settles a crash round based on server elapsed time vs the hidden crash
// point — never on a client-supplied multiplier. Shared by both the
// cashout action and the passive status poll (which auto-settles a round
// that has crashed even if the player never clicked anything).
async function settleCrashRound(userId: string, roundId: string, wantsCashout: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roundRes = await client.query(
      'SELECT id, bet, crash_point, status, game_name, started_at FROM crash_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [roundId, userId],
    );
    if (!roundRes.rowCount) {
      await client.query('ROLLBACK');
      return { error: 'Round not found' as const };
    }
    const round = roundRes.rows[0];
    if (round.status !== 'active') {
      await client.query('ROLLBACK');
      return { busted: round.status === 'busted', settled: true, crashPoint: Number(round.crash_point) };
    }

    const crashPoint = Number(round.crash_point);
    const liveMultiplier = Math.min(currentCrashMultiplier(new Date(round.started_at)), CRASH_MAX_MULTIPLIER);
    const alreadyCrashed = liveMultiplier >= crashPoint;

    if (alreadyCrashed || !wantsCashout) {
      // Either it crashed before the cashout request arrived, or this is
      // just a status poll confirming it crashed with nobody cashing out.
      if (!alreadyCrashed) {
        await client.query('ROLLBACK');
        return { busted: false, settled: false, multiplier: liveMultiplier };
      }
      await client.query('UPDATE crash_rounds SET status=$1 WHERE id=$2', ['busted', roundId]);
      await recordHistory(client, userId, round.game_name, Number(round.bet), 0, 0, { crashPoint, cashedOut: false });
      await client.query('COMMIT');
      return { busted: true, settled: true, crashPoint };
    }

    // Win: cash out at the multiplier live at the moment the request landed.
    const payout = Number(round.bet) * liveMultiplier;
    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, userId],
    );
    await client.query('UPDATE crash_rounds SET status=$1 WHERE id=$2', ['cashed_out', roundId]);
    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [userId, payout, Number(credit.rows[0].balance), 'crash_cashout'],
    );
    await recordHistory(client, userId, round.game_name, Number(round.bet), payout, liveMultiplier, { crashPoint, cashedOut: true });
    await client.query('COMMIT');
    return { busted: false, settled: true, multiplier: liveMultiplier, payout, balance: Number(credit.rows[0].balance) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function crashCashout(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  if (!roundId) return res.status(400).json({ error: 'Invalid request' });
  try {
    const result = await settleCrashRound(req.userId!, roundId, true);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to cash out' });
  }
}

// Read-mostly poll the frontend calls every ~500ms to sync its animation
// and find out if the round crashed. It only mutates state (settling the
// round as busted) when the elapsed time shows it truly has crashed.
export async function crashStatus(req: AuthRequest, res: Response) {
  const roundId = String(req.query?.roundId ?? req.body?.roundId ?? '');
  if (!roundId) return res.status(400).json({ error: 'Invalid request' });
  try {
    const result = await settleCrashRound(req.userId!, roundId, false);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch round status' });
  }
}

// Limbo: player sets a target multiplier before betting. The server rolls a
// point from the same heavy-tailed distribution Crash uses (so the house
// edge/math stays consistent across the app's RNG games), and the player
// wins bet*target if the roll cleared their target. Unlike Crash, this is
// a single instant round — no live cash-out, so no rounds table needed.
const LIMBO_MAX_TARGET = 1_000_000;

function generateLimboRoll(): number {
  const r = Math.random();
  const houseEdge = 0.99;
  return Math.max(1.0, Math.min(houseEdge / (1 - r), LIMBO_MAX_TARGET));
}

function computeLimboPayout(bet: number, target: number) {
  const roll = generateLimboRoll();
  const won = roll >= target;
  const multiplier = won ? target : 0;
  const payout = bet * multiplier;
  return { roll, won, multiplier, payout };
}

export async function limboBet(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const target = Number(req.body?.target);
  const game = String(req.body?.game ?? 'Limbo').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });
  if (!Number.isFinite(target) || target < 1.01 || target > LIMBO_MAX_TARGET) {
    return res.status(400).json({ error: 'Invalid target' });
  }

  const result = await settleInstantRound(req.userId!, bet, game, () => {
    const r = computeLimboPayout(bet, target);
    return { multiplier: r.multiplier, payout: r.payout, roll: r.roll, won: r.won, target };
  });
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

// Keno: player picks 1-10 unique numbers from a 1-40 grid, server draws 10
// unique numbers, payout depends on how many of the player's picks were
// drawn. Paytable is original/house-designed (not copied from any real
// operator), tuned for a house edge broadly consistent with the app's other
// instant games. Entirely one atomic round — fits settleInstantRound as-is.
const KENO_GRID_SIZE = 40;
const KENO_DRAW_COUNT = 10;
const KENO_MAX_PICKS = 10;

// --- Keno Variants ---
// Different paytables for different risk profiles
const KENO_VARIANTS = {
  low: {
    1: [0, 5],
    2: [0, 0, 5],
    3: [0, 0, 3, 10],
    4: [0, 0, 1, 3, 25],
    5: [0, 0, 0, 2, 8, 50],
    6: [0, 0, 0, 1, 3, 15, 100],
    7: [0, 0, 0, 0.5, 2, 8, 50, 200],
    8: [0, 0, 0, 0, 1, 5, 20, 100, 400, 1000],
    9: [0, 0, 0, 0, 1, 3, 10, 50, 200, 1000, 2500],
    10: [0, 0, 0, 0, 1, 2, 5, 20, 100, 250, 1000, 5000],
  },
  medium: {
    1: [0, 3.5],
    2: [0, 0, 9],
    3: [0, 0, 2, 25],
    4: [0, 0, 1, 5, 60],
    5: [0, 0, 0, 3, 15, 150],
    6: [0, 0, 0, 1, 5, 30, 300],
    7: [0, 0, 0, 0.5, 3, 15, 80, 500],
    8: [0, 0, 0, 0, 2, 10, 40, 200, 1000],
    9: [0, 0, 0, 0, 1, 5, 20, 100, 500, 2500],
    10: [0, 0, 0, 0, 1, 3, 15, 50, 250, 1000, 5000],
  },
  high: {
    1: [0, 5],
    2: [0, 0, 15],
    3: [0, 0, 5, 50],
    4: [0, 0, 2, 10, 100],
    5: [0, 0, 0, 5, 25, 200],
    6: [0, 0, 0, 2, 10, 60, 400],
    7: [0, 0, 0, 0, 3, 15, 100, 600],
    8: [0, 0, 0, 0, 2, 15, 60, 300, 1500],
    9: [0, 0, 0, 0, 1, 8, 40, 200, 1000, 2000],
    10: [0, 0, 0, 0, 1, 5, 30, 150, 500, 2000, 10000],
  },
};

type KenoVariant = 'low' | 'medium' | 'high';

function getKenoPaytable(variant: KenoVariant, picksCount: number): number[] {
  // picksCount is guaranteed 1-10 by validation above
  // Use type assertion to satisfy TypeScript's indexed access type
  const idx = picksCount as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  const variantTable = KENO_VARIANTS[variant];
  return variantTable
    ? idx >= 1 && idx <= 10
      ? (variantTable as Record<number, number[]>)[idx]
      : KENO_VARIANTS.medium[idx]
    : KENO_VARIANTS.medium[idx];
}

function computeKenoPayoutWithVariant(bet: number, picks: number[], variant: KenoVariant) {
  const drawn = drawKenoNumbers();
  const drawnSet = new Set(drawn);
  const hits = picks.filter((p) => drawnSet.has(p)).length;
  const table = getKenoPaytable(variant, picks.length);
  const multiplier = table[hits] ?? 0;
  const payout = bet * multiplier;
  return { drawn, hits, multiplier, payout, variant };
}

function drawKenoNumbers(): number[] {
  const pool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, KENO_DRAW_COUNT).sort((a, b) => a - b);
}

export async function kenoDraw(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const picksRaw = req.body?.picks;
  const game = String(req.body?.game ?? 'Keno').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  if (!Array.isArray(picksRaw) || picksRaw.length < 1 || picksRaw.length > KENO_MAX_PICKS) {
    return res.status(400).json({ error: 'Pick between 1 and 10 numbers' });
  }
  const picks = picksRaw.map(Number);
  const uniquePicks = new Set(picks);
  if (uniquePicks.size !== picks.length || picks.some((p) => !Number.isInteger(p) || p < 1 || p > KENO_GRID_SIZE)) {
    return res.status(400).json({ error: 'Picks must be unique numbers between 1 and 40' });
  }

  const variant = req.body?.variant || 'medium';
  const result = await settleInstantRound(req.userId!, bet, game, () => {
    const r = computeKenoPayoutWithVariant(bet, picks, variant as KenoVariant);
    return { multiplier: r.multiplier, payout: r.payout, drawn: r.drawn, hits: r.hits, picks, variant: r.variant };
  });
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function minesStart(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const mineCount = Number(req.body?.mineCount);
  const game = String(req.body?.game ?? 'Mines').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) {
    return res.status(400).json({ error: 'Invalid mine count' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [bet, req.userId],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const minePositions = new Set<number>();
    while (minePositions.size < mineCount) {
      minePositions.add(Math.floor(Math.random() * MINES_GRID_SIZE));
    }

    const round = await client.query<{ id: string }>(
      'INSERT INTO mines_rounds(user_id,bet,mine_count,mine_positions,game_name) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [req.userId, bet, mineCount, Array.from(minePositions), game],
    );

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId, -bet, Number(debit.rows[0].balance), 'mines_bet'],
    );

    await client.query('COMMIT');
    res.status(201).json({ roundId: round.rows[0].id, balance: Number(debit.rows[0].balance) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to start round' });
  } finally {
    client.release();
  }
}

export async function minesReveal(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  const tileIndex = Number(req.body?.tileIndex);
  if (!roundId || !Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= MINES_GRID_SIZE) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roundRes = await client.query(
      `SELECT id, bet, mine_count, mine_positions, revealed, status, game_name
       FROM mines_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [roundId, req.userId],
    );
    if (!roundRes.rowCount || roundRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }
    const round = roundRes.rows[0];
    const revealed: number[] = round.revealed;
    const minePositions: number[] = round.mine_positions;

    if (revealed.includes(tileIndex)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tile already revealed' });
    }

    if (minePositions.includes(tileIndex)) {
      await client.query('UPDATE mines_rounds SET status=$1 WHERE id=$2', ['busted', roundId]);
      await recordHistory(client, req.userId!, round.game_name, Number(round.bet), 0, 0, {
        mines: round.mine_count,
        revealed: revealed.length,
        exploded: true,
      });
      await client.query('COMMIT');
      return res.json({ busted: true, minePositions });
    }

    const newRevealed = [...revealed, tileIndex];
    const multiplier = calculateMinesMultiplier(round.mine_count, newRevealed.length);
    await client.query('UPDATE mines_rounds SET revealed=$1 WHERE id=$2', [newRevealed, roundId]);
    await client.query('COMMIT');
    res.json({ busted: false, multiplier, revealed: newRevealed });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to reveal tile' });
  } finally {
    client.release();
  }
}

export async function minesCashout(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  if (!roundId) return res.status(400).json({ error: 'Invalid request' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roundRes = await client.query(
      `SELECT id, bet, mine_count, revealed, status, game_name
       FROM mines_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [roundId, req.userId],
    );
    if (!roundRes.rowCount || roundRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }
    const round = roundRes.rows[0];
    const revealedCount = (round.revealed as number[]).length;
    if (revealedCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reveal at least one tile before cashing out' });
    }

    const multiplier = calculateMinesMultiplier(round.mine_count, revealedCount);
    const bet = Number(round.bet);
    const payout = bet * multiplier;

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId],
    );
    await client.query('UPDATE mines_rounds SET status=$1 WHERE id=$2', ['cashed_out', roundId]);
    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId, payout, Number(credit.rows[0].balance), 'mines_cashout'],
    );
    await recordHistory(client, req.userId!, round.game_name, bet, payout, multiplier, {
      mines: round.mine_count,
      revealed: revealedCount,
      cashedOut: true,
    });
    await client.query('COMMIT');
    res.json({ payout, multiplier, balance: Number(credit.rows[0].balance) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to cash out' });
  } finally {
    client.release();
  }
}

// ============================================================
// Hi-Lo: Higher/Lower card game
// ============================================================
// State: current revealed card (rank 1-13, Ace=1, King=13),
// running multiplier, status (active/busted/cashed_out)
// Flow:
//   POST /api/games/hilo/start        → deal first card server-side, return it
//   POST /api/games/hilo/guess {guess:'higher'|'lower'} → deal next card, compare
//   POST /api/games/hilo/cashout → credit at current multiplier

const HILO_MAX_CARDS = 13;

function computeHiLoPayout(bet: number, currentCard: number, guess: 'higher'|'lower', cardsRevealed: number[]): { multiplier: number; payout: number; busted: boolean } {
  // If we've already revealed all cards, the game is over
  if (cardsRevealed.length >= HILO_MAX_CARDS) {
    return { multiplier: 0, payout: 0, busted: true };
  }

  // Determine the next card (random from remaining values)
  let nextCard: number;
  // Pick a card different from the last one revealed
  const availableCards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter(c => !cardsRevealed.includes(c));
  if (availableCards.length === 0) {
    return { multiplier: 0, payout: 0, busted: true };
  }
  nextCard = availableCards[Math.floor(Math.random() * availableCards.length)];

  // Determine if guess is correct
  const lastCard = cardsRevealed[cardsRevealed.length - 1];
  let correct = false;

  if (guess === 'higher') {
    correct = nextCard > lastCard;
  } else if (guess === 'lower') {
    correct = nextCard < lastCard;
  }

  if (!correct) {
    return { multiplier: 0, payout: 0, busted: true };
  }

  // Calculate multiplier: each correct guess increases the multiplier
  // Using 13/(13 - cards_revealed_so_far) pattern
  const cardsRemaining = HILO_MAX_CARDS - cardsRevealed.length;
  const multiplier = 13 / cardsRemaining;

  const payout = bet * multiplier;
  return { multiplier, payout, busted: false };
}

export async function hiloStart(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Hi-Lo').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deal first card server-side
    const firstCard = Math.floor(Math.random() * 13) + 1;

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [bet, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const round = await client.query<{ id: string; started_at: string }>(
      `INSERT INTO hilo_rounds(user_id,bet,current_card,status,game_name) VALUES($1,$2,$3,'active',$4) RETURNING id, started_at`,
      [req.userId!, bet, firstCard, game],
    );

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId!, -bet, Number(debit.rows[0].balance), 'hilo_bet'],
    );

    await client.query('COMMIT');

    res.json({ roundId: round.rows[0].id, firstCard, balance: Number(debit.rows[0].balance) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to start round' });
  } finally {
    client.release();
  }
}

export async function hiloGuess(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  const guess = req.body?.guess; // 'higher' or 'lower'

  if (!roundId) return res.status(400).json({ error: 'Invalid request' });
  if (!guess || (guess !== 'higher' && guess !== 'lower')) {
    return res.status(400).json({ error: 'Invalid guess, must be "higher" or "lower"' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query(
      `SELECT id, bet, current_card, status, game_name FROM hilo_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [roundId, req.userId!],
    );
    if (!roundRes.rowCount || roundRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }

    const round = roundRes.rows[0];

    // Build the list of cards revealed so far
    const cardsRevealed: number[] = [round.current_card];

    // Deal next card - pick from remaining cards
    const availableCards = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter(c => !cardsRevealed.includes(c));
    if (availableCards.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No more cards available' });
    }
    const nextCard = availableCards[Math.floor(Math.random() * availableCards.length)];

    // Check guess against last card
    const lastCard = cardsRevealed[cardsRevealed.length - 1];
    const correct = (guess === 'higher') ? nextCard > lastCard : nextCard < lastCard;

    if (!correct) {
      // Player busted - update status
      await client.query('UPDATE hilo_rounds SET status=$1 WHERE id=$2', ['busted', roundId]);
      await recordHistory(client, req.userId!, round.game_name, Number(round.bet), 0, 0, { guess, busted: true });
      await client.query('COMMIT');
      return res.json({ busted: true, multiplier: 0, payout: 0 });
    }

    // Correct guess - update current_card
    const newMultiplier = 13 / (HILO_MAX_CARDS - cardsRevealed.length);
    const payout = Number(round.bet) * newMultiplier;

    // Update the round with new current_card
    await client.query(
      'UPDATE hilo_rounds SET current_card=$1 WHERE id=$2',
      [nextCard, roundId],
    );

    // Record history
    await recordHistory(client, req.userId!, round.game_name, Number(round.bet), payout, newMultiplier, { guess, nextCard });

    await client.query('COMMIT');
    res.json({ busted: false, multiplier: newMultiplier, payout, nextCard });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to process guess' });
  } finally {
    client.release();
  }
}

export async function hiloCashout(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  if (!roundId) return res.status(400).json({ error: 'Invalid request' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query(
      `SELECT id, bet, current_card, status, game_name FROM hilo_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [roundId, req.userId!],
    );
    if (!roundRes.rowCount || roundRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }

    const round = roundRes.rows[0];
    const betAmount = Number(round.bet);

    // Calculate multiplier based on cards revealed so far
    // We have at least 1 card (the first one), so multiplier = 13 / (13 - 1) = 13/12 for first cashout
    const cardsRevealed = 1; // at minimum
    const multiplier = 13 / (HILO_MAX_CARDS - cardsRevealed);
    const payout = betAmount * multiplier;

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId!],
    );

    await client.query('UPDATE hilo_rounds SET status=$1 WHERE id=$2', ['cashed_out', roundId]);
    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId!, payout, Number(credit.rows[0].balance), 'hilo_cashout'],
    );

    await recordHistory(client, req.userId!, round.game_name, betAmount, payout, multiplier, { cashedOut: true });
    await client.query('COMMIT');
    res.json({ payout, multiplier, balance: Number(credit.rows[0].balance) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to cash out' });
  } finally {
    client.release();
  }
}

// ============================================================
// Sic Bo: Three dice game with multiple bet-types per round
// ============================================================
// This is the most complex remaining engine - multi-bet-per-round.
// Player can bet on big/small, specific triple, specific total, etc.
// Each round has one or more sub-bets that sum to the total bet amount.

// Bet type definitions for Sic Bo
type SicBoBetType =
  | 'big'        // Total 4-10 (excluding triples)
  | 'small'      // Total 11-17 (excluding triples)
  | 'total'      // Specific total 4-17
  | 'triple'     // Specific triple (1-1)
  | 'specific-double' // Specific double
  | 'any-triple' // Any triple
  | 'double'     // Any double
  | 'single'     // Specific single number

interface SicBoSubBet {
  type: SicBoBetType;
  value?: number; // for total, triple, double, single
  amount: number; // amount wagered on this sub-bet
}

interface SicBoPlaceBets {
  betAmount: number;
  bets: SicBoSubBet[];
}

// Roll 3 dice server-side
function rollDice(): number[] {
  const results: number[] = [];
  for (let i = 0; i < 3; i++) {
    results.push(Math.floor(Math.random() * 6) + 1);
  }
  return results;
}

// Calculate the total of three dice
function calculateTotal(dice: number[]): number {
  return dice.reduce((sum, val) => sum + val, 0);
}

// Check if all three dice are the same (triple)
function isTriple(dice: number[]): boolean {
  return dice[0] === dice[1] && dice[1] === dice[2];
}

// Get the value of a triple
function getTripleValue(dice: number[]): number | null {
  if (isTriple(dice)) return dice[0];
  return null;
}

// Count occurrences of each die value
function countOccurrences(dice: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  dice.forEach(d => {
    counts[d] = (counts[d] ?? 0) + 1;
  });
  return counts;
}

// Determine payout for a bet
function computeSicBoPayout(bet: SicBoSubBet, dice: number[]): { won: boolean; multiplier: number; payout: number } {
  const { type, value, amount } = bet;
  const total = calculateTotal(dice);
  const counts = countOccurrences(dice);
  const tripleValue = getTripleValue(dice);
  const uniqueValues = new Set(dice).size;

  let won = false;
  let multiplier = 0;

  switch (type) {
    case 'big':
      // Big: total 4-10 (excluding triples)
      won = total >= 4 && total <= 10 && !isTriple(dice);
      multiplier = won ? 1.95 : 0; // ~2.8% house edge
      break;

    case 'small':
      // Small: total 11-17 (excluding triples)
      won = total >= 11 && total <= 17 && !isTriple(dice);
      multiplier = won ? 1.95 : 0; // ~2.8% house edge
      break;

    case 'total':
      // Specific total 4-17
      if (value && total === value) {
        // Payout table for Sic Bo totals
        const totalPayouts: Record<number, number> = {
          4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6,
          11: 6, 12: 6, 13: 6, 14: 6, 15: 6, 16: 30, 17: 60
        };
        multiplier = totalPayouts[value] || 0;
        won = multiplier > 0;
      }
      break;

    case 'triple':
      // Specific triple (e.g., triple 1s, triple 2s, etc.)
      if (value !== undefined && tripleValue === value) {
        multiplier = 180; // 180:1 payout for specific triple
        won = true;
      }
      break;

    case 'specific-double':
      // Specific double (e.g., double 1s, double 2s, etc.)
      // At least 2 dice show the value
      if (value !== undefined && counts[value] && counts[value] >= 2) {
        // 10:1 payout for double
        multiplier = 10;
        won = true;
      }
      break;

    case 'any-triple':
      // Any triple
      if (tripleValue !== null) {
        multiplier = 30; // 30:1 payout for any triple
        won = true;
      }
      break;

    case 'double':
      // Any double (at least 2 dice show the same value, but not a triple)
      if (uniqueValues < 3 && !isTriple(dice)) {
        // This is tricky - any double pays differently
        // For simplicity, if there's a double but not a triple
        const doubleValues = Object.entries(counts).filter(([_, count]) => count === 2);
        if (doubleValues.length > 0) {
          multiplier = 6; // 6:1 payout
          won = true;
        }
      }
      break;

    case 'single':
      // Specific single number (1-6)
      if (value !== undefined) {
        const count = counts[value] || 0;
        if (count === 1) multiplier = 1; // Return bet
        else if (count === 2) multiplier = 3; // 3:1 payout
        else if (count === 3) multiplier = 30; // 30:1 payout for triple
        else multiplier = 0; // No match
        won = multiplier > 0;
      }
      break;
  }

  const payout = amount * multiplier;
  return { won, multiplier, payout };
}

export async function sicBoPlaceBets(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  const bets = req.body?.bets;

  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0 || bets.length > 50) {
    return res.status(400).json({ error: 'At least one bet required' });
  }

  const validSicBoTypes = new Set<SicBoBetType>([
    'big', 'small', 'total', 'triple', 'specific-double', 'any-triple', 'double', 'single',
  ]);

  // Validate each sub-bet individually before trusting any of it
  for (const bet of bets) {
    if (!bet || typeof bet !== 'object') {
      return res.status(400).json({ error: 'Each bet must be an object' });
    }
    if (!validSicBoTypes.has(bet.type)) {
      return res.status(400).json({ error: `Unknown bet type: ${bet.type}` });
    }
    if (!validateBet(Number(bet.amount))) {
      return res.status(400).json({ error: 'Each bet must have a valid positive amount' });
    }
  }

  // Validate that sub-bets sum to exactly the total bet amount
  const totalSubBetAmount = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  if (Math.abs(totalSubBetAmount - betAmount) > 0.005) {
    return res.status(400).json({
      error: `Sub-bets total (${totalSubBetAmount}) must equal bet amount (${betAmount})`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Generate dice roll server-side
    const dice = rollDice();
    const total = calculateTotal(dice);

    // Determine winnings for each sub-bet
    let totalPayout = 0;
    const results: Array<{ type: SicBoBetType; value?: number; won: boolean; payout: number }> = [];

    for (const bet of bets) {
      const result = computeSicBoPayout(bet, dice);
      totalPayout += result.payout;
      results.push({
        type: bet.type,
        value: bet.value,
        won: result.won,
        payout: result.payout,
      });
    }

    // Credit total winnings
    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [totalPayout, req.userId!],
    );

    // Record history - simplified, just store dice result and bets
    const details = {
      dice,
      total,
      bets: bets.map((b: any) => ({ type: b.type, amount: b.amount, value: b.value })),
      totalPayout,
      totalBet: betAmount,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId!, totalPayout - betAmount, Number(credit.rows[0].balance), 'sic_bo_round'],
    );

    // Record game history
    await client.query(
      'INSERT INTO game_history(user_id,game,bet,payout,multiplier,details) VALUES($1,$2,$3,$4,$5,$6)',
      [req.userId!, 'Sic Bo', betAmount, totalPayout, totalPayout / betAmount || 0, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    res.json({
      dice,
      total,
      results,
      totalPayout,
      balance: Number(credit.rows[0].balance),
      totalBet: betAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to place Sic Bo bets' });
  } finally {
    client.release();
  }
}

// NOTE: Sic Bo is a single-request game — sicBoPlaceBets() debits the bet,
// rolls the dice, and credits any payout all in one atomic transaction. It
// never inserts a row into `sic_rounds`, so there is no in-progress round
// for this endpoint to ever find; it will always return 'No active round'.
// Kept only in case a route still points at it — if nothing calls this
// route, it (and the unused `sic_rounds` table) can be deleted outright.
// If you want a real multi-step Sic Bo (bet now, reveal later), this needs
// to actually create/read a sic_rounds row instead.
export async function sicBoSettle(req: AuthRequest, res: Response) {
  const roundId = String(req.body?.roundId ?? '');
  if (!roundId) return res.status(400).json({ error: 'Invalid request' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query(
      `SELECT id, bet_amount, status, game_name FROM sic_rounds WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [roundId, req.userId!],
    );
    if (!roundRes.rowCount || roundRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active round' });
    }

    // This would typically be called after bets are placed and dice rolled
    // For now, we'll just return the round state
    const round = roundRes.rows[0];

    await client.query('COMMIT');
    res.json({ roundId: round.id, status: round.status, betAmount: Number(round.bet_amount) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to settle Sic Bo round' });
  } finally {
    client.release();
  }
}

// ============================================================
// Roulette: Single-zero Roulette (37 numbers: 0-36)
// Player can bet on various bet-types in a single round.
// This is multi-bet-per-round, similar in complexity to Sic Bo.
// ============================================================

// Bet types for Roulette
type RouletteBetType =
  | 'straight'       // Single number 0-36, 35:1 payout
  | 'split'          // Two adjacent numbers, 17:1 payout
  | 'street'         // Three numbers in a row, 11:1 payout
  | 'corner'         // Four numbers forming a square, 8:1 payout
  | 'sixline'        // Six numbers in two rows, 5:1 payout
  | 'column'         // Dozen column, 2:1 payout
  | 'dozen'          // First/Second/Third dozen, 2:1 payout
  | 'red'            // Red numbers, 1:1 payout
  | 'black'          // Black numbers, 1:1 payout
  | 'even'           // Even numbers 2-36, 1:1 payout
  | 'odd'            // Odd numbers 1-35, 1:1 payout
  | 'high'           // High numbers 19-36, 1:1 payout
  | 'low'            // Low numbers 1-18, 1:1 payout;

// Roulette wheel: 37 slots (0-36), house edge 2.7%
const ROULETTE_NUMBERS = 37; // 0 + 1-36
const ROULETTE_HOUSE_EDGE = 1/37; // 2.7% house edge

// Standard European roulette colors. Every number 1-36 belongs to exactly
// ONE of these two sets (0 is green, neither). Built from a single fixed
// array so the two sets can never accidentally overlap or miss a number —
// an earlier version hardcoded both lists separately and 19 ended up in
// both (paying out red AND black bets on the same spin), while 36 was
// misclassified as black and 35 was missing entirely.
const ROULETTE_RED_LIST = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const ROULETTE_RED_NUMBERS = new Set(ROULETTE_RED_LIST);
const ROULETTE_BLACK_NUMBERS = new Set(
  Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !ROULETTE_RED_NUMBERS.has(n)),
);

interface RouletteSubBet {
  type: RouletteBetType;
  value?: number; // for straight, split, street, corner, sixline, dozen
  amount: number; // amount wagered on this sub-bet
}

interface RoulettePlaceBets {
  betAmount: number;
  bets: RouletteSubBet[];
}

// Spin the roulette wheel server-side
function spinRoulette(): number {
  // Generate random number 0-36
  // Slightly biased to simulate house edge - but for our purposes,
  // truly fair random is fine since we're not real casino
  const roll = Math.floor(Math.random() * ROULETTE_NUMBERS);
  return roll; // 0-36
}

// Calculate payout for a roulette bet
function computeRoulettePayout(bet: RouletteSubBet, winningNumber: number): { won: boolean; multiplier: number; payout: number } {
  const { type, value } = bet;
  let won = false;
  let multiplier = 0;

  switch (type) {
    case 'straight':
      // Single number bet
      if (value !== undefined && value === winningNumber) {
        multiplier = 35; // 35:1 payout
        won = true;
      }
      break;

    case 'split':
      // DISABLED (blocked in roulettePlaceBets' validTypes list). A real
      // split bet covers 2 specific adjacent numbers on the table layout
      // (e.g. 1-2 horizontally, or 1-4 vertically) at 17:1. A single
      // `value` field can't say WHICH pair is meant — the old code here
      // quietly treated it as a straight bet at 17:1 instead of 35:1,
      // which just pays the player less than a real straight bet with no
      // actual 2-number coverage. Don't re-enable until RouletteSubBet
      // carries both numbers, e.g. `numbers: [n1, n2]`, and this checks
      // `numbers.includes(winningNumber)`.
      break;

    case 'street':
      // Three numbers in a row (e.g., 1-2-3, 4-5-6, etc.)
      if (value !== undefined) {
        // Streets are: 1-2-3, 4-5-6, 7-8-9, 10-11-12, 13-14-15, 16-17-18,
        // 19-20-21, 22-23-24, 25-26-27, 28-29-30, 31-32-33, 34-35-36
        const streets: number[][] = [
          [1,2,3],[4,5,6],[7,8,9],[10,11,12],
          [13,14,15],[16,17,18],[19,20,21],[22,23,24],
          [25,26,27],[28,29,30],[31,32,33],[34,35,36]
        ];
        const street = streets.find(s => s.includes(value));
        if (street && street.includes(winningNumber)) {
          multiplier = 11;
          won = true;
        }
      }
      break;

    case 'corner':
      // DISABLED (blocked in roulettePlaceBets' validTypes list). Same
      // problem as split: a real corner bet covers 4 numbers forming a
      // square on the layout (e.g. 1-2-4-5) at 8:1, but one `value` field
      // can't say which square. Old code paid it as a straight bet at
      // 8:1 with zero real 4-number coverage. Needs `numbers: [n1,n2,n3,n4]`
      // on RouletteSubBet before re-enabling.
      break;
      break;

    case 'sixline':
      // Six numbers in two rows
      if (value !== undefined) {
        // Sixlines: 1-6, 4-9, 7-12, 10-15, 13-18, 16-21, 19-24, 22-27, 25-30, 28-33, 31-36
        const sixlines: number[][] = [
          [1,2,3,4,5,6],[4,5,6,7,8,9],[7,8,9,10,11,12],
          [10,11,12,13,14,15],[13,14,15,16,17,18],[16,17,18,19,20,21],
          [19,20,21,22,23,24],[22,23,24,25,26,27],[25,26,27,28,29,30],
          [28,29,30,31,32,33],[31,32,33,34,35,36]
        ];
        const sixline = sixlines.find(s => s.includes(value));
        if (sixline && sixline.includes(winningNumber)) {
          multiplier = 5;
          won = true;
        }
      }
      break;

    case 'column':
      // Column bet (1st 12, 2nd 12, 3rd 12)
      // Column 1: 1-4-7-10-13-16-19-22-25-28-31-34
      // Column 2: 2-5-8-11-14-17-20-23-26-29-32-35
      // Column 3: 3-6-9-12-15-18-21-24-27-30-33-36
      if (value !== undefined) {
        const column37 = winningNumber % 3; // 0-based: 0=col3, 1=col1, 2=col2
        // Actually: winningNumber % 3 gives 0,1,2
        // 0 means divisible by 3 -> 3,6,9,...36 -> column 3
        // 1 means 1,4,7,...34 -> column 1
        // 2 means 2,5,8,...35 -> column 2
        const col = winningNumber % 3;
        const betCol = value; // 1, 2, or 3
        if (col === (betCol === 3 ? 0 : betCol - 1)) {
          multiplier = 2;
          won = true;
        }
      }
      break;

    case 'dozen':
      // Dozen bet: 1st 12 (1-12), 2nd 12 (13-24), 3rd 12 (25-36)
      if (value !== undefined) {
        if (winningNumber >= 1 && winningNumber <= 12 && value === 1) {
          multiplier = 2;
          won = true;
        } else if (winningNumber >= 13 && winningNumber <= 24 && value === 2) {
          multiplier = 2;
          won = true;
        } else if (winningNumber >= 25 && winningNumber <= 36 && value === 3) {
          multiplier = 2;
          won = true;
        }
      }
      break;

    case 'red':
      // Standard European roulette red numbers (18 total). Every number is
      // red XOR black — never both — so a red+black pair can never both win
      // on the same spin (aside from the green 0, which is neither).
      if (ROULETTE_RED_NUMBERS.has(winningNumber)) {
        multiplier = 1;
        won = true;
      }
      break;

    case 'black':
      if (ROULETTE_BLACK_NUMBERS.has(winningNumber)) {
        multiplier = 1;
        won = true;
      }
      break;

    case 'even':
      // Even numbers 2-36
      if (winningNumber % 2 === 0 && winningNumber >= 2 && winningNumber <= 36) {
        multiplier = 1;
        won = true;
      }
      break;

    case 'odd':
      // Odd numbers 1-35
      if (winningNumber % 2 === 1 && winningNumber >= 1 && winningNumber <= 35) {
        multiplier = 1;
        won = true;
      }
      break;

    case 'high':
      // High numbers 19-36
      if (winningNumber >= 19 && winningNumber <= 36) {
        multiplier = 1;
        won = true;
      }
      break;

    case 'low':
      // Low numbers 1-18
      if (winningNumber >= 1 && winningNumber <= 18) {
        multiplier = 1;
        won = true;
      }
      break;
  }

  const payout = bet.amount * multiplier;
  return { won, multiplier, payout };
}

// Main handler: place roulette bets and resolve spin
export async function roulettePlaceBets(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  const bets = req.body?.bets;

  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0 || bets.length > 50) {
    return res.status(400).json({ error: 'At least one bet required' });
  }

  const validTypes: RouletteBetType[] = [
    // 'split' and 'corner' are intentionally excluded — see note above
    // computeRoulettePayout's split/corner cases for why.
    'straight', 'street', 'sixline', 'column', 'dozen',
    'red', 'black', 'even', 'odd', 'high', 'low',
  ];

  // Validate each sub-bet individually before trusting any of it
  for (const bet of bets) {
    if (!bet || typeof bet !== 'object' || !validTypes.includes(bet.type)) {
      return res.status(400).json({ error: `Invalid bet type: ${bet?.type}` });
    }
    if (!validateBet(Number(bet.amount))) {
      return res.status(400).json({ error: 'Each bet must have a valid positive amount' });
    }
  }

  // Validate that sub-bets sum to exactly the total bet amount
  const totalSubBetAmount = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  if (Math.abs(totalSubBetAmount - betAmount) > 0.005) {
    return res.status(400).json({
      error: `Sub-bets total (${totalSubBetAmount}) must equal bet amount (${betAmount})`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Spin the wheel server-side
    const winningNumber = spinRoulette();

    // Determine winnings for each sub-bet
    let totalPayout = 0;
    const results: Array<{ type: RouletteBetType; value?: number; won: boolean; payout: number }> = [];

    for (const bet of bets) {
      const result = computeRoulettePayout(bet, winningNumber);
      totalPayout += result.payout;
      results.push({
        type: bet.type,
        value: bet.value,
        won: result.won,
        payout: result.payout,
      });
    }

    // Credit total winnings
    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [totalPayout, req.userId!],
    );

    // Record history - simplified
    const details = {
      winningNumber,
      bets: bets.map((b: any) => ({ type: b.type, amount: b.amount, value: b.value })),
      totalPayout,
      totalBet: betAmount,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4)',
      [req.userId!, totalPayout - betAmount, Number(credit.rows[0].balance), 'roulette_round'],
    );

    // Record game history
    await client.query(
      'INSERT INTO game_history(user_id,game,bet,payout,multiplier,details) VALUES($1,$2,$3,$4,$5,$6)',
      [req.userId!, 'Roulette', betAmount, totalPayout, totalPayout / betAmount || 0, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    res.json({
      winningNumber,
      results,
      totalPayout,
      balance: Number(credit.rows[0].balance),
      totalBet: betAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Unable to place roulette bets' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// BLACKJACK
// ---------------------------------------------------------------------------

export interface BlackjackCard {
  suit: 'H' | 'D' | 'C' | 'S';
  rank: string;
  value: number;
}

function createDeck(): BlackjackCard[] {
  const suits: Array<'H' | 'D' | 'C' | 'S'> = ['H', 'D', 'C', 'S'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: BlackjackCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      let value = Number(rank);
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      if (rank === 'A') value = 11;
      deck.push({ suit, rank, value });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function calculateHand(cards: BlackjackCard[]): { total: number; isSoft: boolean; isBust: boolean; isBlackjack: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else {
      total += card.value;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  const isBust = total > 21;
  const isSoft = aces > 0;
  const isBlackjack = cards.length === 2 && total === 21;

  return { total, isSoft, isBust, isBlackjack };
}

export async function blackjackStart(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM blackjack_rounds WHERE user_id = $1 AND status = $2 LIMIT 1 FOR UPDATE',
      [req.userId!, 'active'],
    );
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active round already exists' });
    }

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const deck = createDeck();
    const playerHand = [deck.pop()!, deck.pop()!];
    const dealerHand = [deck.pop()!, deck.pop()!];

    const playerEval = calculateHand(playerHand);
    const dealerEval = calculateHand(dealerHand);

    if (playerEval.isBlackjack) {
      let status: 'player_won' | 'push' = 'player_won';
      let payout = Math.floor(betAmount * 2.5);

      if (dealerEval.isBlackjack) {
        status = 'push';
        payout = betAmount;
      }

      const credit = await client.query<{ balance: string }>(
        'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
        [payout, req.userId!],
      );

      const round = await client.query<{ id: string }>(
        'INSERT INTO blackjack_rounds(user_id, bet, player_hand, dealer_hand, deck, status) VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
        [req.userId!, betAmount, JSON.stringify(playerHand), JSON.stringify(dealerHand), JSON.stringify(deck), status],
      );

      await client.query(
        'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
        [req.userId!, payout - betAmount, Number(credit.rows[0].balance), 'blackjack_round'],
      );

      await client.query(
        'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
        [
          req.userId!,
          'Blackjack',
          betAmount,
          payout,
          payout / betAmount,
          JSON.stringify({ roundId: round.rows[0].id, playerHand, dealerHand, status }),
        ],
      );

      await client.query('COMMIT');
      return res.json({
        roundId: round.rows[0].id,
        playerHand,
        dealerHand,
        status,
        payout,
        balance: Number(credit.rows[0].balance),
      });
    }

    const round = await client.query<{ id: string }>(
      'INSERT INTO blackjack_rounds(user_id, bet, player_hand, dealer_hand, deck, status) VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.userId!, betAmount, JSON.stringify(playerHand), JSON.stringify(dealerHand), JSON.stringify(deck), 'active'],
    );

    await client.query('COMMIT');
    return res.json({
      roundId: round.rows[0].id,
      playerHand,
      dealerUpCard: dealerHand[0],
      status: 'active',
      balance: Number(debit.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to start blackjack round' });
  } finally {
    client.release();
  }
}

export async function blackjackHit(req: AuthRequest, res: Response) {
  const roundId = req.body?.roundId;
  if (!roundId || typeof roundId !== 'string') {
    return res.status(400).json({ error: 'Invalid round ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query<{
      id: string;
      bet: string;
      player_hand: BlackjackCard[];
      dealer_hand: BlackjackCard[];
      deck: BlackjackCard[];
      status: string;
    }>('SELECT * FROM blackjack_rounds WHERE id = $1 AND user_id = $2 AND status = $3 FOR UPDATE', [
      roundId,
      req.userId!,
      'active',
    ]);

    if (!roundRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active blackjack round not found' });
    }

    const round = roundRes.rows[0];
    const playerHand = round.player_hand;
    const deck = round.deck;
    const betAmount = Number(round.bet);

    playerHand.push(deck.pop()!);
    const playerEval = calculateHand(playerHand);

    if (playerEval.isBust) {
      await client.query('UPDATE blackjack_rounds SET player_hand = $1, deck = $2, status = $3 WHERE id = $4', [
        JSON.stringify(playerHand),
        JSON.stringify(deck),
        'busted',
        roundId,
      ]);

      const prof = await client.query<{ balance: string }>('SELECT balance FROM profiles WHERE id = $1', [req.userId!]);

      await client.query(
        'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
        [req.userId!, -betAmount, Number(prof.rows[0].balance), 'blackjack_round'],
      );

      await client.query(
        'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
        [
          req.userId!,
          'Blackjack',
          betAmount,
          0,
          0,
          JSON.stringify({ roundId, playerHand, dealerHand: round.dealer_hand, status: 'busted' }),
        ],
      );

      await client.query('COMMIT');
      return res.json({
        roundId,
        playerHand,
        dealerUpCard: round.dealer_hand[0],
        status: 'busted',
        payout: 0,
        balance: Number(prof.rows[0].balance),
      });
    }

    await client.query('UPDATE blackjack_rounds SET player_hand = $1, deck = $2 WHERE id = $3', [
      JSON.stringify(playerHand),
      JSON.stringify(deck),
      roundId,
    ]);

    await client.query('COMMIT');
    return res.json({
      roundId,
      playerHand,
      dealerUpCard: round.dealer_hand[0],
      status: 'active',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to hit in blackjack' });
  } finally {
    client.release();
  }
}

export async function blackjackStand(req: AuthRequest, res: Response) {
  const roundId = req.body?.roundId;
  if (!roundId || typeof roundId !== 'string') {
    return res.status(400).json({ error: 'Invalid round ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query<{
      id: string;
      bet: string;
      player_hand: BlackjackCard[];
      dealer_hand: BlackjackCard[];
      deck: BlackjackCard[];
      status: string;
    }>('SELECT * FROM blackjack_rounds WHERE id = $1 AND user_id = $2 AND status = $3 FOR UPDATE', [
      roundId,
      req.userId!,
      'active',
    ]);

    if (!roundRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active blackjack round not found' });
    }

    const round = roundRes.rows[0];
    const playerHand = round.player_hand;
    const dealerHand = round.dealer_hand;
    const deck = round.deck;
    const betAmount = Number(round.bet);

    let dealerEval = calculateHand(dealerHand);
    while (dealerEval.total < 17 || (dealerEval.total === 17 && dealerEval.isSoft)) {
      dealerHand.push(deck.pop()!);
      dealerEval = calculateHand(dealerHand);
    }

    const playerEval = calculateHand(playerHand);
    let status: 'player_won' | 'dealer_won' | 'push' = 'dealer_won';
    let payout = 0;

    if (dealerEval.isBust || playerEval.total > dealerEval.total) {
      status = 'player_won';
      payout = betAmount * 2;
    } else if (playerEval.total === dealerEval.total) {
      status = 'push';
      payout = betAmount;
    } else {
      status = 'dealer_won';
      payout = 0;
    }

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId!],
    );

    await client.query('UPDATE blackjack_rounds SET dealer_hand = $1, deck = $2, status = $3 WHERE id = $4', [
      JSON.stringify(dealerHand),
      JSON.stringify(deck),
      status,
      roundId,
    ]);

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, payout - betAmount, Number(credit.rows[0].balance), 'blackjack_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [
        req.userId!,
        'Blackjack',
        betAmount,
        payout,
        payout / betAmount,
        JSON.stringify({ roundId, playerHand, dealerHand, status }),
      ],
    );

    await client.query('COMMIT');
    return res.json({
      roundId,
      playerHand,
      dealerHand,
      status,
      payout,
      balance: Number(credit.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to stand in blackjack' });
  } finally {
    client.release();
  }
}

export async function blackjackDoubleDown(req: AuthRequest, res: Response) {
  const roundId = req.body?.roundId;
  if (!roundId || typeof roundId !== 'string') {
    return res.status(400).json({ error: 'Invalid round ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roundRes = await client.query<{
      id: string;
      bet: string;
      player_hand: BlackjackCard[];
      dealer_hand: BlackjackCard[];
      deck: BlackjackCard[];
      status: string;
    }>('SELECT * FROM blackjack_rounds WHERE id = $1 AND user_id = $2 AND status = $3 FOR UPDATE', [
      roundId,
      req.userId!,
      'active',
    ]);

    if (!roundRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Active blackjack round not found' });
    }

    const round = roundRes.rows[0];
    const playerHand = round.player_hand;
    const dealerHand = round.dealer_hand;
    const deck = round.deck;
    const initialBet = Number(round.bet);

    if (playerHand.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Double down only allowed on initial hand' });
    }

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [initialBet, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance to double down' });
    }

    const totalBet = initialBet * 2;

    playerHand.push(deck.pop()!);
    const playerEval = calculateHand(playerHand);

    if (playerEval.isBust) {
      await client.query('UPDATE blackjack_rounds SET bet = $1, player_hand = $2, deck = $3, status = $4 WHERE id = $5', [
        totalBet,
        JSON.stringify(playerHand),
        JSON.stringify(deck),
        'busted',
        roundId,
      ]);

      const prof = await client.query<{ balance: string }>('SELECT balance FROM profiles WHERE id = $1', [req.userId!]);

      await client.query(
        'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
        [req.userId!, -totalBet, Number(prof.rows[0].balance), 'blackjack_round'],
      );

      await client.query(
        'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
        [
          req.userId!,
          'Blackjack',
          totalBet,
          0,
          0,
          JSON.stringify({ roundId, playerHand, dealerHand, status: 'busted', doubled: true }),
        ],
      );

      await client.query('COMMIT');
      return res.json({
        roundId,
        playerHand,
        dealerHand,
        status: 'busted',
        payout: 0,
        balance: Number(prof.rows[0].balance),
      });
    }

    let dealerEval = calculateHand(dealerHand);
    while (dealerEval.total < 17 || (dealerEval.total === 17 && dealerEval.isSoft)) {
      dealerHand.push(deck.pop()!);
      dealerEval = calculateHand(dealerHand);
    }

    let status: 'player_won' | 'dealer_won' | 'push' = 'dealer_won';
    let payout = 0;

    if (dealerEval.isBust || playerEval.total > dealerEval.total) {
      status = 'player_won';
      payout = totalBet * 2;
    } else if (playerEval.total === dealerEval.total) {
      status = 'push';
      payout = totalBet;
    } else {
      status = 'dealer_won';
      payout = 0;
    }

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId!],
    );

    await client.query('UPDATE blackjack_rounds SET bet = $1, player_hand = $2, dealer_hand = $3, deck = $4, status = $5 WHERE id = $6', [
      totalBet,
      JSON.stringify(playerHand),
      JSON.stringify(dealerHand),
      JSON.stringify(deck),
      status,
      roundId,
    ]);

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, payout - totalBet, Number(credit.rows[0].balance), 'blackjack_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [
        req.userId!,
        'Blackjack',
        totalBet,
        payout,
        payout / totalBet,
        JSON.stringify({ roundId, playerHand, dealerHand, status, doubled: true }),
      ],
    );

    await client.query('COMMIT');
    return res.json({
      roundId,
      playerHand,
      dealerHand,
      status,
      payout,
      balance: Number(credit.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to double down in blackjack' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// BACCARAT
// ---------------------------------------------------------------------------

export type BaccaratBetType = 'player' | 'banker' | 'tie' | 'player_pair' | 'banker_pair';

export interface BaccaratSubBet {
  type: BaccaratBetType;
  amount: number;
}

export interface BaccaratCard {
  suit: 'H' | 'D' | 'C' | 'S';
  rank: string;
  value: number; // 0-9
}

function createBaccaratDeck(): BaccaratCard[] {
  const suits: Array<'H' | 'D' | 'C' | 'S'> = ['H', 'D', 'C', 'S'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: BaccaratCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      let value = 0;
      if (['10', 'J', 'Q', 'K'].includes(rank)) value = 0;
      else if (rank === 'A') value = 1;
      else value = Number(rank);
      deck.push({ suit, rank, value });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function computeBaccaratHandValue(cards: BaccaratCard[]): number {
  const sum = cards.reduce((acc, c) => acc + c.value, 0);
  return sum % 10;
}

export async function baccaratPlaceBets(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  const bets: BaccaratSubBet[] = req.body?.bets;

  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  if (!bets || !Array.isArray(bets) || bets.length === 0 || bets.length > 10) {
    return res.status(400).json({ error: 'At least one bet required' });
  }

  const validTypes: BaccaratBetType[] = ['player', 'banker', 'tie', 'player_pair', 'banker_pair'];

  for (const bet of bets) {
    if (!bet || typeof bet !== 'object' || !validTypes.includes(bet.type)) {
      return res.status(400).json({ error: `Invalid bet type: ${bet?.type}` });
    }
    if (!validateBet(Number(bet.amount))) {
      return res.status(400).json({ error: 'Each bet must have a valid positive amount' });
    }
  }

  const totalSubBetAmount = bets.reduce((sum, b) => sum + Number(b.amount), 0);
  if (Math.abs(totalSubBetAmount - betAmount) > 0.005) {
    return res.status(400).json({
      error: `Sub-bets total (${totalSubBetAmount}) must equal bet amount (${betAmount})`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const deck = createBaccaratDeck();
    const playerCards: BaccaratCard[] = [deck.pop()!, deck.pop()!];
    const bankerCards: BaccaratCard[] = [deck.pop()!, deck.pop()!];

    let playerTotal = computeBaccaratHandValue(playerCards);
    let bankerTotal = computeBaccaratHandValue(bankerCards);

    // Natural check (8 or 9)
    if (playerTotal < 8 && bankerTotal < 8) {
      let playerThirdCard: BaccaratCard | null = null;

      // Player draw rule
      if (playerTotal <= 5) {
        playerThirdCard = deck.pop()!;
        playerCards.push(playerThirdCard);
        playerTotal = computeBaccaratHandValue(playerCards);
      }

      // Banker draw rule
      if (!playerThirdCard) {
        // Player stood
        if (bankerTotal <= 5) {
          bankerCards.push(deck.pop()!);
          bankerTotal = computeBaccaratHandValue(bankerCards);
        }
      } else {
        // Player drew a 3rd card
        const p3Val = playerThirdCard.value;
        let bankerDraws = false;

        if (bankerTotal <= 2) bankerDraws = true;
        else if (bankerTotal === 3 && p3Val !== 8) bankerDraws = true;
        else if (bankerTotal === 4 && [2, 3, 4, 5, 6, 7].includes(p3Val)) bankerDraws = true;
        else if (bankerTotal === 5 && [4, 5, 6, 7].includes(p3Val)) bankerDraws = true;
        else if (bankerTotal === 6 && [6, 7].includes(p3Val)) bankerDraws = true;

        if (bankerDraws) {
          bankerCards.push(deck.pop()!);
          bankerTotal = computeBaccaratHandValue(bankerCards);
        }
      }
    }

    // Evaluate payouts
    let totalPayout = 0;
    const results: Array<{ type: BaccaratBetType; won: boolean; payout: number }> = [];

    const isTie = playerTotal === bankerTotal;
    const playerWon = playerTotal > bankerTotal;
    const bankerWon = bankerTotal > playerTotal;
    const playerPair = playerCards[0].rank === playerCards[1].rank;
    const bankerPair = bankerCards[0].rank === bankerCards[1].rank;

    for (const b of bets) {
      const amt = Number(b.amount);
      let won = false;
      let payout = 0;

      switch (b.type) {
        case 'player':
          if (playerWon) {
            won = true;
            payout = amt * 2; // 1:1
          } else if (isTie) {
            payout = amt; // push
          }
          break;
        case 'banker':
          if (bankerWon) {
            won = true;
            payout = amt * 1.95; // 0.95:1 (5% commission)
          } else if (isTie) {
            payout = amt; // push
          }
          break;
        case 'tie':
          if (isTie) {
            won = true;
            payout = amt * 9; // 8:1
          }
          break;
        case 'player_pair':
          if (playerPair) {
            won = true;
            payout = amt * 12; // 11:1
          }
          break;
        case 'banker_pair':
          if (bankerPair) {
            won = true;
            payout = amt * 12; // 11:1
          }
          break;
      }

      totalPayout += payout;
      results.push({ type: b.type, won, payout });
    }

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [totalPayout, req.userId!],
    );

    const details = {
      playerCards,
      bankerCards,
      playerTotal,
      bankerTotal,
      bets: bets.map((b) => ({ type: b.type, amount: b.amount })),
      totalPayout,
      totalBet: betAmount,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, totalPayout - betAmount, Number(credit.rows[0].balance), 'baccarat_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [req.userId!, 'Baccarat', betAmount, totalPayout, totalPayout / betAmount || 0, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    return res.json({
      playerCards,
      bankerCards,
      playerTotal,
      bankerTotal,
      results,
      totalPayout,
      balance: Number(credit.rows[0].balance),
      totalBet: betAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to place baccarat bets' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// TEEN PATTI
// ---------------------------------------------------------------------------

export interface TeenPattiCard {
  suit: 'H' | 'D' | 'C' | 'S';
  rank: string;
  value: number; // 2..14 (A=14)
}

function createTeenPattiDeck(): TeenPattiCard[] {
  const suits: Array<'H' | 'D' | 'C' | 'S'> = ['H', 'D', 'C', 'S'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: TeenPattiCard[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      let value = Number(rank);
      if (rank === 'J') value = 11;
      if (rank === 'Q') value = 12;
      if (rank === 'K') value = 13;
      if (rank === 'A') value = 14;
      deck.push({ suit, rank, value });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export interface TeenPattiHandEval {
  category: number; // 6=Trail, 5=Pure Sequence, 4=Sequence, 3=Color, 2=Pair, 1=High Card
  categoryName: string;
  ranks: number[]; // For tie-breaking comparison
}

function evaluateTeenPattiHand(cards: TeenPattiCard[]): TeenPattiHandEval {
  // Sort cards descending by value
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const v0 = sorted[0].value;
  const v1 = sorted[1].value;
  const v2 = sorted[2].value;

  const isFlush = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;

  // Check sequence: standard (e.g. A-K-Q, K-Q-J) or A-2-3 (14-3-2)
  let isSequence = false;
  let sequenceRanks: number[] = [];

  if (v0 === v1 + 1 && v1 === v2 + 1) {
    isSequence = true;
    sequenceRanks = [v0, v1, v2];
  } else if (v0 === 14 && v1 === 3 && v2 === 2) {
    // A-2-3 sequence (Ace acts as 1)
    isSequence = true;
    sequenceRanks = [3, 2, 1];
  }

  // 1. Trail / Trio (Three of a kind)
  if (v0 === v1 && v1 === v2) {
    return { category: 6, categoryName: 'Trail', ranks: [v0] };
  }

  // 2. Pure Sequence (Straight Flush)
  if (isFlush && isSequence) {
    return { category: 5, categoryName: 'Pure Sequence', ranks: sequenceRanks };
  }

  // 3. Sequence (Straight)
  if (isSequence) {
    return { category: 4, categoryName: 'Sequence', ranks: sequenceRanks };
  }

  // 4. Color (Flush)
  if (isFlush) {
    return { category: 3, categoryName: 'Color', ranks: [v0, v1, v2] };
  }

  // 5. Pair
  if (v0 === v1) {
    return { category: 2, categoryName: 'Pair', ranks: [v0, v2] };
  }
  if (v1 === v2) {
    return { category: 2, categoryName: 'Pair', ranks: [v1, v0] };
  }

  // 6. High Card
  return { category: 1, categoryName: 'High Card', ranks: [v0, v1, v2] };
}

function compareTeenPattiHands(a: TeenPattiHandEval, b: TeenPattiHandEval): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  for (let i = 0; i < Math.min(a.ranks.length, b.ranks.length); i++) {
    if (a.ranks[i] !== b.ranks[i]) {
      return a.ranks[i] - b.ranks[i];
    }
  }
  return 0;
}

export async function teenPattiPlay(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const deck = createTeenPattiDeck();
    const playerHand: TeenPattiCard[] = [deck.pop()!, deck.pop()!, deck.pop()!];
    const dealerHand: TeenPattiCard[] = [deck.pop()!, deck.pop()!, deck.pop()!];

    const playerEval = evaluateTeenPattiHand(playerHand);
    const dealerEval = evaluateTeenPattiHand(dealerHand);

    const cmp = compareTeenPattiHands(playerEval, dealerEval);
    let outcome: 'player_won' | 'dealer_won' | 'push' = 'dealer_won';
    let payout = 0;

    if (cmp > 0) {
      outcome = 'player_won';
      payout = betAmount * 2; // 1:1
    } else if (cmp === 0) {
      outcome = 'push';
      payout = betAmount;
    } else {
      outcome = 'dealer_won';
      payout = 0;
    }

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId!],
    );

    const details = {
      playerHand,
      dealerHand,
      playerCategory: playerEval.categoryName,
      dealerCategory: dealerEval.categoryName,
      outcome,
      payout,
      betAmount,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, payout - betAmount, Number(credit.rows[0].balance), 'teenpatti_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [req.userId!, 'Teen Patti', betAmount, payout, payout / betAmount || 0, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    return res.json({
      playerHand,
      dealerHand,
      playerCategory: playerEval.categoryName,
      dealerCategory: dealerEval.categoryName,
      outcome,
      payout,
      balance: Number(credit.rows[0].balance),
      betAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to play Teen Patti' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// DICE TABLE
// ---------------------------------------------------------------------------

export async function diceTablePlay(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  const target = Number(req.body?.target ?? 50);
  const isOver = Boolean(req.body?.isOver ?? true);

  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  if (!Number.isFinite(target) || target < 2 || target > 98) {
    return res.status(400).json({ error: 'Invalid target (must be between 2 and 98)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const outcome = computeDicePayout(betAmount, target, isOver);

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [outcome.payout, req.userId!],
    );

    const details = {
      result: outcome.result,
      won: outcome.won,
      target,
      isOver,
      multiplier: outcome.multiplier,
      payout: outcome.payout,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, outcome.payout - betAmount, Number(credit.rows[0].balance), 'dicetable_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [req.userId!, 'Dice Table', betAmount, outcome.payout, outcome.multiplier, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    return res.json({
      result: outcome.result,
      won: outcome.won,
      multiplier: outcome.multiplier,
      payout: outcome.payout,
      target,
      isOver,
      balance: Number(credit.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to play Dice Table' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// GAME SHOW
// ---------------------------------------------------------------------------

const GAME_SHOW_SEGMENTS = [
  { multiplier: 0, weight: 15 },
  { multiplier: 1, weight: 40 },
  { multiplier: 2, weight: 25 },
  { multiplier: 5, weight: 12 },
  { multiplier: 10, weight: 5 },
  { multiplier: 20, weight: 2 },
  { multiplier: 50, weight: 0.8 },
  { multiplier: 100, weight: 0.2 },
];

function spinGameShowWheel() {
  const totalWeight = GAME_SHOW_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < GAME_SHOW_SEGMENTS.length; i++) {
    const segment = GAME_SHOW_SEGMENTS[i];
    if (random < segment.weight) {
      return { segmentIndex: i, multiplier: segment.multiplier };
    }
    random -= segment.weight;
  }

  return { segmentIndex: 1, multiplier: GAME_SHOW_SEGMENTS[1].multiplier };
}

export async function gameShowPlay(req: AuthRequest, res: Response) {
  const betAmount = Number(req.body?.betAmount);
  if (!validateBet(betAmount)) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const debit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
      [betAmount, req.userId!],
    );
    if (!debit.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const result = spinGameShowWheel();
    const payout = Math.floor(betAmount * result.multiplier);

    const credit = await client.query<{ balance: string }>(
      'UPDATE profiles SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [payout, req.userId!],
    );

    const details = {
      segmentIndex: result.segmentIndex,
      multiplier: result.multiplier,
      payout,
      betAmount,
    };

    await client.query(
      'INSERT INTO wallet_transactions(user_id, amount, balance_after, reason) VALUES($1, $2, $3, $4)',
      [req.userId!, payout - betAmount, Number(credit.rows[0].balance), 'gameshow_round'],
    );

    await client.query(
      'INSERT INTO game_history(user_id, game, bet, payout, multiplier, details) VALUES($1, $2, $3, $4, $5, $6)',
      [req.userId!, 'Game Show', betAmount, payout, result.multiplier, JSON.stringify(details)],
    );

    await client.query('COMMIT');

    return res.json({
      segmentIndex: result.segmentIndex,
      multiplier: result.multiplier,
      payout,
      balance: Number(credit.rows[0].balance),
      betAmount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Unable to play Game Show' });
  } finally {
    client.release();
  }
}
