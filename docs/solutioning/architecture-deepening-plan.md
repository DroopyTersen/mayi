# Architecture Deepening Plan

Status: completed
Created: 2026-05-14

## Summary

This plan sequences the architecture deepening work identified during the top-level seam review.

The goal is not to do one large rewrite. The goal is to land small, independently verified changes that increase module depth, improve locality for rule and realtime bugs, and keep the game playable after every step.

The highest-risk seam is the core card-state owner seam. Later phases depend on that seam becoming easier to reason about.

## Working Rules

- Load `docs/house-rules.md` before each refactor phase or continuation of
  this work. Keep it in working context while designing, editing, and verifying.
- Treat Grandma Jeanne's house rules as domain invariants. A refactor must not
  change rule behavior unless the change is intentional, documented, and covered
  by a red test first.
- Before editing a rule-bearing module, identify which house-rule sections the
  change can affect.
- Every verification note must include a house-rule review statement for the
  affected behavior.
- Use TDD for every behavior change. Write a failing test first, run it red, then implement.
- Keep each phase mergeable on its own.
- Do not mix unrelated architecture phases in one commit.
- Commit only after the phase or subphase has passed its verification gate.
- Prefer small commits named after the verified behavior, not broad cleanup labels.
- If a verification step cannot run because of missing credentials or environment, record the reason in the commit message or follow-up note.

## Global Verification Ladder

Every implementation phase must define a local verification gate. The full ladder is:

1. Run the new failing test and confirm it fails before implementation.
2. Review the changed behavior against `docs/house-rules.md` and record which
   house-rule sections were protected by tests or manual harness checks.
3. Run targeted tests for the changed seam.
4. Run `bun run typecheck`.
5. Run `bun test`.
6. Run `bun run build`.
7. Run CLI harness smoke coverage.
8. Run at least one full CLI round after major engine or command pipeline phases.
9. Run browser E2E after web, realtime, and protocol phases.
10. Run AI integration tests after AI command, prompt, or tool behavior changes.

House-rule review checklist:

- Setup: 3-8 players, correct deck count, 11-card deal, 6 hands.
- Turn structure: draw first, exactly one draw, discard to end turn unless going
  out by playing all cards.
- Down status: down players draw stock only, cannot May I, can lay off only on
  later turns, and cannot lay off on the same turn they lay down.
- Contracts: each hand requires the exact contract, same-suit two-run gap rule,
  wild ratio applies to initial laydown only.
- Joker swapping: runs only, before laying down only, after drawing only, never
  in Hand 6.
- May I: exposed discard lifecycle, priority line, down-player skip, current
  player priority before draw, penalty-card draw, AI non-response counts as
  allow, no usage limit.
- Hand 6: no one is down until winning, all cards must be used to lay down, no
  discard on win, no layoff, no Joker swapping.
- Stock depletion: replenish from discard except top exposed card, or end hand
  if no replenishment is possible.
- Scoring: went-out player scores 0; remaining hand values follow the card-value
  table; lowest total wins after Hand 6.

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

- [x] Phase 1: Finish the core card-state owner seam
  - [x] Prevent turn completion from overwriting round-owned card/player state
    from stale `TurnOutput`
  - [x] Extract draw, discard, and reorder card moves into pure round
    card-state helpers
  - [x] Extract laydown, layoff, and joker-swap card moves into pure round
    card-state helpers
  - [x] Project legacy game-actor player state from `RoundMachine` instead of
    stale turn copies
- [x] Phase 2: Deepen the committed game action pipeline
  - [x] Centralize room queued action submission behind
    `submitQueuedGameAction`
  - [x] Verify Party/AI queue path with focused tests, typecheck, full suite,
    and production build
  - [x] Verify CLI full-round transition with deterministic `ARCHP5` harness
    state
  - [x] Verify local realtime action path with WebSocket agent-state smoke;
    Chrome automation was attempted but blocked by tool timeouts
  - [x] Verify AI integration with `RUN_INTEGRATION_TESTS=1 bun test ai/`
- [x] Phase 3: Move `GameAction` into a shared command module
  - [x] Add shared `core/engine/game-action.command.ts` schema and type
  - [x] Make Party protocol adapt/re-export the shared command schema
  - [x] Move AI, CLI, Party action, and web sender imports to the shared
    command module
  - [x] Verify no AI/CLI imports from `app/party/protocol.types`
  - [x] Verify with targeted tests, typecheck, full suite, build, and CLI
    command-mode smoke
- [x] Phase 4: Split room side effects into domain events and broadcast projection
  - [x] Rename game action side-effect outputs to domain event names
  - [x] Add `game-action-event.projection` for per-recipient server message
    projection
  - [x] Keep `MayIRoom` as the WebSocket adapter that stores state, sends
    projected messages, and invokes AI continuations
  - [x] Verify May-I prompt and final-round transition projection through live
    WebSocket smoke checks; Chrome automation remained blocked by local tool
    timeouts
- [x] Phase 5: Create typed UI player-action intents
  - [x] Add typed `PlayerActionIntent` resolver for command mapping, drawer
    transitions, and payload validation
  - [x] Wire ActionBar, HandDrawer, desktop footer, mobile discard context, and
    GameView state through typed intents
  - [x] Simplify the route to send already-formed shared `GameAction`
    commands, including May-I allow/claim
  - [x] Verify UI intent tests, full type/test/build ladder, and live
    WebSocket draw/reorder/discard fallback; Chrome automation remained blocked
- [x] Phase 6: Move shared rendering, prompt, and activity text out of CLI
  - [x] Move Party activity/card text off `cli/shared/cli.renderer`
  - [x] Move AI prompt rendering under the AI seam with direct prompt-renderer
    tests
  - [x] Move meld numbering to a shared core module re-exported by CLI
  - [x] Add shared activity log entry creation and display formatting used by
    CLI, Party, and web activity rendering
  - [x] Verify with import checks, targeted renderer/activity tests, full
    type/test/build ladder, and AI integration
- [x] Phase 7: Clean up projection, persistence, availability, and command results
  - [x] Extract XState-to-`GameSnapshot` projection into an engine-owned
    projection module with fixture coverage
  - [x] Add a versioned engine persistence envelope while preserving legacy
    snapshot restore compatibility
  - [x] Share command availability and execution preflight through a core
    command policy module
  - [x] Return explicit accepted/rejected action results from the Party action
    adapter
  - [x] Add explicit card-invariant policies for projection warning,
    persistence rejection, and test failure
  - [x] Verify final system gate with CLI full round, live realtime smoke,
    full test/build ladder, and AI integration

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

Verification note:

- 2026-05-14: Chrome DevTools automation timed out when listing/opening
  pages, and Computer Use could not attach to Chrome (`cgWindowNotFound`).
  As a fallback, a local WebSocket smoke against the dev server injected an
  agent state, performed human draw/skip/discard through `GAME_ACTION`, and
  observed live AI turns run through the queued action path.

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
bun test app/party/mayi-room.message-handlers.test.ts app/party/protocol.types.test.ts app/party/game-action-event.projection.test.ts app/party/round-summary.capture.test.ts app/party/party-game-adapter.test.ts app/party/game-action-executor.test.ts app/party/queued-game-action.test.ts
bun run typecheck
bun test
bun run build
```

Browser gate:

- Chrome E2E quick start.
- Chrome E2E injected May-I prompt state.
- Chrome E2E injected round-end state.

Phase 4 result:

- Focused Party projection and queued-action tests passed.
- `bun run typecheck`, `bun test`, and `bun run build` passed.
- Local WebSocket fallback May-I smoke passed: three human clients joined,
  started a game, a non-current player called May-I, notification reached all
  clients, and exactly one prompted player received `MAY_I_PROMPT`.
- Local WebSocket fallback final-round smoke passed: agent harness injected a
  round 6 state, the human laid down all cards, and the room emitted
  `ROUND_ENDED` plus `GAME_ENDED` with winner and score payloads.
- Chrome E2E remains blocked by the same local automation issue recorded in
  Phase 2; the fallback used the actual dev server WebSocket path.

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

Phase 5 result:

- Added `player-action.intent` as the typed seam between UI controls, local
  drawer transitions, and shared game commands.
- `ActionBar`, `HandDrawer`, `GameViewDesktopFooter`,
  `GameViewMobileDiscardContext`, and `useGameViewState` now pass typed intents
  instead of `string` plus `unknown` payloads.
- `game.$roomId` no longer casts UI payloads into commands; it sends shared
  `GameAction` values and handles May-I prompt responses through the same send
  path.
- Verification passed: targeted route/UI tests, `bun run typecheck`,
  `bun test`, and `bun run build`.
- Chrome DevTools remained blocked; even `list_pages` timed out. Fallback live
  WebSocket smoke passed by starting a three-human room and performing
  draw-from-stock, hand reorder, skip, and discard with shared `GameAction`
  commands.

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

Phase 6 result:

- `app/party` and `ai` no longer import `cli/shared/cli.renderer`.
- Party action logging now uses core card text directly.
- AI prompt rendering lives in `ai/mayIAgent.prompt-renderer` with direct tests
  for privacy, table rendering, May-I prompts, and available actions.
- Meld numbering lives in `core/meld/meld-numbering`; CLI keeps a compatibility
  re-export.
- Activity log entry creation and display formatting live in
  `core/activity/activity-log.format`, with CLI, Party, and web formatting using
  the shared seam.
- Verification passed: import check, targeted CLI/AI/Party/activity tests,
  `bun run typecheck`, `bun test`, `bun run build`, and
  `RUN_INTEGRATION_TESTS=1 bun test ai/`.

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
bun test core/engine/game-engine*.test.ts core/engine/available-actions.test.ts core/engine/card-state.invariants.test.ts core/engine/card-state.invariant-policy.test.ts core/engine/game-action.command-policy.test.ts
bun test app/party/game-actions.test.ts app/party/game-action-executor.test.ts cli/shared/cli-game-adapter.test.ts ai/mayIAgent.tools.test.ts
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

Phase 7 result:

- Extracted `GameSnapshot` projection to `core/engine/game-engine.projection`
  and covered round-owned card state, May-I resolution, round/game end states,
  and duplicate-card warning behavior.
- Added `core/engine/game-engine.persistence` so CLI, Party, and agent-state
  injection restore through a versioned engine persistence envelope instead of
  reaching into raw nested actor layout.
- Added `core/engine/game-action.command-policy` and wired Party human action
  execution through it, with `ActionResult.status` now explicitly reporting
  `accepted` or `rejected`.
- Added `core/engine/card-state.invariant-policy` so snapshot projection warns,
  persisted action commits reject, and tests can fail fast on invariant
  violations.
- Verification passed: red tests were run before implementation for projection,
  persistence, command policy, action result status, and invariant policy;
  targeted Phase 7 engine/Party/CLI/AI tests passed; `bun run typecheck`,
  `bun test`, and `bun run build` passed.
- Final CLI gate passed with deterministic `ARCHP7CLI`: status began in Round 1
  `AWAITING_DISCARD`, `discard 1` advanced to Round 2, scores were recorded, and
  the log showed `Closer went out - Round 1 complete`.
- Chrome automation remained blocked: `mcp__chrome_devtools__.list_pages`
  timed out after 120 seconds on 2026-05-14. Live dev-server WebSocket fallback
  passed instead: quick start emitted `GAME_STARTED`; a three-human room
  performed draw, hand reorder, skip, discard, May-I call, prompted allow, and
  resolution; an injected round-end room emitted `ROUND_ENDED` for Round 1 and
  `GAME_STATE` for Round 2.
- AI integration passed with `RUN_INTEGRATION_TESTS=1 bun test ai/` across all
  54 AI tests and live provider connectivity checks.

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
