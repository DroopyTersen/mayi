# Architecture Deepening Plan

Status: proposed
Created: 2026-05-14

## Summary

This plan sequences the architecture deepening work identified during the top-level seam review.

The goal is not to do one large rewrite. The goal is to land small, independently verified changes that increase module depth, improve locality for rule and realtime bugs, and keep the game playable after every step.

The highest-risk seam is the core card-state owner seam. Later phases depend on that seam becoming easier to reason about.

## Working Rules

- Use TDD for every behavior change. Write a failing test first, run it red, then implement.
- Keep each phase mergeable on its own.
- Do not mix unrelated architecture phases in one commit.
- Commit only after the phase or subphase has passed its verification gate.
- Prefer small commits named after the verified behavior, not broad cleanup labels.
- If a verification step cannot run because of missing credentials or environment, record the reason in the commit message or follow-up note.

## Global Verification Ladder

Every implementation phase must define a local verification gate. The full ladder is:

1. Run the new failing test and confirm it fails before implementation.
2. Run targeted tests for the changed seam.
3. Run `bun run typecheck`.
4. Run `bun test`.
5. Run `bun run build`.
6. Run CLI harness smoke coverage.
7. Run at least one full CLI round after major engine or command pipeline phases.
8. Run browser E2E after web, realtime, and protocol phases.
9. Run AI integration tests after AI command, prompt, or tool behavior changes.

Commands:

```bash
bun run typecheck
bun test
bun run build
RUN_INTEGRATION_TESTS=1 bun test ai/
```

CLI harness smoke:

```bash
bun cli/play.ts new
bun cli/play.ts <game-id> status --json
bun cli/play.ts <game-id> draw stock
bun cli/play.ts <game-id> skip
bun cli/play.ts <game-id> discard 1
bun cli/play.ts <game-id> log 10
```

Full CLI round verification should use either:

- a deterministic custom state that can complete a round quickly, or
- a normal generated game played until the first round transition is observed.

Browser E2E verification:

```bash
bun run dev
```

Then use Chrome automation against:

- `http://localhost:5173/game/agent/new`
- `http://localhost:5173/game/agent/state/<encoded-state>`

Minimum browser checks:

- app connects and joins the room
- game starts and receives `GAME_STARTED`
- current player can draw and discard
- hand reorder persists after server update
- May-I prompt can be answered
- round summary appears for injected round-end scenarios

## Progress Tracker

- [ ] Phase 1: Finish the core card-state owner seam
  - [x] Prevent turn completion from overwriting round-owned card/player state
    from stale `TurnOutput`
  - [x] Extract draw, discard, and reorder card moves into pure round
    card-state helpers
- [ ] Phase 2: Deepen the committed game action pipeline
- [ ] Phase 3: Move `GameAction` into a shared command module
- [ ] Phase 4: Split room side effects into domain events and broadcast projection
- [ ] Phase 5: Create typed UI player-action intents
- [ ] Phase 6: Move shared rendering, prompt, and activity text out of CLI
- [ ] Phase 7: Clean up projection, persistence, availability, and command results

## Phase 1: Finish The Core Card-State Owner Seam

Related docs:

- [card-state-single-owner.md](card-state-single-owner.md)
- [remove-turn-reorder-sync.md](remove-turn-reorder-sync.md)
- [card-state-invariants.md](card-state-invariants.md)

Files:

- `core/engine/round.machine.ts`
- `core/engine/turn.machine.ts`
- `core/engine/game-engine.ts`
- `core/engine/game-engine.types.ts`
- `core/engine/card-state.invariants.ts`

Problem:

`RoundMachine` is intended to own physical card zones, but `TurnMachine` still stores and mutates `hand`, `stock`, `discard`, and `table`, then returns them in `TurnOutput`. This keeps a shallow seam between round flow and turn flow: callers and tests must understand sync order and nested actor state to know which card copy is authoritative.

Target shape:

- `RoundMachine` owns all physical card locations.
- `TurnMachine` owns only turn workflow state: phase, player, draw/action flags, and turn-local error/result state.
- Turn completion cannot overwrite round-owned card zones.
- `GameEngine` projects card zones from one owner.

Red tests:

- Drawing from stock immediately removes the drawn card from round-owned stock.
- Drawing from discard immediately removes the claimed card from round-owned discard.
- Reordering the current player after drawing cannot alter stock/discard/table.
- Reordering a non-current player during a live turn cannot alter stock/discard/table.
- Turn completion cannot resurrect stale card zones from `TurnOutput`.
- May-I claim by a non-current player moves the claimed discard and penalty card into exactly one hand and out of piles.
- Persist/restore after each turn phase preserves card invariants.

Verification gate:

```bash
bun test core/engine/round.machine.card-ownership.test.ts
bun test core/engine/game-engine.draw-discard-persistence.test.ts core/engine/game-engine.duplicate-restore.test.ts core/engine/game-engine.xstate.test.ts
bun run typecheck
bun test
bun run build
```

Harness gate:

- Run one CLI full round.
- Confirm no duplicate-card warnings.
- Confirm round transition produces expected scores and next round state.

Commit checkpoint:

- Commit after targeted tests, full test suite, build, and CLI full round pass.
- Suggested commit shape: `Refactor engine card ownership to round machine`.

## Phase 2: Deepen The Committed Game Action Pipeline

Related docs:

- [unified-action-pipeline.md](unified-action-pipeline.md)
- [unified-ai-action-pipeline-checkpoint.md](unified-ai-action-pipeline-checkpoint.md)

Files:

- `app/party/mayi-room.ts`
- `app/party/game-action-executor.ts`
- `app/party/game-action-queue.ts`
- `app/party/mayi-room.message-handlers.ts`
- `app/party/ai-turn-coordinator.ts`
- `app/party/ai-may-i-response.ts`

Problem:

`GameActionQueue` and `executeStoredGameAction` are good seams, but `MayIRoom` still owns queue timing, phase reload, state commit, error-to-snapshot conversion, AI recursion rules, and side-effect execution. The caller must understand the entire mutation protocol.

Target shape:

- A deeper queued action module owns "submit action by actor".
- Human actions, AI turn actions, and AI May-I responses use the same commit path.
- Revision updates, invariant validation, and post-commit event production live behind one interface.

Red tests:

- Two queued actions apply to the latest state in order.
- Failed action does not save state or broadcast.
- Card invariant violation rejects save.
- Human action and AI action use the same executor path.
- AI May-I response uses the queue and does not write stale snapshots.
- Queue result includes enough post-commit information for broadcasts and AI follow-up.

Verification gate:

```bash
bun test app/party/game-action-executor.test.ts app/party/game-action-queue.test.ts
bun test app/party/ai-turn-coordinator.test.ts app/party/ai-turn-coordinator.reorder-race.test.ts app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts
bun run typecheck
bun test
bun run build
```

Browser gate:

- Use Chrome automation against `/game/agent/new`.
- Confirm AI turns can run.
- Confirm a human May-I action can interrupt an AI turn without stale-state overwrite.

AI integration gate:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

If API keys are unavailable, run all non-integration AI tests and record the skipped integration gate.

Commit checkpoint:

- Commit after full verification, browser gate, and AI integration gate or documented skip.
- Suggested commit shape: `Deepen queued game action pipeline`.

## Phase 3: Move GameAction Into A Shared Command Module

Files:

- `app/party/protocol.types.ts`
- `app/party/game-actions.ts`
- `cli/shared/cli-game-adapter.ts`
- `cli/shared/cli-ai-action-runtime.ts`
- `ai/ai-action-runtime.types.ts`
- `ai/mayIAgent.tools.ts`
- `app/routes/game/game-action.sender.ts`

Problem:

`GameAction` is a shared command interface, but it lives inside the Party wire protocol module. CLI and AI import `app/party` to get command semantics, making the Party protocol module the accidental owner of shared commands.

Target shape:

- `GameAction` and command schemas live in a shared command module.
- Party protocol adapts wire messages to shared commands.
- CLI, AI, web route, and Party action pipeline use the shared command module.

Red tests:

- Protocol parser still accepts every existing game action message.
- CLI action runtime compiles without importing command types from `app/party`.
- AI action runtime compiles without importing command types from `app/party`.
- Web game-action sender compiles against shared command types.
- Shared command schema rejects malformed actions.
- Add `cli/shared/cli-ai-action-runtime.test.ts` if the runtime needs command ownership coverage beyond existing CLI adapter tests.

Verification gate:

```bash
bun test app/party/protocol.types.test.ts app/routes/game/game-action.sender.test.ts
bun test cli/shared/cli-game-adapter.test.ts cli/shared/cli-ai-action-runtime.test.ts
bun test ai/mayIAgent.tools.test.ts ai/aiPlayer.registry.test.ts
rg "from .*app/party/protocol.types" ai cli
bun run typecheck
bun test
bun run build
```

The `rg` check should show no AI or CLI imports whose only purpose is command ownership.

Commit checkpoint:

- Commit after targeted tests, import check, full test suite, and build pass.
- Suggested commit shape: `Move game commands to shared module`.

## Phase 4: Split Room Side Effects Into Domain Events And Broadcast Projection

Files:

- `app/party/mayi-room.ts`
- `app/party/mayi-room.message-handlers.ts`
- `app/party/game-action-executor.ts`
- `app/party/protocol.types.ts`
- `app/party/round-summary.capture.ts`
- `app/party/party-game-adapter.ts`

Problem:

`GameActionSideEffect` leaks concrete room behavior: broadcast method names, `PartyGameAdapter` instances, AI triggers, and transition detection. The pure handler module is still shallow because its interface is nearly as complex as the room implementation.

Target shape:

- Post-action logic emits domain events: player views changed, May-I prompt needed, May-I resolved, round ended, game ended, AI turn eligible.
- A broadcast projection module turns domain events and room state into per-recipient `ServerMessage` batches.
- `MayIRoom` remains the WebSocket adapter that sends messages and invokes AI.

Red tests:

- Round-ended domain event projects correct `ROUND_ENDED` messages.
- Game-ended domain event projects correct `GAME_ENDED` messages.
- May-I prompt event projects prompt only to the prompted player.
- May-I notification projects to all connected players.
- PlayerView broadcasts preserve hand privacy.
- Activity log included in relevant game state messages.

Verification gate:

```bash
bun test app/party/mayi-room.message-handlers.test.ts app/party/protocol.types.test.ts
bun test app/party/round-summary.capture.test.ts app/party/party-game-adapter.test.ts
bun run typecheck
bun test
bun run build
```

Browser gate:

- Chrome E2E quick start.
- Chrome E2E injected May-I prompt state.
- Chrome E2E injected round-end state.

Commit checkpoint:

- Commit after targeted tests, full ladder, and browser gate pass.
- Suggested commit shape: `Project room domain events to server messages`.

## Phase 5: Create Typed UI Player-Action Intents

Files:

- `app/routes/game.$roomId.tsx`
- `app/routes/game/game-action.sender.ts`
- `app/ui/game-view/GameView.tsx`
- `app/ui/game-view/useGameViewState.ts`
- `app/ui/action-bar/ActionBar.tsx`
- `app/ui/hand-drawer/HandDrawer.tsx`
- `app/ui/game-view/GameViewDesktopFooter.tsx`

Problem:

The UI action interface is shallow: UI modules emit `string` plus `unknown`, and the route casts payloads into commands. Action naming, payload validation, drawer behavior, and command mapping are scattered.

Target shape:

- UI modules emit typed player-action intents.
- One adapter maps intents to shared commands or local drawer transitions.
- May-I allow/claim cannot be silently emitted without route support.

Red tests:

- Every action bar intent maps to the expected command or local UI transition.
- Hand drawer draw/discard/reorder intents map to the expected command.
- Lay down, lay off, and swap intents validate required payload fields.
- Invalid payloads are rejected at the intent seam.
- May-I allow/claim intents are handled consistently with prompt dialog responses.

Verification gate:

```bash
bun test app/routes/game app/ui/game-view app/ui/action-bar app/ui/hand-drawer
bun run typecheck
bun test
bun run build
```

Browser gate:

- Chrome E2E draw from stock.
- Chrome E2E discard.
- Chrome E2E reorder hand and confirm server update preserves order.
- Chrome E2E May-I response.

Commit checkpoint:

- Commit after UI tests, full ladder, and browser gate pass.
- Suggested commit shape: `Type UI game action intents`.

## Phase 6: Move Shared Rendering, Prompt, And Activity Text Out Of CLI

Files:

- `cli/shared/cli.renderer.ts`
- `cli/shared/cli.llm-output.ts`
- `cli/shared/cli-meld-numbering.ts`
- `cli/shared/cli-game-adapter.ts`
- `app/party/party-game-adapter.ts`
- `app/party/game-actions.ts`
- `ai/mayIAgent.ts`
- `ai/mayIAgent.tools.ts`

Problem:

AI prompt rendering, server activity logging, card text, and meld numbering are shared presentation/read-model concerns, but several live under `cli`. This makes CLI an accidental dependency of Party and AI modules.

Target shape:

- Core card text is used directly for cross-layer card text.
- AI prompt rendering lives under `ai` or a shared read-model seam, not `cli`.
- Meld numbering lives in a shared action-addressing or presentation module.
- Activity log derivation lives in one module used by Party and CLI.

Red tests:

- `app/party` no longer imports `cli/shared/cli.renderer`.
- AI prompt renderer has direct tests for privacy filtering, table rendering, May-I prompt text, and available action text.
- Meld numbering tests cover CLI and AI tool numbering.
- Activity log derivation tests cover draw, discard, lay down, lay off, swap, May-I allow/claim, and go out.

Verification gate:

```bash
rg "cli/shared/cli.renderer" app/party ai
bun test cli/shared/cli.renderer.test.ts cli/shared/cli.llm-output.test.ts cli/shared/cli-meld-numbering.test.ts
bun test ai/mayIAgent.prompt.test.ts ai/mayIAgent.tools.test.ts
bun test app/party/game-actions.test.ts app/party/party-game-adapter.test.ts
bun run typecheck
bun test
bun run build
```

AI integration gate:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

Commit checkpoint:

- Commit after import check, full ladder, and AI integration gate or documented skip.
- Suggested commit shape: `Move shared rendering out of CLI`.

## Phase 7: Clean Up Projection, Persistence, Availability, And Command Results

Files:

- `core/engine/game-engine.ts`
- `core/engine/game-engine.types.ts`
- `core/engine/game-engine.availability.ts`
- `core/engine/game-engine.hints.ts`
- `core/engine/card-state.invariants.ts`
- `app/party/game-actions.ts`
- `cli/shared/cli-game-adapter.ts`
- `ai/ai-action-runtime.types.ts`

Problem:

After the deeper seams are in place, remaining shallow spots should be easier to fix: XState snapshot projection, raw persistence shape, duplicated availability checks, and `lastError`-based command failure inference.

Target shape:

- `GameEngine` has a focused projection module: XState snapshot in, `GameSnapshot` out.
- Engine persistence is versioned and hides raw nested XState layout from adapters.
- Availability and command execution share policy modules.
- Commands expose explicit accepted/rejected results instead of relying on `lastError` guessing.
- Card-state invariant policy is explicit: warn, reject, or test-fail depending on seam.

Red tests:

- Projection fixture tests cover game, round, turn, May-I, round-end, and game-end states.
- Persistence tests do not reach into raw nested actor layout outside engine-owned fixtures.
- Availability tests assert available actions are executable.
- Command result tests assert accepted/rejected outcomes without snapshot diff guessing.
- Card invariant policy tests cover warning at snapshot projection and rejection at persistence commit.

Verification gate:

```bash
bun test core/engine/game-engine*.test.ts core/engine/available-actions.test.ts core/engine/card-state.invariants.test.ts
bun test app/party/game-actions.test.ts cli/shared/cli-game-adapter.test.ts ai/mayIAgent.tools.test.ts
bun run typecheck
bun test
bun run build
```

Final system gate:

- Run one CLI full round.
- Run Chrome E2E quick start.
- Run Chrome E2E injected May-I state.
- Run Chrome E2E injected round-end state.
- Run `RUN_INTEGRATION_TESTS=1 bun test ai/`, or document missing integration credentials.

Commit checkpoint:

- Commit after full system gate.
- Suggested commit shape: `Deepen engine projection and command results`.

## Commit Discipline

Commit after each verified subphase, not after every file edit.

Before committing:

```bash
git status --short
git diff --check
```

Commit message format:

```text
<imperative summary>

Verification:
- <targeted tests>
- bun run typecheck
- bun test
- bun run build
- <CLI/browser/AI gate or documented skip>
```

If a phase requires multiple commits, each commit must leave the app in a verified state.

## Notes For Future Updates

When a phase is completed:

- Check off the phase in the progress tracker.
- Add a short completion note under that phase with the commit hash.
- Record any skipped verification with the reason.
- If a phase reveals a new architecture constraint, add it to this file or create an ADR if it should prevent future re-litigation.
