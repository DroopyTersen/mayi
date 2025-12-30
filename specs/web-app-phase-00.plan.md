# Phase 0: Server-Safe Engine

> **Status**: Not Started
> **Prerequisite for**: All web app phases
> **Estimated scope**: Refactor only, no new features

---

## Goal

Extract a **server-safe game engine** from the current CLI implementation. The engine must have zero Node.js dependencies so it can run on Cloudflare Workers.

## Problem

The current CLI orchestrator cannot run on Workers:

```typescript
// cli/harness/orchestrator.ts - CANNOT run on Workers!
import { CLIPersistence } from "~/cli/shared/cli.persistence"; // Uses node:fs!
import { CLIRenderer } from "~/cli/shared/cli.renderer";       // Terminal output!
```

## Solution

Create a pure game engine in `core/engine/` that:
1. Contains only game logic (no I/O)
2. Has no Node.js dependencies
3. Uses XState for state machine orchestration
4. Can be wrapped by both CLI and Workers with their own persistence

## Target Architecture

```
core/                           # Server-safe (Worker-compatible)
├── engine/
│   ├── game-engine.ts          # Main engine class (pure logic)
│   ├── game-engine.test.ts     # Engine tests
│   └── ... (existing machines)
├── card/
│   └── ... (already server-safe)
└── types/
    └── game.types.ts           # Shared types including PlayerView

cli/                            # CLI adapter (uses Node.js)
├── harness/
│   ├── cli-orchestrator.ts     # Wraps GameEngine + file persistence
│   └── cli.persistence.ts      # File-based storage (node:fs)
└── ...
```

## GameEngine Interface

```typescript
// core/engine/game-engine.ts

export interface CommandResult {
  success: boolean;
  error?: string;
  message?: string;
}

export class GameEngine {
  private actor: Actor<typeof gameMachine>;

  constructor(config: { playerNames: string[] }) {
    // Initialize XState actor
  }

  // Restore from serialized state
  static fromSnapshot(snapshot: unknown): GameEngine;

  // Pure command methods - no I/O, just state transitions
  drawFromStock(playerId: string): CommandResult;
  drawFromDiscard(playerId: string): CommandResult;
  layDown(playerId: string, cardIds: string[][]): CommandResult;
  discard(playerId: string, cardId: string): CommandResult;
  layOff(playerId: string, cardId: string, meldId: string): CommandResult;
  callMayI(playerId: string): CommandResult;
  pass(playerId: string): CommandResult;

  // State access
  getSnapshot(): unknown;  // For persistence (caller decides where to store)
  getPlayerView(playerId: string): PlayerView;
  getSpectatorView(): SpectatorView;

  // Game state queries
  getCurrentPlayerId(): string;
  getPhase(): "lobby" | "playing" | "ended";
  isGameOver(): boolean;
}
```

## PlayerView Type

```typescript
// core/types/game.types.ts

export interface PlayerView {
  gameId: string;
  public: {
    phase: "lobby" | "playing" | "ended";
    currentPlayerIndex: number;
    turnPhase: "DRAW" | "PLAY" | "DISCARD" | "MAY_I_WINDOW";
    round: number;
    discardTop: Card | null;
    stockCount: number;
    table: Meld[];  // Melds have stable meldId
    scores: Record<string, number>;
  };
  players: Array<{
    playerId: string;
    name: string;
    cardCount: number;
    hasLaidDown: boolean;
    isConnected: boolean;  // For web app
  }>;
  yourPlayerId: string;
  yourHand: Card[];  // Cards have stable cardId
}
```

## Stable IDs Requirement

Cards and melds must have stable IDs (not array indices):

```typescript
interface Card {
  cardId: string;  // e.g., "c_a1b2c3" - stable across state updates
  suit: Suit;
  rank: Rank;
}

interface Meld {
  meldId: string;  // e.g., "m_x1y2z3" - stable for LAY_OFF commands
  cards: Card[];
  type: "set" | "run";
}
```

This is required because:
- Commands use IDs: `{ type: "DISCARD", cardId: "c_a1b2c3" }`
- Array indices change when cards are added/removed
- Idempotency requires stable references

## Tasks

1. [ ] Audit current `core/` for any Node.js imports
2. [ ] Ensure all cards have stable `cardId` assigned at creation
3. [ ] Ensure all melds have stable `meldId` assigned at creation
4. [ ] Create `GameEngine` class wrapping XState actor
5. [ ] Implement `getPlayerView(playerId)` method
6. [ ] Create `CLIOrchestrator` wrapper that uses `GameEngine` + file I/O
7. [ ] Update CLI to use new `CLIOrchestrator`
8. [ ] Verify all existing CLI tests still pass

## Verification Criteria

### Automated Tests (TDD)

Write tests FIRST for each component:

```typescript
// core/engine/game-engine.test.ts
import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine", () => {
  describe("initialization", () => {
    it("creates a game with player names", () => {
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      expect(engine.getPhase()).toBe("playing");
    });

    it("deals correct number of cards per round", () => {
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      const view = engine.getPlayerView("player-0");
      expect(view.yourHand.length).toBe(6); // Round 1 = 6 cards
    });
  });

  describe("stable IDs", () => {
    it("cards have stable cardId", () => {
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      const view = engine.getPlayerView("player-0");
      const cardId = view.yourHand[0].cardId;
      expect(cardId).toMatch(/^c_[a-z0-9]+$/);
    });

    it("melds have stable meldId", () => {
      // After laying down, melds should have IDs
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      // ... setup to create a meld
      const view = engine.getPlayerView("player-0");
      expect(view.public.table[0]?.meldId).toMatch(/^m_[a-z0-9]+$/);
    });
  });

  describe("getPlayerView", () => {
    it("returns only the requesting player's hand", () => {
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      const aliceView = engine.getPlayerView("player-0");
      const bobView = engine.getPlayerView("player-1");

      expect(aliceView.yourHand).not.toEqual(bobView.yourHand);
      expect(aliceView.yourPlayerId).toBe("player-0");
      expect(bobView.yourPlayerId).toBe("player-1");
    });

    it("hides other players hand counts only", () => {
      const engine = new GameEngine({ playerNames: ["Alice", "Bob"] });
      const view = engine.getPlayerView("player-0");

      // Can see card counts
      expect(view.players[1].cardCount).toBeGreaterThan(0);
      // Cannot see actual cards (not in PlayerView)
      expect((view.players[1] as any).hand).toBeUndefined();
    });
  });

  describe("serialization", () => {
    it("round-trips through JSON", () => {
      const engine1 = new GameEngine({ playerNames: ["Alice", "Bob"] });
      const snapshot = engine1.getSnapshot();

      const engine2 = GameEngine.fromSnapshot(snapshot);
      const view1 = engine1.getPlayerView("player-0");
      const view2 = engine2.getPlayerView("player-0");

      expect(view1).toEqual(view2);
    });
  });
});
```

### CLI Verification

```bash
# All tests pass
bun test

# No Node.js imports in core/
grep -r "from ['\"]node:" core/ && echo "FAIL: node imports found" || echo "PASS"

# No CLI imports in core/
grep -r "~/cli" core/ && echo "FAIL: cli imports found" || echo "PASS"

# CLI still works end-to-end
bun cli/play.ts new
bun cli/play.ts status
```

### Definition of Done

- [ ] All tests in `core/engine/game-engine.test.ts` pass
- [ ] `grep -r "node:" core/` returns nothing
- [ ] `grep -r "~/cli" core/` returns nothing
- [ ] `bun cli/play.ts new` creates a game successfully
- [ ] Existing CLI test suite passes

## Out of Scope

- Web app implementation (Phase 1+)
- New game features
- Lobby/matchmaking logic
- AI players

---

## Notes

The key insight is that `GameEngine` is a pure state machine wrapper. It doesn't know or care about:
- Where state is persisted (file, Durable Object storage, memory)
- How commands arrive (CLI args, WebSocket messages, HTTP)
- How state is rendered (terminal, React, JSON API)

This separation allows the same game logic to power both CLI and web.
