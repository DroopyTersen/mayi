# Solution Design: Single Owner for Card State

## Summary

The current engine temporarily stores authoritative card state in two places:

- `RoundMachine` owns `players`, `stock`, `discard`, and `table` between turns.
- `TurnMachine` owns the current player's `hand`, `stock`, `discard`, and `table` during a turn.

This split made manual reordering fragile. Reorder is a round-level free action available to any player, but the current player's live hand and piles can be inside the child turn actor. The recent duplicate-card fix had to reach into the child actor, copy its hand/piles back to round context, and send sync events back to the child. That is a working patch, but the shape is a code smell.

The durable fix is to make one machine own all physical card locations at all times.

## The Issue

Card identity is a hard invariant: one physical card ID can exist in exactly one zone:

- one player's hand
- stock
- discard
- a table meld

The current architecture violates that mental model during active turns. A card drawn from stock moves into `TurnMachine.context.hand`, but the parent `RoundMachine.context.stock` can remain stale until turn completion. Likewise, drawing from discard or claiming May-I can update child state while parent piles lag behind.

That split creates these failure modes:

- A parent-level action can read stale piles while the child has the real piles.
- A child-level action can finish and overwrite a parent-level reorder.
- Snapshot extraction has to prefer child state for the current player, but parent state for everyone else.
- Persistence/merge code has to understand XState's nested persisted snapshot format.

Manual reordering exposed the bug because it is a free action that can occur while turn state is in progress. It is not inherently a "UI bug"; the UI just found the architectural gap.

## Why A Fix Is Better

A single card-state owner removes an entire class of bugs:

- No parent/child pile synchronization.
- No stale stock/discard resurrection after reorder.
- No need for `SYNC_HAND` and `SYNC_PILES` as correctness mechanisms.
- Easier duplicate-card invariant checks.
- Easier persistence and snapshot extraction.
- Human and AI actions become less special because all actions mutate the same canonical state.

This also matches the domain: a round owns the deck, discard pile, table, and all hands. A turn is a temporary flow over that round state.

## What The Fix Looks Like

Recommended target:

- `RoundMachine` owns all card locations for the round.
- `TurnMachine` owns only turn workflow state and validates turn event ordering.
- Turn actions return a patch or command result instead of storing canonical cards internally.

The final ownership model:

```text
GameMachine
└─ RoundMachine
   ├─ canonical cards:
   │  ├─ players[].hand
   │  ├─ stock
   │  ├─ discard
   │  └─ table
   └─ turn flow:
      ├─ currentPlayerIndex
      ├─ turnPhase
      ├─ hasDrawn
      ├─ laidDownThisTurn
      └─ tookActionThisTurn
```

`TurnMachine` can remain as a pure-ish turn phase machine, but it should not hold duplicate copies of the card piles. It should receive enough data to validate an event and return a patch for `RoundMachine` to apply.

## Options Considered

### Option 1: Minimal

Keep the current machines and add helper functions to read the active turn context safely.

Files:

| File | Change |
|------|--------|
| `core/engine/round.machine.ts` | Extract current turn context lookup into helpers. |
| `core/engine/game-engine.ts` | Centralize snapshot preference logic. |

Pros:

- Fast.
- Low immediate risk.
- Builds on the patch already shipped.

Cons:

- Still has two authoritative card stores.
- Still needs sync events.
- Does not remove the root smell.

### Option 2: Clean

Remove canonical card state from `TurnMachine` entirely.

Files:

| File | Change |
|------|--------|
| `core/engine/round.machine.ts` | Own and mutate all card state. |
| `core/engine/turn.machine.ts` | Keep only phase and turn-local booleans, or remove if no longer valuable. |
| `core/engine/game-engine.ts` | Stop merging child turn card state into snapshots. |
| `app/party/party-game-adapter.ts` | Remove nested snapshot card patching once no longer needed. |

Pros:

- Strongest invariant.
- Simplifies persistence and snapshots.
- Makes networking races easier to reason about.

Cons:

- Highest refactor risk.
- Touches core turn flow, May-I, laydown, layoff, joker swap, and scoring.
- Needs broad regression tests.

### Option 3: Pragmatic

Move stock/discard/table ownership to `RoundMachine` first, then migrate current-player hand ownership.

Files:

| File | Change |
|------|--------|
| `core/engine/round.machine.ts` | Apply draw/discard/laydown/layoff/swap card mutations in round context. |
| `core/engine/turn.machine.ts` | Gradually replace card arrays with selectors or event inputs. |
| `core/engine/game-engine.ts` | Reduce child-state snapshot preference step by step. |

Pros:

- Reduces the most dangerous stale pile bugs first.
- Allows smaller testable PRs.
- Keeps the turn phase machine if it still adds clarity.

Cons:

- Intermediate state still has some split ownership.
- Requires a clear migration checklist so the team does not stop halfway.

## Recommendation

Use Option 3.

The clean end state is correct, but moving all card ownership in one PR is too risky for a rules-heavy game. The pragmatic path lets the team remove the most dangerous class first: stale stock/discard/table duplication.

## Coding Plan

### Phase 1: Add Failing Tests For Ownership Drift

Write tests before implementation.

Add or extend:

- `core/engine/round.machine.card-ownership.test.ts`
- `core/engine/game-engine.card-invariants.test.ts`

Test cases:

- Drawing from stock immediately removes that card from the round-level stock in the persisted snapshot.
- Drawing from discard immediately removes that card from the round-level discard in the persisted snapshot.
- Reordering the current player after a draw does not have to sync piles.
- Reordering a non-current player during the current player's turn cannot change stock/discard/table.
- Laydown and layoff update a single canonical table.
- Restoring from persisted snapshot after each turn phase has no hand/pile overlap.

### Phase 2: Introduce Round-Level Card Patch Helpers

Create:

- `core/engine/round.card-state.ts`
- `core/engine/round.card-state.test.ts`

Suggested API:

```ts
interface RoundCardState {
  players: Player[];
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
}

type RoundCardPatch = Partial<Pick<RoundCardState, "players" | "stock" | "discard" | "table">>;

function applyDrawFromStock(state: RoundCardState): RoundCardPatch;
function applyDrawFromDiscard(state: RoundCardState): RoundCardPatch;
function applyDiscard(state: RoundCardState, cardId: string): RoundCardPatch;
function applyReorderHand(state: RoundCardState, playerId: string, cardIds: string[]): RoundCardPatch;
```

Keep these helpers pure. They should not know about XState.

### Phase 3: Move Pile Mutations To RoundMachine

Update `RoundMachine` so `DRAW_FROM_STOCK` and `DRAW_FROM_DISCARD` mutate `context.stock`, `context.discard`, and current player hand directly before or instead of forwarding to `TurnMachine`.

During the transition, the child `TurnMachine` can still receive a smaller event like:

```ts
{ type: "MARK_DRAWN"; source: "stock" | "discard" }
```

or it can receive the original draw event only for phase transition, without owning the pile arrays.

### Phase 4: Move Current-Player Hand Ownership

Change current-player hand mutations:

- `LAY_DOWN`
- `LAY_OFF`
- `SWAP_JOKER`
- `DISCARD`

so they update `RoundMachine.context.players[currentPlayerIndex].hand` directly.

`TurnMachine` should validate phase and set turn-local flags, but should not return authoritative card arrays.

### Phase 5: Simplify Snapshot Extraction

Update `GameEngine.extractGameSnapshot()`:

- Remove the "prefer turn context hand for current player" branch.
- Remove fallback filtering for missing `turnContext.discard`.
- Read players, stock, discard, and table only from `RoundMachine`.

### Phase 6: Remove Sync Events

Remove or make obsolete:

- `SYNC_HAND`
- `SYNC_PILES`
- round action `syncTurnHand`
- round action `syncTurnPiles`
- turn context card copies once no longer used

## Verification Instructions

This is the highest-risk refactor in the set. Verification must prove that every physical card ID has exactly one owner after every command, after persistence/restore, and after web/PartyKit action handling.

### Red Test Requirement

Before changing implementation code, add failing tests for the exact ownership drift being removed.

Required red tests:

- `core/engine/round.machine.card-ownership.test.ts`
  - Drawing from stock immediately removes the drawn card from round-level stock, even before turn completion.
  - Drawing from discard immediately removes the claimed card from round-level discard, even before turn completion.
  - Reordering the current player after drawing does not change stock/discard/table.
  - Reordering a non-current player while the current player has drawn does not change stock/discard/table.
  - May-I claim by a non-current player moves the claimed discard and penalty card into exactly one hand and out of piles.
  - Current-player May-I claim behaves like drawing from discard and does not add a penalty card.
- `core/engine/game-engine.card-invariants.test.ts`
  - `getSnapshot()` has no duplicate card IDs after each phase of a turn.
  - `getPersistedSnapshot()` followed by `fromPersistedSnapshot()` has no duplicate card IDs after each phase of a turn.
  - Restoring while the current player is in `AWAITING_ACTION` preserves the drawn card exactly once.
  - Restoring while the current player is in `AWAITING_DISCARD` preserves laydown/layoff/table cards exactly once.

Each red test should fail against the pre-refactor code for the reason the refactor is meant to remove. Do not write broad "snapshot is valid" tests only; include assertions for the specific card IDs moved by the command.

### Unit Tests

Run pure helper tests first. These should be fast and should not require actors or PartyKit.

Required files:

- `core/engine/round.card-state.test.ts`
- `core/engine/card-state.invariants.test.ts`, if the invariant module has landed

Required scenarios:

- `applyDrawFromStock` adds exactly `stock[0]` to current player's hand and removes only that card from stock.
- `applyDrawFromStock` replenishes stock from discard using the same house-rule behavior as the current engine.
- `applyDrawFromDiscard` adds exactly `discard[0]` to current player's hand and removes only that card from discard.
- `applyDiscard` removes only one physical card from hand and pushes it to `discard[0]`.
- `applyReorderHand` preserves the same card IDs and only changes order.
- `applyLayDown`, `applyLayOff`, and `applySwapJoker`, if extracted, move cards between hand/table exactly once.
- Invalid commands return an error or no-op patch without mutating input arrays.

Commands:

```bash
bun test core/engine/round.card-state.test.ts
bun test core/engine/card-state.invariants.test.ts
```

### Machine Tests

Run machine-level tests after each implementation phase. These prove XState transitions still apply the pure helpers correctly.

Required commands:

```bash
bun test core/engine/round.machine.card-ownership.test.ts
bun test core/engine/round.machine.reorder.test.ts
bun test core/engine/round.machine.reorder-race.test.ts
bun test core/engine/roundMachine.mayI.test.ts
bun test core/engine/turn.machine.test.ts
bun test core/engine/game-engine.round.test.ts
```

Required assertions:

- Turn phase still advances correctly: `AWAITING_DRAW` -> `AWAITING_ACTION` -> `AWAITING_DISCARD` -> next turn.
- Current player hand count changes by the expected amount for draw/discard/laydown/layoff.
- Stock and discard counts change by the expected amount for draw/discard/May-I.
- Table melds contain the expected cards after laydown/layoff/swap.
- Reorder remains a free action and does not consume the turn.
- Invalid reorder does not change hand, stock, discard, or table.
- Round 6 "lay down all cards" behavior still works.
- May-I priority order and prompted player behavior are unchanged.

### Engine Persistence Tests

The refactor changes where state is read from, so persistence must be tested directly.

Required commands:

```bash
bun test core/engine/game-engine.duplicate-restore.test.ts
bun test core/engine/game-engine.draw-discard-persistence.test.ts
bun test core/engine/game-engine.turn-discard-fallback-duplicate.test.ts
bun test core/engine/game-engine.xstate.test.ts
```

Required assertions:

- No fallback filtering is needed to hide duplicate discard cards.
- `GameEngine.getSnapshot()` reads card zones from the round owner.
- A persisted snapshot taken after every command restores to the same visible hands/piles/table.
- Duplicate warning tests still pass if corrupted snapshots are manually manufactured.
- `lastError` behavior remains unchanged for valid actions.

### PartyKit And Web Action Tests

Even though this is a core refactor, deployed failures were observed through WebSockets. Verify the app boundary.

Required commands:

```bash
bun test app/party/game-actions.test.ts
bun test app/party/mayi-room.message-handlers.test.ts
bun test app/party/party-game-adapter.test.ts
bun test app/party/party-game-adapter.merge.test.ts
bun test app/party/bug-44-may-i-duplicate-cards.test.ts
```

Required assertions:

- `REORDER_HAND` from the web protocol still reorders the correct player's hand.
- `CALL_MAY_I`, `ALLOW_MAY_I`, and `CLAIM_MAY_I` still produce the same side effects and prompts.
- Party adapter snapshots contain no hand/pile overlap after each action.
- Existing AI merge tests still pass until the unified action pipeline removes that merge path.

### AI And Integration Tests

Run non-LLM AI/fallback tests as part of normal validation. Real LLM integration tests are optional and should be run only when explicitly validating AI behavior.

Required commands:

```bash
bun test app/party/ai-turn-coordinator.reorder-race.test.ts
bun test app/party/ai-turn-coordinator.may-i-cards-disappear.test.ts
bun test app/party/ai-turn-handler.mayi-fallback.test.ts
bun test ai/mayIAgent.tools.test.ts
```

Optional real-provider integration:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

Do not require real LLM integration for every refactor PR unless AI planning behavior changed. Require it before a release if AI action generation or tool schemas changed.

### CLI Harness Tests

Use the CLI harness to prove the public command surface still works with persisted state.

Recommended scripted smoke:

```bash
bun cli/play.ts new
bun cli/play.ts list
```

Pick the created game ID and run:

```bash
bun cli/play.ts <game-id> status
bun cli/play.ts <game-id> draw stock
bun cli/play.ts <game-id> status --json
bun cli/play.ts <game-id> skip
bun cli/play.ts <game-id> discard 1
bun cli/play.ts <game-id> status --json
```

Custom-state harness checks:

1. Create `.data/card-owner-draw/game-state.json` with a current player about to draw from a known stock card.
2. Run `bun cli/play.ts card-owner-draw draw stock`.
3. Run `bun cli/play.ts card-owner-draw status --json`.
4. Verify the known card appears in exactly one hand and not in stock/discard/table.

Repeat with:

- draw from discard
- May-I claim
- laydown after draw
- reorder after draw
- restore after each command

### Web Manual Smoke

Run the local app:

```bash
bun run dev
```

Manual scenarios:

- Three-human game, two decks: repeatedly draw, reorder, discard, and May-I across rounds 1-3.
- Current player draws from discard, reorders, then discards a different card.
- Non-current player reorders while another human is in `AWAITING_ACTION`.
- Non-current player calls May-I while current player has not drawn.
- Prompted player claims May-I, then all players inspect hands.
- Later-round scenario after several May-I claims and reorders.

Use browser devtools or room logs to confirm no duplicate warning is emitted.

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

- Full test suite passes.
- No TypeScript errors.
- No duplicate-card warnings in focused tests.
- No `SYNC_HAND` or `SYNC_PILES` remains as a correctness dependency after the final phase.
- Existing CLI and web action APIs remain backward compatible.

## Rollout Notes

Do this behind tests, not a runtime feature flag. The public `GameEngine` API should not change. The deployed app should see the same actions and snapshots, only with simpler internals.

The highest-risk area is May-I resolution because it can add cards to non-current players while the current player's turn is still active. Treat May-I tests as required acceptance tests for every phase.
