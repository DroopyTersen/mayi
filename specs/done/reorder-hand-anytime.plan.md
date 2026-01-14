# Feature: Reorder Hand Anytime

**Goal:** Allow players to organize/reorder their hand at any time during a round, not just during their turn.

**Status:** Planning

---

## Problem Statement

Currently, the "Organize your hand" feature is only available during a player's turn because:

1. **State machine architecture**: `REORDER_HAND` is handled in `turn.machine.ts` in 3 states (`awaitingDraw`, `drawn`, `awaitingDiscard`)
2. **Turn machine lifecycle**: The turn actor is only active during the current player's turn - when it's not your turn, your turn actor doesn't exist
3. **UI gating**: Both CLI and web app only show the organize option when it's the player's turn

Players should be able to organize their hand while waiting for opponents to take their turn, as this is a common desire when planning strategy.

---

## Architecture Decision

### Chosen Approach: Handle at Round Level with SYNC_HAND

Move `REORDER_HAND` handling from turn machine to round machine, which exists for the entire round duration.

**Key Changes:**
1. Round machine handles `REORDER_HAND` directly (not forwarding to turn)
2. Round machine updates `context.players[playerId].hand`
3. If the reordering player is the current player (turn actor exists), sync via new `SYNC_HAND` event
4. Turn machine receives `SYNC_HAND` to stay in sync
5. Remove `REORDER_HAND` handling from turn machine states

**Why this approach:**
- Round context is already the source of truth for player hands
- Follows established `SYNC_PILES` pattern for round→turn synchronization
- Works when no turn actor exists (core requirement)
- Preserves reorders during your turn (SYNC_HAND keeps turn context in sync)

---

## Race Condition Analysis

### Scenario 1: User reorders while opponent adds cards to their hand (May I)
- User A is organizing their hand
- Opponent B completes May I resolution, giving User A penalty cards
- User A's `REORDER_HAND` arrives at server with old card IDs
- **Guard fails** (card count mismatch) - reorder silently rejected
- **Safe**: User sees new cards in UI, would need to organize again

### Scenario 2: Multiple rapid reorders
- User sends 3 reorder requests in quick succession
- Each one arrives at server and is processed atomically by XState
- Last one wins (each overwrites previous)
- **Safe**: No race condition, final state is consistent

### Scenario 3: Reorder during turn transition
- User A reorders their hand right as turn transitions to them
- Round machine is always active, processes reorder
- If turn actor just started, `SYNC_HAND` keeps it in sync
- **Safe**: Turn actor gets current hand state

### Scenario 4: Reorder during May I resolution
- User attempts to reorder during May I resolution phase
- Handler is in `playing` substate, not `resolvingMayI` substate
- **Blocked**: By design (per requirements)

### Scenario 5: Reorder between rounds
- User tries to reorder during `scoring` state
- Handler is in `active` state, `scoring` is a sibling
- **Blocked**: By design (can enable later if desired)

**Conclusion**: No dangerous race conditions. XState guards protect against invalid states.

---

## Implementation Plan

### Phase 1: Core State Machine Changes

#### 1.1 Turn Machine (`core/engine/turn.machine.ts`)

**Add SYNC_HAND event type (line ~76):**
```typescript
export type TurnEvent =
  | ... existing events ...
  | { type: "SYNC_HAND"; hand: Card[] };
```

**Add syncHand action (after line ~496):**
```typescript
syncHand: assign(({ event }) => {
  if (event.type !== "SYNC_HAND") return {};
  return { hand: event.hand };
}),
```

**Add global SYNC_HAND handler (line ~639):**
```typescript
on: {
  SYNC_PILES: { actions: "syncPiles" },
  SYNC_HAND: { actions: "syncHand" }, // NEW
},
```

**Remove REORDER_HAND handlers from states:**
- Delete lines 694-697 (awaitingDraw)
- Delete lines 744-747 (drawn)
- Delete lines 786-789 (awaitingDiscard)

**Keep but mark as unused:**
- `canReorderHand` guard (lines 359-375) - keep for reference
- `reorderHand` action (lines 593-609) - keep for reference
- `setReorderError` action (lines 610-633) - keep for reference

#### 1.2 Round Machine (`core/engine/round.machine.ts`)

**Add import (top of file):**
```typescript
import { reorderHand as reorderHandUtil } from "./hand.reordering";
```

**Add canReorderPlayerHand guard (after line ~216):**
```typescript
canReorderPlayerHand: ({ context, event }) => {
  if (event.type !== "REORDER_HAND") return false;
  const playerId = event.playerId;
  if (!playerId) return false;

  const player = context.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Validate using pure utility function
  const result = reorderHandUtil(player.hand, event.newOrder);
  return result.success;
},
```

**Add reorderPlayerHand action (after line ~445):**
```typescript
reorderPlayerHand: assign(({ context, event }) => {
  if (event.type !== "REORDER_HAND") return {};
  const playerId = event.playerId;
  if (!playerId) return {};

  const playerIndex = context.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return {};

  const player = context.players[playerIndex]!;
  const result = reorderHandUtil(player.hand, event.newOrder);
  if (!result.success) return {};

  return {
    players: context.players.map((p, i) =>
      i === playerIndex ? { ...p, hand: result.hand } : p
    ),
  };
}),
```

**Add syncTurnHand action (after reorderPlayerHand):**
```typescript
syncTurnHand: sendTo("turn", ({ context, event }) => {
  if (event.type !== "REORDER_HAND") {
    // Return no-op - shouldn't happen but type-safe
    return { type: "SYNC_PILES" as const, stock: context.stock, discard: context.discard };
  }

  const playerId = event.playerId;
  const currentPlayer = context.players[context.currentPlayerIndex];

  // Only sync if reorder is for the current player (turn actor exists)
  if (currentPlayer?.id === playerId) {
    const player = context.players.find((p) => p.id === playerId);
    if (player) {
      const result = reorderHandUtil(player.hand, event.newOrder);
      if (result.success) {
        return { type: "SYNC_HAND" as const, hand: result.hand };
      }
    }
  }

  // Not current player or invalid - return no-op sync
  return { type: "SYNC_PILES" as const, stock: context.stock, discard: context.discard };
}),
```

**Update REORDER_HAND handler in playing state (replace line 612):**
```typescript
// OLD:
REORDER_HAND: { actions: sendTo("turn", ({ event }) => event) },

// NEW:
REORDER_HAND: {
  guard: "canReorderPlayerHand",
  actions: ["reorderPlayerHand", "syncTurnHand"],
},
```

### Phase 2: Availability & UI Changes

#### 2.1 Game Engine Availability (`core/engine/game-engine.availability.ts`)

**Add canReorderHand to AvailableActions interface (after line ~35):**
```typescript
export interface AvailableActions {
  // ... existing fields ...
  /** Can reorder hand (available during round, not during May I resolution) */
  canReorderHand: boolean;
}
```

**Add canReorderHand logic to getAvailableActions (after line ~69, before phase checks):**
```typescript
// Hand reordering available during active round (any phase except May I resolution)
// Available for any player, not just current player
if (snapshot.phase === "ROUND_ACTIVE") {
  actions.canReorderHand = true;
}
```

**Update default value (line ~59-69):**
```typescript
const actions: AvailableActions = {
  // ... existing fields ...
  canReorderHand: false,
};
```

#### 2.2 Web App ActionBar (`app/ui/action-bar/ActionBar.tsx`)

**Add canReorderHand to destructured props (line ~34):**
```typescript
const {
  canDrawFromStock,
  canDrawFromDiscard,
  canLayDown,
  canLayOff,
  canSwapJoker,
  canDiscard,
  canMayI,
  canAllowMayI,
  canClaimMayI,
  canReorderHand, // NEW
} = availableActions;
```

**Replace isYourTurn-gated Organize button (lines 124-134):**
```typescript
// OLD:
{isYourTurn && (
  <Button onClick={() => onAction("organize")} variant="ghost" size="sm" className="ml-2">
    Organize
  </Button>
)}

// NEW:
{canReorderHand && (
  <Button onClick={() => onAction("organize")} variant="ghost" size="sm" className="ml-2">
    Organize
  </Button>
)}
```

#### 2.3 Web App HandDrawer (Mobile) (`app/ui/hand-drawer/HandDrawer.tsx`)

**No changes needed** - HandDrawer already renders ActionBar (line 189), so updating ActionBar automatically updates mobile.

#### 2.4 Protocol Types (`app/party/protocol.types.ts`)

No changes needed - `REORDER_HAND` already defined correctly.

#### 2.5 Game Actions Handler (`app/party/game-actions.ts`)

Already correct - `REORDER_HAND` is already exempt from turn check (line 41).

### Phase 3: CLI Changes

#### 3.1 Interactive Mode (`cli/interactive/interactive.ts`)

**Add organize option when waiting for other players.**

Currently organize is only offered in:
- `handleHumanDraw` (line 292)
- `handleHumanAction` (line 351)
- `handleDiscard` (line 505)

**Add new function to show organize option when not your turn:**
```typescript
async function handleWaitingForOpponents(state: GameSnapshot): Promise<void> {
  // Show hand and offer organize option while waiting
  const human = getHumanPlayer(state);
  printHand(human);
  console.log("");
  console.log("Waiting for other players...");
  console.log("");
  console.log("  1. Organize your hand");
  console.log("  2. Continue waiting");
  console.log("");

  const choice = await promptNumber("> ", 1, 2);
  if (choice === 1) {
    await handleOrganizeHand(state);
  }
}
```

**Update game loop to call this when waiting:**
In the main loop, when it's not the human's turn and not resolving May I, offer the organize option.

### Phase 4: Testing

#### 4.1 Unit Tests (`core/engine/round.machine.reorder.test.ts`) - NEW FILE

```typescript
import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("Round Machine - REORDER_HAND", () => {
  describe("during own turn", () => {
    it("allows reordering hand during AWAITING_DRAW phase", () => {
      // ... test implementation
    });

    it("allows reordering hand during AWAITING_ACTION phase", () => {
      // ... test implementation
    });

    it("allows reordering hand during AWAITING_DISCARD phase", () => {
      // ... test implementation
    });

    it("syncs reordered hand to turn machine", () => {
      // ... test implementation
    });
  });

  describe("during other player's turn", () => {
    it("allows non-current player to reorder their hand", () => {
      // ... test implementation
    });

    it("does not affect current player's turn state", () => {
      // ... test implementation
    });
  });

  describe("validation", () => {
    it("rejects reorder with wrong card IDs", () => {
      // ... test implementation
    });

    it("rejects reorder with duplicate card IDs", () => {
      // ... test implementation
    });

    it("rejects reorder with missing cards", () => {
      // ... test implementation
    });

    it("rejects reorder for non-existent player", () => {
      // ... test implementation
    });
  });

  describe("blocked scenarios", () => {
    it("does not allow reorder during May I resolution", () => {
      // ... test implementation
    });

    it("does not allow reorder between rounds", () => {
      // ... test implementation
    });
  });
});
```

#### 4.2 CLI Integration Tests

Run existing CLI tests to ensure no regressions:
```bash
bun test cli/
```

#### 4.3 Web App Tests via Claude in Chrome

**Test Plan:**
1. Start dev server (`bun run dev`)
2. Open game in browser
3. Navigate to a game where it's NOT your turn
4. Verify "Organize" button is visible
5. Click "Organize" and reorder hand
6. Verify reorder persists (refresh and check)
7. Wait for your turn
8. Verify organize still works during your turn
9. Verify organize is NOT available during May I resolution

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `core/engine/turn.machine.ts` | Add SYNC_HAND event + handler, remove REORDER_HAND from states |
| `core/engine/round.machine.ts` | Add guard, action, sync action, update handler |
| `core/engine/game-engine.availability.ts` | Add canReorderHand to interface and logic |
| `app/ui/action-bar/ActionBar.tsx` | Use canReorderHand instead of isYourTurn |
| `app/ui/hand-drawer/HandDrawer.tsx` | No changes (uses ActionBar) |
| `cli/interactive/interactive.ts` | Add organize option when waiting |
| `core/engine/round.machine.reorder.test.ts` | NEW: Unit tests for round-level reorder |

---

## Rollback Plan

If issues arise:
1. Revert round.machine.ts changes (restore `sendTo("turn")` forwarding)
2. Revert turn.machine.ts changes (restore REORDER_HAND handlers in states)
3. Revert UI changes (restore `isYourTurn` gating)

The feature is isolated and can be safely reverted.

---

## Future Enhancements

1. **Enable during May I resolution** - Could allow if desired, just need to move handler to parent `active` state
2. **Enable between rounds** - Could allow during scoring phase if desired
3. **Optimistic UI updates** - Currently UI waits for server response; could update immediately and reconcile

---

## Approval Checklist

- [ ] Architecture approach approved
- [ ] Race condition analysis reviewed
- [ ] File changes reviewed
- [ ] Test plan approved
- [ ] Ready to implement
