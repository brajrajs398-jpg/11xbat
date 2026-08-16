# PlayVault — Project Handoff

**Last updated:** 16 Aug 2026 (Phase 7)
**Purpose:** Full history of this project so any future session (Claude, Jules, or a human dev) can pick up context instantly without re-deriving decisions.

---

## 1. What this project is

A virtual-currency (no real money) casino-style gaming app. Signup gives 1000 free virtual coins.

**Stack:**
- Frontend: React + Vite + TypeScript + Tailwind, in `frontend/frontend/`
- Backend: Node.js + Express + PostgreSQL + JWT auth, in `backend/backend/`

For Phases 1–6 (IP cleanup, visual diversification, backend migration, security audit, load hardening, root-cause slot-catalog security fix), see the version of this doc dated 16 Aug 2026 (pre-Phase 7) — summarized briefly below, full detail unchanged from before.

---

## 2. Project history (chronological, abbreviated for phases 1–6)

- **Phase 1** — Removed copied real-operator catalog/trademarks; procedurally regenerated 2,892 original game names; fake provider attribution replaced with in-house labels.
- **Phase 2** — Gave every catalog game a unique background gradient; expanded slot symbol packs to 19 themes; spread the 2,235 slot-catalog games across 5 mechanics (Reel/Mines/Plinko/Wheel/Dice-guess).
- **Phase 3** — Migrated backend from Supabase to self-hosted Node/Express/Postgres.
- **Phase 4** — Security audit found `/api/wallet/change` was fully client-trusted (critical: anyone could mint coins), no rate limiting, weak JWT secret placeholder, no email verification.
- **Phase 5** — Load/scale hardening: connection pooling, rate limiting, clustering, graceful shutdown.
- **Phase 6** — Made Slot/Dice/Plinko/Wheel/Mines (2,235 games = 77% of catalog) fully server-authoritative via `backend/backend/src/games.ts`. `/api/wallet/change` left in place but capped (5,000/call) for the remaining 657 live-table games, which are still exploitable — **this was the known open item going into Phase 7.**

### Phase 7 — Repeated-game problem: added 2 new real engines (Crash, Coinflip)

**Problem identified this phase:** the catalog *looked* like 2,892 unique games, but under the hood only 12 real engines existed (5 slot-mechanics + 6 live-table types + none else), each reskinned hundreds of times. Players would notice the same game repeating under different names. Researched the open-source landscape (GitHub) for casino-style game engines to see how many more *genuinely distinct* mechanics could realistically be added — conclusion: the entire industry (including big real-money casinos) only has on the order of ~20 base mechanics total; getting to hundreds of truly distinct engines isn't achievable by anyone. Agreed plan going forward: keep adding real engines where they exist, and pair each with real parameter variation, rather than promising unrealistic engine counts.

**This phase's concrete step:** two components already in the codebase but never wired up — `CrashGame.tsx` and `CoinFlipGame.tsx` — were fully integrated as new server-authoritative engines (previously they had **zero backend calls at all**, i.e. would have been the same open exploit as the pre-Phase-6 slot games if linked as-is).

**Backend (`backend/backend/src/games.ts`):**
- `coinFlipFlip` — instant round, reuses the existing `settleInstantRound` transaction helper (bet-deduct + outcome + payout-credit + history-log atomically). Same 1.96× payout math as before.
- `crashStart` / `crashCashout` / `crashStatus` — Crash is multi-step and time-based like Mines, so it uses a new `crash_rounds` table. The crash point is generated and stored **server-side at round start and never sent to the client** until the round resolves. The frontend animates a local growth-curve display (`e^(0.06·t)`) and polls `crash/status` every 400ms; the *actual* win/bust decision is always made server-side by comparing server elapsed time (from `started_at`) against the hidden `crash_point` at the moment a cashout request or poll lands — never from a client-supplied multiplier.
- New table `crash_rounds` added to `sql/schema.sql` (mirrors `mines_rounds`: `active`/`busted`/`cashed_out` status, `FOR UPDATE` row locking to prevent double-cashout races).
- New routes: `POST /api/games/coinflip/flip`, `POST /api/games/crash/start`, `POST /api/games/crash/cashout`, `GET /api/games/crash/status`.

**Frontend:**
- `CoinFlipGame.tsx` and `CrashGame.tsx` rewritten to call the endpoints above instead of generating their own `Math.random()` result and self-reporting via `/api/wallet/change`. Both now accept an optional `game: CatalogGame` prop (same pattern as `DiceGame.tsx`) so they render with a catalog game's name/description when opened from the catalog.
- `lib/api.ts` — added `coinFlipFlip`, `crashStart`, `crashCashout`, `crashStatus`.
- `App.tsx` — catalog routing switch statements (both the primary one and the fallback-by-id one) now handle `engineType: 'crash'` and `'coinflip'`.

**Catalog (`data/gamesCatalog.ts`):**
- `CatalogGame.engineType` union extended with `'crash' | 'coinflip'`.
- 60 new catalog entries appended (`crash_1..30`, `coinflip_1..30`), each with a unique procedurally-generated gradient accent (same style as Phase 2), unique names (adjective+noun combinations, no collisions), `subCategory: 'Crash'` / `'Coin Flip'`, `provider: 'PlayVault Studios'`.
- Catalog is now **2,952 entries total** (was 2,892) backed by **9 real engines** (was 7).

**Verified:** backend `tsc --noEmit` clean, frontend `tsc --noEmit` clean, `vite build` succeeds.

---

## 3. Current state — what's secure vs. what's not

| Games | Count | Status |
|---|---|---|
| Slot, Dice, Plinko, Wheel, Mines (via slot catalog) | 2,235 | ✅ Fully server-authoritative |
| Crash, Coin Flip | 60 | ✅ Fully server-authoritative (new, Phase 7) |
| Roulette, Blackjack, Baccarat, Teen Patti, Game Show, Dice-table (via live catalog) | 657 | 🟡 Still client-trusted via `/api/wallet/change`, capped at 5,000/call. **Still not a real fix.** |

**If continuing this project, still the highest-priority security item:** migrate the 6 remaining live-table engines to server-authoritative (same as Phase 6/7 pattern). Unchanged from before — Phase 7 did not touch this.

**On the repeated-game problem (the reason Phase 7 happened):** 9 real engines now exist. The user's direction (confirmed) is Option A — any future non-casino/skill-based game (arcade, puzzle, etc.) should still plug into the bet→outcome→payout loop, with the score itself verified server-side (never client-reported) to avoid reopening the Phase 4 hole. Next candidates to research/build, roughly in order of how well-supported they are in the open-source ecosystem: Keno, Hi-Lo, Limbo, Sic Bo, Video Poker. Skill-based arcade games (if pursued) will need a bespoke server-side score-verification approach per game — there's no generic pattern to reuse the way `settleInstantRound` works for RNG games.

Other things **not yet done** (carried over, unchanged):
- No rate limiting specifically on `/api/games/*` beyond the general 60 req/min
- No email verification / CAPTCHA on signup
- Password policy still just 6-char minimum
- App name/branding rename away from "11xbat" — not done in this codebase

---

## 4. ⚠️ SESSION CUT SHORT — PART 2 NOT DONE YET (read this first)

This session ran out before finishing the full repeated-game fix. **Part 1 (below) is done and verified. Part 2 is the exact next-step PRD — do this next, in order.**

### Part 1 — done this session (Phase 7)

- Crash + Coinflip wired up server-authoritative (was Phase 7a, see section 2 above for full detail).
- **Phase 7b (this session, continued):** two more full engines added, same rigor as Crash/Coinflip:
  - **Limbo** (`backend/backend/src/games.ts`: `limboBet` / `computeLimboPayout` / `generateLimboRoll`) — instant round, player sets a target multiplier, server rolls from the same heavy-tailed distribution Crash uses and pays `bet × target` if the roll clears it. Route: `POST /api/games/limbo/bet`. Frontend: `LimboGame.tsx`.
  - **Keno** (`backend/backend/src/games.ts`: `kenoDraw` / `computeKenoPayout` / `drawKenoNumbers`) — instant round, player picks 1-10 numbers from a 1-40 grid, server draws 10, payout from an original house-designed paytable (`KENO_PAYTABLES`, indexed by picks-count then hits-count — **not copied from any real operator, tune this if the house edge feels off**). Route: `POST /api/games/keno/draw`. Frontend: `KenoGame.tsx`.
  - Both reuse the existing `settleInstantRound` atomic-transaction helper — no new DB tables needed (unlike Mines/Crash).
  - Catalog: `engineType` union now includes `'limbo' | 'keno'`. 40 new entries appended (`limbo_1..20`, `keno_1..20`), unique names/gradients, same pattern as before.
  - `App.tsx` routing (both switch statements) updated for the two new engine types.
  - **Verified:** backend `tsc --noEmit` clean, frontend `tsc --noEmit` clean, `vite build` succeeds.

**Catalog is now 2,992 entries backed by 11 real engines** (was 2,892 / 7 at the start of this session).

### Part 2 — exact next steps (do these next, in this order)

1. **Hi-Lo** (Higher/Lower card game) — multi-step, needs its own rounds table (`hilo_rounds`), same shape as `crash_rounds`/`mines_rounds` (`id, user_id, bet, status active/busted/cashed_out, game_name, created_at` + game-specific state columns). State needed: current revealed card (rank 1-13, suits don't matter for higher/lower), running multiplier. Flow: `POST /api/games/hilo/start` (debit bet, deal first card server-side, store it, return only that first card — never future cards). `POST /api/games/hilo/guess` `{roundId, guess: 'higher'|'lower'}` → server deals next card server-side, compares to current, if guess correct update multiplier and current card, if wrong mark busted (payout 0, record history). `POST /api/games/hilo/cashout` `{roundId}` → credit at current multiplier, same locking pattern as `minesCashout`/`settleCrashRound` (`FOR UPDATE` on the round row to prevent double-cashout races). Multiplier formula: something like `multiplier *= (13 / cardsThatWouldWin)` per correct guess, house-edge-adjusted (~0.97-0.99×) — same style as `calculateMinesMultiplier` in `games.ts`, reuse that pattern.
2. **Sic Bo** — three dice, player can bet on multiple bet-types at once (big/small, specific triple, specific total, etc.) in a single round. This one's different from everything else in the app: it's **multi-bet-per-round**, not single-bet. Needs its own request shape: `{ betAmount, bets: [{type: 'big'|'small'|'triple'|'total', value?: number, amount: number}] }` where each sub-bet's `amount` sums to `betAmount`, validate that server-side. Payout table again original/house-designed, not copied from a real operator. This is the most complex remaining engine — budget the most time for it.
3. **Real parameter-variants for existing engines** — the user's original ask was for catalog entries to be more than just a reskin. Concrete, scoped work per engine:
   - Crash: vary `CRASH_GROWTH_RATE` per catalog entry (e.g. 0.04/0.06/0.09 → "slow build" vs "fast rocket" games feel mechanically different, not just re-colored)
   - Mines: already varies by `mineCount` at play-time (player-chosen), no catalog-level change needed
   - Wheel: vary `WHEEL_SEGMENTS` (different segment counts/paytables per catalog entry group, not one fixed array for all 2,235-ish wheel-mechanic games)
   - Plinko: vary `PLINKO_ROWS` (e.g. 8/12/16 rows → different risk profiles)
   - Keno: vary which `KENO_PAYTABLES` a given catalog entry uses (e.g. a "high risk" Keno variant with steeper payouts) — currently every Keno entry shares one paytable
   - This requires each catalog entry to carry a small config (e.g. a `variant` or `config` field) that the frontend passes to the relevant `api.*` call, and the backend to accept and clamp it (never trust an unbounded value from the client — validate against a small fixed set of allowed variant presets server-side, don't let the client send arbitrary growth rates/paytables).
4. **Then, and only then** — revisit the still-open Phase 4/6 item: migrate the 657 live-table games (Roulette/Blackjack/Baccarat/Teen Patti/Game Show/Dice-table) off the client-trusted `/api/wallet/change` endpoint to dedicated server-authoritative endpoints, same rigor as everything above. This has been the top security priority since Phase 6 and Phase 7 intentionally did not touch it — don't lose track of it while chasing the repeated-game/variety problem.

### Other reminders carried forward (still true, unchanged)
- No rate limiting specifically on `/api/games/*` beyond the general 60 req/min
- No email verification / CAPTCHA on signup
- Password policy still just 6-char minimum
- App name/branding rename away from "11xbat" — not done in this codebase
- Keep following the Phase 1 discipline: any new game/engine name, icon, or paytable must be original — never copy a real operator's exact branding, name, or proprietary paytable, even when using a generic open-source mechanic as a reference.

## 5. How to run locally

```bash
# Backend
cd backend/backend
cp .env.example .env   # then edit JWT_SECRET to a real random 32+ char string
docker compose up -d   # starts Postgres
npm install
npm run db:init        # applies sql/schema.sql (idempotent, safe to re-run — includes new crash_rounds table)
npm run dev             # dev server, or:
npm run build && npm run start:cluster   # production, multi-core

# Frontend
cd frontend/frontend
cp .env.example .env    # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev
```

## 6. Key architectural facts worth remembering

- Auth is **stateless JWT** — horizontal scaling needs no code changes.
- `gamesCatalog.ts` is a static generated file — not fetched from the DB.
- All slot-symbol packs use the same value tiers `[100, 50, 25, 15, 10, 5, 3]`.
- Every catalog entry routes through `engineType` in `App.tsx`; slot-type entries are further routed to one of 5 mechanics via `pickSlotInterface`. Crash and Coin Flip are now top-level `engineType`s, not sub-mechanics of `slot`.
- Every server-authoritative game engine lives in `backend/backend/src/games.ts` and follows one of two patterns: **instant round** (`settleInstantRound` — one atomic transaction, used by Slot/Dice/Plinko/Wheel/Coinflip) or **multi-step round** (a dedicated rounds table with `active/busted/cashed_out` status and `FOR UPDATE` locking, used by Mines/Crash). Any new RNG-based engine should reuse one of these two patterns rather than inventing a third.
