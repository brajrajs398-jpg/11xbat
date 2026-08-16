# PlayVault

## Structure

```
backend/    All server code (Express + TypeScript + Postgres)
docs/       Handoff notes
docs/archive/  Older status reports, kept for history only
```

## Running the backend

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:3000, auto-restarts on changes
```

Set `DATABASE_URL` (or the standard `PG*` env vars) and run `schema.sql`
then `seed.sql` against your Postgres database before testing games —
without the seeded demo user, every bet will fail (no wallet to debit).

## Current status (as of this reorg)

**Working:**
- 27 game endpoints (Slots, Dice, Plinko, Wheel, Coinflip, Crash, Limbo,
  Keno, Mines, Hi-Lo, Sic Bo, Roulette, Blackjack, Baccarat, Teen Patti,
  Dice Table, Game Show) — all compute outcomes server-side, none trust
  a client-sent result.
- `npm run build` (type-check) passes clean.
- Server actually boots and `/health` responds.

**Temporary / not real yet — swap before this takes real users or money:**
- `backend/auth.ts` does not check any login. Every request is treated as
  one hardcoded demo user (see `DEMO_USER_ID`). There is no signup/login
  route at all yet. This is intentional for now — replace it with real
  token verification once the client's server/credentials are ready.
- No rate limiting, no CORS config, no clustering — fine for a demo, not
  for production traffic.
- Roulette split & corner bets are disabled server-side (payout math for
  them was broken; see `docs/HANDOFF-part3.md`). Straight/street/sixline/
  column/dozen bets work.
- `sicBoSettle` in `games.ts` is unused dead code — Sic Bo settles in one
  shot, not in steps. Safe to ignore or delete later.

**Missing entirely (not in this repo):**
- No frontend code at all — this repo is backend-only right now.
- No deposit/withdraw or payment integration.
- No admin panel.
