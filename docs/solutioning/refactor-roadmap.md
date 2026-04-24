# Solutioning Roadmap: Duplicate-Card Refactors

## Summary

The four proposed improvements are related, but they are not one giant inseparable project.

They address two different classes of risk:

- Core engine state ownership risk: card state is split between round and turn actors.
- Realtime persistence/concurrency risk: human and AI actions can write through different paths.

The recommended path is to land the low-risk enabling work first, then tackle the larger refactors with stronger tests.

## The Four Improvements

| Improvement | Primary Area | Main Problem Solved | Can Stand Alone? |
|-------------|--------------|---------------------|------------------|
| Shared card-state invariants | `core/engine`, `app/party` | Detect duplicate physical card IDs consistently | Yes |
| Remove turn-level reorder/sync dead code | `core/engine` | Remove stale reorder implementation and reduce confusion | Yes |
| Single owner for card state | `core/engine` | Remove parent/child card-state drift | Yes, but benefits from invariants first |
| Unified human/AI action pipeline | `app/party` | Remove stale AI snapshot writes and human/AI path differences | Yes, but benefits from invariants first |

## Dependency Graph

```text
Shared card-state invariants
  |                  |
  v                  v
Unified action      Single owner for
pipeline            card state

Remove turn-level reorder/sync dead code
  |
  v
Single owner for card state
```

Recommended dependencies:

- Build shared invariants before enforcing save-time validation.
- Remove stale turn reorder before the single-owner refactor.
- Use invariants during both the single-owner refactor and unified action pipeline.

Hard dependencies:

- None of the four must land before any other from a compiler perspective.
- The only practical hard rule is avoiding simultaneous edits to the same files without coordination.

## Isolation Analysis

### Shared Card-State Invariants

Isolation level: high.

This can be implemented and shipped independently. It starts as a pure module plus test coverage. Replacing existing duplicate checks in `GameEngine` and PartyKit is incremental.

Files likely touched:

- `core/engine/card-state.invariants.ts`
- `core/engine/card-state.invariants.test.ts`
- `core/engine/game-engine.ts`
- `app/party/party-game-adapter.ts`
- duplicate regression tests

Can be done without the others:

- Yes. It improves observability even if no architecture changes happen.

Can be done in parallel:

- Yes, with the unified action pipeline if the invariant API is agreed first.
- Yes, with turn reorder cleanup if they avoid overlapping `game-engine.ts`.
- It may conflict with the single-owner refactor if both rewrite snapshot extraction at the same time.

Best timing:

- First or very early.

Why it helps the others:

- The single-owner refactor needs an easy way to prove every card has one owner.
- The unified pipeline needs a save-time validation gate.
- Existing duplicate tests can reuse the same helper instead of local ad hoc checks.

### Remove Turn-Level Reorder And Sync Dead Code

Isolation level: high to medium.

This is a narrow core cleanup. It removes misleading `TurnMachine` reorder code and simplifies the current sync path. It does not require PartyKit changes beyond regression tests.

Files likely touched:

- `core/engine/turn.machine.ts`
- `core/engine/round.machine.ts`
- `core/engine/round.machine.reorder.test.ts`
- `core/engine/turn.machine.test.ts`

Can be done without the others:

- Yes. It is valuable on its own because it removes dead behavior and duplicate validation.

Can be done in parallel:

- Yes, with shared invariants if coordinated.
- Yes, with unified action pipeline because they touch mostly different areas.
- No, not safely with the single-owner card-state refactor. Both edit `round.machine.ts` and `turn.machine.ts` around the same responsibilities.

Best timing:

- Before single-owner card state.

Why it helps the others:

- It reduces the number of reorder paths before moving card ownership.
- It removes stale `TurnMachine` concepts that would otherwise confuse the larger refactor.

### Single Owner For Card State

Isolation level: medium.

This is a core engine refactor. It can ship without changing PartyKit's action pipeline because the public `GameEngine` API should stay the same. However, it touches enough rule behavior that it should not be treated as a small cleanup.

Files likely touched:

- `core/engine/round.machine.ts`
- `core/engine/turn.machine.ts`
- `core/engine/game-engine.ts`
- new `core/engine/round.card-state.ts`
- many core tests
- some PartyKit tests because snapshots may simplify

Can be done without the others:

- Yes. It directly fixes the core state-ownership smell.
- But it is much safer after shared invariants exist.
- It is cleaner after stale turn reorder code is removed.

Can be done in parallel:

- Not with turn reorder cleanup.
- Not with another core-machine refactor.
- It can run in parallel with unified action pipeline only if teams agree that `GameEngine` public APIs and `GameSnapshot` shape are stable. Expect occasional rebase conflicts in tests.

Best timing:

- After invariants and turn reorder cleanup.

Why it helps the others:

- It reduces the amount of snapshot patching the unified action pipeline needs to worry about.
- It makes save-time invariant failures more meaningful because card zones have one owner.

### Unified Human And AI Action Pipeline

Isolation level: medium to high.

This is mostly an app/PartyKit refactor. It can ship while the core engine still has split card ownership because it operates at the action/persistence boundary.

Files likely touched:

- `app/party/game-action-executor.ts`
- `app/party/game-action-queue.ts`
- `app/party/mayi-room.ts`
- `app/party/ai-turn-coordinator.ts`
- `app/party/party-game-adapter.ts`
- PartyKit and AI tests

Can be done without the others:

- Yes. It removes stale AI snapshot writes even if core card ownership remains split.
- But save-time invariant validation is much better if shared invariants exist first.

Can be done in parallel:

- Yes, with turn reorder cleanup.
- Yes, with shared invariants after agreeing on the invariant API.
- Cautiously with single-owner card state, because both may update tests around snapshots, duplicates, and PartyKit adapter behavior.

Best timing:

- Start after shared invariants are available.
- It does not need to wait for single-owner card state.

Why it helps the others:

- It removes a separate source of duplicate-card risk: stale whole-snapshot writes.
- It makes human-only and AI games exercise the same persistence path.

## Recommended Sequence

### Step 1: Shared Card-State Invariants

Reason:

- Lowest risk.
- Improves test quality immediately.
- Gives later work a common validation gate.

Deliverable:

- `validateCardZones(...)`.
- Zone builders for snapshots/round state.
- `GameEngine` and PartyKit duplicate checks use the shared module.

### Step 2: Remove Turn-Level Reorder Dead Code

Reason:

- Small, isolated cleanup.
- Reduces confusion before larger core changes.

Deliverable:

- `TurnMachine` no longer exposes user `REORDER_HAND`.
- `RoundMachine` is the only engine machine handling reorder.
- Public web/CLI reorder behavior unchanged.

### Step 3: Unified Action Executor And Queue

Reason:

- Addresses realtime race conditions without waiting for the core ownership refactor.
- Gives human and AI actions the same mutation path.

Deliverable:

- Shared executor applies each action to latest stored state.
- Queue serializes mutations.
- Revisions increment per successful action.
- AI can begin migrating away from long-lived stale adapters.

### Step 4: Single Owner For Card State

Reason:

- Biggest core simplification.
- Safer after invariants and reorder cleanup.

Deliverable:

- `RoundMachine` owns hands, stock, discard, and table.
- `TurnMachine` owns phase/turn-local flags only, or is folded into round logic.
- `GameEngine` snapshot extraction no longer merges child card state.

### Step 5: Finish AI Per-Action Migration

Reason:

- Once the executor exists and core snapshots are simpler, remove the stale merge helper completely.

Deliverable:

- AI plans one action at a time from latest state.
- `mergeAIStatePreservingOtherPlayerHands` is deleted.
- Merge-specific race tests are replaced by queue/executor race tests.

## Parallel Work Plan

Safe parallel tracks:

- Track A: Shared invariants.
- Track B: Turn reorder cleanup.
- Track C: PartyKit executor scaffolding.

Coordination needed:

- Track A and Track C should agree on the invariant report shape.
- Track B and single-owner should not both edit `round.machine.ts` at the same time.
- Track C and single-owner should agree that `GameSnapshot` stays backward compatible.

Avoid parallelizing:

- Single-owner card state and turn reorder cleanup.
- Single-owner card state and any unrelated core XState refactor.
- AI per-action migration and removal of the merge helper in separate branches unless the executor contract is already stable.

## What Can Ship Independently

### Invariants Only

Can ship: yes.

Impact:

- Better duplicate detection and logs.
- No gameplay behavior change unless callers start rejecting invalid states.

Risk:

- Low, if the first adoption only logs/reports and does not reject.

### Reorder Cleanup Only

Can ship: yes.

Impact:

- Less confusing internals.
- Reorder behavior should remain unchanged.

Risk:

- Low to medium, because `TurnMachine` type cleanup can reveal hidden stale tests/callers.

### Unified Pipeline Only

Can ship: yes.

Impact:

- Human and AI actions become safer around stale state.
- AI games should behave more like human-only games.

Risk:

- Medium, because queue ordering and side effects affect real-time UX.

### Single Owner Only

Can ship: yes.

Impact:

- Removes core card-state drift.
- Simplifies snapshot extraction.

Risk:

- Medium to high, because it touches core rule execution.

## How They Relate Conceptually

The improvements form two layers:

```text
Layer 1: Engine correctness
  - Shared card-state invariants
  - Remove stale turn reorder code
  - Single owner for card state

Layer 2: Realtime correctness
  - Shared card-state invariants
  - Unified human/AI action pipeline
```

Shared invariants sit in both layers because they are the diagnostic and enforcement tool.

Single-owner card state prevents the engine from manufacturing duplicate ownership internally.

Unified action pipeline prevents the room from reintroducing stale state through persistence races.

Both are valuable independently. Together, they close both sides of the bug class:

- The engine should not create duplicate card ownership.
- The realtime layer should not resurrect old card ownership.

## Verification Across The Whole Program

When multiple improvements are combined, use the superset verification gate:

```bash
bun run typecheck
bun test
bun run build
```

Focused suites:

```bash
bun test core/engine/card-state.invariants.test.ts
bun test core/engine/round.machine.reorder.test.ts
bun test core/engine/round.machine.reorder-race.test.ts
bun test core/engine/roundMachine.mayI.test.ts
bun test core/engine/game-engine.duplicate-restore.test.ts
bun test app/party/game-actions.test.ts
bun test app/party/mayi-room.message-handlers.test.ts
bun test app/party/party-game-adapter.merge.test.ts
bun test app/party/ai-turn-coordinator.reorder-race.test.ts
bun test app/party/bug-44-may-i-duplicate-cards.test.ts
```

Optional integration:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

Manual smoke:

- Three-human web game with repeated reorder, draw, discard, and May-I.
- Human reorder during AI thinking.
- Human May-I during AI thinking.
- Later-round game with several May-I claims.
- CLI custom states for draw/discard/May-I/reorder restore.

Do not deploy combined refactors unless the full suite, build, and at least one web manual smoke pass.
