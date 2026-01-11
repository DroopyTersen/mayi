# Bug: Player Hands Not Resetting Between Rounds

**Status**: Fixed
**Severity**: High (game-breaking - incorrect card state)
**Component**: `app/party/party-game-adapter.ts`
**Related**: `specs/out-of-turn-reorder-race-condition.bug.md` (the fix for this bug introduced the current bug)

## Summary

When a round ends, sometimes a player's hand doesn't reset to freshly dealt cards. Instead, they keep the same cards they had at the end of the previous round (e.g., 2 cards instead of 11).

## Symptoms

1. Round N ends (player goes out by discarding their last card)
2. Round N+1 begins, cards are dealt
3. One player has their old hand from round N (e.g., 2 remaining cards) instead of 11 fresh cards
4. The bug is intermittent - does not happen every round

## Reported Instance

- Round 4 ended
- Player 2 (Human) started Round 5 with the same 2 cards she had at the end of Round 4
- Expected: Player 2 should have been dealt 11 fresh cards
- Cannot confirm who the current player was when the round ended

## Root Cause Analysis

### Primary Hypothesis: Merge Function Complete State Fallback

The `mergeAIStatePreservingOtherPlayerHands` function (introduced to fix the reorder race condition) has a dangerous fallback that returns the **entire stale state** when it can't find player data in the fresh state.

#### The Problem Code

`app/party/party-game-adapter.ts:107-179`:

```typescript
export function mergeAIStatePreservingOtherPlayerHands(
  freshState: StoredGameState | null,
  aiState: StoredGameState,
  currentPlayerEngineId: string
): StoredGameState {
  // ...

  // Navigate to players array in both snapshots
  const freshPlayers = freshSnapshot?.children?.round?.snapshot?.context?.players;
  const aiPlayers = aiSnapshot?.children?.round?.snapshot?.context?.players;

  // If we can't find players in both, fall back to AI state
  if (!freshPlayers || !aiPlayers || freshPlayers.length !== aiPlayers.length) {
    return aiState;  // <-- DANGEROUS: returns ENTIRE stale state for ALL players!
  }

  // NO ROUND NUMBER VALIDATION! <-- ALSO A BUG

  // ...
}
```

#### Why Human Players Are Affected

During a round transition, the `children.round` actor might be:
- Being destroyed (old round ending)
- Not yet fully initialized (new round starting)
- In "dealing" state before hands are populated

If `freshPlayers` is undefined during this transition window, the function returns `aiState` **entirely** - meaning **ALL players** (including humans) get stale hands from the old round!

#### Bug Timeline

```
T0: AI's turn - Round N is active
    - aiState = Round N data (all players have some cards)

T1: AI discards, triggers round end
    - Round N → scoring → roundEnd → Round N+1
    - New RoundMachine spawning, dealCards action queued

T2: Merge function runs (before dealCards completes)
    - freshState = Round N+1 BUT round actor mid-initialization
    - freshPlayers = undefined OR empty (actor not ready)
    - Validation fails: !freshPlayers
    - Fallback triggers: return aiState entirely

T3: ENTIRE stale Round N state saved
    - ALL players get stale hands (2 cards, etc.)
    - Human player 2 has 2 cards instead of 11
    - Game state is corrupted for EVERYONE
```

#### Important: Only Affects AI-Triggered Round Ends

- **Human ends round**: No bug - merge function not called (only runs during AI turns)
- **AI ends round**: Bug possible - merge runs and may fallback to stale state

### Why Human Player Could Be Affected

The merge function uses `currentPlayerEngineId` to determine which player's hand to preserve from `aiState`. This is the AI player whose turn is being executed.

However, if the round ends and transitions to a new round before the merge runs:
1. The new round has a NEW current player (next in turn order)
2. If that new current player happens to be a human, AND
3. The merge still uses the AI's engine ID as `currentPlayerEngineId`
4. Then the AI (now NOT current player in new round) gets fresh hand
5. But the snapshot structure could be inconsistent

**Alternative theory**: The bug might affect ANY player whose index matches `currentPlayerIndex` when the round numbers mismatch, due to how player indices work across rounds.

### Supporting Evidence

1. **Intermittent nature**: The bug only manifests when a round transition occurs during an AI turn's persist/completion
2. **Introduced with reorder fix**: This merge function was added in commit `746b615` to fix the reorder race condition
3. **No round validation**: The merge function doesn't compare `roundNumber` between fresh and AI states

## How Round Transitions Work (Context)

### Normal Round Transition Flow

```
[Round N Active]
  ↓ Player discards last card (wentOut = true)
[RoundMachine → scoring (final state)]
  ↓ invoke onDone
[GameMachine: roundEnd state]
  ↓ assign actions (update scores, history)
  ↓ always transition
[GameMachine: playing state]
  ↓ invoke new RoundMachine
[RoundMachine: dealing state]
  ↓ entry: dealCards (creates fresh hands)
[RoundMachine: active state]
  ↓ First player's turn begins
```

### Where Hands Live in XState Snapshot

```
snapshot
├── context.players          # Game-level: metadata only, empty hands
└── children
    └── round
        └── snapshot
            └── context
                ├── roundNumber    # Round identifier
                └── players        # Round-level: actual hands here
```

## Proposed Fixes

### Option 1: Prefer Fresh State on Mismatch/Error (Recommended)

Two key changes:
1. Check round numbers - if they differ, use `freshState` entirely
2. Change fallback behavior - if validation fails, prefer `freshState` over stale `aiState`

```typescript
export function mergeAIStatePreservingOtherPlayerHands(
  freshState: StoredGameState | null,
  aiState: StoredGameState,
  currentPlayerEngineId: string
): StoredGameState {
  // If no fresh state, use AI state (original behavior)
  if (!freshState) return aiState;

  const freshSnapshot = JSON.parse(freshState.engineSnapshot);
  const aiSnapshot = JSON.parse(aiState.engineSnapshot);

  // Get round numbers from both snapshots
  const freshRoundNumber = freshSnapshot?.children?.round?.snapshot?.context?.roundNumber;
  const aiRoundNumber = aiSnapshot?.children?.round?.snapshot?.context?.roundNumber;

  // If rounds differ, a transition occurred - use fresh state entirely
  // Fresh state has the newly dealt hands from the new round
  if (freshRoundNumber !== undefined && aiRoundNumber !== undefined &&
      freshRoundNumber !== aiRoundNumber) {
    return freshState;
  }

  // Navigate to players arrays
  const freshPlayers = freshSnapshot?.children?.round?.snapshot?.context?.players;
  const aiPlayers = aiSnapshot?.children?.round?.snapshot?.context?.players;

  // CHANGED: If we can't find valid players in fresh state, prefer fresh state
  // (it's from storage and more authoritative than stale AI adapter state)
  // Only proceed with merge if we have valid data in BOTH states
  if (!freshPlayers || !aiPlayers || freshPlayers.length !== aiPlayers.length) {
    return freshState;  // <-- Changed from aiState to freshState
  }

  // Same round, valid data - proceed with merge logic
  // ... rest of existing merge logic
}
```

**Pros**:
- Handles both round mismatch AND incomplete fresh state
- Fresh state is more authoritative (from storage)
- Simple changes to existing logic

**Cons**:
- If fresh state is somehow corrupt, we use it anyway (but this is safer than stale data)

### Option 2: Check Game Phase

Skip merge if game is in `ROUND_END` phase or if round actors don't match.

**Pros**: More explicit about game state
**Cons**: Phase detection in snapshots is complex

### Option 3: Skip Merge Entirely on Round Transition

Don't call merge at all when a round transition is detected (check before calling merge in ai-turn-coordinator).

**Pros**: Avoids the problem entirely
**Cons**: Requires changes in multiple places (coordinator + merge function)

## Files to Modify

1. **`app/party/party-game-adapter.ts`**
   - Add round number validation to `mergeAIStatePreservingOtherPlayerHands`

2. **`app/party/party-game-adapter.merge.test.ts`**
   - Add test case for round transition scenario

3. **`app/party/ai-turn-coordinator.reorder-race.test.ts`**
   - Add test case for round end during AI turn

## Test Cases Needed

1. **Round transition during AI turn**
   - AI's discard ends the round
   - Verify all players get fresh hands in new round

2. **Round transition detected by merge**
   - Fresh state is round N+1
   - AI state is round N
   - Verify fresh state is returned (not merged)

3. **Same round merge still works**
   - Both states are same round
   - Human reorders during AI turn
   - Verify reorder is preserved

## Related Issues

- `specs/out-of-turn-reorder-race-condition.bug.md` - The fix for this bug introduced the current bug
- The merge function was working correctly for its intended purpose (preserving reorders)
- It just didn't account for round transitions

## Reproduction Steps (Manual)

1. Start a 3-player game (1 human, 2 AI)
2. Play until late in a round when players have few cards
3. When an AI is about to go out (discard last card), watch for round transition
4. Check if all players have 11 cards in the new round
5. If any player has fewer cards (their old hand), bug reproduced

## Investigation Log

- 2025-01-09: Bug reported by user's mom during testing
- 2025-01-09: Root cause identified as missing round number validation in merge function
- 2025-01-10: Fix applied - Option 1 (Prefer Fresh State on Mismatch/Error)

## Fix Applied

**Option 1 (Prefer Fresh State on Mismatch/Error)** was implemented with two key changes:

### 1. Round Number Validation
Added check at the start of `mergeAIStatePreservingOtherPlayerHands` to compare round numbers:
- If `freshRoundNumber !== aiRoundNumber`, return `freshState` entirely
- This prevents stale hands from being merged when a round transition has occurred

### 2. Changed Fallback Behavior
All fallback cases now return `freshState` instead of `aiState`:
- Invalid/missing players array → return `freshState`
- Player count mismatch → return `freshState`
- Current player not found → return `freshState`

**Rationale**: `freshState` comes from storage and is more authoritative. When merge can't proceed safely, it's better to use the authoritative state than potentially stale AI adapter state.

### Files Modified
- `app/party/party-game-adapter.ts` - Updated merge function with round validation and new fallback behavior

### Tests Added
- `app/party/party-game-adapter.merge.test.ts`:
  - `returns fresh state when round numbers differ` - verifies round mismatch handling
  - `still merges when round numbers are the same` - verifies normal merge still works
  - `prefers fresh state when fallback conditions are met` - verifies new fallback behavior

### Test Coverage
All 2034 tests pass, including:
- All 10 merge function tests
- Reorder race condition test still passes (preserving the original fix)
