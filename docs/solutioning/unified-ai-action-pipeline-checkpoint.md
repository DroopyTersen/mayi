# Unified AI Action Pipeline Checkpoint

Last updated: 2026-04-26

## Branch And PR State

- Base branch: `main`
- Working branch: `refactor/unified-ai-action-pipeline`
- Current committed refactor baseline: `7400082 Refactor AI turns onto queued action pipeline`
- Open PR: https://github.com/DroopyTersen/mayi/pull/81
- AgentFlow/GitHub issue: https://github.com/DroopyTersen/mayi/issues/79

The original May-I stale AI merge bug fix was merged separately:

- PR #80: https://github.com/DroopyTersen/mayi/pull/80
- Merge commit on `main`: `89c3c6b`

## Verification Already Completed On `7400082`

- `bun run typecheck`
- `bun test` -> 2528 pass, 6 skip
- `bun run build`
- `RUN_INTEGRATION_TESTS=1 bun test ai/` -> 42 pass
- `bun run check` including Wrangler dry-run
- CLI harness smoke:
  - `bun cli/play.ts new`
  - `bun cli/play.ts list`
  - `bun cli/play.ts FFQVFD status --json`
  - `bun cli/play.ts FFQVFD draw stock`
  - `bun cli/play.ts FFQVFD skip`
  - `bun cli/play.ts FFQVFD discard 5`
  - `bun cli/play.ts FFQVFD mayi player-0`
  - `bun cli/play.ts FFQVFD allow`
  - `bun cli/play.ts FFQVFD status --json`

## Current Problem With PR #81

PR #81 moved PartyKit AI persistence onto the shared queue/executor path, but it still has compatibility code:

- `AIGameAdapterProxy`
- `QueuedAIGameAdapterProxy`
- `executeFallbackTurn`
- `executeFallbackTurnWithAdapter`
- `onPersist` plumbing in AI/coordinator code
- `mergeAIStatePreservingOtherPlayerHands`
- merge/proxy/fallback-specific tests

That made the first refactor slice safer but not complete. The desired final refactor should feel deletion-heavy: AI should be an action producer over the same state-machine event pipeline as humans.

## Target Architecture

```text
AI tool loop step
  -> read latest committed GameSnapshot
  -> compute legal tools from that snapshot
  -> LLM selects a tool
  -> tool converts arguments to one normal GameAction from latest snapshot
  -> enqueue GameAction through the same room pipeline as humans
  -> persist + side effects + broadcast
  -> next tool-loop step reads latest committed GameSnapshot
```

There should be exactly one mutation path:

```text
GameActionQueue -> executeStoredGameAction -> GameEngine/state machine -> persist -> side effects
```

AI should not own a mutable cloned adapter, stale engine snapshot, or special persistence merge.

## AI Interruption Semantics

Human actions should be classified by whether they affect AI decision context.

- `REORDER_HAND`
  - Persist and broadcast.
  - Do not abort or restart the AI loop.
  - Reason: it changes private human hand order, not public legal context.
- `CALL_MAY_I`
  - Persist and broadcast prompt.
  - Abort current AI loop if one is running.
  - Reason: phase/legal actions change to `RESOLVING_MAY_I`.
- `ALLOW_MAY_I` / `CLAIM_MAY_I`
  - Persist through queue.
  - Continue May-I resolution.
  - Resume AI turns if phase returns to `ROUND_ACTIVE` and an AI is awaiting.
- AI tool actions
  - Always re-read latest snapshot immediately before mapping positions to card IDs.
  - If the latest state no longer allows the action, return a normal tool failure from the committed latest snapshot.

No new persisted game phase like `AI_THINKING` should be added. AI thinking/cancellation is orchestration state owned by `AITurnCoordinator`.

## Completion Plan

1. Replace `AIGameAdapter` with an action-runtime contract.

   Proposed shape:

   ```ts
   interface AIActionRuntime {
     getSnapshot(): Promise<GameSnapshot>;
     executeAction(action: GameAction): Promise<AIActionResult>;
   }

   type AIActionResult =
     | { ok: true; snapshot: GameSnapshot }
     | { ok: false; snapshot: GameSnapshot; error: string };
   ```

2. Convert `ai/mayIAgent.tools.ts` so tools emit `GameAction`s directly.

   Examples:

   - `draw_from_stock` -> `{ type: "DRAW_FROM_STOCK" }`
   - `draw_from_discard` -> `{ type: "DRAW_FROM_DISCARD" }`
   - `discard(position)` -> read latest hand, map position to `cardId`, then `{ type: "DISCARD", cardId }`
   - `lay_down(melds)` -> read latest hand, map positions to `MeldSpec[]`, then `{ type: "LAY_DOWN", melds }`
   - `lay_off(cardPosition, meldNumber)` -> read latest hand/table, map to card/meld IDs, then `{ type: "LAY_OFF", cardId, meldId }`
   - `swap_joker(...)` -> read latest hand/table, map IDs, then `{ type: "SWAP_JOKER", ... }`
   - `allow_may_i` -> `{ type: "ALLOW_MAY_I" }`
   - `claim_may_i` -> `{ type: "CLAIM_MAY_I" }`

3. Remove `onPersist` from `mayIAgent`, `AITurnCoordinator`, and tests.

   Tool execution itself persists because it executes a queued `GameAction`.

4. Remove AI fallback mutation paths.

   Delete:

   - `executeFallbackTurn`
   - `executeFallbackTurnWithAdapter`
   - fallback branches in `executeAITurn`
   - fallback-specific AI tests

   If disconnected-human autoplay is still desired, implement it later as a separate policy that emits normal `GameAction`s. Do not keep it inside AI turn execution.

5. Simplify `app/party/ai-turn-handler.ts`.

   It should:

   - resolve model;
   - validate the requested AI lobby player is currently awaiting;
   - pass an `AIActionRuntime` to `executeTurn`;
   - return the result.

   It should not contain direct adapter classes or fallback turn logic.

6. Simplify `app/party/ai-turn-coordinator.ts`.

   It should orchestrate only:

   - single-flight AI loop;
   - abort controller lifecycle;
   - thinking/done callbacks;
   - chained AI turns;
   - passing the queued action runtime into `executeAITurn`.

   It should not:

   - call `mergeAIStatePreservingOtherPlayerHands`;
   - call `setState` after AI completion;
   - carry `onPersist` callbacks.

7. Delete stale merge helper.

   Remove from `app/party/party-game-adapter.ts`:

   - `mergeAIStatePreservingOtherPlayerHands`
   - helper functions used only by that merge

   Remove or rewrite tests:

   - delete `app/party/party-game-adapter.merge.test.ts`
   - delete/replace `app/party/bug-44-may-i-duplicate-cards.test.ts` if it only tests stale merge
   - delete/replace `app/party/bug-80-may-i-ai-merge-rollback.test.ts`

   Replacement tests should prove stale snapshots cannot be written because AI only submits queued actions.

8. Update CLI AI usage.

   `CliGameAdapter` can remain as the CLI game facade, but `mayIAgent` should not depend on its imperative adapter methods. Add a CLI `AIActionRuntime` helper that:

   - reads `game.getSnapshot()`;
   - executes normal action semantics against `CliGameAdapter` or the underlying engine;
   - returns committed snapshots.

   This keeps CLI behavior working without keeping the AI adapter interface.

9. Replace focused tests.

   Keep/add tests for:

   - AI tools emit `GameAction`s through `AIActionRuntime`.
   - Position mapping uses the latest snapshot at tool execution time.
   - Human reorder during AI thinking does not abort and is preserved.
   - Human May-I during AI thinking aborts the AI turn.
   - AI May-I responses use the same queued action executor.
   - No `mergeAIStatePreservingOtherPlayerHands` export exists.

10. Verification gate.

    Run:

    - `bun run typecheck`
    - focused AI/Party tests
    - `bun test`
    - `bun run build`
    - `RUN_INTEGRATION_TESTS=1 bun test ai/`
    - `bun run check`
    - CLI harness smoke

## Files Known To Need Work

- `ai/ai-game-adapter.types.ts`
- `ai/mayIAgent.tools.ts`
- `ai/mayIAgent.ts`
- `ai/mayIAgent.llm.test.ts`
- `ai/devtools-test.ts`
- `cli/interactive/interactive.ts`
- `cli/shared/cli-game-adapter.ts`
- `app/party/ai-turn-handler.ts`
- `app/party/ai-turn-coordinator.ts`
- `app/party/mayi-room.ts`
- `app/party/party-game-adapter.ts`
- `app/party/ai-turn-handler.proxy.test.ts`
- `app/party/ai-turn-handler.queued-proxy.test.ts`
- `app/party/ai-turn-handler.mayi-fallback.test.ts`
- `app/party/party-game-adapter.merge.test.ts`
- `app/party/bug-44-may-i-duplicate-cards.test.ts`
- `app/party/bug-80-may-i-ai-merge-rollback.test.ts`
- `app/party/ai-turn-coordinator*.test.ts`

## Resume Point

The next implementation step is to introduce the `AIActionRuntime` contract and rewrite `mayIAgent.tools.ts` around `GameAction` emission. After that, delete the adapter/fallback code from `app/party/ai-turn-handler.ts` and repair tests around the single action pipeline.
