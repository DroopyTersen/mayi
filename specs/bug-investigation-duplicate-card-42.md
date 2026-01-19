# Bug Investigation: Duplicate card-42 (J♠) after draw from discard

**Status:** Under investigation
**Date:** 2025-01-18
**Bug ID:** Issue #42 candidate

## Bug Description

In an all-human game (Kate, Curt, Jane), Round 1, first turn:
1. Kate drew J♠ (card-42) from the discard pile
2. J♠ appeared in Kate's hand (correct)
3. J♠ ALSO remained visible in the discard pile (bug)
4. When Kate tried to discard, the server detected duplicate card IDs
5. Error: "Action failed: Duplicate card IDs detected: card-42"

## Key Observations

- **No AI players**: All 3 players were human
- **First turn of Round 1**: Very first draw action in a new game
- **Card duplication**: The same card appeared in two places (hand + discard)
- **Server-side detection**: The duplicate was detected by `extractGameSnapshot` on the server
- **Kate had 12 cards**: Correctly drew (11 dealt + 1 drawn)

## Architecture Understanding

### State Flow (Normal)
```
Client sends GAME_ACTION (drawFromDiscard)
    ↓
Server: MayIRoom.handleGameAction()
    ↓
Server: PartyGameAdapter.drawFromDiscard()
    ↓
Server: GameEngine.drawFromDiscard()
    ↓
Server: turnMachine assigns new context (card removed from discard, added to hand)
    ↓
Server: PartyGameAdapter.getStoredState() → persists to Durable Object
    ↓
Server: broadcastGameState() → sends to all connected clients
```

### Key Finding: Dual Context Architecture

The game uses nested XState actors with separate contexts:

1. **RoundMachine context** (`roundContext`)
   - `stock`, `discard`, `table`, `players[].hand`
   - Updated when turn ENDS (via `onDone` handler)

2. **TurnMachine context** (`turnContext`)
   - `stock`, `discard`, `hand`, `table`
   - Updated DURING the turn (immediately on draw/discard)

When `drawFromDiscard` runs:
```typescript
// turn.machine.ts
drawFromDiscard: assign({
  hand: ({ context }) => [...context.hand, context.discard[0]!],
  discard: ({ context }) => context.discard.slice(1),  // Card removed HERE
  hasDrawn: () => true,
}),
```

But `roundContext.discard` still has the OLD pile until turn ends.

### Snapshot Extraction Uses Fallback Pattern

```typescript
// game-engine.ts extractGameSnapshot()
const discard = turnContext?.discard ?? roundContext?.discard ?? [];
```

This SHOULD work: prefer turnContext, fall back to roundContext.

## Hypotheses

### ❌ Hypothesis 1: AI State Merge Race Condition
**Ruled out**: No AI players in this game. `mergeAIStatePreservingOtherPlayerHands` was never called.

### ❌ Hypothesis 2: Connection Sync Issue (Jane's spotty connection)
**Ruled out**: Client state CANNOT affect server state. Server is authoritative.
- Clients only send actions
- Server processes and broadcasts
- No client-to-server state merging for human games

### 🔍 Hypothesis 3: XState Persistence Gap (Under Investigation)
The issue may be in how XState v5 persists nested actor state.

When `getPersistedSnapshot()` is called:
- Is `turnContext.discard` always populated after `drawFromDiscard`?
- Could there be a race between action execution and snapshot serialization?

**Tests pass** for this scenario in isolation:
- `game-engine.turn-context-discard.test.ts` ✅
- `game-engine.draw-discard-persistence.test.ts` ✅
- `party-game-adapter.draw-discard.test.ts` ✅

### 🔍 Hypothesis 4: Durable Object Storage Race
Possibility: The Durable Object might be serving a stale snapshot in certain timing conditions.

PartyKit flow:
1. `setGameState(newState)` → `ctx.storage.put()`
2. `broadcastGameState()` → `ctx.storage.get()` → sends to clients

If these aren't atomic, could a read return stale data?

### 🔍 Hypothesis 5: WebSocket Broadcast Timing
The broadcast happens AFTER persistence. But what if:
1. Client A's action is processed
2. State is persisted
3. Before broadcast completes, state is read again for another purpose
4. Old cached value is used?

This seems unlikely given Durable Object guarantees.

## Tests Created

1. **`game-engine.turn-context-discard.test.ts`**
   - Verifies `turnContext.discard` is populated after draw
   - ✅ Passes

2. **`game-engine.draw-discard-persistence.test.ts`**
   - Tests save/restore cycles maintain correct discard state
   - ✅ Passes

3. **`party-game-adapter.draw-discard.test.ts`**
   - Tests through the adapter layer
   - ✅ Passes

4. **`party-game-adapter.merge.test.ts`** (pile-to-pile duplicates)
   - Added tests for stock-discard overlap detection in merge function
   - ✅ Passes (but only relevant for AI games)

## Code Changes Made

### 1. Duplicate Detection Converted to Warning
Changed from throwing error to logging warning, allowing game to continue:
```typescript
// game-engine.ts
if (duplicateIds.length > 0) {
  console.warn(`[GameEngine] Duplicate card IDs detected: ${duplicateIds.join(", ")}`);
  // Game continues but state may be corrupted
}
```

### 2. Pile-to-Pile Duplicate Detection in Merge
Added safeguard to `mergeAIStatePreservingOtherPlayerHands` to detect stock-discard overlap:
```typescript
// party-game-adapter.ts
const hasStockDiscardOverlap = [...stockCardIds].some((id) => discardCardIds.has(id));
if (hasStockDiscardOverlap) return freshState;
```

**Note:** This only helps AI games, not the reported all-human bug.

## Remaining Questions

1. **How did the duplicate occur?** The exact code path that caused `turnContext.discard` to have the wrong value (or fall back to `roundContext.discard`) is still unknown.

2. **Is this reproducible?** We haven't been able to reproduce the bug in tests.

3. **Was the bug a one-time glitch?** Could be a rare timing issue that's hard to trigger.

## Recommended Next Steps

1. **Add server-side logging**: Log the raw persisted snapshot structure when duplicate is detected, to see which context the discard came from.

2. **Add XState version check**: Ensure XState v5 snapshot format hasn't changed.

3. **Monitor production**: With duplicate detection now a warning instead of error, collect more data about when/how it occurs.

4. **Consider defensive copy**: When spawning turnMachine, deep-copy the discard array instead of passing by reference.

## Files Involved

- `core/engine/game-engine.ts` - extractGameSnapshot, duplicate detection
- `core/engine/turn.machine.ts` - drawFromDiscard action
- `core/engine/round.machine.ts` - turn invocation, context initialization
- `app/party/party-game-adapter.ts` - mergeAIStatePreservingOtherPlayerHands
- `app/party/mayi-room.ts` - handleGameAction, broadcastGameState
