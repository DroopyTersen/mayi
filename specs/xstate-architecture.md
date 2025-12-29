# XState Architecture Refactor

## Overview

This document describes the refactoring of the May I? game engine from an imperative orchestrator pattern to a hierarchical XState actor model. The goal is to separate core game logic from CLI-specific concerns, enabling reuse across CLI, WebSocket (PartyKit), and future transports.

## Current State

### The Problem

`cli/harness/orchestrator.ts` (~1081 lines) is a monolith that mixes:
1. **Game engine logic** - state transitions, rules, validation
2. **CLI-specific concerns** - file persistence, action logging, rendering helpers

The orchestrator **reimplements** game logic that already exists (or should exist) in `core/engine/`'s XState machines, rather than using them.

### Existing Machines (Not Wired Together)

| Machine | File | Purpose | Status |
|---------|------|---------|--------|
| `gameMachine` | `game.machine.ts` | Game lifecycle (setup → playing → gameEnd) | Exists, unused |
| `roundMachine` | `round.machine.ts` | Single round (dealing → active → scoring) | Exists, unused |
| `turnMachine` | `turn.machine.ts` | Single turn (awaitingDraw → drawn → complete) | Exists, unused |
| `mayIWindowMachine` | `mayIWindow.machine.ts` | May I claiming window | Exists, unused |

## Target Architecture

### Machine Hierarchy

```
GameMachine (root)
├─ invokes → RoundMachine (one round at a time)
│  └─ invokes → TurnMachine (one turn at a time)
│     └─ invokes → MayIWindowMachine (after drawing from stock)
```

Each parent **invokes** its child when entering a specific state. The child runs until reaching a final state, then returns output to the parent via `onDone`.

### Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GameMachine                                                             │
│  States: setup → playing → gameEnd                                       │
│                                                                          │
│  playing state:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  invoke: RoundMachine                                                ││
│  │  onDone: more rounds? → re-invoke : → gameEnd                        ││
│  │                                                                      ││
│  │  RoundMachine                                                        ││
│  │  States: dealing → active → scoring (final)                          ││
│  │                                                                      ││
│  │  active state:                                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │  invoke: TurnMachine                                             │││
│  │  │  onDone: wentOut? → scoring : advanceTurn → re-invoke            │││
│  │  │                                                                  │││
│  │  │  TurnMachine                                                     │││
│  │  │  States: awaitingDraw → mayIWindow → drawn → discard → complete  │││
│  │  │                                                                  │││
│  │  │  After DRAW_FROM_STOCK:                                          │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐│││
│  │  │  │  invoke: MayIWindowMachine                                   ││││
│  │  │  │  onDone: apply result → drawn                                ││││
│  │  │  └─────────────────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### Event Flow

All external code (CLI, WebSocket) sends events to the **root GameActor** only:

```typescript
gameActor.send({ type: "DRAW_FROM_STOCK" });
gameActor.send({ type: "CALL_MAY_I" });
gameActor.send({ type: "DISCARD", cardId: "card-123" });
```

XState automatically routes events to the deepest active invoked actor. No manual forwarding needed.

### Transport Adapter Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                      Core Engine (core/engine/)                  │
│                                                                  │
│  GameActor (root XState actor)                                   │
│    ├─ send(event) → processes command                            │
│    ├─ getSnapshot() → current state                              │
│    ├─ getPersistedSnapshot() → serializable state                │
│    └─ subscribe() → state change notifications                   │
│                                                                  │
│  Inspection API captures all events for logging/replay           │
└───────────────────────────────────────────────────────────────────┘
                    ▲                         │
                    │ events                  │ snapshots
                    │                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Transport Adapters                          │
├─────────────────────┬───────────────────────────────────────────┤
│  CLI Adapter        │  WebSocket Adapter (future)               │
│  (cli/)             │  (app/party/)                             │
│                     │                                           │
│  - Parse commands   │  - Receive events via WebSocket           │
│  - actor.send()     │  - actor.send()                           │
│  - Render snapshot  │  - Broadcast snapshot to clients          │
│  - File persistence │  - D1 persistence                         │
│  - Format activity  │  - Activity broadcast                     │
└─────────────────────┴───────────────────────────────────────────┘
```

## File Structure

### New/Modified Files in `core/engine/`

```
core/engine/
├── engine.types.ts            # Existing - add SerializableGameState
├── engine.serialization.ts    # NEW: Serialize/deserialize helpers
├── game.actor.ts              # NEW: Factory for creating game actors
├── game.events.ts             # NEW: Unified GameCommand type
│
├── game.machine.ts            # MODIFY: Wire to invoke roundMachine
├── round.machine.ts           # MODIFY: Wire to invoke turnMachine
├── turn.machine.ts            # MODIFY: Wire to invoke mayIWindowMachine
└── mayIWindow.machine.ts      # Existing - mostly unchanged
```

### New/Modified Files in `cli/`

```
cli/
├── shared/
│   ├── cli.types.ts           # SIMPLIFY: Remove game state types
│   ├── cli.persistence.ts     # MODIFY: Use core serialization
│   ├── cli.activity.ts        # MODIFY: Format inspection events
│   └── cli.adapter.ts         # NEW: Thin wrapper around game actor
├── harness/
│   ├── orchestrator.ts        # DELETE
│   ├── harness.render.ts      # MODIFY: Use new state shape
│   └── harness.state.ts       # DELETE
└── interactive/
    └── interactive.ts         # MODIFY: Use cli.adapter.ts
```

## Key Types

### SerializableGameState

Single source of truth for game state serialization, used by both CLI and WebSocket:

```typescript
// core/engine/engine.serialization.ts

export interface SerializableGameState {
  version: "3.0";

  // Game-level
  gameId: string;
  currentRound: RoundNumber;
  dealerIndex: number;
  roundHistory: RoundRecord[];

  // Round-level
  players: Player[];
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];

  // Turn-level
  turnPhase: TurnPhase;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;

  // May I (if active)
  mayIWindow: {
    discardedCard: Card;
    claimants: string[];
    awaitingPlayerId: string;
  } | null;
}

export type TurnPhase =
  | "awaitingDraw"
  | "mayIWindow"
  | "drawn"
  | "awaitingDiscard"
  | "turnComplete";
```

### GameCommand (External Events)

```typescript
// core/engine/game.events.ts

export type GameCommand =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "LAY_DOWN"; melds: MeldProposal[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "CALL_MAY_I" }
  | { type: "PASS_MAY_I" }
  | { type: "SWAP_JOKER"; meldId: string; jokerPos: number; cardId: string }
  | { type: "SKIP" }
  | { type: "CONTINUE" };
```

### Game Actor Factory

```typescript
// core/engine/game.actor.ts

export function createGameActor(
  input: GameInput,
  options?: {
    onInspect?: (event: InspectionEvent) => void;
    snapshot?: SerializableGameState;
  }
): GameActor;

export function getSerializableState(actor: GameActor): SerializableGameState;
```

### CLI Adapter

```typescript
// cli/shared/cli.adapter.ts

export class CLIGameAdapter {
  newGame(playerNames: string[]): void;
  loadGame(): void;
  send(event: GameCommand): void;
  getState(): SerializableGameState;
  getRecentActivity(count?: number): string[];
}
```

## Testing Strategy

### Isolation Testing

Each machine is tested independently by creating an actor directly:

```typescript
// turn.machine.test.ts
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";

test("drawing from stock invokes May I window", () => {
  const actor = createActor(turnMachine, {
    input: {
      playerId: "player-0",
      hand: [/* cards */],
      stock: [/* cards */],
      discard: [/* cards */],
      table: [],
      roundNumber: 1,
      isDown: false,
    },
  }).start();

  actor.send({ type: "DRAW_FROM_STOCK" });

  // Verify transition to mayIWindow state
  expect(actor.getSnapshot().value).toMatchObject({
    // State includes invoked mayIWindowMachine
  });
});
```

### Integration Testing

Full game flow tested via root GameActor:

```typescript
// game.integration.test.ts
import { createGameActor } from "./game.actor";

test("complete turn flow", () => {
  const actor = createGameActor({
    players: [
      { id: "p0", name: "Alice" },
      { id: "p1", name: "Bob" },
      { id: "p2", name: "Carol" },
    ],
  });
  actor.start();

  // Events route through hierarchy automatically
  actor.send({ type: "DRAW_FROM_STOCK" });
  actor.send({ type: "PASS_MAY_I" });  // All players pass
  actor.send({ type: "DISCARD", cardId: "..." });

  const state = getSerializableState(actor);
  expect(state.currentPlayerIndex).toBe(1);  // Turn advanced
});
```

## Decisions and Alternatives

### Decision 1: Hierarchical Invoke vs Flat Coordination

**Chosen: Hierarchical Invoke**

| Approach | Pros | Cons |
|----------|------|------|
| **Hierarchical Invoke** (chosen) | XState-idiomatic, automatic lifecycle, deep persistence, event routing | Parent knows child's input/output shape |
| Flat Coordination | Maximum flexibility, independent machines | Manual lifecycle, no auto-persistence, more code |

**Rationale**: Hierarchical invoke is the recommended XState pattern. It provides automatic actor lifecycle management, deep persistence (spawned/invoked actors are recursively persisted), and automatic event routing to active children.

**Sources**:
- [Stately Actors Documentation](https://stately.ai/docs/actors)
- [Stately Invoke Documentation](https://stately.ai/docs/invoke)

### Decision 2: May I Window - Invoke vs Parallel State vs Spawn

**Chosen: Invoke (using existing mayIWindowMachine)**

| Approach | Pros | Cons |
|----------|------|------|
| **Invoke** (chosen) | Clean separation, existing machine ready, turn naturally pauses | Slightly more setup |
| Parallel State | Single snapshot, no inter-actor communication | Complex state structure, May I mixed with turn |
| Spawn | Dynamic creation | Manual lifecycle, must track actorRef |

**Rationale**: The existing `mayIWindow.machine.ts` is already well-designed with clear input/output types, making it perfect for invoke. The turn naturally pauses during May I resolution, which is exactly what invoke handles. Parallel states would require rewriting the May I logic inline.

**Sources**:
- [Stately Spawn Documentation](https://stately.ai/docs/spawn)
- [Parallel States Guide](https://dev.to/codingdive/state-machine-advent-introduction-to-nested-and-parallel-states-using-statecharts-7ed)

### Decision 3: Event Routing - Root Only vs Explicit Targeting

**Chosen: Root Actor Only**

| Approach | Pros | Cons |
|----------|------|------|
| **Root Only** (chosen) | Simpler API, XState handles routing, matches CLI/WebSocket model | Less explicit control |
| Explicit Targeting | More flexible, explicit actor references | Complex API, breaks encapsulation |

**Rationale**: XState automatically routes events to the deepest active invoked actor. Sending all events to the root GameActor provides a clean, transport-agnostic API. The CLI and future WebSocket adapter both just call `actor.send(event)`.

### Decision 4: Logging - Inspection API vs Explicit Calls

**Chosen: Inspection API**

| Approach | Pros | Cons |
|----------|------|------|
| **Inspection API** (chosen) | Automatic, captures all events, enables replay | Requires formatting layer |
| Explicit logAction() calls | Human-readable by default | Must remember to call, easy to miss |

**Rationale**: XState v5's inspection API captures all events flowing through the actor system. The CLI adapter subscribes to these events and formats them for human-readable display. This also enables event sourcing for replay/debugging.

**Sources**:
- [Stately Persistence Documentation](https://stately.ai/docs/persistence)
- [XState v5 Release Blog](https://stately.ai/blog/2023-12-01-xstate-v5)

### Decision 5: Game Creation - Machine State vs External

**Chosen: External (pass config to machine)**

The game creation flow (player setup, name entry) stays external to the state machine. The GameMachine receives initial configuration as input:

```typescript
const actor = createGameActor({
  players: [
    { id: "player-0", name: "Alice" },
    { id: "player-1", name: "Bob" },
  ],
  dealerIndex: 0,
});
```

**Rationale**: Game setup is a one-time configuration, not an ongoing state machine concern. Keeping it external simplifies the machine and matches how both CLI and web app would work.

### Decision 6: Backward Compatibility

**Chosen: No backward compatibility**

The serializable state format changes from version "2.0" to "3.0". Old save files will not load.

**Rationale**: The app is in development. Adding compatibility shims adds complexity without benefit. Users can start new games.

## Implementation Plan

### Phase 1: Wire Machines Together

1. Modify `game.machine.ts` to invoke `roundMachine`
2. Modify `round.machine.ts` to invoke `turnMachine`
3. Modify `turn.machine.ts` to invoke `mayIWindowMachine`
4. Create `game.actor.ts` factory
5. Create `engine.serialization.ts` with SerializableGameState

### Phase 2: Create CLI Adapter

1. Create `cli.adapter.ts` using game actor
2. Modify `cli.activity.ts` to format inspection events
3. Modify `cli.persistence.ts` to use core serialization

### Phase 3: Migrate CLI Code

1. Update `harness.render.ts` to use new state shape
2. Update `interactive.ts` to use CLIGameAdapter
3. Update `play.ts` entry point

### Phase 4: Delete Old Code

1. Delete `orchestrator.ts`
2. Delete `harness.state.ts`
3. Simplify `cli.types.ts`

### Phase 5: Update Tests

1. Update existing machine tests if needed
2. Add integration tests for wired machines
3. Verify all 1800+ tests pass

## Migration Checklist

- [ ] `game.machine.ts` invokes `roundMachine`
- [ ] `round.machine.ts` invokes `turnMachine`
- [ ] `turn.machine.ts` invokes `mayIWindowMachine`
- [ ] `game.actor.ts` factory created
- [ ] `engine.serialization.ts` created
- [ ] `cli.adapter.ts` created
- [ ] `cli.persistence.ts` updated
- [ ] `cli.activity.ts` updated
- [ ] `harness.render.ts` updated
- [ ] `interactive.ts` updated
- [ ] `play.ts` updated
- [ ] `orchestrator.ts` deleted
- [ ] `harness.state.ts` deleted
- [ ] All tests passing
- [ ] Manual CLI testing complete

## References

- [Stately Actors Documentation](https://stately.ai/docs/actors)
- [Stately Invoke Documentation](https://stately.ai/docs/invoke)
- [Stately Spawn Documentation](https://stately.ai/docs/spawn)
- [Stately Persistence Documentation](https://stately.ai/docs/persistence)
- [XState v5 Release Blog](https://stately.ai/blog/2023-12-01-xstate-v5)
- [Testing Child Machines (GitHub Discussion)](https://github.com/statelyai/xstate/discussions/4221)
- [Parent-Child Communication](https://dev.to/gtodorov/improve-child-to-parent-communication-with-xstate-5-1onp)
