# PlayVault Part 2 Completion

**Date:** 16 Aug 2026
**Project:** PlayVault - Casino Gaming Platform
**Status:** Part 2 Hi-Lo & Sic Bo engines implemented

## Overview

This note documents the completion of Part 2 from the PROJECT-HANDOFF.md, which includes implementing two new server-authoritative game engines: **Hi-Lo** and **Sic Bo**.

## ✅ Hi-Lo (Higher/Lower Card Game) - COMPLETE

### SQL Schema Added
- `hilo_rounds` table with columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `bet NUMERIC(14,2) NOT NULL CHECK (bet > 0)`
  - `current_card INT NOT NULL CHECK (current_card BETWEEN 1 AND 13)`
  - `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'busted', 'cashed_out'))`
  - `game_name TEXT NOT NULL DEFAULT 'Hi-Lo'`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Index: `idx_hilo_rounds_user_active` on `user_id WHERE status = 'active'`

### Backend Engine (`backend/src/games.ts`)
- **`HILO_MAX_CARDS = 13`** constant
- **`computeHiLoPayout()`** function with multiplier formula: `13 / (13 - cards_revealed)`
- **`hiloStart()`** - deals first card server-side, deducts bet, returns first card
- **`hiloGuess()`** - handles `{'higher'|'lower'}` guesses:
  - Deals next card server-side from remaining cards
  - Compares against last revealed card
  - On correct guess: updates multiplier and current_card
  - On incorrect guess: marks round as busted, payout = 0
- **`hiloCashout()`** - credits payout at current multiplier, marks round as cashed_out

### Game Flow
1. Player calls `POST /api/games/hilo/start` → gets first card, bet deducted
2. Player calls `POST /api/games/hilo/guess {guess: 'higher'|'lower'}` → next card dealt, comparison made
3. Player can repeat guesses until busted or decides to cash out
4. Player calls `POST /api/games/hilo/cashout` → credited at current multiplier

### Multiplier Formula
- Starts at `13/12` ≈ 1.083 after first correct guess
- Increases with each correct guess: `13 / (13 - cards_revealed)`
- Maximum after 12 correct guesses: `13/1` = 13× the bet

## ✅ Sic Bo (Three Dice Game) - COMPLETE

### SQL Schema Added
- `sic_rounds` table with columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `bet_amount NUMERIC(14,2) NOT NULL CHECK (bet_amount > 0)`
  - `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled'))`
  - `game_name TEXT NOT NULL DEFAULT 'Sic Bo'`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Index: `idx_sic_rounds_user_active` on `user_id WHERE status = 'active'`

### Backend Engine (`backend/src/games.ts`)
- **7 bet types** with authentic Sic Bo payouts:
  - `big` / `small` - total 4-10 / 11-17 (excluding triples): 1.95:1
  - `total` - specific total 4-17: 6:1 to 60:1 (depends on total)
  - `triple` - specific triple (1-1): 180:1
  - `specific-double` - specific double: 10:1
  - `any-triple` - any triple: 30:1
  - `double` - any double (not triple): 6:1
  - `single` - specific single number (1-6): 1:1 to 30:1 (based on count)

- **`SicBoBetType`** union type defining all bet variants
- **`SicBoSubBet`** interface with `type`, `value?`, `amount`
- **`SicBoPlaceBets`** interface with `betAmount`, `bets[]`
- **`sicBoPlaceBets()`** - main handler:
  1. Validates sub-bets sum to total bet amount
  2. Deducts bet from balance
  3. Rolls 3 dice server-side
  4. Computes winnings for each sub-bet
  5. Credits total winnings
  6. Logs transactions and game history
- **`sicBoSettle()`** - round state query helper

### Payout Table (House Edge ~2.8% for big/small)
| Bet Type | True Odds | Payout |
|----------|-----------|--------|
| Big/Small | 48.6% | 1.95:1 |
| Specific Total 4-17 | varies | 6:1 to 60:1 |
| Specific Triple | 1:216 | 180:1 |
| Any Triple | 6:216 | 30:1 |
| Specific Double | varies | 10:1 |
| Any Double | varies | 6:1 |
| Specific Single | varies | 1:1 to 30:1 |

### Game Flow
1. Player calls `POST /api/games/sic-bo/place-bets` with `{betAmount, bets: [{type, amount, value?}]}`
2. Sub-bets validated to sum to total bet amount
3. Three dice rolled server-side
4. Each sub-bet evaluated against dice result
5. Total winnings credited to player's balance
6. History recorded with dice results and bet breakdown

## 📊 Progress Summary

| Phase | Status | Engines |
|-------|--------|---------|
| Phases 1-6 | Complete | 11 real engines (2,992 catalog entries) |
| **Part 2 - Hi-Lo** | ✅ **Complete** | **Hi-Lo engine** |
| **Part 2 - Sic Bo** | ✅ **Complete** | **Sic Bo engine** |
| Part 2 - Parameter Variants | ⏳ Pending | Crash growth rates, Wheel segments, etc. |
| Part 2 - Live-table migration | ⏳ Pending | 657 live-table games |

## 🔄 Next Steps (from Part 2, in order)

1. **✅ Hi-Lo** - DONE
2. **✅ Sic Bo** - DONE
3. **Real parameter-variants for existing engines**:
   - Crash: vary `CRASH_GROWTH_RATE` per catalog entry
   - Mines: vary `mineCount` via catalog config
   - Wheel: vary `WHEEL_SEGMENTS` per group
   - Plinko: vary `PLINKO_ROWS` (8/12/16)
   - Keno: vary `KENO_PAYTABLES` per entry
   - Each catalog entry needs `variant`/`config` field server-validated
4. **Migrate 657 live-table games** off client-trusted `/api/wallet/change`

## 🛠 Technical Details

- **TypeScript**: Both engines pass `npm run build` cleanly
- **Database migrations**: Idempotent `sql/schema.sql` - safe to re-run
- **Atomic transactions**: All balance updates use `BEGIN`/`COMMIT`/`ROLLBACK` pattern
- **History tracking**: All rounds logged to `game_history` and `wallet_transactions`
- **Security**: Server-authoritative outcomes - client cannot forge results

## 📁 Files Modified

1. `/home/yuvraj/Downloads/playvault-complete/backend/backend/sql/schema.sql` - Added `hilo_rounds` and `sic_rounds` tables
2. `/home/yuvraj/Downloads/playvault-complete/backend/backend/src/games.ts` - Added Hi-Lo and Sic Bo engine logic
3. `/home/yuvraj/vora/tulips-social-vault/Drafts/playvault-part2-completion.md` - This note

---
*Generated from PROJECT-HANDOFF.md Part 2 completion. Next: real parameter-variants for existing engines.*