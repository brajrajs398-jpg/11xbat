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

function computePlinkoPayout(bet: number) {
  let currentX = 50;
  for (let row = 0; row < PLINKO_ROWS; row++) {
    currentX += (Math.random() - 0.5) * (100 / PLINKO_COLS);
    currentX = Math.max(8, Math.min(92, currentX));
  }
  const slot = Math.max(0, Math.min(PLINKO_MULTIPLIERS.length - 1, Math.round((currentX / 100) * (PLINKO_MULTIPLIERS.length - 1))));
  const multiplier = PLINKO_MULTIPLIERS[slot];
  const payout = bet * multiplier;
  return { slot, multiplier, payout };
}

const WHEEL_SEGMENTS = [1.5, 2, 0, 3, 1.5, 0, 5, 2, 0, 1.5, 10, 0];

function computeWheelPayout(bet: number) {
  const winningIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
  const multiplier = WHEEL_SEGMENTS[winningIndex];
  const payout = bet * multiplier;
  return { winningIndex, multiplier, payout };
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
const CRASH_GROWTH_RATE = 0.06;
const CRASH_MAX_MULTIPLIER = 100;

function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.03) return 1.0;
  const houseEdge = 0.99;
  const point = houseEdge / (1 - r);
  return Math.max(1.0, Math.min(point, CRASH_MAX_MULTIPLIER));
}

function currentCrashMultiplier(startedAt: Date): number {
  const elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;
  return Math.pow(Math.E, CRASH_GROWTH_RATE * elapsedSeconds);
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
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const result = await settleInstantRound(req.userId!, bet, game, () => computePlinkoPayout(bet));
  if (!result) return res.status(400).json({ error: 'Insufficient balance' });
  res.json(result);
}

export async function wheelSpin(req: AuthRequest, res: Response) {
  const bet = Number(req.body?.betAmount);
  const game = String(req.body?.game ?? 'Wheel').slice(0, 120);
  if (!validateBet(bet)) return res.status(400).json({ error: 'Invalid bet amount' });

  const result = await settleInstantRound(req.userId!, bet, game, () => computeWheelPayout(bet));
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

// Index = hits, value = payout multiplier (0 = no win). Indexed by pick count.
const KENO_PAYTABLES: Record<number, number[]> = {
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
};

function drawKenoNumbers(): number[] {
  const pool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, KENO_DRAW_COUNT).sort((a, b) => a - b);
}

function computeKenoPayout(bet: number, picks: number[]) {
  const drawn = drawKenoNumbers();
  const drawnSet = new Set(drawn);
  const hits = picks.filter((p) => drawnSet.has(p)).length;
  const table = KENO_PAYTABLES[picks.length] ?? [];
  const multiplier = table[hits] ?? 0;
  const payout = bet * multiplier;
  return { drawn, hits, multiplier, payout };
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

  const result = await settleInstantRound(req.userId!, bet, game, () => {
    const r = computeKenoPayout(bet, picks);
    return { multiplier: r.multiplier, payout: r.payout, drawn: r.drawn, hits: r.hits, picks };
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
