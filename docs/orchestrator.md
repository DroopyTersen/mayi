# Orchestrator Architecture

The Orchestrator is the central game flow manager for May I? It provides a unified command interface that works across multiple transports:

- **CLI harness**: File-based persistence for AI agents
- **Interactive mode**: File-based persistence with human-friendly REPL
- **WebSocket (PartyKit)**: In-memory state, D1 persistence, real-time broadcasts

## Core Design Principles

1. **Transport-agnostic**: The same `Orchestrator` class works for CLI, interactive play, and WebSocket games
2. **Single source of truth**: `getSerializableState()` returns the complete game state
3. **Command pattern**: All game actions are methods that return `CommandResult`
4. **Immutable state views**: `getStateView()` and `getSerializableState()` return fresh objects

## Key Files

| File | Purpose |
|------|---------|
| `harness/orchestrator.ts` | Core Orchestrator class |
| `harness/orchestrator.persistence.ts` | File-based persistence layer |
| `harness/orchestrator.test.ts` | Test suite |
| `harness/harness.types.ts` | Type definitions |
| `harness/play.ts` | CLI entry point |
| `harness/interactive.ts` | Interactive mode REPL |

## Types

### SerializableGameState

The complete game state, suitable for WebSocket broadcast or D1 persistence:

```typescript
interface SerializableGameState {
  version: "2.0";
  gameId: string;
  phase: OrchestratorPhase;
  harnessPhase: DecisionPhase;
  turnNumber: number;
  players: Player[];
  currentRound: RoundNumber;
  dealerIndex: number;
  currentPlayerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundHistory: RoundRecord[];
  awaitingPlayerId: string;
  mayIContext: MayIContext | null;
  hasDrawn: boolean;
  laidDownThisTurn: boolean;
}
```

### OrchestratorPhase

High-level game phases:

- `IDLE` - No game in progress
- `GAME_SETUP` - Setting up a new game
- `ROUND_ACTIVE` - A round is in progress
- `MAY_I_WINDOW` - May I claims are being processed
- `ROUND_END` - Round just ended, awaiting continue
- `GAME_END` - Game complete

### DecisionPhase

Player-facing phases for UI prompts:

- `AWAITING_DRAW` - Player must draw
- `AWAITING_ACTION` - Player can lay down, lay off, skip, or swap
- `AWAITING_DISCARD` - Player must discard
- `MAY_I_WINDOW` - Non-current player can call May I
- `ROUND_END` - Awaiting continue to next round
- `GAME_END` - Game over

### CommandResult

Return type for all game commands:

```typescript
interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}
```

## Usage

### CLI Mode

```bash
# Start new game
bun harness/play.ts new

# Show status
bun harness/play.ts status

# Draw from stock/discard
bun harness/play.ts draw stock
bun harness/play.ts draw discard

# Lay down melds (card positions)
bun harness/play.ts laydown "1,2,3" "4,5,6,7"

# Skip laying down
bun harness/play.ts skip

# Discard card
bun harness/play.ts discard 5

# Lay off card to meld
bun harness/play.ts layoff 3 1

# Call May I
bun harness/play.ts mayi

# Pass on May I
bun harness/play.ts pass

# Current player takes discard (vetoes May I)
bun harness/play.ts take

# Continue to next round
bun harness/play.ts continue
```

### Interactive Mode

```bash
bun harness/play.ts --interactive
```

This starts a human-friendly REPL with numbered menus.

### WebSocket Integration

```typescript
// Restore from D1 persistence
const state = await db.get<SerializableGameState>(`game:${gameId}`);
const orchestrator = Orchestrator.fromState(state);

// Process command
const result = orchestrator.drawFromStock();

// Broadcast to clients
const newState = orchestrator.getSerializableState();
room.broadcast(JSON.stringify(newState));

// Persist to D1
await db.put(`game:${gameId}`, JSON.stringify(newState));
```

## Commands

### Turn Actions

| Method | Phase Required | Description |
|--------|----------------|-------------|
| `drawFromStock()` | AWAITING_DRAW | Draw from stock pile |
| `drawFromDiscard()` | AWAITING_DRAW | Draw from discard (not allowed when down) |
| `layDown(meldGroups)` | AWAITING_ACTION | Lay down contract melds |
| `skip()` | AWAITING_ACTION | Skip laying down |
| `discardCard(position)` | AWAITING_DISCARD | Discard to end turn |
| `layOff(cardPos, meldNum)` | AWAITING_ACTION | Add card to existing meld |
| `swap(meldNum, jokerPos, cardPos)` | AWAITING_ACTION | Swap Joker from run |
| `stuck()` | AWAITING_ACTION | End turn stuck (Round 6 only) |

### May I Window

| Method | Phase Required | Description |
|--------|----------------|-------------|
| `callMayI()` | MAY_I_WINDOW | Non-current player claims discard |
| `pass()` | MAY_I_WINDOW | Pass on claiming discard |
| `take()` | MAY_I_WINDOW | Current player vetoes by taking discard |

### Game Flow

| Method | Description |
|--------|-------------|
| `newGame(playerNames)` | Start a new game |
| `loadGame()` | Load from persistence |
| `continue()` | Advance to next round |

## House Rules Implemented

1. **Draw first**: Players must always draw before any other action
2. **Down players draw from stock only**: Once laid down, cannot draw from discard
3. **No layoff on laydown turn**: Cannot lay off cards on the same turn you lay down
4. **Joker swap before laydown only**: Can only swap Jokers from runs before laying down your contract
5. **Round 6 no discard out**: Cannot discard your last card in Round 6

## State Flow

```
AWAITING_DRAW
    │
    ├── drawFromStock() ──► MAY_I_WINDOW ──► AWAITING_ACTION
    │                           │
    │                           └── (if no discard) ──► AWAITING_ACTION
    │
    └── drawFromDiscard() ──► AWAITING_ACTION
                                    │
                                    ├── layDown() ──► AWAITING_DISCARD (or ROUND_END if went out)
                                    │
                                    ├── skip() ──► AWAITING_DISCARD
                                    │
                                    ├── layOff() ──► (stays in AWAITING_ACTION or ROUND_END)
                                    │
                                    └── swap() ──► (stays in AWAITING_ACTION)

AWAITING_DISCARD
    │
    └── discardCard() ──► AWAITING_DRAW (next player) or ROUND_END

ROUND_END
    │
    └── continue() ──► AWAITING_DRAW (new round) or GAME_END
```

## Testing

```bash
# Run orchestrator tests
bun test harness/orchestrator.test.ts

# Run all tests
bun test

# Typecheck
bun run typecheck
```

## Migration Notes

### v1.0 to v2.0

The orchestrator supports loading v1.0 `PersistedGameState` files automatically. The persistence layer detects the version and converts as needed:

- v1.0: Flat structure with `harness.phase`, `harness.awaitingPlayerId`
- v2.0: Nested `gameSnapshot` containing `SerializableGameState`

For WebSocket clients, always use `SerializableGameState` (v2.0 format).
