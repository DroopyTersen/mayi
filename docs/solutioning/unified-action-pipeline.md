# Solution Design: Unified Human And AI Action Pipeline

## Summary

Human actions and AI actions currently reach persistence through different paths.

Human actions are handled by the PartyKit room message handler and saved directly. AI actions can run for longer, hold an adapter created from an older stored state, then merge their final snapshot back into the latest room state. That merge exists for a good reason: it preserves human hand reorders while AI turns are running. But it also means AI games have a special stale-state protection path that human-only games do not use.

The improvement is to make all game actions, human and AI, pass through one serialized room-level action pipeline.

## The Issue

The current AI flow has to protect against stale state:

1. AI starts with state A.
2. Human reorders or calls May-I, producing state B.
3. AI finishes from stale state A and produces A-prime.
4. Code manually merges A-prime with B.

That merge parses nested persisted XState snapshots, preserves non-current player hands, patches the active turn hand, and checks for duplicate cards. This is a lot of domain-critical behavior outside the engine.

The smell is not that AI needs async handling. The smell is that async handling writes whole stale snapshots back to storage.

## Why A Fix Is Better

A unified action pipeline gives these properties:

- Every action is applied to the latest stored state.
- Human and AI actions have the same validation and persistence behavior.
- AI cannot overwrite human reorders with stale snapshots.
- May-I interruption is explicit in one queue instead of spread across abort logic and merge logic.
- The PartyKit room becomes the concurrency boundary, not the merge helper.

This also makes production bugs easier to reproduce locally. A test can enqueue the same sequence of actions and assert final state, instead of simulating stale adapters and snapshot merges.

## What The Fix Looks Like

Add a room-level game action executor that serializes all mutations:

```text
Client WebSocket
AI coordinator
CLI/test harness
     |
     v
GameActionQueue
     |
     v
load latest StoredGameState
     |
     v
PartyGameAdapter.fromStoredState(...)
     |
     v
executeGameAction(...)
     |
     v
validate invariants
     |
     v
save StoredGameState + broadcast
```

AI should stop owning a long-lived mutable adapter for the duration of a turn. Instead, it should decide the next action from the latest snapshot, enqueue that action, wait for the result, and repeat until the turn is complete.

## Options Considered

### Option 1: Minimal

Keep AI's long-lived adapter but make the merge helper more robust.

Files:

| File | Change |
|------|--------|
| `app/party/party-game-adapter.ts` | Harden `mergeAIStatePreservingOtherPlayerHands`. |
| `app/party/ai-turn-coordinator.ts` | Add more duplicate/invariant checks after merge. |

Pros:

- Fastest path.
- Keeps the current AI turn implementation.

Cons:

- Keeps snapshot surgery.
- Still treats AI and humans differently.
- Does not remove the architectural root cause.

### Option 2: Clean

Build an explicit command bus with optimistic revisions.

Files:

| File | Change |
|------|--------|
| `app/party/game-action-queue.ts` | New serialized queue with revision checks. |
| `app/party/game-action-executor.ts` | New latest-state executor shared by human and AI callers. |
| `app/party/ai-turn-coordinator.ts` | Rework AI to plan one action at a time from latest state. |
| `app/party/mayi-room.ts` | Delegate all game mutations to executor. |
| `app/party/party-game-adapter.ts` | Remove stale AI snapshot merge. |

Pros:

- Strong concurrency model.
- Removes AI-specific merge behavior.
- Clear test seams.

Cons:

- Larger change.
- Requires careful AI turn loop redesign.
- May need revision metadata migration.

### Option 3: Pragmatic

Introduce a shared executor first, then gradually move AI to per-action execution.

Files:

| File | Change |
|------|--------|
| `app/party/game-action-executor.ts` | Shared latest-state action execution. |
| `app/party/mayi-room.ts` | Human actions use the executor. |
| `app/party/ai-turn-coordinator.ts` | AI `onPersist` uses executor for tool actions, then later removes stale adapter usage. |
| `app/party/party-game-adapter.ts` | Keep merge temporarily as a fallback. |

Pros:

- Gives humans and AI a common path incrementally.
- Reduces risk by keeping the existing merge until AI is migrated.
- Easy to test one action at a time.

Cons:

- Temporary duplication.
- Must track and remove the old merge path.

## Recommendation

Use Option 3.

The end state should be a clean command bus, but migrating AI one step at a time is safer. The key is to create the shared executor first and move callers onto it, not to keep adding logic to the stale snapshot merge.

## Coding Plan

### Phase 1: Add Failing Race Tests

Create:

- `app/party/game-action-executor.test.ts`
- `app/party/ai-action-pipeline.test.ts`

Test cases:

- Human reorder during an AI turn is preserved without calling the AI merge helper.
- Human May-I call during AI thinking is applied before the next AI action.
- Two human actions sent close together apply in order to latest state.
- A rejected action does not save state or broadcast a game update.
- Duplicate-card invariant failure prevents save and returns a structured error.

### Phase 2: Add Stored State Revision

Extend `StoredGameState` with a monotonically increasing revision:

```ts
interface StoredGameState {
  version: string;
  roomId: string;
  createdAt: string;
  engineSnapshot: string;
  activityLog: ActivityLogEntry[];
  revision?: number;
}
```

Migration rule:

- Missing `revision` means `0`.
- Every successful game action writes `revision + 1`.

### Phase 3: Create Shared Executor

Create `app/party/game-action-executor.ts`.

Suggested API:

```ts
interface ExecuteStoredActionInput {
  getState: () => Promise<StoredGameState | null>;
  setState: (state: StoredGameState) => Promise<void>;
  roomPhase: RoomPhase;
  callerPlayerId: string;
  action: ClientGameAction;
}

interface ExecuteStoredActionResult {
  ok: boolean;
  state: StoredGameState | null;
  snapshot: GameSnapshot | null;
  revisionBefore: number | null;
  revisionAfter: number | null;
  outboundMessages: ServerMessage[];
  sideEffects: GameActionSideEffect[];
}
```

Responsibilities:

- Load latest state.
- Create `PartyGameAdapter` from latest state.
- Run `handleGameActionMessage`.
- Validate invariants before save.
- Increment revision.
- Return side effects for prompt/broadcast/AI continuation.

### Phase 4: Serialize Actions In MayIRoom

Add a simple promise queue inside `MayIRoom`:

```ts
private actionQueue: Promise<void> = Promise.resolve();

private enqueueGameMutation(task: () => Promise<void>): Promise<void> {
  this.actionQueue = this.actionQueue.then(task, task);
  return this.actionQueue;
}
```

Use this for:

- incoming human `GAME_ACTION`
- AI-generated game actions
- AI May-I responses

This ensures only one mutation reads and writes storage at a time.

### Phase 5: Migrate AI To Per-Action Execution

Change AI turn execution so tools do not mutate a stale adapter directly. Instead:

1. Load latest snapshot.
2. Ask AI/fallback for one action.
3. Enqueue that action through the same executor as humans.
4. Load the new snapshot.
5. Continue if the same AI still owns the turn and no May-I interruption is pending.

The existing `executeAITurn` API may need to split into:

- `planNextAIAction(snapshot, playerId, modelId)`
- `executeAIActionViaRoomQueue(action)`

### Phase 6: Remove Merge Helper

After AI no longer persists stale snapshots, remove:

- `mergeAIStatePreservingOtherPlayerHands`
- tests that assert merge-specific behavior
- comments describing AI stale snapshot merge as required behavior

Replace with queue/executor race tests.

## Verification Instructions

This refactor changes the concurrency boundary. Verification must prove that every mutation is applied to the latest stored state, that actions are serialized, and that AI can no longer overwrite human actions with stale snapshots.

### Red Test Requirement

Before changing implementation code, add failing tests for the race behavior.

Required red tests:

- `app/party/game-action-executor.test.ts`
  - Two queued human actions read revision `N`, then `N + 1`, not both `N`.
  - A rejected action does not call `setState`.
  - A successful action increments revision exactly once.
  - An invariant failure prevents save and returns a structured failure.
- `app/party/ai-action-pipeline.test.ts`
  - AI plans from state A, human reorders to state B, AI's next action applies to B.
  - AI plans from state A, human calls May-I to state B, AI stops or waits instead of writing stale A-prime.
  - AI per-action loop stops if `awaitingPlayerId` changes away from the AI.
- `app/party/mayi-room.message-handlers.test.ts`
  - Concurrent `GAME_ACTION` messages are serialized through the queue.

The first red tests should fail against the current long-lived AI adapter flow. If a test only proves the existing merge helper still works, it is not enough.

### Unit Tests

Required command:

```bash
bun test app/party/game-action-executor.test.ts
```

Required scenarios:

- Missing room state returns a failure without side effects.
- Non-playing room phase returns the same error behavior as current `handleGameActionMessage`.
- Valid action loads latest state, executes once, validates, saves, and returns outbound messages.
- Invalid action returns outbound error and does not save.
- Revision defaults to `0` for existing stored states without a revision.
- Revision increments from `0` to `1`, then `1` to `2`.
- Side effects from `handleGameActionMessage` are preserved in order.
- Invariant validator is called before save.
- Broadcast is not triggered for failed actions.

### Queue Tests

If the queue is factored into `app/party/game-action-queue.ts`, test it without PartyKit.

Required command:

```bash
bun test app/party/game-action-queue.test.ts
```

Required scenarios:

- Tasks run in the order enqueued.
- A failing task does not permanently break the queue.
- Later tasks still run after an earlier rejection.
- Queue waits for async tasks before starting the next one.
- Queue exposes enough state for tests or logs to prove it is idle/running.

### PartyKit Message Handler Tests

Required commands:

```bash
bun test app/party/mayi-room.message-handlers.test.ts
bun test app/party/game-actions.test.ts
bun test app/party/protocol.types.test.ts
```

If `protocol.types.test.ts` does not exist, add the relevant schema coverage to the nearest protocol test file.

Required scenarios:

- `GAME_ACTION` for draw/discard/laydown/layoff/reorder still maps to the same engine action.
- `CALL_MAY_I` still aborts or pauses AI before prompt handling.
- `ALLOW_MAY_I` and `CLAIM_MAY_I` still broadcast the same prompt/resolution messages.
- Failed actions send one error message to the caller and do not broadcast a stale view.
- Successful actions save state before broadcasting.
- Action logs are preserved.

### AI Pipeline Tests

Required commands:

```bash
bun test app/party/ai-action-pipeline.test.ts
bun test app/party/ai-turn-coordinator.reorder-race.test.ts
bun test app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts
bun test app/party/ai-turn-handler.mayi-fallback.test.ts
bun test app/party/ai-turn-handler.proxy.test.ts
```

Required scenarios:

- AI fallback turn executes one action at a time through the shared executor.
- Human reorder during AI thinking is preserved without relying on `mergeAIStatePreservingOtherPlayerHands`.
- Human May-I during AI thinking interrupts the AI turn cleanly.
- Prompted AI May-I response goes through the same queue as human responses.
- AI does not continue after a round ends.
- AI does not continue if `awaitingPlayerId` changes.
- AI does not persist if its planned action is rejected.

Optional real-provider integration:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

Run this when AI tool schemas or AI prompt/action planning changed. It is not required for queue-only changes.

### Adapter And Merge Regression Tests

Until the merge helper is removed, keep its tests green.

Required commands:

```bash
bun test app/party/party-game-adapter.test.ts
bun test app/party/party-game-adapter.merge.test.ts
bun test app/party/bug-44-may-i-duplicate-cards.test.ts
```

During the final phase, replace merge-specific tests with executor tests that prove the same races are impossible because stale AI snapshots are never saved.

### Core Regression Tests

The pipeline should not change game rules, but it exercises all core actions.

Required commands:

```bash
bun test core/engine/roundMachine.mayI.test.ts
bun test core/engine/round.machine.reorder.test.ts
bun test core/engine/game-engine.xstate.test.ts
bun test core/engine/game-engine.duplicate-restore.test.ts
```

Required assertions:

- May-I priority and outcome rules are unchanged.
- Reorder remains a free action.
- Persist/restore still works with revised stored state.
- Duplicate-card warnings are not introduced by queued actions.

### CLI Harness Tests

The CLI does not use PartyKit, but it verifies the public engine behavior remains compatible.

Run:

```bash
bun cli/play.ts new
bun cli/play.ts list
bun cli/play.ts <game-id> status --json
bun cli/play.ts <game-id> draw stock
bun cli/play.ts <game-id> skip
bun cli/play.ts <game-id> discard 1
bun cli/play.ts <game-id> status --json
```

Also create a custom state with a May-I opportunity and run:

```bash
bun cli/play.ts <custom-game-id> mayi <player-id>
bun cli/play.ts <custom-game-id> allow
bun cli/play.ts <custom-game-id> status --json
```

Expected result: CLI behavior is unchanged. This is a regression check, not the main proof for the PartyKit queue.

### Web Manual Smoke

Run:

```bash
bun run dev
```

Manual scenarios:

- Three humans reorder at nearly the same time while one player is in `AWAITING_ACTION`.
- Human calls May-I while AI is thinking.
- Human reorders while AI is thinking.
- Prompted human claims May-I while another action button is visible.
- AI-heavy game runs through several turns with repeated broadcasts.

Expected result:

- No lost reorder.
- No duplicate-card warning.
- No stale prompt after May-I resolution.
- No action appears to succeed locally and then vanish after broadcast.

### Release Gate

Before merge/deploy:

```bash
bun run typecheck
bun test
bun run build
```

If deployment is intended:

```bash
bun run deploy
```

Acceptance criteria:

- All game mutations go through the shared executor or are explicitly documented as read-only.
- Stale AI adapter writes are gone before `mergeAIStatePreservingOtherPlayerHands` is removed.
- Revisions increment exactly once per successful action.
- Failed actions do not save or broadcast.
- Full suite passes.

## Rollout Notes

This can be deployed incrementally:

1. Add executor for human actions.
2. Add queue around existing human actions.
3. Move AI tool persistence to executor.
4. Remove stale snapshot merge.

Do not remove the merge helper until tests prove AI no longer writes stale adapter state.
