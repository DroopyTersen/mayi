# Implementation Fixes Spec

## Overview

This document describes bugs discovered during code review that need to be fixed. These are in addition to the Round 6 transition work documented in `specs/round-6-transition.md`.

---

## 1. May I "Take" Command Bug

### Current (Incorrect) Behavior

The `take()` command in `harness/orchestrator.ts` (lines 597-619) allows the current player to take the discard card AFTER they have already drawn from stock. The flow is:

1. Player is in `AWAITING_DRAW` phase
2. Player calls `drawFromStock()` → draws 1 card from stock
3. `drawFromStock()` calls `openMayIWindow()` (line 304)
4. Phase is now `MAY_I_WINDOW`
5. Player calls `take()` → gets the discard card too!
6. Player now has 2 extra cards (1 from stock + 1 from discard)

### Correct Behavior

Per `specs/house-rules.md` Section 7:

> "Once the current player draws from stock, they forfeit the right to veto any May I? calls on that discard."

The "veto" action is the current player choosing to draw from the discard pile INSTEAD of the stock pile. It is not a separate action that can occur after drawing from stock.

### Fix

The `take()` command should ONLY work during `MAY_I_WINDOW` phase when the current player has NOT yet completed their draw. Specifically:

```typescript
// In take():
if (this.harnessPhase !== "MAY_I_WINDOW") {
  return {
    success: false,
    message: "Take is only available during the May I window.",
    error: "wrong_phase"
  };
}

// The current player can only take if they initiated the May I window
// by drawing from stock. If they take, it replaces their stock draw.
// Actually, this means take() should:
// 1. Only work for the current turn player
// 2. Only work before they've drawn
// 3. When used, count as their draw action

// Better approach: Remove take() entirely.
// The current player vetoes by choosing drawFromDiscard() instead of drawFromStock().
// If they draw from stock first, they cannot veto - the May I window resolves normally.
```

**Recommended**: Remove the `take()` command entirely. The current player's "veto" is simply choosing `drawFromDiscard()` instead of `drawFromStock()` at the start of their turn. Once they draw from stock, they've forfeited veto rights.

### Files to Modify

- `harness/orchestrator.ts`: Remove or fix `take()` method
- `harness/play.ts`: Remove "take" command from CLI
- `docs/orchestrator.md`: Update May I Window documentation

---

## 2. Laying Down Exact Contract (Rounds 1-5)

### Current (Incorrect) Behavior

The `layDown()` method (lines 349-445) allows players to lay down extended melds. For example:
- In Round 1 (2 sets), a player could lay down a 4-card set (7♠ 7♦ 7♥ 7♣) instead of only 3 cards
- This means they can lay down 7+ cards when the minimum contract is 6

### Correct Behavior

Per user clarification:

> "In previous rounds you can't lay down more than the contract. You have to wait until the next turn to add additional cards to the meld."

This means:
- Sets in the initial laydown must be exactly 3 cards
- Runs in the initial laydown must be exactly 4 cards
- Even if you have cards that could extend your melds, you must lay down the minimum and wait for your next turn to lay off extras

### Fix

```typescript
// In layDown(), after building melds but before applying:
if (this.currentRound !== 6) {
  // Rounds 1-5: Melds must be minimum size only
  for (const meld of melds) {
    if (meld.type === "set" && meld.cards.length !== 3) {
      return {
        success: false,
        message: `Sets in the contract must be exactly 3 cards. You provided ${meld.cards.length} cards.`,
        error: "set_wrong_size"
      };
    }
    if (meld.type === "run" && meld.cards.length !== 4) {
      return {
        success: false,
        message: `Runs in the contract must be exactly 4 cards. You provided ${meld.cards.length} cards.`,
        error: "run_wrong_size"
      };
    }
  }
}
// Round 6: Melds can be any valid size since you must use ALL cards
```

### Files to Modify

- `harness/orchestrator.ts`: Add exact meld size validation in `layDown()` for Rounds 1-5
- `harness/orchestrator.test.ts`: Add tests for exact contract enforcement

---

## 3. Stock Auto-Replenishment

### Current (Incorrect) Behavior

The stock pile can become empty. When a player tries to draw and there are no cards, the game may error or behave incorrectly.

### Correct Behavior

Per `specs/house-rules.md` Section 11:

> "**The stock pile should never be empty.** When the last card is drawn from the stock:"
> 1. Immediately take the discard pile (except the top exposed card).
> 2. Shuffle those cards.
> 3. Place them face down as the new stock pile.
> 4. The exposed discard remains on the discard pile.

This should happen automatically, immediately after the last stock card is drawn.

### Fix

```typescript
// After any stock draw (including penalty cards):
private replenishStockIfNeeded(): void {
  if (this.stock.length === 0 && this.discard.length > 1) {
    // Keep the top discard exposed
    const exposedDiscard = this.discard.pop()!;

    // Take remaining discard pile
    const cardsToShuffle = [...this.discard];
    this.discard = [exposedDiscard];

    // Shuffle and make new stock
    this.stock = shuffle(cardsToShuffle);
  }
}

// Call this after:
// - drawFromStock()
// - Any May I penalty card draw
// - Any other stock draw
```

### Files to Modify

- `harness/orchestrator.ts`: Add `replenishStockIfNeeded()` helper, call it after all stock draws
- `harness/orchestrator.test.ts`: Add tests for stock replenishment

---

## 4. Wild Ratio Only Applies to Initial Laydown

### Current (Incorrect) Behavior

The layoff functions in `core/engine/layoff.ts` enforce wild ratio checks when laying off cards:

- `canLayOffToSet()` (lines 132-138): Rejects if wilds > naturals after adding card
- `canLayOffToRun()` (lines 241-247): Same check
- `getRunInsertPosition()` (lines 304-309): Same check

### Correct Behavior

Per user clarification:

> "The rule about the wild cards exceeding the number of normal cards no longer applies [when laying off]. The rule only applies to the initial meld where you're laying down. It does not apply to when you're playing on top of other melds that are already laid down."

Examples:
- A set of 7♠ 7♦ 2♥ can have another 2♣ added (2 naturals, 2 wilds) ✓
- That same meld can have another 2♦ added (2 naturals, 3 wilds) ✓

### Fix

Remove the wild ratio checks from all three layoff functions:

```typescript
// In canLayOffToSet(), canLayOffToRun(), getRunInsertPosition():
// DELETE these lines:
const newCards = [...meld.cards, card];
const { wilds, naturals } = countWildsAndNaturals(newCards);

if (wilds > naturals) {
  return false;  // or return null;
}
```

### Files to Modify

- `core/engine/layoff.ts`: Remove wild ratio checks from `canLayOffToSet()`, `canLayOffToRun()`, `getRunInsertPosition()`
- `core/engine/layoff.test.ts`: Update tests that expect wild ratio enforcement during layoff
- `harness/orchestrator.test.ts`: Remove/update any layoff wild ratio tests

---

## 5. Update orchestrator.md Documentation

### Changes Needed

1. Remove `stuck()` from the command list (per Round 6 transition spec)
2. Fix the May I Window section to clarify:
   - Current player's "veto" = drawing from discard instead of stock
   - No separate "take" action after drawing
3. Add note about exact contract in Rounds 1-5
4. Add note about automatic stock replenishment

---

## Validation Checklist

After implementation, verify:

- [ ] `take` command removed or properly restricted
- [ ] Rounds 1-5 `layDown()` rejects extra melds or cards (sets must be 3 cards, runs must be 4 cards)
- [ ] Stock automatically replenishes when empty
- [ ] May I window cannot give current player 2 cards
- [ ] Wild ratio NOT enforced during layoff (only during initial laydown)
- [ ] Can lay off wilds to melds even when wilds would outnumber naturals
- [ ] Documentation updated
- [ ] All existing tests pass
- [ ] New tests added for each fix

---

## Priority

1. **High**: May I "take" bug (can give player unfair advantage)
2. **High**: Round 6 transition (fundamentally broken - see separate spec)
3. **Medium**: Wild ratio on layoff (incorrectly blocks valid plays)
4. **Medium**: Exact contract enforcement (game still playable without it)
5. **Low**: Stock replenishment (rare edge case)
