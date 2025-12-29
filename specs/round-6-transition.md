# Round 6 Implementation Transition Spec

## Overview

The current Round 6 implementation is fundamentally incorrect. This document describes the required changes to align with the correct rules as documented in `specs/house-rules.md`.

## Current (Incorrect) Behavior

The current implementation treats Round 6 like Rounds 1–5 with a small modification:

1. Players can lay down the minimum contract (1 set + 2 runs = 11 cards)
2. Players become "down" and can lay off cards on subsequent turns
3. A "stuck" command exists for when a player has 1 card they can't lay off
4. Melds accumulate on the table from multiple players
5. Players who are "down" can only draw from stock

### Incorrect Code Locations

- **`harness/orchestrator.ts`**: Contains `stuck()` method that shouldn't exist
- **`harness/orchestrator.ts`**: `layDown()` allows partial contract in Round 6
- **`harness/orchestrator.ts`**: `layOff()` is allowed in Round 6
- **`harness/harness.types.ts`**: May have types related to "stuck" state
- **Turn machine**: Allows AWAITING_ACTION → lay off flow in Round 6
- **Round machine**: Allows "down" state in Round 6

## Correct Behavior

Round 6 is fundamentally different:

1. **No one is ever "down"** until someone wins
2. **Table stays empty** - no melds until victory
3. **Laying down requires ALL cards** (12+ cards after drawing)
4. **Laying down = going out** - they are the same action
5. **No laying off** - there are no melds to lay off to
6. **No Joker swapping** - there are no runs on the table
7. **No "stuck" state** - just discard and try again next turn
8. **All players can draw from discard** - no one is "down"
9. **All players can call May I?** - no one is "down"

### Turn Flow in Round 6

```
AWAITING_DRAW
    │
    ├── drawFromStock() ──► MAY_I_WINDOW ──► AWAITING_ACTION
    │                           │
    │                           └── (resolved) ──► AWAITING_ACTION
    │
    └── drawFromDiscard() ──► AWAITING_ACTION
                                    │
                                    ├── layDown(ALL cards) ──► ROUND_END (winner!)
                                    │
                                    └── skip() ──► AWAITING_DISCARD
                                                        │
                                                        └── discardCard() ──► next player
```

Key differences from Rounds 1–5:
- `layDown()` only succeeds if ALL cards form valid melds
- No AWAITING_DISCARD after layDown (because laying down = going out)
- No `layOff()` command available
- No `swap()` command available
- No `stuck()` command exists

## Required Changes

### 1. Remove "stuck" Command

**File:** `harness/orchestrator.ts`

- Delete the `stuck()` method entirely
- Remove any guards or state related to "stuck"
- Remove "stuck" from CLI help and commands

**File:** `harness/play.ts`

- Remove the `handleStuck()` function
- Remove "stuck" from the switch statement
- Remove from help text

### 2. Modify `layDown()` for Round 6

**File:** `harness/orchestrator.ts`

The `layDown()` method needs Round 6-specific logic:

```typescript
// In layDown():
if (currentRound === 6) {
  // Round 6: ALL cards must be used
  const totalCardsInMelds = meldGroups.flat().length;
  const playerHandSize = player.hand.length;

  if (totalCardsInMelds !== playerHandSize) {
    return {
      success: false,
      message: `Round 6 requires laying down ALL ${playerHandSize} cards. You specified ${totalCardsInMelds}.`,
      error: "round_6_incomplete"
    };
  }

  // If successful, this is also going out
  // Transition directly to ROUND_END, not AWAITING_DISCARD
}
```

### 3. Disable Lay Off in Round 6

**File:** `harness/orchestrator.ts`

```typescript
layOff(cardPos: number, meldNum: number): CommandResult {
  if (this.currentRound === 6) {
    return {
      success: false,
      message: "Laying off is not allowed in Round 6. You must lay down all cards at once.",
      error: "round_6_no_layoff"
    };
  }
  // ... existing logic
}
```

### 4. Disable Joker Swap in Round 6

**File:** `harness/orchestrator.ts`

```typescript
swap(meldNum: number, jokerPos: number, cardPos: number): CommandResult {
  if (this.currentRound === 6) {
    return {
      success: false,
      message: "Joker swapping is not allowed in Round 6 (no melds on table).",
      error: "round_6_no_swap"
    };
  }
  // ... existing logic
}
```

### 5. Allow Discard Draw for Everyone in Round 6

**File:** `harness/orchestrator.ts`

In Round 6, no one is ever "down", so the restriction on drawing from discard doesn't apply:

```typescript
drawFromDiscard(): CommandResult {
  // Existing check:
  // if (player.isDown) { return error }

  // Modify to:
  if (player.isDown && this.currentRound !== 6) {
    return {
      success: false,
      message: "Down players cannot draw from discard.",
      error: "down_player_discard"
    };
  }
  // Actually in Round 6, isDown should never be true, but defensive check is fine
}
```

### 6. Allow May I for Everyone in Round 6

**File:** `harness/orchestrator.ts`

Similar to above, the "down players can't May I" restriction doesn't apply in Round 6 because no one is ever down:

```typescript
callMayI(): CommandResult {
  // In Round 6, this check is moot because isDown is never true
  // But if we're being defensive:
  if (player.isDown && this.currentRound !== 6) {
    return error;
  }
}
```

### 7. Update State Machine Guards

**Files:** `core/engine/turn.machine.ts`, `core/engine/round.machine.ts`

Add guards that check for Round 6 and modify allowed transitions:

- `canLayOff`: false in Round 6
- `canSwap`: false in Round 6
- `layDownRequiresAllCards`: true in Round 6
- `layDownEndsRound`: true in Round 6 (no discard phase after)

### 8. Update Harness Rendering

**File:** `harness/harness.render.ts`

- Remove "stuck" from available commands
- In Round 6, don't show "layoff" or "swap" as options
- Update the Round 6 banner message to be more accurate

### 9. Update Tests

**File:** `harness/orchestrator.test.ts`

- Remove/update tests that use "stuck"
- Add tests for Round 6 specific behavior:
  - Test that layDown fails if not all cards used
  - Test that layDown succeeds and ends round when all cards used
  - Test that layOff returns error in Round 6
  - Test that swap returns error in Round 6
  - Test that all players can draw from discard in Round 6
  - Test that all players can May I in Round 6

## Validation Checklist

After implementation, verify:

- [ ] `stuck` command is completely removed
- [ ] Round 6 layDown requires ALL cards in hand
- [ ] Round 6 layDown immediately ends the round (no discard)
- [ ] Round 6 layOff returns an error
- [ ] Round 6 swap returns an error
- [ ] Round 6 all players can draw from discard
- [ ] Round 6 all players can call May I
- [ ] Round 6 table stays empty until someone wins
- [ ] Round 6 isDown is never true for any player
- [ ] May I penalty cards correctly increase required meld size
- [ ] Help text and CLI output updated

## Migration Notes

- Any saved games in Round 6 with the old behavior will be incompatible
- Consider adding a version check or migration path for saved states
- The `OrchestratorPhase` may not need changes, but verify ROUND_ACTIVE behavior

## Example: Correct Round 6 Victory

```
Round 6 - Player has 12 cards after drawing:
  3♠ 3♦ 3♥ | 5♣ 6♣ 7♣ 8♣ | 10♥ J♥ Q♥ K♥ A♥

Player calls: laydown "1,2,3" "4,5,6,7" "8,9,10,11,12"

Result:
  - Set: 3♠ 3♦ 3♥ (3 cards)
  - Run: 5♣ 6♣ 7♣ 8♣ (4 cards)
  - Run: 10♥ J♥ Q♥ K♥ A♥ (5 cards)
  - Total: 12 cards = ALL cards
  - Player wins immediately!
```

## Example: Correct Round 6 Non-Victory Turn

```
Round 6 - Player has 12 cards after drawing:
  3♠ 3♦ 3♥ | 5♣ 6♣ 7♣ 8♣ | 10♥ J♥ Q♥ K♥ | 2♠

Player cannot form 1 set + 2 runs using ALL 12 cards.
Player must skip laying down and discard one card.
Player discards 2♠ (strategic: high points but risky!)
Next player's turn.
```
