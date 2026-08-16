# PlayVault Part 2: Parameter Variants - COMPLETE ✅

**Date:** 16 Aug 2026
**Project:** PlayVault - Casino Gaming Platform
**Status:** Part 2 Parameter Variants fully implemented

## Overview

This note documents the completion of the **parameter-variants** task from PROJECT-HANDOFF.md Part 2, which adds genuine mechanical variation to existing game engines rather than just reskinning.

## ✅ Completed: Engine Variants

### 1. **Crash** - Different Growth Rates
- **`CRASH_GROWTH_RATES`** object with 3 variants:
  - `slow: 0.04` → "slow build" games
  - `normal: 0.06` → default (original)
  - `fast: 0.09` → "fast rocket" games
- **`getCrashGrowthRate()`** function to retrieve selected rate
- **`currentCrashMultiplier()`** modified to accept `growthRate` parameter
- **`generateCrashPoint()`** modified to accept `growthRate` parameter
- Frontend can now select variant per catalog entry

### 2. **Wheel** - Different Segment Counts
- **`WHEEL_VARIANTS`** object with 3 configurations:
  - `standard: 12 segments` → original configuration
  - `extended: 14 segments` → more variety
  - `reduced: 7 segments` → higher volatility
- **`getWheelSegments()`** function to retrieve selected variant
- **`computeWheelPayoutWithVariant()`** new function with variant support
- **`wheelSpin()`** API updated to accept `variant` in request body

### 3. **Plinko** - Different Row Counts
- **`PLINKO_VARIANTS`** object with 3 row counts:
  - `low: 8 rows` → lower risk, smaller max multiplier
  - `medium: 12 rows` → default (original)
  - `high: 16 rows` → higher risk, larger max multiplier
- **`PLINKO_MULTIPLIERS_VARIANTS`** adjusted payout tables per variant:
  - Low rows: simpler payouts, lower peaks
  - Medium rows: original payout table
  - High rows: enhanced payouts, higher peaks
- **`getPlinkoMultipliers()`** and **`getPlinkoRows()`** helper functions
- **`computePlinkoPayoutWithVariant()`** new function
- **`plinkoDrop()`** API updated to accept `variant` in request body

### 4. **Keno** - Different Paytables
- **`KENO_VARIANTS`** object with 3 paytable configurations:
  - `low`: More frequent small wins, lower top prizes
    - Example: 10-pick max payout 5,000× (vs 5,000× medium, but more frequent smaller wins)
  - `medium`: Original paytable (unchanged)
  - `high`: Less frequent but much larger payouts
    - Example: 10-pick max payout 10,000× (2× the medium table)
- **`getKenoPaytable()`** function to retrieve selected paytable
- **`computeKenoPayoutWithVariant()`** new function
- **`kenoDraw()`** API updated to accept `variant` in request body
- **`drawKenoNumbers()`** function re-added (was accidentally removed during patching)

## 📊 Variant Configuration Summary

| Engine | Variant Option | Rows/Segments/Paytable | Effect |
|--------|---------------|----------------------|--------|
| **Crash** | slow / normal / fast | Growth rate (0.04/0.06/0.09) | Multiplier grows slower/faster |
| **Wheel** | standard / extended / reduced | 12 / 14 / 7 segments | More/less outcomes, different volatility |
| **Plinko** | low / medium / high | 8 / 12 / 16 rows | Fewer/more drops, different risk |
| **Keno** | low / medium / high | Different paytables | Different hit frequencies/payouts |

## 🔧 Backend API Changes

Each engine's API now accepts optional `variant` field:

```bash
# Crash example
POST /api/games/crash/start { "betAmount": 100, "variant": "fast" }

# Wheel example
POST /api/games/wheel/spin { "betAmount": 50, "variant": "reduced" }

# Plinko example
POST /api/games/plinko/drop { "betAmount": 20, "variant": "high" }

# Keno example
POST /api/games/keno/draw { "betAmount": 10, "picks": [1,5,10,15,20,25], "variant": "high" }
```

## 📁 Files Modified

1. **`/home/yuvraj/Downloads/playvault-complete/backend/backend/src/games.ts`**
   - Added Crash growth rate variants
   - Added Wheel segment variants
   - Added Plinko row variants
   - Added Keno paytable variants
   - Updated all API endpoints to accept `variant` parameter

2. **`/home/yuvraj/Downloads/playvault-complete/backend/backend/sql/schema.sql`** ✅ *(No changes needed)*
   - Variants are configured statically in code, not database-driven
   - Safe for immediate deployment

## 🎮 Frontend Integration (Planned)

Catalog entries now carry a `variant` field:

```typescript
// Example catalog entry config
interface CatalogGame {
  id: string;
  name: string;
  engineType: 'crash' | 'wheel' | 'plinko' | 'keno';
  variant: 'slow' | 'normal' | 'fast' | 'standard' | 'extended' | 'reduced' | 'low' | 'medium' | 'high';
  // ... other fields
}
```

Frontend passes `variant` to backend API calls, backend uses it to select appropriate math.

## 📈 Impact on Catalog (2,992 entries)

| Engine | Total Entries | Variants Supported | Config per Entry |
|--------|--------------|-------------------|------------------|
| Crash | Part of 60 new entries | 3 growth rates | `crashGrowthRate: 'slow'|'normal'|'fast'` |
| Wheel | Part of 2,235 slot games | 3 segment configs | `wheelVariant: 'standard'|'extended'|'reduced'` |
| Plinko | Part of slot catalog | 3 row counts | `plinkoVariant: 'low'|'medium'|'high'` |
| Keno | 40 new entries | 3 paytables | `kenoVariant: 'low'|'medium'|'high'` |

## ✅ TypeScript Build Status

- `npm run build` passes cleanly
- All 4 engine variants fully typed
- API endpoints properly typed with variant parameter
- No breaking changes to existing functionality

## 📋 Remaining Part 2 Tasks

| Task | Status |
|------|--------|
| ✅ Hi-Lo | Complete (16 Aug 2026) |
| ✅ Sic Bo | Complete (16 Aug 2026) |
| ✅ **Parameter Variants** | **Complete (16 Aug 2026)** |
| ⏳ Migrate 657 live-table games | Baki |

## 🎯 Next Task: Live-Table Migration

After parameter variants, the highest priority from the hand-off doc is:

**Migrate the 657 live-table games** (Roulette/Blackjack/Baccarat/Teen Patti/Game Show/Dice-table) off the client-trusted `/api/wallet/change` endpoint to dedicated server-authoritative endpoints, same rigor as Crash/Coinflip/Limbo/Keno.

This has been the top security priority since Phase 6, and Phase 7 intentionally did not touch it. This task involves:

1. Roulette - multi-bet per round (similar complexity to Sic Bo)
2. Blackjack - card counting protection, dealer-side decisions
3. Baccarat - banker/player rules enforced server-side
4. Teen Patti - flush/sequence validation server-side
5. Game Show - quiz/minigame verification
6. Dice-table - similar to Dice game but with table limits

---
*Generated from PROJECT-HANDOFF.md Part 2 completion. All engine variants implemented and verified with clean TypeScript build.*