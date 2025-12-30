# XState Game Engine Architecture

The May I? game engine is built with XState v5. The core rule enforcement lives in XState machines under `core/engine/*`.

`core/engine/game-engine.ts` is intentionally thin: it sends events, persists/hydrates XState snapshots, and extracts a stable `GameSnapshot` read model for UIs.

---

## Machine Hierarchy

```
GameMachine (root)
└─ invokes → RoundMachine (one round at a time)
   └─ invokes → TurnMachine (one turn at a time)
```

There is no separate “May I window” machine. May I is resolved inside `RoundMachine` as a dedicated sub-state.

---

## The Three Machines

### GameMachine (`core/engine/game.machine.ts`)

Owns the 6-round lifecycle:

- `setup` → add players
- `playing` → invokes `RoundMachine`
- `roundEnd` → auto-advances to next round or ends the game
- `gameEnd` → final scores

Gameplay events are forwarded to the invoked round actor.

### RoundMachine (`core/engine/round.machine.ts`)

Owns:

- dealing the round
- invoking `TurnMachine` for the current player
- scoring + round completion output
- **May I resolution** (round-level, per house rules)

The `active` state is a compound state:

- `active.playing` (normal turn flow; forwards most events to `TurnMachine`)
- `active.resolvingMayI` (prompts higher-priority players to `ALLOW_MAY_I` or `CLAIM_MAY_I`)

Key detail: the “exposed discard” is treated as `discard[0]` throughout the engine.

### TurnMachine (`core/engine/turn.machine.ts`)

Owns the normal turn rules:

- `awaitingDraw` → must draw exactly one card
- `drawn` → may lay down / lay off / swap (or skip)
- `awaitingDiscard` → must discard (or go out in round 6 by playing all cards)

TurnMachine does **not** implement May I resolution; it only executes the mechanical effects of draw/discard/laydown/layoff/swap with guard-driven validation.

---

## Public API: GameEngine

UIs and adapters should use `GameEngine` (not raw actors):

- `createGame(...)`
- command methods (`drawFromStock`, `discard`, `callMayI`, `allowMayI`, `claimMayI`, …)
- persistence (`getPersistedSnapshot()`, `fromPersistedSnapshot()`)
- read model (`getSnapshot()` / `GameSnapshot`)

This keeps “how to drive the actor” and “how to extract state safely” in one place.

---

## May I Resolution Model (house rules first)

When a player calls May I (`CALL_MAY_I`):

1. RoundMachine captures the exposed discard (`discard[0]`) into `mayIResolution.cardBeingClaimed`.
2. It computes `playersToCheck` (“ahead of the caller” in priority order), skipping:
   - down players
   - current player if they already drew from stock this turn
3. It prompts each player in order. The engine exposes who must answer via:
   - `phase = "RESOLVING_MAY_I"`
   - `awaitingPlayerId = playerBeingPrompted`
4. Each prompted player responds:
   - `ALLOW_MAY_I` → advance to next
   - `CLAIM_MAY_I` → resolution ends immediately (claimer wins)
5. Winner receives:
   - current player claim: discard as their normal draw (no penalty)
   - otherwise: discard + 1 penalty card from stock

UIs should never replicate this logic — they should render `mayIContext` and send `allow`/`claim` when prompted.

---

## Testing Strategy

Preferred test layers (fast → broad):

1. **Machine-level tests**
   - `core/engine/roundMachine.mayI.test.ts` (May I resolution rules)
   - `core/engine/turn.machine.*.test.ts` (turn validation)
2. **Engine wrapper tests**
   - `core/engine/game-engine.xstate.test.ts` (GameEngine persistence + May I integration)
3. **CLI adapter tests**
   - `cli/shared/cli-game-adapter.test.ts` (disk persistence + CLI mappings)

Run:

```bash
bun test
bun run typecheck
```
