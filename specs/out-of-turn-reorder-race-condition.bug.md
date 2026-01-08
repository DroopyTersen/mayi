# Bug: Out-of-Turn Hand Reorder Race Condition

**Status**: Fixed
**Severity**: Medium (UX bug, not data corruption)
**Component**: `app/party/ai-turn-coordinator.ts`
**Related**: `app/party/mayi-room.ts`, `app/party/party-game-adapter.ts`

## Summary

When a player reorders their hand while another player (especially AI) is taking their turn, the reorder appears to work initially but then "blips" back to the original order when the current player's turn completes.

## Symptoms

1. Player clicks "Organize" while waiting for opponent's turn
2. Hand reorders successfully - UI updates to show new card order
3. Opponent (AI or human) completes an action (draw, lay down, discard)
4. Player's hand suddenly reverts to the pre-reorder order
5. UI "blips" between old and new order

## Root Cause

**State overwrite race condition in AI turn coordinator.**

The AI turn coordinator loads game state at the START of an AI turn, creates an adapter from that state, then saves the entire adapter state when the turn completes. Any changes made by other players during the AI turn are lost.

### Timeline of the Bug

```
T0: AI turn starts
    - AITurnCoordinator.executeAITurnsIfNeeded() called
    - Loads state A from storage: getState()
    - Creates adapter from state A

T1: Human reorders hand (during AI turn)
    - handleGameAction() receives REORDER_HAND
    - Loads state A, applies reorder → state B
    - Saves state B to storage
    - Broadcasts state B to all clients
    - UI shows reordered hand ✓

T2: AI completes turn
    - AI adapter (based on state A) finishes actions
    - Calls setState(adapter.getStoredState())
    - Adapter state is A' (A + AI's changes, NO human reorder)
    - State B is OVERWRITTEN with A'
    - Broadcasts A' to all clients
    - UI reverts to original hand order ✗
```

### Code Location

**`app/party/ai-turn-coordinator.ts:176-179`** (onPersist callback):
```typescript
onPersist: async () => {
  // Persist after each tool call
  await this.deps.setState(adapter.getStoredState());  // ← Overwrites ALL state
  await this.deps.broadcast();
},
```

**`app/party/ai-turn-coordinator.ts:200-201`** (turn completion):
```typescript
// Normal completion - save final state
await this.deps.setState(adapter.getStoredState());  // ← Overwrites ALL state
```

The problem: `adapter.getStoredState()` returns the ENTIRE game state as it was when the adapter was created, plus any changes the AI made. It does NOT incorporate changes made to storage by other players during the AI turn.

## Reproduction

### Manual Steps

1. Start a 3-player game (1 human, 2 AI)
2. Wait for it to be an AI player's turn
3. While AI is "thinking", click Organize and reorder your hand
4. Observe hand reorders correctly
5. Wait for AI to complete their action
6. Observe hand reverts to original order

### Automated Test

A failing test exists at:
```
app/party/ai-turn-coordinator.reorder-race.test.ts
```

Run with:
```bash
bun test app/party/ai-turn-coordinator.reorder-race.test.ts
```

The test:
1. Creates a game where it's an AI's turn
2. Simulates human reorder during AI's executeAITurn callback
3. Verifies human's reorder is saved to storage
4. AI completes turn and saves
5. Asserts human's hand is still reordered → **FAILS**

## Engine Tests Pass

Importantly, the game ENGINE correctly handles out-of-turn reorders:

```bash
bun test core/engine/round.machine.reorder-race.test.ts  # All pass
```

This confirms the bug is in the **web app layer** (PartyKit room / AI coordinator), not the game engine.

## Affected Scenarios

| Scenario | Bug Occurs? |
|----------|-------------|
| Human reorders during own turn | No |
| Human reorders during human opponent's turn | Unlikely (turns are fast) |
| Human reorders during AI opponent's turn | **Yes** (AI turns take seconds) |
| Multiple humans reorder during AI turn | **Yes** (all reorders lost) |

## Proposed Fixes

### Option 1: Selective State Merge (Recommended)

Only update fields that the AI turn actually changed when saving:

```typescript
// Instead of:
await this.deps.setState(adapter.getStoredState());

// Do:
const freshState = await this.deps.getState();
const aiChanges = adapter.getStoredState();

// Merge: use AI's changes for current player + game state,
// but preserve other players' hands from freshState
const mergedState = mergeGameState(freshState, aiChanges, {
  preserveNonCurrentPlayerHands: true
});
await this.deps.setState(mergedState);
```

**Pros**: Surgical fix, only affects AI coordinator
**Cons**: Need to implement merge logic, potential for subtle bugs

### Option 2: Optimistic Locking / Version Check

Add a version number to game state. Reject writes if version doesn't match:

```typescript
interface StoredGameState {
  version: number;  // Increment on every save
  // ... existing fields
}

// On save:
const currentVersion = (await this.deps.getState())?.version ?? 0;
if (adapter.version !== currentVersion) {
  // State changed during AI turn - reload and retry or merge
}
```

**Pros**: Standard concurrency pattern, catches all conflicts
**Cons**: More complex, need retry/merge logic anyway

### Option 3: Lock During AI Turn

Prevent other state changes while AI is executing:

```typescript
// In handleGameAction:
if (this.getAICoordinator().isRunning() && action.type === "REORDER_HAND") {
  // Queue the reorder to apply after AI turn completes
  this.pendingReorders.push({ playerId, cardIds });
  return; // Don't apply now
}
```

**Pros**: Simple, avoids race entirely
**Cons**: Bad UX (user's action is delayed), feels unresponsive

### Option 4: Per-Player State Isolation

Store each player's hand separately from main game state:

```typescript
// Storage keys:
// "game:state" - game state (stock, discard, table, turn info)
// "player:p1:hand" - Player 1's hand
// "player:p2:hand" - Player 2's hand
// etc.

// Reorder only touches player's own hand key
// AI turn only touches game state + current player's hand key
```

**Pros**: Complete isolation, no conflicts possible
**Cons**: Major refactor, complicates snapshot assembly

## Recommended Fix

**Option 1 (Selective State Merge)** is recommended because:

1. Minimal code changes (localized to AI coordinator)
2. No UX degradation (reorder still instant)
3. No architectural changes (same storage model)
4. Clear merge semantics (AI changes game state, preserve other hands)

### Implementation Sketch

```typescript
// In ai-turn-coordinator.ts

async function mergeAndSave(
  adapter: PartyGameAdapter,
  getState: () => Promise<StoredGameState | null>
): Promise<void> {
  const fresh = await getState();
  if (!fresh) return;

  const aiState = adapter.getStoredState();
  const aiSnapshot = JSON.parse(aiState.engineSnapshot);
  const freshSnapshot = JSON.parse(fresh.engineSnapshot);

  // Get current player ID from AI's turn
  const currentPlayerId = aiSnapshot.context?.children?.round?.snapshot?.context?.currentPlayerIndex;

  // Merge: AI's snapshot, but with fresh hands for non-current players
  const mergedSnapshot = {
    ...aiSnapshot,
    context: {
      ...aiSnapshot.context,
      children: {
        ...aiSnapshot.context?.children,
        round: {
          ...aiSnapshot.context?.children?.round,
          snapshot: {
            ...aiSnapshot.context?.children?.round?.snapshot,
            context: {
              ...aiSnapshot.context?.children?.round?.snapshot?.context,
              players: aiSnapshot.context?.children?.round?.snapshot?.context?.players?.map(
                (player: any, index: number) => {
                  if (index === currentPlayerId) {
                    return player; // Use AI's version for current player
                  }
                  // Use fresh version for other players (preserves reorders)
                  return freshSnapshot.context?.children?.round?.snapshot?.context?.players?.[index] ?? player;
                }
              ),
            },
          },
        },
      },
    },
  };

  await this.deps.setState({
    ...aiState,
    engineSnapshot: JSON.stringify(mergedSnapshot),
  });
}
```

## Files to Modify

1. **`app/party/ai-turn-coordinator.ts`**
   - Add merge logic before setState calls
   - Pass getState to onPersist callback

2. **`app/party/ai-turn-coordinator.test.ts`**
   - Add test for merge behavior

3. **`app/party/ai-turn-coordinator.reorder-race.test.ts`**
   - Update test to expect PASS after fix

## Related Issues

- This bug may also affect other "free actions" if we add any in the future
- Similar race could occur if two humans act simultaneously (less likely due to turn structure)

## Fix Applied

**Option 1 (Selective State Merge)** was implemented:

1. Added `mergeAIStatePreservingOtherPlayerHands()` function to `party-game-adapter.ts`
2. Modified `ai-turn-coordinator.ts` to use the merge function when saving state

The merge function:
- Takes the fresh state from storage (which may include human reorders)
- Takes the AI's adapter state (which has AI's game actions)
- Preserves non-current players' hands from the fresh state
- Uses the current AI player's hand from the AI state
- XState v5 stores player hands at `snapshot.children.round.snapshot.context.players`

Files modified:
- `app/party/party-game-adapter.ts` - Added merge function
- `app/party/ai-turn-coordinator.ts` - Uses merge function in onPersist and turn completion

## Test Coverage Added

| File | Tests |
|------|-------|
| `core/engine/round.machine.reorder.test.ts` | 11 tests for engine-level reorder |
| `core/engine/round.machine.reorder-race.test.ts` | 5 tests for engine race conditions (all pass) |
| `app/party/ai-turn-coordinator.reorder-race.test.ts` | 1 test for coordinator race (now PASSES) |
| `app/party/party-game-adapter.merge.test.ts` | 6 tests for the merge function |
