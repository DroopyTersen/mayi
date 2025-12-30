# XState Game Engine Architecture

The May I? game engine uses XState v5's hierarchical actor model. Each machine is independently testable and composes into a full game loop via the `invoke` pattern.

## Machine Hierarchy

```
GameMachine (root)
├─ invokes → RoundMachine (one round at a time)
│  └─ invokes → TurnMachine (one turn at a time)
│     └─ invokes → MayIWindowMachine (after drawing from stock)
```

Each parent **invokes** its child when entering a specific state. The child runs until reaching a final state, then returns output to the parent via `onDone`.

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GameMachine                                                             │
│  States: setup → playing → roundEnd → gameEnd                            │
│                                                                          │
│  playing state invokes RoundMachine:                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  RoundMachine                                                        ││
│  │  States: dealing → active → scoring (final)                          ││
│  │                                                                      ││
│  │  active state invokes TurnMachine:                                   ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │  TurnMachine                                                     │││
│  │  │  States: awaitingDraw → mayIWindow → drawn → awaitingDiscard     │││
│  │  │          → turnComplete (final) | wentOut (final)                │││
│  │  │                                                                  │││
│  │  │  mayIWindow state invokes MayIWindowMachine:                     │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐│││
│  │  │  │  MayIWindowMachine                                           ││││
│  │  │  │  States: open → resolvingClaims → resolved/closedNoClaim     ││││
│  │  │  └─────────────────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## The Four Machines

### GameMachine (`core/engine/game.machine.ts`)

Manages the full game lifecycle across 6 rounds.

**States:**
- `setup` - Adding players (3-8 required)
- `playing` - Invokes RoundMachine for current round
- `roundEnd` - Transient state that checks if game is over
- `gameEnd` - Final state with winners

**Key Events:**
- `ADD_PLAYER` - Add a player during setup
- `START_GAME` - Begin the game
- All gameplay events are forwarded to the invoked RoundMachine

### RoundMachine (`core/engine/round.machine.ts`)

Manages a single round with dealing, turns, and scoring.

**States:**
- `dealing` - Entry action deals cards to all players
- `active` - Invokes TurnMachine for current player
- `scoring` - Final state, calculates round scores

**Input:** `RoundInput` with players, round number, dealer index
**Output:** `RoundOutput` with `RoundRecord` (scores, winner)

**Key Feature:** Supports `predefinedState` input for deterministic testing.

### TurnMachine (`core/engine/turn.machine.ts`)

Manages a single player's turn with draw, laydown, layoff, and discard phases.

**States:**
- `awaitingDraw` - Waiting for draw from stock or discard
- `mayIWindow` - Invokes MayIWindowMachine when drawing from stock
- `drawn` - Can lay down, lay off, swap jokers, or skip to discard
- `awaitingDiscard` - Must discard to end turn
- `turnComplete` - Final state (normal turn end)
- `wentOut` - Final state (player emptied hand)

**Input:** `TurnInput` with player hand, piles, table state
**Output:** `TurnOutput` with updated state, `wentOut` flag, May I results

### MayIWindowMachine (`core/engine/mayIWindow.machine.ts`)

Handles the May I claiming window after a stock draw.

**States:**
- `open` - Collecting claims, waiting for current player decision
- `resolvingClaims` - Determines winner by priority
- `closedByCurrentPlayer` - Current player took the discard
- `resolved` - A May I claimant won
- `closedNoClaim` - No claims, window closed

**Priority:** Players closest in turn order to the current player have priority.

**Penalty:** May I winner receives the claimed card + 1 penalty card from stock.

## Event Routing

All external code sends events to the **root GameActor** only:

```typescript
import { createGameActor } from "./core/engine/game.actor";

const actor = createGameActor({
  playerNames: ["Alice", "Bob", "Carol"],
  autoStart: true,
});

// All events go to the root - XState routes to active child
actor.send({ type: "DRAW_FROM_STOCK" });
actor.send({ type: "CALL_MAY_I", playerId: "player-1" });
actor.send({ type: "DISCARD", cardId: "card-123" });
```

Parent machines use `sendTo` to forward events to invoked children:

```typescript
// In game.machine.ts
on: {
  DRAW_FROM_STOCK: { actions: sendTo("round", ({ event }) => event) },
  // ...
}
```

## Testing Strategy

### Isolation Testing

Each machine is testable independently by creating actors directly:

```typescript
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";

test("drawing from stock opens May I window", () => {
  const actor = createActor(turnMachine, {
    input: {
      playerId: "player-0",
      hand: [/* cards */],
      stock: [/* cards */],
      discard: [/* cards */],
      table: [],
      roundNumber: 1,
      isDown: false,
      playerOrder: ["player-0", "player-1", "player-2"],
      playerDownStatus: { "player-0": false, "player-1": false, "player-2": false },
    },
  }).start();

  actor.send({ type: "DRAW_FROM_STOCK" });

  // Verify May I window is open
  const state = actor.getSnapshot().value;
  expect(state).toEqual({ mayIWindow: "open" });
});
```

### Integration Testing

Full game flow via root GameActor:

```typescript
import { createGameActor, getSerializableState } from "./game.actor";

test("complete turn flow", () => {
  const actor = createGameActor({
    playerNames: ["Alice", "Bob", "Carol"],
    autoStart: true,
  });

  actor.send({ type: "DRAW_FROM_STOCK" });
  // May I window opens, all pass
  actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-0" }); // current player passes
  actor.send({ type: "SKIP_LAY_DOWN" });

  const hand = getHandFromSnapshot(actor);
  actor.send({ type: "DISCARD", cardId: hand[0].id });

  const state = getSerializableState(actor);
  expect(state.currentPlayerIndex).toBe(1); // Turn advanced
});
```

### Deterministic Testing with PredefinedState

RoundMachine accepts a `predefinedState` for testing specific scenarios:

```typescript
const actor = createActor(roundMachine, {
  input: {
    roundNumber: 1,
    players: [/* players */],
    dealerIndex: 0,
    predefinedState: {
      hands: [
        [/* Alice's exact cards */],
        [/* Bob's exact cards */],
        [/* Carol's exact cards */],
      ],
      stock: [/* exact stock pile */],
      discard: [/* exact discard pile */],
    },
  },
}).start();
```

## Accessing Hierarchical State

XState v5's `getPersistedSnapshot()` provides deep access to invoked actor state:

```typescript
const actor = createGameActor({ playerNames: ["A", "B", "C"], autoStart: true });

// Get the full hierarchy
const persisted = actor.getPersistedSnapshot() as any;

// Access round state
const roundSnapshot = persisted.children?.round?.snapshot;
const roundContext = roundSnapshot?.context; // players, stock, discard, table

// Access turn state
const turnSnapshot = roundSnapshot?.children?.turn?.snapshot;
const turnContext = turnSnapshot?.context; // hand, hasDrawn, isDown

// Access May I window state (when active)
const mayISnapshot = turnSnapshot?.children?.mayIWindow?.snapshot;
const mayIContext = mayISnapshot?.context; // claimants, winnerId
```

The `getSerializableState()` helper in `game.actor.ts` flattens this hierarchy into a single object for persistence/serialization.

## Key Files

| File | Purpose |
|------|---------|
| `core/engine/game.machine.ts` | Game lifecycle, invokes rounds |
| `core/engine/round.machine.ts` | Round lifecycle, dealing, invokes turns |
| `core/engine/turn.machine.ts` | Turn phases, invokes May I window |
| `core/engine/mayIWindow.machine.ts` | May I claim resolution |
| `core/engine/game.actor.ts` | Factory and serialization helpers |
| `core/engine/contracts.ts` | Round contract definitions |
| `core/engine/guards.ts` | Shared guard functions |

## The May I Mechanic

The May I mechanic allows non-current players to claim a discarded card when the current player draws from stock.

### When May I Opens

1. Current player sends `DRAW_FROM_STOCK`
2. TurnMachine checks `shouldOpenMayIWindow` guard:
   - Stock is not empty
   - Discard has a card
   - At least one other player is **not down** (eligible to claim)
3. If true, transitions to `mayIWindow` state and invokes MayIWindowMachine

### During the Window

- Other players can send `CALL_MAY_I` to register a claim
- Current player can:
  - `DRAW_FROM_STOCK` again to pass (close window)
  - `DRAW_FROM_DISCARD` to claim the card themselves (if not down)

### Resolution

When current player passes:
1. MayIWindowMachine transitions to `resolvingClaims`
2. Claims are resolved by priority (closest to current player wins)
3. Winner receives: claimed card + 1 penalty card from stock
4. Window closes, TurnMachine continues to `drawn` state

### Code Flow

```typescript
// turn.machine.ts - awaitingDraw state
DRAW_FROM_STOCK: [
  {
    guard: "shouldOpenMayIWindow",
    target: "mayIWindow",
    actions: [
      assign({ mayIDiscardTop: ({ context }) => context.discard[0] }),
      "drawFromStock",
    ],
  },
  // ...
]

// mayIWindow state invokes the machine
mayIWindow: {
  invoke: {
    src: "mayIWindowMachine",
    input: ({ context }): MayIWindowInput => ({
      discardedCard: context.mayIDiscardTop!,
      currentPlayerId: context.playerId,
      playerOrder: context.playerOrder,
      playerDownStatus: context.playerDownStatus,
      // ...
    }),
    onDone: {
      target: "drawn",
      actions: assign(({ context, event }) => {
        const output = event.output as MayIWindowOutput;
        // Apply May I result to state...
      }),
    },
  },
}
```
