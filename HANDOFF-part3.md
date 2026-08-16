# PlayVault: Handoff for Next Session (Part 3)

This session fixed the issues found while reviewing Part 2's `games.ts`.
No new games were added — this was a bug-fix pass only.

## ✅ Fixed this session

1. **Roulette red/black double-payout bug (real exploit)** — number 19 was
   in *both* the red and black number lists, so a spin landing on 19 paid
   out red bets AND black bets simultaneously. A player betting both
   colors every spin could extract free money 1/37 of the time. Also: 36
   was wrongly classified as black instead of red, and 35 was missing
   from black entirely.
   **Fix:** colors are now derived from one canonical red list, black =
   everything else 1-36. Verified programmatically: 18 red / 18 black,
   zero overlap, all 36 numbers covered.

2. **Weak bet-amount validation on Sic Bo & Roulette** — these two
   endpoints used an ad-hoc `betAmount > 0` check instead of the shared
   `validateBet()` used by every other game, so they had no upper bound
   and didn't reject `NaN`/`Infinity`. Both now use `validateBet()`, and
   each individual sub-bet's amount is validated the same way. Sub-bet
   arrays are also capped at 50 entries (was unbounded).

3. **Split & corner roulette bets were fake** — they were coded to
   "simplify" a 2-number (split) or 4-number (corner) bet down to
   checking a single `value`, and only paid out if the winning number
   equaled that one value — at the *reduced* split/corner odds (17:1 /
   8:1) instead of a straight bet's 35:1. Net effect: these bet types
   quietly paid players less than a straight bet while offering none of
   the real multi-number coverage. **Fix:** disabled both bet types at
   the validation layer (`roulettePlaceBets` now rejects them with a
   clear error) rather than silently running broken math. Re-enabling
   them properly needs a schema change — see below.

4. **`sic_rounds` table / `sicBoSettle()` was dead code** — Sic Bo
   actually resolves in one shot inside `sicBoPlaceBets` (debit → roll →
   credit, one transaction), so it never writes to `sic_rounds`. The
   `sicBoSettle` endpoint can therefore never find an active round. Left
   the function in place (in case a route still points at it) but
   documented this clearly in the code. Recommend either wiring it up
   for real multi-step play, or deleting it + the table.

All changes verified with a clean `tsc --noEmit` (0 errors).

## ⏳ Still open — real follow-up work, not quick fixes

### A. Re-enable split & corner bets properly
Needs a schema change on the client + server:
```ts
interface RouletteSubBet {
  type: RouletteBetType;
  numbers?: number[]; // for split (2 numbers) / corner (4 numbers)
  value?: number;      // still used by straight/street/sixline/column/dozen
  amount: number;
}
```
Then `computeRoulettePayout` checks `numbers.includes(winningNumber)`.
This needs frontend changes too (whatever UI lets a player click a split
or corner needs to send both/four numbers) — can't be done blind from
the backend alone.

### B. Live-table migration (657 games) — the big one, unstarted beyond Roulette
These games still settle through the client-trusted `/api/wallet/change`
endpoint (client tells the server what to credit — a real forgeable-win
hole):

| Game | What it needs |
|---|---|
| Roulette | Payout logic exists in `games.ts`, but **the route still isn't registered in `server.ts`** — currently unreachable. Wire it up first; it's the closest to done. |
| Blackjack | New `blackjack_rounds` table, dealer-hit/stand logic, hand evaluation, split/double-down handling if supported |
| Baccarat | Banker/player third-card draw rules, hand evaluation |
| Teen Patti | Flush/sequence/pair hand ranking, blind vs seen betting if the original game has it |
| Game Show | Custom per-minigame verification — depends entirely on what the minigame actually does client-side today |
| Dice-table | Table limits + outcome authorization, similar pattern to the existing single-player Dice engine |

Suggested order: **Roulette route registration first** (cheap, already
written), then Blackjack (most standardized rules), then Baccarat, then
Teen Patti, then Dice-table, then Game Show last (most bespoke).

### C. Housekeeping
- 8 near-duplicate status/report `.md` files from Part 2 are still in
  this repo (`playvault-part2-*.md`). Worth consolidating into one or
  deleting before this goes further — they're just noise for anyone
  reading the repo later.
