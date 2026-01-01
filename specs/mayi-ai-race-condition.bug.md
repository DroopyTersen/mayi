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

## Solution: AbortController + Immediate Persistence

The fix requires two coordinated changes:

1. **Abort the AI agent loop when May-I is called** - Use an `AbortController` to interrupt the LLM call
2. **Persist state after each tool call** - Ensure partial progress (e.g., AI already drew) is saved before abort

### Why This Approach Works

The AI agent uses Vercel AI SDK's `generateText()` which supports an `abortSignal` parameter. When a human calls May-I:

1. We abort the in-flight LLM call immediately
2. Any tool calls already executed are already persisted
3. May-I resolution proceeds with consistent state
4. After resolution, the AI turn loop restarts and sees the correct mid-turn state

### Corrected Timeline

```
Time    AI Turn                           Game State                    Human
────────────────────────────────────────────────────────────────────────────
T0      Load state                        turnPhase: AWAITING_DRAW
T1      LLM: "draw from stock"
T2      Tool: drawCard() executes
T3      **Persist state immediately**     turnPhase: AWAITING_ACTION
T4      LLM thinking about next action... (drawn card in hand)
T5                                                                      May-I clicked!
T6      AbortController.abort()
T7      Agent loop stops cleanly
T8                                        → RESOLVING_MAY_I
T9      May-I resolution prompts...
T10     Resolution complete               → ROUND_ACTIVE
T11     Re-check: is it AI's turn?        turnPhase: AWAITING_ACTION
T12     Start NEW agent loop              (AI already drew)
T13     LLM: "discard 5♠"
T14     Tool: discard(), persist          → next player's turn
```

### Implementation Details

#### 1. Thread `abortSignal` through the call chain

```typescript
// ai/mayIAgent.ts - executeTurn()
export async function executeTurn(config: ExecuteTurnConfig): Promise<ExecuteTurnResult> {
  const {
    // ...existing
    abortSignal,      // NEW: AbortSignal to cancel LLM call
    onPersist,        // NEW: Called after each tool execution
  } = config;

  const result = await generateText({
    // ...existing
    abortSignal,      // Vercel AI SDK supports this natively
    onStepFinish: (step) => {
      // ...existing logging

      // NEW: Persist after tool results
      if (step.toolResults && step.toolResults.length > 0) {
        onPersist?.();
      }
    },
  });
}
```

#### 2. Update `executeAITurn()` to accept new parameters

```typescript
// app/party/ai-turn-handler.ts
interface ExecuteAITurnOptions {
  // ...existing
  abortSignal?: AbortSignal;
  onPersist?: () => Promise<void>;
}

export async function executeAITurn(options: ExecuteAITurnOptions): Promise<AITurnResult> {
  const { abortSignal, onPersist, ...rest } = options;

  const result = await executeTurn({
    // ...existing
    abortSignal,
    onPersist,
  });
}
```

#### 3. Manage AbortController in the room

```typescript
// app/party/mayi-room.ts
private aiTurnAbortController: AbortController | null = null;

async executeAITurnsIfNeeded() {
  while (turnsExecuted < MAX_CHAINED_TURNS) {
    const gameState = await this.getGameState();
    const adapter = PartyGameAdapter.fromStoredState(gameState);

    const aiPlayer = isAIPlayerTurn(adapter);
    if (!aiPlayer) return;

    // Create abort controller for this AI turn
    this.aiTurnAbortController = new AbortController();

    try {
      await executeAITurn({
        adapter,
        abortSignal: this.aiTurnAbortController.signal,
        onPersist: async () => {
          // Persist after each tool call
          await this.setGameState(adapter.getStoredState());
          await this.broadcastGameState();
        },
        // ...rest
      });

      // Normal completion - save final state
      await this.setGameState(adapter.getStoredState());
      await this.broadcastGameState();

    } catch (err) {
      if (err.name === 'AbortError') {
        // May-I was called - state already persisted via onPersist
        // Exit loop and let May-I resolution take over
        return;
      }
      throw err;
    } finally {
      this.aiTurnAbortController = null;
    }

    turnsExecuted++;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
```

#### 4. Abort on May-I call

```typescript
// app/party/mayi-room.ts - in handleGameAction()
case "CALL_MAY_I": {
  // Abort any running AI turn FIRST
  // State is already persisted via onPersist, so this is safe
  this.aiTurnAbortController?.abort();

  // Process May-I normally
  result = adapter.callMayI(lobbyPlayerId);
  // ...
  break;
}
```

#### 5. Re-enter AI loop after May-I resolution

```typescript
// app/party/mayi-room.ts - in handleGameAction()
case "ALLOW_MAY_I":
case "CLAIM_MAY_I": {
  // ...existing resolution logic
  await this.setGameState(adapter.getStoredState());
  await this.broadcastGameState();

  // Check if we need to resume AI turns
  // This will reload fresh state and see if it's still an AI's turn
  await this.executeAITurnsIfNeeded();
  break;
}
```

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| AI draws → May-I called | Draw persisted at T3, abort at T6, May-I resolution, new AI loop starts at AWAITING_ACTION |
| AI thinking (no action yet) → May-I called | No state change yet, abort fires, May-I resolution, AI restarts from AWAITING_DRAW |
| AI discards before abort | Discard persisted, new card exposed. May-I claim is for the NEW exposed card (AI's discard) |
| May-I resolution gives card to claimer | Claimer gets card + penalty, AI's turn continues (or next player if AI discarded) |
| No one claims May-I | Card stays in discard, AI's turn resumes normally |

### Why Not Other Approaches?

| Approach | Problem |
|----------|---------|
| May-I timeout window | Slows down AI-only games unnecessarily; doesn't fix the stale state issue |
| State versioning | Complex retry logic; doesn't interrupt stale LLM calls |
| Action locking | LLM calls take 2-5s; would block all human actions |
| Dirty flag | Still needs to interrupt LLM call anyway |

The AbortController approach is cleanest because:
- Matches game semantics (May-I interrupts the current turn per house rules)
- Vercel AI SDK already supports `abortSignal`
- Immediate persistence ensures no lost state
- Clean re-entry handles all mid-turn scenarios

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

- The same pattern (AbortController + immediate persistence) could apply to other interruptible AI operations
- The fallback turn logic (`executeFallbackTurn`) also needs abort signal support (included in this fix)

---

## Additional Bug: AI Players Never Respond to May-I Prompts

### Summary

When May-I resolution prompts an AI player to "allow or claim?", the AI never responds. This causes May-I resolution to hang indefinitely waiting for the AI's response.

### Root Cause

During May-I resolution, the game enters `RESOLVING_MAY_I` phase and prompts each player in priority order. For human players, the UI shows "Allow" and "Claim" buttons. But for AI players, there is **no code** that triggers an AI response.

**Current flow:**
1. Human calls May-I for 7♠
2. Phase → `RESOLVING_MAY_I`
3. AI player is ahead in priority queue
4. `broadcastMayIPrompt()` is called (notifies clients)
5. UI shows prompt to the AI player... but AI has no client!
6. Nothing happens. Game hangs.

### Evidence

**File:** `app/party/mayi-room.ts` (lines 487-496)
```typescript
if (phaseBefore !== "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
  // May I was just called - broadcast MAY_I_PROMPT
  await this.broadcastMayIPrompt(adapter);  // ← Only broadcasts, no AI handling!
} else if (phaseBefore === "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
  // Still resolving (someone allowed) - prompt next player
  await this.broadcastMayIPrompt(adapter);  // ← Same issue
}
```

**Missing:** After broadcasting the prompt, there's no check for "is the prompted player an AI?" and no code to execute an AI response.

**AI Agent Tools:** The AI agent has `allowMayI` and `claimMayI` tools in `ai/mayIAgent.tools.ts`, but these are only used during the AI's own turn, not when prompted during May-I resolution.

### Timeline of Hung Game

```
Time    Event                                  Game State
─────   ─────────────────────────────          ─────────────────────────
T0      Human calls May-I for 7♠               phase: ROUND_ACTIVE
T1      State → RESOLVING_MAY_I                phase: RESOLVING_MAY_I
T2      Check priority queue: AI 1 is first    playerBeingPrompted: AI 1
T3      broadcastMayIPrompt(adapter)           (UI updates)
T4      ...waiting for AI 1 response...        (HANGS FOREVER)
T5      (No code triggers AI decision)
```

### Required Fix

After `broadcastMayIPrompt()`, check if the prompted player is an AI and execute an AI response.

**Good news:** The existing infrastructure already supports this! We can reuse `executeTurn()`:

1. **Tools already exist**: `allow_may_i` and `claim_may_i` in `mayIAgent.tools.ts` (lines 99-109)
2. **Tool filtering works**: `getAvailableToolNames()` returns them during `RESOLVING_MAY_I` phase
3. **System prompt covers it**: "RESOLVING_MAY_I — You MUST respond" (line 143-144)
4. **User message has context**: Already shows "MAY I? — Your decision for 9♠" and "Caller: Bob"

```typescript
if (phaseBefore !== "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
  await this.broadcastMayIPrompt(adapter);
  await this.executeAIMayIResponseIfNeeded(adapter);  // NEW
} else if (phaseBefore === "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
  await this.broadcastMayIPrompt(adapter);
  await this.executeAIMayIResponseIfNeeded(adapter);  // NEW
}
```

**New method - reuses existing agent:**
```typescript
private async executeAIMayIResponseIfNeeded(adapter: PartyGameAdapter): Promise<void> {
  const snapshot = adapter.getSnapshot();
  if (snapshot.phase !== "RESOLVING_MAY_I") return;
  if (!snapshot.mayIContext) return;

  // Check if prompted player is AI
  const promptedEngineId = snapshot.mayIContext.playerBeingPrompted;
  const lobbyPlayer = this.findLobbyPlayerByEngineId(promptedEngineId);
  if (!lobbyPlayer?.isAI) return; // Human player - wait for their input

  // Use the SAME executeTurn() as regular AI turns
  // The agent will see:
  //   - Phase: RESOLVING_MAY_I
  //   - Available tools: [allow_may_i, claim_may_i]
  //   - User message: "MAY I? — Your decision for 9♠", "Caller: Bob"
  //   - System prompt: same as always (prompt caching works!)

  const proxy = new AIGameAdapterProxy(adapter, lobbyPlayer.lobbyId);
  const model = await createWorkerAIModelAsync(lobbyPlayer.aiModelId ?? "default:grok", this.env);
  const mapping = adapter.getPlayerMapping(lobbyPlayer.lobbyId);

  // Create abort controller for this AI response (can be interrupted)
  this.aiTurnAbortController = new AbortController();

  try {
    await executeTurn({
      model,
      game: proxy,
      playerId: mapping.engineId,
      playerName: lobbyPlayer.name,
      maxSteps: 1,  // Only need one action (allow or claim)
      abortSignal: this.aiTurnAbortController.signal,
      onPersist: async () => {
        await this.setGameState(adapter.getStoredState());
        await this.broadcastGameState();
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return; // Aborted - another May-I was called (edge case)
    }
    throw err;
  } finally {
    this.aiTurnAbortController = null;
  }

  // Save and broadcast final state
  await this.setGameState(adapter.getStoredState());
  await this.broadcastGameState();

  // DON'T recurse here - let normal handleGameAction flow handle chaining
  // After we return, the ALLOW_MAY_I/CLAIM_MAY_I action will be processed
  // which will trigger another check for the next AI in priority queue
}
```

### Why Reusing executeTurn() Works

| Aspect | How It's Handled |
|--------|------------------|
| **Tool filtering** | `getAvailableToolNames()` checks phase and returns `[allow_may_i, claim_may_i]` |
| **User message context** | `outputGameStateForLLM()` already shows card and caller info |
| **System prompt** | Identical for all calls → prompt caching works |
| **LLM decision** | Agent sees full game state and makes informed choice |
| **Abortable** | Same AbortController pattern as regular turns |
| **Chained AI responses** | Normal game flow handles it (no recursion needed) |

### AI Decision Quality

The LLM will consider:
- Current hand and what cards are needed
- Whether the card helps complete the contract
- The penalty card cost of claiming
- Whether blocking an opponent is worth it

This is better than a heuristic because the LLM has full game context.

### Impact

**Severity:** Critical - Game becomes unplayable when AI is in May-I priority queue

**Affected scenarios:**
- Human calls May-I, AI is between them and current player
- Multiple AIs in the priority queue
- Any game with 2+ AI players

### Reproduction Steps

1. Create game: Human + AI 1 + AI 2 (turn order)
2. Have AI 2 discard a card Human wants
3. Human (position 1) clicks "May I"
4. AI 1 (position 2) should be prompted first (priority order)
5. **Observe:** Game hangs, no response from AI 1

### Fix Scope

This fix should be included with the race condition fix since:
1. Both involve AI behavior during May-I
2. The abort controller pattern can be reused
3. Fixing one without the other leaves May-I broken for AI games

## Testing Strategy

### Architecture: Extract AITurnCoordinator

To make the abort/persist logic testable without PartyKit, extract coordination into a separate class:

```typescript
// app/party/ai-turn-coordinator.ts
export class AITurnCoordinator {
  private abortController: AbortController | null = null;

  constructor(
    private deps: {
      getState: () => Promise<StoredGameState>;
      setState: (state: StoredGameState) => Promise<void>;
      broadcast: (state: StoredGameState) => void;
      executeAITurn: (options: ExecuteAITurnOptions) => Promise<AITurnResult>;
    }
  ) {}

  async executeAITurnsIfNeeded(): Promise<void> {
    // ... loop logic with abort controller lifecycle
  }

  abortCurrentTurn(): void {
    this.abortController?.abort();
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }
}
```

The room becomes a thin wrapper that injects real dependencies:

```typescript
// app/party/mayi-room.ts
this.coordinator = new AITurnCoordinator({
  getState: () => this.getGameState(),
  setState: (s) => this.setGameState(s),
  broadcast: (s) => this.broadcastGameState(),
  executeAITurn: (opts) => executeAITurn(opts),
});
```

### Test Layers

| Layer | Test Type | What It Tests |
|-------|-----------|---------------|
| `AITurnCoordinator` | Unit tests (fast) | Abort lifecycle, persist callbacks, loop behavior |
| `executeTurn()` + abort | Integration (slow, real LLM) | AbortSignal interrupts `generateText()` |
| `onPersist` callback | Unit tests (fast) | Callback is invoked after tool results |
| Full flow | E2E / Manual | Human clicks May-I during AI turn in browser |

### Unit Tests: AITurnCoordinator

Test with dependency injection - no mocking, just simple fake implementations:

```typescript
// app/party/ai-turn-coordinator.test.ts
import { describe, it, expect } from "bun:test";
import { AITurnCoordinator } from "./ai-turn-coordinator";

describe("AITurnCoordinator", () => {
  it("should abort when abortCurrentTurn is called mid-turn", async () => {
    let state = createAITurnGameState();
    let persistCount = 0;

    const coordinator = new AITurnCoordinator({
      getState: async () => state,
      setState: async (s) => { state = s; persistCount++; },
      broadcast: () => {},
      executeAITurn: async ({ abortSignal, onPersist }) => {
        // Simulate: persist after draw
        await onPersist();

        // Simulate LLM thinking (where abort happens)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 1000);
          abortSignal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });

        return { success: true, actions: ['draw', 'discard'], usedFallback: false };
      },
    });

    // Start turn, abort after 50ms
    const turnPromise = coordinator.executeAITurnsIfNeeded();
    await new Promise(r => setTimeout(r, 50));
    coordinator.abortCurrentTurn();
    await turnPromise;

    expect(persistCount).toBeGreaterThan(0); // Draw was persisted before abort
    expect(coordinator.isRunning()).toBe(false); // Cleaned up
  });

  it("should call onPersist after each tool execution", async () => {
    const persistedStates: StoredGameState[] = [];

    const coordinator = new AITurnCoordinator({
      getState: async () => createGameState(),
      setState: async (s) => { persistedStates.push(structuredClone(s)); },
      broadcast: () => {},
      executeAITurn: async ({ onPersist }) => {
        await onPersist(); // After draw
        await onPersist(); // After skip
        await onPersist(); // After discard
        return { success: true, actions: ['draw', 'skip', 'discard'], usedFallback: false };
      },
    });

    await coordinator.executeAITurnsIfNeeded();

    // 3 from onPersist + 1 final save
    expect(persistedStates.length).toBe(4);
  });

  it("should exit loop cleanly on abort without throwing", async () => {
    const coordinator = new AITurnCoordinator({
      getState: async () => createAITurnGameState(),
      setState: async () => {},
      broadcast: () => {},
      executeAITurn: async ({ abortSignal }) => {
        return new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      },
    });

    const turnPromise = coordinator.executeAITurnsIfNeeded();
    coordinator.abortCurrentTurn();

    // Should resolve without throwing
    await expect(turnPromise).resolves.toBeUndefined();
  });

  it("should clean up AbortController on normal completion", async () => {
    const coordinator = new AITurnCoordinator({
      getState: async () => createHumanTurnGameState(), // Not AI's turn
      setState: async () => {},
      broadcast: () => {},
      executeAITurn: async () => ({ success: true, actions: [], usedFallback: false }),
    });

    await coordinator.executeAITurnsIfNeeded();

    expect(coordinator.isRunning()).toBe(false);
  });

  it("should broadcast after each persist", async () => {
    let broadcastCount = 0;

    const coordinator = new AITurnCoordinator({
      getState: async () => createAITurnGameState(),
      setState: async () => {},
      broadcast: () => { broadcastCount++; },
      executeAITurn: async ({ onPersist }) => {
        await onPersist();
        return { success: true, actions: ['draw'], usedFallback: false };
      },
    });

    await coordinator.executeAITurnsIfNeeded();

    expect(broadcastCount).toBeGreaterThanOrEqual(1);
  });
});
```

### Integration Tests: Agent Abort (requires `RUN_INTEGRATION_TESTS=1`)

```typescript
// ai/mayIAgent.abort.test.ts
import { describe, it, expect } from "bun:test";

describe("executeTurn with abortSignal", () => {
  it("should stop LLM call when aborted", async () => {
    const adapter = createTestGameAdapter();
    const controller = new AbortController();

    const turnPromise = executeTurn({
      model: createTestModel(),
      game: adapter,
      playerId: "p1",
      abortSignal: controller.signal,
    });

    // Abort after 500ms (mid-LLM-call)
    setTimeout(() => controller.abort(), 500);

    await expect(turnPromise).rejects.toThrow(/abort/i);
  });
});
```

### Why This Approach

- **No mocking** - dependency injection with simple fakes
- **Fast unit tests** - coordinator tests run in milliseconds
- **Real integration tests** - agent abort tested with actual LLM
- **Room stays thin** - just wires dependencies, barely needs tests
- **Testable abort flow** - can simulate timing precisely
