# Phase 0: Server-Safe Engine

> **Status**: Not Started
> **Prerequisite for**: All web app phases
> **Architecture**: Clean immutable snapshots with ID-based commands

---

## Goal

Extract a **server-safe game engine** from the current CLI Orchestrator. The engine must:
1. Have zero Node.js dependencies (run on Cloudflare Workers)
2. Use **immutable snapshots** for all state transitions
3. Expose **ID-based commands** (not position-based)
4. Provide **PlayerView** with per-player information hiding

---

## Problem

The current CLI Orchestrator cannot run on Workers:

```typescript
// cli/harness/orchestrator.ts - CANNOT run on Workers!
import { saveOrchestratorSnapshot } from "~/cli/shared/cli.persistence"; // Uses node:fs!

class Orchestrator {
  // Mutable internal state
  private players: Player[] = [];

  // Position-based commands (CLI-specific)
  discardCard(position: number): CommandResult { ... }

  // Persistence baked in
  private save(): void {
    saveOrchestratorSnapshot(this.gameId, this.createSnapshot());
  }
}
```

---

## Solution: Clean Architecture

Create a pure `GameEngine` class that:
1. **Never mutates** - commands return new snapshots
2. **Uses IDs** - `discardCard(playerId, cardId)` not `discardCard(position)`
3. **No I/O** - caller handles persistence
4. **Type-safe views** - `PlayerView` hides other players' hands at compile time

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CORE (Worker-safe)                            │
│                                                                         │
│  GameEngine                     GameSnapshot                            │
│  ┌─────────────────────────┐   ┌─────────────────────────┐             │
│  │ fromSnapshot(snapshot)  │   │ version: "3.0"          │             │
│  │ getSnapshot()           │   │ players: Player[]       │             │
│  │ getPlayerView(playerId) │   │ stock: Card[]           │             │
│  │                         │   │ discard: Card[]         │             │
│  │ // Commands return new  │   │ table: Meld[]           │             │
│  │ // CommandResult<Snap>  │   │ phase, turnPhase, ...   │             │
│  │ drawFromStock(pid)      │   └─────────────────────────┘             │
│  │ discard(pid, cardId)    │                                           │
│  │ layDown(pid, melds)     │   PlayerView                              │
│  │ ...                     │   ┌─────────────────────────┐             │
│  └─────────────────────────┘   │ yourHand: Card[]        │             │
│                                │ opponents: OpponentInfo[]│             │
│                                │ // No other hands!      │             │
│                                └─────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│     CLI (Node.js)            │   │     Web (Cloudflare Worker)  │
│                              │   │                              │
│  CLIOrchestrator             │   │  MayIRoom (Durable Object)   │
│  ┌────────────────────────┐  │   │  ┌────────────────────────┐  │
│  │ engine: GameEngine     │  │   │  │ engine: GameEngine     │  │
│  │                        │  │   │  │                        │  │
│  │ // Position → ID       │  │   │  │ // WebSocket handler   │  │
│  │ discardCard(pos: num)  │  │   │  │ onMessage(cmd)         │  │
│  │   → cardId = hand[pos] │  │   │  │   → engine.discard()   │  │
│  │   → engine.discard()   │  │   │  │   → broadcast()        │  │
│  │                        │  │   │  │                        │  │
│  │ // File persistence    │  │   │  │ // DO storage          │  │
│  │ save() → node:fs       │  │   │  │ save() → ctx.storage   │  │
│  └────────────────────────┘  │   │  └────────────────────────┘  │
└──────────────────────────────┘   └──────────────────────────────┘
```

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **State pattern** | Immutable snapshots | Easier debugging (compare snapshots), safer parallelism, cleaner tests |
| **Command returns** | `CommandResult<GameSnapshot>` | Caller decides what to do with new state |
| **API style** | ID-based only | Position-based is CLI-specific; IDs work for any client |
| **Persistence** | Not in engine | Engine is pure; CLIOrchestrator/MayIRoom handle I/O |
| **XState** | Not used | Orchestrator logic works well; XState has snapshot restoration issues |

---

## File Structure

```
core/engine/
├── game-engine.ts              # NEW: Pure game logic (~800 lines)
├── game-engine.types.ts        # NEW: GameSnapshot, PlayerView, MeldSpec (~150 lines)
├── game-engine.test.ts         # NEW: Core engine tests (~500 lines)
└── ... (existing machines - untouched)

cli/harness/
├── cli-orchestrator.ts         # NEW: CLI wrapper (~350 lines)
├── cli-orchestrator.test.ts    # NEW: CLI-specific tests (~300 lines)
└── orchestrator.ts             # DEPRECATED: Re-export for compatibility
```

---

## Type Definitions

### GameSnapshot (v3.0)

```typescript
// core/engine/game-engine.types.ts

export interface GameSnapshot {
  version: "3.0";
  gameId: string;

  // Phase tracking
  phase: EnginePhase;
  turnPhase: TurnPhase;
  turnNumber: number;

  // Players
  players: Player[];
  currentRound: RoundNumber;
  dealerIndex: number;
  currentPlayerIndex: number;
  awaitingPlayerId: string;

  // Card zones
  stock: Card[];
  discard: Card[];
  table: Meld[];

  // Turn state
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
  lastDiscardedByPlayerId: string | null;

  // May I window
  mayIContext: MayIContext | null;

  // History
  roundHistory: RoundRecord[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type EnginePhase =
  | "ROUND_ACTIVE"
  | "MAY_I_WINDOW"
  | "ROUND_END"
  | "GAME_END";

export type TurnPhase =
  | "AWAITING_DRAW"
  | "AWAITING_ACTION"
  | "AWAITING_DISCARD";
```

### PlayerView (Information Hiding)

```typescript
// core/engine/game-engine.types.ts

export interface PlayerView {
  gameId: string;
  viewingPlayerId: string;

  // Your data (full visibility)
  yourHand: Card[];
  isYourTurn: boolean;

  // Opponents (hidden hands)
  opponents: OpponentInfo[];

  // Public game state
  currentRound: RoundNumber;
  contract: Contract;
  phase: EnginePhase;
  turnPhase: TurnPhase;
  turnNumber: number;
  awaitingPlayerId: string;

  // Card zones
  stockCount: number;
  topDiscard: Card | null;
  table: Meld[];

  // Scores
  roundHistory: RoundRecord[];

  // May I (if active)
  mayIContext: MayIContext | null;
}

export interface OpponentInfo {
  id: string;
  name: string;
  handCount: number;  // Only count, NOT cards!
  isDown: boolean;
  totalScore: number;
  isDealer: boolean;
  isCurrentPlayer: boolean;
}
```

### CommandResult (with new snapshot)

```typescript
// core/engine/game-engine.types.ts

export interface CommandResult<T = void> {
  success: boolean;
  message: string;
  error?: string;
  snapshot?: T;  // New snapshot on success
}

// Usage:
const result = engine.discard("player-0", "card-abc123");
if (result.success) {
  engine = GameEngine.fromSnapshot(result.snapshot!);
  save(result.snapshot!);
}
```

### MeldSpec (ID-based)

```typescript
// core/engine/game-engine.types.ts

export interface MeldSpec {
  type: "set" | "run";
  cardIds: string[];
}

// Usage:
engine.layDown("player-0", [
  { type: "set", cardIds: ["card-1", "card-2", "card-3"] },
  { type: "run", cardIds: ["card-4", "card-5", "card-6", "card-7"] }
]);
```

---

## GameEngine Interface

```typescript
// core/engine/game-engine.ts

export class GameEngine {
  private snapshot: GameSnapshot;

  // ═══════════════════════════════════════════════════════════════════════
  // Factory Methods
  // ═══════════════════════════════════════════════════════════════════════

  static createGame(playerNames: string[], startingRound?: RoundNumber): GameEngine;
  static fromSnapshot(snapshot: GameSnapshot): GameEngine;

  // ═══════════════════════════════════════════════════════════════════════
  // State Access (Read-only)
  // ═══════════════════════════════════════════════════════════════════════

  getSnapshot(): GameSnapshot;
  getPlayerView(playerId: string): PlayerView;
  getAwaitingPlayerId(): string;
  getPhase(): EnginePhase;
  getTurnPhase(): TurnPhase;

  // ═══════════════════════════════════════════════════════════════════════
  // Commands (Return new snapshot - NEVER mutate!)
  // ═══════════════════════════════════════════════════════════════════════

  // Drawing
  drawFromStock(playerId: string): CommandResult<GameSnapshot>;
  drawFromDiscard(playerId: string): CommandResult<GameSnapshot>;

  // Laying down
  layDown(playerId: string, melds: MeldSpec[]): CommandResult<GameSnapshot>;
  skip(playerId: string): CommandResult<GameSnapshot>;

  // Discarding
  discard(playerId: string, cardId: string): CommandResult<GameSnapshot>;

  // Laying off (after laying down, on subsequent turns)
  layOff(playerId: string, cardId: string, meldId: string): CommandResult<GameSnapshot>;

  // Joker swapping
  swap(playerId: string, meldId: string, jokerCardId: string, swapCardId: string): CommandResult<GameSnapshot>;

  // May I window
  callMayI(playerId: string): CommandResult<GameSnapshot>;
  passMayI(playerId: string): CommandResult<GameSnapshot>;

  // Round progression
  continueToNextRound(): CommandResult<GameSnapshot>;

  // Hand management
  reorderHand(playerId: string, newCardOrder: string[]): CommandResult<GameSnapshot>;
}
```

---

## CLIOrchestrator Interface

```typescript
// cli/harness/cli-orchestrator.ts

export class CLIOrchestrator {
  private engine: GameEngine;
  private gameId: string;

  // ═══════════════════════════════════════════════════════════════════════
  // Factory Methods (same as before)
  // ═══════════════════════════════════════════════════════════════════════

  newGame(playerNames: string[], startingRound?: RoundNumber): GameStateView;
  loadGame(gameId: string): GameStateView;
  static fromState(state: SerializableGameState): CLIOrchestrator;

  // ═══════════════════════════════════════════════════════════════════════
  // State Access (same as before)
  // ═══════════════════════════════════════════════════════════════════════

  getStateView(): GameStateView;
  getSerializableState(): SerializableGameState;
  getPersistedState(): PersistedGameState;
  getAwaitingPlayer(): Player | undefined;
  getCurrentPlayer(): Player;

  // ═══════════════════════════════════════════════════════════════════════
  // Commands - POSITION-BASED (translates to engine's ID-based)
  // ═══════════════════════════════════════════════════════════════════════

  drawFromStock(): CommandResult;
  drawFromDiscard(): CommandResult;
  layDown(meldGroups: number[][]): CommandResult;  // positions → cardIds
  skip(): CommandResult;
  discardCard(position: number): CommandResult;     // position → cardId
  layOff(cardPos: number, meldNum: number): CommandResult;
  swap(meldNum: number, jokerPos: number, cardPos: number): CommandResult;
  callMayI(): CommandResult;
  pass(): CommandResult;
  continue(): CommandResult;
  reorderHand(newHand: Card[]): CommandResult;

  // ═══════════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private positionToCardId(position: number, hand: Card[]): string | null;
  private meldNumberToMeldId(meldNum: number): string | null;
  private save(): void;
  private logAction(playerId: string, action: string, details?: string): void;
}
```

---

## Implementation Tasks

### Phase 0.1: Types and Test Scaffolding

- [ ] **0.1.1** Create `core/engine/game-engine.types.ts`
  - [ ] Define `GameSnapshot` interface (v3.0)
  - [ ] Define `PlayerView` and `OpponentInfo` interfaces
  - [ ] Define `CommandResult<T>` generic type
  - [ ] Define `MeldSpec` type
  - [ ] Define `EnginePhase` and `TurnPhase` types

- [ ] **0.1.2** Create `core/engine/game-engine.test.ts` (TDD - write failing tests first!)
  - [ ] Test: `createGame` initializes with correct players
  - [ ] Test: `createGame` deals correct cards per round
  - [ ] Test: `getSnapshot()` returns immutable copy
  - [ ] Test: `fromSnapshot()` restores identical state
  - [ ] Test: `getPlayerView()` hides other players' hands

### Phase 0.2: GameEngine Core

- [ ] **0.2.1** Create `core/engine/game-engine.ts` shell
  - [ ] Implement `createGame()` factory
  - [ ] Implement `fromSnapshot()` factory
  - [ ] Implement `getSnapshot()` (returns deep copy)
  - [ ] Implement `getPlayerView()` (information hiding)

- [ ] **0.2.2** Implement immutable state helpers
  - [ ] `updateSnapshot()` - creates new snapshot with changes
  - [ ] `updatePlayer()` - updates single player immutably
  - [ ] `updatePlayers()` - updates players array immutably

### Phase 0.3: Draw Commands

- [ ] **0.3.1** Write failing tests for draw commands
  - [ ] Test: `drawFromStock` returns new snapshot with card in hand
  - [ ] Test: `drawFromStock` original snapshot unchanged (immutability)
  - [ ] Test: `drawFromStock` opens May I window
  - [ ] Test: `drawFromDiscard` returns card from discard
  - [ ] Test: `drawFromDiscard` fails for down players

- [ ] **0.3.2** Implement draw commands
  - [ ] `drawFromStock(playerId)` → `CommandResult<GameSnapshot>`
  - [ ] `drawFromDiscard(playerId)` → `CommandResult<GameSnapshot>`
  - [ ] Stock replenishment helper (immutable)

### Phase 0.4: Action Commands

- [ ] **0.4.1** Write failing tests for action commands
  - [ ] Test: `skip` transitions to AWAITING_DISCARD
  - [ ] Test: `layDown` validates contract
  - [ ] Test: `layDown` uses card IDs not positions
  - [ ] Test: `layDown` enforces exact meld sizes (Round 1-5)
  - [ ] Test: `layDown` Round 6 requires ALL cards

- [ ] **0.4.2** Implement action commands
  - [ ] `skip(playerId)` → `CommandResult<GameSnapshot>`
  - [ ] `layDown(playerId, melds: MeldSpec[])` → `CommandResult<GameSnapshot>`

### Phase 0.5: Discard and Layoff Commands

- [ ] **0.5.1** Write failing tests for discard/layoff
  - [ ] Test: `discard` uses cardId not position
  - [ ] Test: `discard` advances to next player
  - [ ] Test: `discard` triggers going out when hand empty
  - [ ] Test: `layOff` uses cardId and meldId
  - [ ] Test: `layOff` fails on same turn as layDown

- [ ] **0.5.2** Implement discard/layoff commands
  - [ ] `discard(playerId, cardId)` → `CommandResult<GameSnapshot>`
  - [ ] `layOff(playerId, cardId, meldId)` → `CommandResult<GameSnapshot>`

### Phase 0.6: May I Window

- [ ] **0.6.1** Write failing tests for May I
  - [ ] Test: `callMayI` adds to claimants
  - [ ] Test: `passMayI` advances window
  - [ ] Test: May I resolution gives cards to winner
  - [ ] Test: Down players excluded from May I

- [ ] **0.6.2** Implement May I commands
  - [ ] `callMayI(playerId)` → `CommandResult<GameSnapshot>`
  - [ ] `passMayI(playerId)` → `CommandResult<GameSnapshot>`
  - [ ] May I resolution helper (immutable)

### Phase 0.7: Swap and Continue

- [ ] **0.7.1** Write failing tests
  - [ ] Test: `swap` uses IDs for meld, joker, and swap card
  - [ ] Test: `swap` only works when not down
  - [ ] Test: `continueToNextRound` advances round
  - [ ] Test: `reorderHand` validates same cards

- [ ] **0.7.2** Implement remaining commands
  - [ ] `swap(playerId, meldId, jokerCardId, swapCardId)` → `CommandResult<GameSnapshot>`
  - [ ] `continueToNextRound()` → `CommandResult<GameSnapshot>`
  - [ ] `reorderHand(playerId, cardIds)` → `CommandResult<GameSnapshot>`

### Phase 0.8: CLIOrchestrator Wrapper

- [ ] **0.8.1** Create `cli/harness/cli-orchestrator.ts`
  - [ ] Wrap `GameEngine` instance
  - [ ] Implement position → ID translation helpers
  - [ ] Implement `save()` using `cli.persistence`
  - [ ] Implement `logAction()` using `cli.persistence`

- [ ] **0.8.2** Implement CLI command wrappers
  - [ ] Each method: translate positions → IDs → call engine → save → return
  - [ ] Maintain backward-compatible return types

### Phase 0.9: Test Migration (TDD Rewrites)

> **CRITICAL**: Rewrite tests FIRST in TDD style before updating implementations

- [ ] **0.9.1** Rewrite `cli/harness/orchestrator.test.ts` → `cli-orchestrator.test.ts`
  - [ ] Split into two test files:
    - `core/engine/game-engine.test.ts` - pure engine tests (ID-based)
    - `cli/harness/cli-orchestrator.test.ts` - CLI wrapper tests (position-based)
  - [ ] 674 lines of tests to migrate
  - [ ] Tests must pass BEFORE updating CLI imports

- [ ] **0.9.2** Update `ai/mayIAgent.llm.test.ts`
  - [ ] Change `TrackedOrchestrator extends Orchestrator` → `extends CLIOrchestrator`
  - [ ] Update `SerializableGameState` usage
  - [ ] ~400 lines affected

- [ ] **0.9.3** Update `ai/devtools-test.ts`
  - [ ] Change `TestOrchestrator extends Orchestrator` → `extends CLIOrchestrator`
  - [ ] Update state creation
  - [ ] 76 lines affected

- [ ] **0.9.4** Verify `cli/shared/cli.persistence.test.ts`
  - [ ] Should mostly work unchanged
  - [ ] May need snapshot format updates
  - [ ] 323 lines to verify

### Phase 0.10: CLI Integration

- [ ] **0.10.1** Update `cli/play.ts`
  - [ ] Change import from `Orchestrator` to `CLIOrchestrator`
  - [ ] Verify all commands work

- [ ] **0.10.2** Update `cli/interactive/interactive.ts`
  - [ ] Change import from `Orchestrator` to `CLIOrchestrator`
  - [ ] Verify interactive mode works

- [ ] **0.10.3** Create backward-compat `cli/harness/orchestrator.ts`
  - [ ] Re-export `CLIOrchestrator as Orchestrator`
  - [ ] Add deprecation warning

### Phase 0.11: Verification

- [ ] **0.11.1** Run all tests
  ```bash
  bun test
  ```

- [ ] **0.11.2** Verify no Node.js imports in core
  ```bash
  grep -r "from ['\"]node:" core/ && echo "FAIL" || echo "PASS"
  ```

- [ ] **0.11.3** Verify no CLI imports in core
  ```bash
  grep -r "~/cli" core/ && echo "FAIL" || echo "PASS"
  ```

- [ ] **0.11.4** End-to-end CLI verification
  ```bash
  bun cli/play.ts new
  bun cli/play.ts list
  ```

---

## Test Migration Details

### orchestrator.test.ts → Split into Two Files

**Current structure (674 lines):**
```typescript
describe("Orchestrator", () => {
  describe("serialization")        // → game-engine.test.ts
  describe("newGame")              // → game-engine.test.ts (factory tests)
  describe("drawFromStock")        // → game-engine.test.ts (command tests)
  describe("drawFromDiscard")      // → game-engine.test.ts
  describe("skip")                 // → game-engine.test.ts
  describe("discardCard")          // → cli-orchestrator.test.ts (position-based!)
  describe("May I window")         // → game-engine.test.ts
  describe("persistence")          // → cli-orchestrator.test.ts (file I/O!)
  describe("layOff rules")         // → game-engine.test.ts
  describe("layDown exact contract") // → game-engine.test.ts
  describe("swap modifies hand")   // → game-engine.test.ts
  describe("stock auto-replenishment") // → game-engine.test.ts
  describe("full turn flow")       // → both files
});
```

**New `game-engine.test.ts` structure:**
```typescript
describe("GameEngine", () => {
  describe("createGame", () => {
    it("creates game with players");
    it("deals 11 cards per player");
    it("rejects < 3 or > 8 players");
  });

  describe("immutability", () => {
    it("getSnapshot returns copy, not reference");
    it("commands don't mutate original snapshot");
    it("fromSnapshot creates independent instance");
  });

  describe("drawFromStock", () => {
    it("returns new snapshot with card in hand");
    it("opens May I window when discard exists");
    // ... more
  });

  // ... all pure logic tests
});
```

**New `cli-orchestrator.test.ts` structure:**
```typescript
describe("CLIOrchestrator", () => {
  describe("position translation", () => {
    it("discardCard(1) uses first card's ID");
    it("layDown([[1,2,3]]) translates positions to card IDs");
    it("layOff(cardPos, meldNum) translates both to IDs");
  });

  describe("persistence", () => {
    it("saves and loads game state");
    it("action log records actions");
  });

  describe("backward compatibility", () => {
    it("getStateView returns same structure");
    it("getSerializableState returns v2.0 format");
  });
});
```

---

## TDD Example: Discard Command

**Step 1: Write failing test**
```typescript
// core/engine/game-engine.test.ts
describe("discard", () => {
  it("removes card from hand by ID and adds to discard", () => {
    const engine = GameEngine.createGame(["Alice", "Bob", "Carol"]);

    // Setup: draw first
    const afterDraw = engine.drawFromDiscard("player-1");
    engine = GameEngine.fromSnapshot(afterDraw.snapshot!);

    // Setup: skip laydown
    const afterSkip = engine.skip("player-1");
    engine = GameEngine.fromSnapshot(afterSkip.snapshot!);

    // Get a card ID from the player's hand
    const snapshot = engine.getSnapshot();
    const player = snapshot.players.find(p => p.id === "player-1")!;
    const cardToDiscard = player.hand[0]!;
    const handSizeBefore = player.hand.length;

    // Act: discard by card ID (NOT position!)
    const result = engine.discard("player-1", cardToDiscard.id);

    // Assert
    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();

    // Original unchanged (immutability)
    expect(engine.getSnapshot().players.find(p => p.id === "player-1")!.hand.length)
      .toBe(handSizeBefore);

    // New snapshot has card removed
    const newPlayer = result.snapshot!.players.find(p => p.id === "player-1")!;
    expect(newPlayer.hand.length).toBe(handSizeBefore - 1);
    expect(newPlayer.hand.find(c => c.id === cardToDiscard.id)).toBeUndefined();

    // Card is now top of discard
    expect(result.snapshot!.discard[0]!.id).toBe(cardToDiscard.id);
  });
});
```

**Step 2: Run test (should fail)**
```bash
bun test core/engine/game-engine.test.ts --test-name-pattern "discard"
```

**Step 3: Implement**
```typescript
// core/engine/game-engine.ts
discard(playerId: string, cardId: string): CommandResult<GameSnapshot> {
  // Validate phase
  if (this.snapshot.turnPhase !== "AWAITING_DISCARD") {
    return { success: false, message: "Not in discard phase", error: "wrong_phase" };
  }

  // Validate player
  if (this.snapshot.awaitingPlayerId !== playerId) {
    return { success: false, message: "Not your turn", error: "wrong_player" };
  }

  // Find card
  const player = this.snapshot.players.find(p => p.id === playerId)!;
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) {
    return { success: false, message: "Card not in hand", error: "card_not_found" };
  }

  const card = player.hand[cardIndex]!;

  // Create new snapshot (immutable!)
  const newSnapshot: GameSnapshot = {
    ...this.snapshot,
    players: this.snapshot.players.map(p =>
      p.id === playerId
        ? { ...p, hand: p.hand.filter(c => c.id !== cardId) }
        : p
    ),
    discard: [card, ...this.snapshot.discard],
    currentPlayerIndex: (this.snapshot.currentPlayerIndex + 1) % this.snapshot.players.length,
    turnPhase: "AWAITING_DRAW",
    turnNumber: this.snapshot.turnNumber + 1,
    hasDrawn: false,
    laidDownThisTurn: false,
    lastDiscardedByPlayerId: playerId,
    updatedAt: new Date().toISOString(),
  };

  // Update awaiting player
  newSnapshot.awaitingPlayerId = newSnapshot.players[newSnapshot.currentPlayerIndex]!.id;

  return {
    success: true,
    message: `Discarded card`,
    snapshot: newSnapshot,
  };
}
```

**Step 4: Run test (should pass)**
```bash
bun test core/engine/game-engine.test.ts --test-name-pattern "discard"
```

---

## Verification Criteria

### Definition of Done

- [ ] All tests pass: `bun test`
- [ ] No Node.js imports in core: `grep -r "node:" core/` returns nothing
- [ ] No CLI imports in core: `grep -r "~/cli" core/` returns nothing
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Agent game harness works (see scenarios below)
- [ ] Interactive mode works: `bun cli/play.ts --interactive`
- [ ] AI tests pass: `bun test ai/`

### Automated Test Verification

```bash
# Run all tests
bun test

# Run specific test suites
bun test core/engine/game-engine.test.ts          # New engine tests
bun test cli/harness/cli-orchestrator.test.ts     # New CLI wrapper tests
bun test cli/shared/cli.persistence.test.ts       # Persistence (should pass unchanged)
bun test ai/                                       # AI agent tests

# TypeScript compilation
bun run typecheck
```

### Code Quality Verification

```bash
# No Node.js imports in core/
grep -r "from ['\"]node:" core/ && echo "FAIL: node imports found!" || echo "PASS: no node imports"

# No CLI imports in core/
grep -r "~/cli" core/ && echo "FAIL: cli imports found!" || echo "PASS: no cli imports"

# No direct fs usage in core/
grep -r "import.*fs" core/ && echo "FAIL: fs imports found!" || echo "PASS: no fs imports"
```

### Agent Game Harness Verification

These scenarios test the full CLI flow per [docs/agent-game-harness.md](../docs/agent-game-harness.md):

#### Scenario 1: Basic Turn Flow
```bash
# Create new game
bun cli/play.ts new
# Output: Started new game: <gameId>

# Get status
bun cli/play.ts <gameId> status

# Draw from discard (player 1's turn)
bun cli/play.ts <gameId> draw discard
# Verify: phase changes to AWAITING_ACTION

# Skip laying down
bun cli/play.ts <gameId> skip
# Verify: phase changes to AWAITING_DISCARD

# Discard a card
bun cli/play.ts <gameId> discard 1
# Verify: phase changes to AWAITING_DRAW, player advances
```

#### Scenario 2: May I Window
```bash
# Create new game
bun cli/play.ts new
# Note the game ID

# Draw from STOCK (opens May I window)
bun cli/play.ts <gameId> draw stock
# Verify: phase is MAY_I_WINDOW

# Pass on May I (as next player)
bun cli/play.ts <gameId> pass
# Verify: moves to next player or resolves

# Continue passing until window closes
bun cli/play.ts <gameId> pass
# Verify: phase returns to AWAITING_ACTION
```

#### Scenario 3: Laying Down Contract
```bash
# Create new game
bun cli/play.ts new

# Draw
bun cli/play.ts <gameId> draw discard

# Check hand positions in status
bun cli/play.ts <gameId> status

# Attempt laydown with positions (Round 1 = 2 sets)
# Note: This will likely fail unless hand has valid melds
bun cli/play.ts <gameId> laydown "1,2,3" "4,5,6"
# Verify: error message if invalid, success if valid
```

#### Scenario 4: Game Persistence
```bash
# Create game
bun cli/play.ts new
# Save the gameId

# Play a turn
bun cli/play.ts <gameId> draw discard
bun cli/play.ts <gameId> skip
bun cli/play.ts <gameId> discard 1

# List games
bun cli/play.ts list
# Verify: game appears in list

# Check status after commands
bun cli/play.ts <gameId> status
# Verify: state persisted correctly

# Check action log
bun cli/play.ts <gameId> log
# Verify: actions recorded
```

#### Scenario 5: Multi-Player Options
```bash
# Create 5-player game
bun cli/play.ts new --players 5
# Verify: 5 players created

# Create game starting at Round 6
bun cli/play.ts new --round 6
# Verify: starts at Round 6 with correct contract
```

#### Scenario 6: JSON Output
```bash
# Get JSON status
bun cli/play.ts <gameId> status --json
# Verify: valid JSON with all expected fields
```

### Interactive Mode Verification

```bash
# Start interactive mode
bun cli/play.ts --interactive

# In interactive mode:
# 1. Create a new game
# 2. Play through a few turns using numbered menus
# 3. Verify hand display, meld selection, etc. work correctly
# 4. Exit and verify game was saved
```

### Full Integration Test (End-to-End)

```bash
# Complete a full turn cycle with all 3 players
GAME=$(bun cli/play.ts new | grep -oE '[a-z0-9]{6}')

# Player 1 turn
bun cli/play.ts $GAME draw discard
bun cli/play.ts $GAME skip
bun cli/play.ts $GAME discard 1

# Player 2 turn
bun cli/play.ts $GAME draw stock
bun cli/play.ts $GAME pass  # May I responses
bun cli/play.ts $GAME pass
bun cli/play.ts $GAME skip
bun cli/play.ts $GAME discard 1

# Player 3 turn
bun cli/play.ts $GAME draw discard
bun cli/play.ts $GAME skip
bun cli/play.ts $GAME discard 1

# Verify all turns completed
bun cli/play.ts $GAME log
# Should show 3 complete turns
```

---

## Out of Scope

- Web app implementation (Phase 1+)
- New game features
- Lobby/matchmaking logic
- AI player changes (beyond test fixes)
- XState integration (not using)

---

## Notes

### Why Immutable Snapshots?

1. **Debugging**: Can compare before/after snapshots
2. **Time travel**: Can keep history of states
3. **Testing**: Input → output, no side effects
4. **Safety**: No accidental mutations
5. **Parallelism**: Safe to share across threads/workers

### Why Not XState?

The XState machines exist but have a critical limitation: XState v5's `invoke` pattern does not support restoring snapshots for invoked actors. This means:
- Cannot restore a game in "playing" state (roundMachine is invoked)
- Would need event replay or different architecture

The current Orchestrator logic works well and can be extracted without XState. We can always migrate to XState later if needed.

### Snapshot Format Compatibility

The new `GameSnapshot` v3.0 format is internal to `GameEngine`. The `CLIOrchestrator` will continue to expose `SerializableGameState` v2.0 format for backward compatibility with:
- Existing saved games
- AI agent code
- Any external tools reading `.data/` files
