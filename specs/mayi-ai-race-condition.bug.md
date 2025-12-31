# Bug: May-I Doesn't Work When Human Plays Against AI Players

## Summary

When a human player is playing against AI players, clicking "May I" to claim a discarded card doesn't work. The May-I call appears to be ignored or cancelled because the AI turn execution loop continues without waiting for potential May-I claims.

## Root Cause: Race Condition in AI Turn Loop

The `executeAITurnsIfNeeded()` loop in `mayi-room.ts` has a fundamental concurrency issue:

1. When an AI player discards, the state is broadcast to clients
2. The loop **immediately continues** to the next player's turn (no pause for May-I window)
3. If the next player is also an AI, their turn begins before a human can call May-I
4. Even if a human sends CALL_MAY_I, the AI's turn may already be in progress with **stale state**

### The Race Condition Timeline

```
Time    AI Turn Loop (async)              Human WebSocket Handler (concurrent)
─────   ──────────────────────────────    ─────────────────────────────────────
T0      AI 1 discards 7♠
T1      broadcastGameState()
T2      Loop checks: AI 2 is next         Human sees 7♠ in discard pile
T3      Load state (adapter created)
T4      Start AI 2 LLM call...            Human clicks "May I"
T5      (waiting for LLM ~2-5 sec)        New onMessage handler starts
T6      (waiting for LLM)                 Load state, apply CALL_MAY_I
T7      (waiting for LLM)                 Save state → RESOLVING_MAY_I
T8      LLM returns: "draw from stock"    (Human's May-I saved)
T9      Apply action to STALE adapter
T10     Save state → OVERWRITES May-I!
T11     AI 2's turn continues...          Human's May-I is lost
```

### Why This Happens

**File:** `app/party/mayi-room.ts`

```typescript
// Lines 821-874: executeAITurnsIfNeeded
while (turnsExecuted < MAX_CHAINED_TURNS) {
  const gameState = await this.getGameState();        // Load state
  const adapter = PartyGameAdapter.fromStoredState(gameState);

  const aiPlayer = isAIPlayerTurn(adapter);
  if (!aiPlayer) return;                              // Exit only if NOT AI turn

  // ... LLM call takes 2-5 seconds ...
  const result = await executeAITurn({ adapter, ... }); // Uses stale adapter

  await this.setGameState(adapter.getStoredState());  // Overwrites any concurrent changes
  await this.broadcastGameState();

  // Small delay (300ms) - NOT enough for human to react
  await new Promise((resolve) => setTimeout(resolve, 300));
}
```

**Problems:**

1. **No May-I window pause**: After an AI discards, the loop has only a 300ms delay before starting the next AI's turn. Humans need time to see the card and decide.

2. **Stale state during LLM call**: The adapter is loaded BEFORE the LLM call. If a human's May-I is processed during the LLM call (2-5 seconds), the AI's adapter doesn't see it.

3. **State overwrites**: When the AI turn completes, it saves its state unconditionally, potentially overwriting a May-I that was called during the LLM wait.

4. **No concurrency protection**: Multiple async operations can modify game state simultaneously without coordination.

---

## Reproduction Steps

1. Start a new game with 1 human + 2-3 AI players
2. Play until it's an AI player's turn
3. Watch the AI discard a card
4. **Quickly** click "May I" to claim the discarded card
5. **Observe:** The May-I either:
   - Doesn't register at all (UI doesn't respond)
   - Briefly shows "Resolving May I" then immediately continues to next turn
   - Gets cancelled as the next AI's turn starts

### Expected Behavior

1. AI discards a card
2. Game pauses with May-I window open for ~3-5 seconds
3. Human can click "May I" during this window
4. May-I resolution proceeds normally (prompting players in priority order)
5. After resolution (or timeout), next player's turn begins

### Actual Behavior

- AI discards → next AI's turn starts almost immediately
- Human's May-I click is either ignored or overwritten
- No meaningful window for human to claim the discard

---

## Technical Details

### Affected Files

| File | Issue |
|------|-------|
| `app/party/mayi-room.ts` | AI turn loop has no May-I window pause |
| `app/party/ai-turn-handler.ts` | `executeAITurn` uses adapter that may be stale |

### Relevant Code Sections

**AI Turn Loop** (`mayi-room.ts:821-874`):
- Loads adapter at start of each iteration
- No check for pending May-I opportunities
- 300ms delay is insufficient for human reaction

**Human Action Handler** (`mayi-room.ts:460-521`):
- Runs concurrently with AI turn loop
- Can modify state while AI LLM call is in progress
- No locking or coordination mechanism

**AI Turn Execution** (`ai-turn-handler.ts:383-476`):
- Takes 2-5 seconds for LLM response
- Uses adapter state from before LLM call
- Doesn't detect if game state changed during execution

---

## Proposed Solutions

### Option A: May-I Window with Timeout (Recommended)

After any player discards, enforce a May-I window:

```typescript
// After AI discards, pause for May-I window
if (actionWasDiscard) {
  await this.broadcastGameState(); // Show the discard

  // Wait for May-I window (3-5 seconds or until all players respond)
  const mayIWindow = await this.waitForMayIWindow({
    timeout: 4000,  // 4 second window
    skipDownPlayers: true,
  });

  // Only continue if no May-I was called
  if (mayIWindow.mayICalled) {
    // May-I resolution happens, don't continue AI loop
    return;
  }
}
```

**Pros:**
- Clear user expectation (always have time to call May-I)
- Matches physical card game timing
- Simple to understand

**Cons:**
- Slows down AI-only games
- Need timeout mechanism

### Option B: Optimistic Locking / State Versioning

Add version numbers to game state:

```typescript
interface StoredGameState {
  version: number;  // Incremented on every save
  // ... existing fields
}

// Before saving, check version hasn't changed
const currentState = await this.getGameState();
if (currentState.version !== adapter.getVersion()) {
  // State was modified during our operation - reload and retry or abort
  return { success: false, error: "state_conflict" };
}
```

**Pros:**
- Prevents state overwrites
- More general solution for concurrency

**Cons:**
- Need retry logic
- More complex implementation

### Option C: Serialize AI and Human Actions

Use a queue or lock to ensure only one operation modifies state at a time:

```typescript
private actionLock = new AsyncLock();

async handleGameAction(...) {
  await this.actionLock.acquire('game', async () => {
    // ... process action
  });
}

async executeAITurnsIfNeeded() {
  await this.actionLock.acquire('game', async () => {
    // ... execute AI turn
  });
}
```

**Pros:**
- Eliminates race conditions
- Predictable ordering

**Cons:**
- Can cause delays if lock is held too long
- LLM calls are slow (2-5s) - would block all human actions

### Option D: Hybrid Approach (Recommended)

Combine May-I window with stale state detection:

1. After any discard, broadcast state and start May-I window timer
2. AI turn loop waits for May-I window to close before proceeding
3. If human calls May-I during AI's LLM call, mark state as "dirty"
4. AI turn checks for dirty state before saving - if dirty, reload and re-evaluate

---

## Impact

**Severity:** High - Core game mechanic is broken in multiplayer AI games

**User Impact:**
- Humans cannot effectively use May-I against AI players
- Makes the game significantly harder for humans
- Frustrating experience as clicks seem to be ignored

**Workarounds:**
- None practical - the race condition is in server-side code
- Only "fix" is to not play with AI players

---

## Related Issues

- The same concurrency issue could affect other time-sensitive actions
- Consider auditing all places where AI turn loop interacts with human actions

## Test Cases for Fix

```typescript
describe("May-I with AI players", () => {
  it("should allow human to call May-I after AI discards", async () => {
    // Setup: Human + 2 AI players
    // AI 1 discards
    // Human sends CALL_MAY_I within 3 seconds
    // Assert: May-I resolution begins, AI 2's turn doesn't start yet
  });

  it("should wait for May-I window before starting next AI turn", async () => {
    // AI 1 discards
    // Assert: 3+ second delay before AI 2's turn starts
    // No May-I called
    // AI 2's turn begins after window closes
  });

  it("should handle May-I called during AI LLM call", async () => {
    // AI 1 discards
    // AI 2's turn starts (LLM call in progress)
    // Human calls May-I
    // Assert: AI 2's stale actions are discarded
    // May-I resolution proceeds correctly
  });

  it("should not overwrite May-I state when AI turn saves", async () => {
    // AI discards, human calls May-I
    // State is RESOLVING_MAY_I
    // Concurrent AI operation tries to save
    // Assert: May-I state is preserved
  });
});
```
