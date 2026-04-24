# Solution Design: Remove Turn-Level Reorder And Sync Code

## Summary

`REORDER_HAND` is now handled at round level so any player can organize their hand at any time during an active round. However, `TurnMachine` still contains stale reorder event types, guards, actions, and error handling. The round machine also has sync actions that exist mainly to compensate for card state being split between round and turn contexts.

This doc covers the narrower cleanup: remove dead turn-level reorder behavior and simplify the current round-level sync code. This is smaller than the full single-owner card-state refactor, but it reduces confusion immediately.

## The Issue

There are two reorder concepts in the code:

- `RoundMachine` actually handles `REORDER_HAND` during `active.playing`.
- `TurnMachine` still declares `REORDER_HAND`, `canReorderHand`, `reorderHand`, and `setReorderError`, but its states do not handle the event.

This creates misleading code. A future change could accidentally re-enable turn-level reorder and bypass the round-level free-action rules. It also makes tests harder to interpret because there are two validation implementations:

- `core/engine/hand.reordering.ts`
- the stale `TurnMachine` reorder guard/action logic

The sync code is also more complex than it should be. The round action `reorderPlayerHand` computes the reordered hand, then `syncTurnHand` recomputes the same reorder result to send `SYNC_HAND` to the child.

## Why A Fix Is Better

Removing stale reorder code gives these benefits:

- One reorder validation path: `reorderHand` from `core/engine/hand.reordering.ts`.
- Fewer event types in `TurnMachine`.
- Less risk of divergent behavior between round and turn machines.
- Simpler code review for future reorder fixes.
- A smaller stepping stone toward full single-owner card state.

Even before the larger refactor, `REORDER_HAND` should be represented exactly once in the engine.

## What The Fix Looks Like

The desired near-term shape:

```text
REORDER_HAND
  |
  v
GameMachine forwards to RoundMachine
  |
  v
RoundMachine validates with hand.reordering.ts
  |
  v
RoundMachine updates the target player's hand
  |
  v
If target is current player, RoundMachine sends one explicit child update:
    SYNC_HAND
```

`TurnMachine` should not know about `REORDER_HAND`. If sync is still needed before the full card-state refactor, keep only `SYNC_HAND` as an internal event with a clear comment that it is not a user command.

## Options Considered

### Option 1: Minimal

Delete stale turn-level reorder guard/action code only.

Files:

| File | Change |
|------|--------|
| `core/engine/turn.machine.ts` | Remove `REORDER_HAND` from `TurnEvent`, remove `canReorderHand`, `reorderHand`, and `setReorderError`. |

Pros:

- Very small.
- Low risk.
- Removes misleading dead code.

Cons:

- Round sync still recomputes reorder.
- Card ownership is still split.

### Option 2: Clean

Do this as part of the single-owner card-state refactor and remove `SYNC_HAND` and `SYNC_PILES` too.

Files:

| File | Change |
|------|--------|
| `core/engine/round.machine.ts` | Own all card state and remove sync actions. |
| `core/engine/turn.machine.ts` | Remove all card arrays and card sync events. |

Pros:

- Cleanest final result.
- No temporary sync behavior.

Cons:

- Larger blast radius.
- Blocks this easy cleanup behind a bigger refactor.

### Option 3: Pragmatic

Remove dead turn-level reorder now, then simplify round sync to compute reorder once.

Files:

| File | Change |
|------|--------|
| `core/engine/turn.machine.ts` | Remove user-facing reorder event/guard/action. Keep internal `SYNC_HAND` temporarily. |
| `core/engine/round.machine.ts` | Share a small helper so `reorderPlayerHand` and `syncTurnHand` do not recompute. |
| `core/engine/round.machine.reorder.test.ts` | Assert current-player reorder still updates active turn hand. |

Pros:

- Removes misleading code now.
- Keeps current behavior stable.
- Makes the later single-owner refactor smaller.

Cons:

- Still has internal sync until the larger ownership work lands.

## Recommendation

Use Option 3.

It is small enough to do safely, and it removes the most confusing dead code without forcing the larger card-state refactor immediately.

## Coding Plan

### Phase 1: Add Failing Tests

Write tests first.

Add to `core/engine/turn.machine.test.ts`:

- Sending a user `REORDER_HAND` event to `TurnMachine` is no longer part of the public event contract.

Because this is TypeScript type-level cleanup, runtime tests should focus on behavior through `GameEngine` and `RoundMachine`:

Add to `core/engine/round.machine.reorder.test.ts`:

- Current player can reorder after drawing and then discard the moved card.
- Non-current player can reorder while current player has drawn.
- Invalid reorder does not change the hand and does not change active turn piles.

### Phase 2: Remove Turn Event And Guard

In `core/engine/turn.machine.ts`:

- Remove `| { type: "REORDER_HAND"; ... }` from `TurnEvent`.
- Remove guard `canReorderHand`.
- Remove action `reorderHand`.
- Remove action `setReorderError`.
- Remove stale comments that say reorder is handled by turn states.

Keep:

- `SYNC_HAND`, if still needed by `RoundMachine`.
- `SYNC_PILES`, if still needed by May-I and current patch behavior.

Rename comments around sync events:

```ts
// Internal parent-to-child sync used while card ownership is being migrated.
// User reorder commands are handled by RoundMachine, not TurnMachine.
```

### Phase 3: Avoid Recomputing Reorder In RoundMachine

In `core/engine/round.machine.ts`, extract a helper:

```ts
interface ReorderResolution {
  playerId: string;
  playerIndex: number;
  hand: Card[];
  reorderedHand: Card[];
  currentTurnContext: TurnMachineContext | null;
}

function resolveReorder(
  context: RoundContext,
  event: Extract<RoundEvent, { type: "REORDER_HAND" }>,
  self: ActorRefLike
): ReorderResolution | null;
```

XState action functions cannot easily share local state between `assign` and `sendTo`, so two options are acceptable:

- Use a pure helper in both places for clarity.
- Replace the two actions with one action object that sends the computed sync event from inside the same implementation, if XState usage stays readable.

The helper should be the same source of truth for:

- target player lookup
- current turn context lookup
- effective hand selection
- reorder validation

### Phase 4: Update Type Errors And Imports

After removing `REORDER_HAND` from `TurnEvent`, update any compiler failures. Expected locations:

- tests directly importing `TurnEvent`
- comments or helper utilities that still construct turn reorder events

Do not change web protocol. Client actions still send `REORDER_HAND`; only the turn actor stops accepting that user command.

## Verification Instructions

This cleanup should be behavior-preserving. Verification should prove that user-facing reorder still works through `RoundMachine`, while `TurnMachine` no longer contains or accepts user reorder behavior.

### Red Test Requirement

Before implementation, add tests that define the intended behavior.

Required red or characterization tests:

- `core/engine/round.machine.reorder.test.ts`
  - Current player can reorder after drawing and then discard the selected moved card.
  - Non-current player can reorder while current player is in `AWAITING_ACTION`.
  - Invalid reorder leaves the target hand unchanged.
  - Invalid reorder leaves active turn stock/discard unchanged.
- Type-level cleanup
  - Removing `REORDER_HAND` from `TurnEvent` should produce TypeScript errors in stale direct-turn tests or helpers until they are updated.

This change may not have a natural runtime red test because stale turn-level reorder code is currently unreachable. In that case, the red signal is the typecheck failure after removing the stale event from `TurnEvent`, followed by updating only legitimate callers.

### Unit Tests

Required commands:

```bash
bun test core/engine/hand.reordering.test.ts
bun test core/engine/turn.machine.test.ts
```

Required assertions:

- `hand.reordering.ts` remains the only reorder validation implementation.
- Reorder rejects duplicate IDs, missing IDs, extra IDs, and wrong-card IDs.
- `TurnMachine` draw/discard/laydown/layoff/swap behavior is unchanged.
- No `TurnMachine` test constructs a user `REORDER_HAND` event after cleanup.

### Round And Engine Tests

Required commands:

```bash
bun test core/engine/round.machine.reorder.test.ts
bun test core/engine/round.machine.reorder-race.test.ts
bun test core/engine/game-engine.round.test.ts
bun test core/engine/game-engine.xstate.test.ts
```

Required assertions:

- Reorder works through `GameEngine.reorderHand`.
- Reorder works before drawing, after drawing, and while awaiting discard.
- Reorder works for non-current players.
- Reorder remains available during an active round but not as a turn-consuming action.
- Current player's active turn hand stays in sync after reorder.
- Invalid reorder does not set up stale pile sync.

### PartyKit And Web Action Tests

The web protocol still uses `REORDER_HAND`, so app-level behavior must be unchanged.

Required commands:

```bash
bun test app/party/game-actions.test.ts --test-name-pattern REORDER_HAND
bun test app/party/mayi-room.message-handlers.test.ts --test-name-pattern REORDER_HAND
bun test app/party/party-game-adapter.test.ts --test-name-pattern reorderHand
```

If a test-name pattern misses coverage because names differ, run the whole file:

```bash
bun test app/party/game-actions.test.ts
bun test app/party/mayi-room.message-handlers.test.ts
bun test app/party/party-game-adapter.test.ts
```

Required assertions:

- Web `REORDER_HAND` maps to `GameEngine.reorderHand`.
- Missing `cardIds` still returns the same validation error.
- Reorder is still not logged as a noisy activity item unless that behavior is intentionally changed.
- Broadcasted player views show the new hand order.

### CLI Harness Tests

Interactive/manual CLI reorder should still work because it calls `GameEngine.reorderHand`.

Run:

```bash
bun cli/play.ts new
bun cli/play.ts <game-id> status --json
```

If command-mode reorder exists, run it directly. If reorder is only interactive, use interactive mode:

```bash
bun cli/play.ts --interactive
```

Manual CLI checks:

- Sort by rank and verify status reflects the new order.
- Sort by suit and verify status reflects the new order.
- Move a single card and verify status reflects the new order.
- Draw, reorder, skip, discard, and verify the discarded card is the intended one.

### Code Search Verification

After cleanup, run:

```bash
rg -n "REORDER_HAND|canReorderHand|setReorderError|reorderHand" core/engine/turn.machine.ts
rg -n "SYNC_HAND|SYNC_PILES" core/engine
```

Expected result:

- `turn.machine.ts` contains no user `REORDER_HAND` event, guard, or action.
- Any remaining `SYNC_HAND` or `SYNC_PILES` references are documented as internal transitional sync only.
- `RoundMachine` remains the only engine machine handling user reorder.

### Release Gate

Before merge/deploy:

```bash
bun run typecheck
bun test
bun run build
```

Acceptance criteria:

- User reorder behavior is unchanged.
- `TurnMachine` no longer contains stale reorder command code.
- The public web and CLI reorder APIs are unchanged.
- Full suite passes.

## Rollout Notes

This change should be invisible to users. It is internal cleanup only.

Do this before the single-owner card-state refactor. It reduces duplicate logic and makes the later diff easier to review.
