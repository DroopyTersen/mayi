# May I? — Technical Design Document

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
├──────────────────┬──────────────────┬───────────────────────────┤
│   CLI (Bun)      │   Web App        │   AI Player               │
│                  │   (React Router 7)│   (LLM-powered)          │
│   Local play,    │   PartyKit       │                           │
│   AI opponents,  │   WebSocket      │   Receives visible state  │
│   testing        │   connection     │   + available commands,   │
│                  │                  │   returns chosen command  │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         │                  ▼                       │
         │         ┌───────────────────┐            │
         │         │   PartyKit Server │            │
         │         │   (Cloudflare)    │            │
         │         │                   │            │
         │         │   - Game rooms    │            │
         │         │   - State sync    │            │
         │         │   - Persistence   │            │
         │         └─────────┬─────────┘            │
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Game Engine                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │   Card Engine       │    │   May I Engine                 │  │
│  │                     │    │                                │  │
│  │   - Deck creation   │◄───│   - XState machine             │  │
│  │   - Shuffle         │    │   - Contract validation        │  │
│  │   - Deal            │    │   - Meld validation            │  │
│  │   - Draw/Discard    │    │   - Turn management            │  │
│  │     primitives      │    │   - Scoring                    │  │
│  └─────────────────────┘    │   - "May I?" resolution        │  │
│                             └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Persistence       │
                         │                     │
                         │   CLI: JSON files   │
                         │   Web: Cloudflare D1│
                         │        + Drizzle    │
                         └─────────────────────┘
```

## 2. Module Breakdown

### `/core` — Game Engine

```
core/
├── card/
│   ├── types.ts          # Card, Suit, Rank types
│   ├── deck.ts           # Deck creation, shuffle
│   ├── utils.ts          # Point values, isWild, isNatural
│   └── card.test.ts
│
├── meld/
│   ├── types.ts          # Meld, Set, Run types
│   ├── validation.ts     # isValidSet, isValidRun, wildCount checks
│   └── meld.test.ts
│
├── engine/
│   ├── types.ts          # GameState, PlayerState, Command, Event
│   ├── machine.ts        # XState machine definition
│   ├── actions.ts        # State transition implementations
│   ├── guards.ts         # Validation logic for transitions
│   ├── contracts.ts      # Round contract definitions
│   ├── scoring.ts        # Hand scoring logic
│   ├── serialization.ts  # JSON hydration/dehydration
│   └── engine.test.ts
│
└── index.ts              # Public API exports
```

**Responsibilities:**

- Zero dependencies on runtime environment (no I/O, no network)
- Pure functions where possible
- Fully deterministic given same inputs
- Exposes `createGame()`, `hydrateGame()`, `send()` for state transitions

### `/cli` — Terminal Client

```
cli/
├── index.ts              # Entry point
├── renderer.ts           # ASCII card/table rendering
├── input.ts              # Player input handling
├── ai-adapter.ts         # Interface to AI decision function
├── game-loop.ts          # Main game loop orchestration
├── persistence.ts        # JSON file save/load
└── cli.test.ts
```

**Responsibilities:**

- Human-readable game state display
- Input parsing and command construction
- Local game orchestration (human vs AI, multiplayer hot-seat)
- JSON persistence for save/resume

### `/app` — Web Application

```
app/
├── routes/
│   ├── _index.tsx        # Landing page
│   ├── game.$roomId.tsx  # Game room view
│   └── join.tsx          # Join game flow
│
├── components/
│   ├── Card.tsx
│   ├── Hand.tsx
│   ├── Table.tsx
│   ├── PlayerList.tsx
│   ├── ActionBar.tsx
│   └── ...
│
├── party/
│   ├── server.ts         # PartyKit server (Durable Object)
│   └── client.ts         # PartyKit client hooks
│
├── db/
│   ├── schema.ts         # Drizzle schema
│   ├── client.ts         # D1 client setup
│   └── queries.ts        # Game persistence queries
│
└── lib/
    ├── game-context.tsx  # React context for game state
    └── utils.ts
```

**Responsibilities:**

- Real-time multiplayer via PartyKit WebSockets
- React UI for game interaction
- D1 persistence for game state
- Room code generation and joining

---

## 3. Core Type Definitions

### Card Types

```typescript
// core/card/types.ts

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A"
  | "K"
  | "Q"
  | "J"
  | "10"
  | "9"
  | "8"
  | "7"
  | "6"
  | "5"
  | "4"
  | "3"
  | "2" // Wild
  | "Joker"; // Wild

export interface Card {
  id: string; // Unique identifier (needed with multiple decks)
  suit: Suit | null; // null for Joker
  rank: Rank;
}

// Derived properties (pure functions, not stored)
export const isWild = (card: Card): boolean =>
  card.rank === "2" || card.rank === "Joker";

export const isNatural = (card: Card): boolean => !isWild(card);

export const getPointValue = (card: Card): number => {
  if (card.rank === "Joker") return 50;
  if (card.rank === "A") return 15;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  if (card.rank === "2") return 2;
  return parseInt(card.rank, 10);
};
```

### Meld Types

```typescript
// core/meld/types.ts

export interface Meld {
  id: string;
  type: "set" | "run";
  cards: Card[];
  ownerId: string; // Player who laid it down
}

export interface Contract {
  roundNumber: 1 | 2 | 3 | 4 | 5 | 6;
  sets: number;
  runs: number;
}

export const CONTRACTS: Record<number, Contract> = {
  1: { roundNumber: 1, sets: 2, runs: 0 },
  2: { roundNumber: 2, sets: 1, runs: 1 },
  3: { roundNumber: 3, sets: 0, runs: 2 },
  4: { roundNumber: 4, sets: 3, runs: 0 },
  5: { roundNumber: 5, sets: 2, runs: 1 },
  6: { roundNumber: 6, sets: 1, runs: 2 },
};
```

### Game State Types

```typescript
// core/engine/types.ts

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isDown: boolean; // Has laid down contract this round
  totalScore: number; // Cumulative across rounds
  isConnected: boolean; // For multiplayer
}

export interface GameState {
  // Identity
  gameId: string;

  // Round tracking
  currentRound: 1 | 2 | 3 | 4 | 5 | 6;
  roundPhase: RoundPhase;

  // Players
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;

  // Card zones
  stock: Card[];
  discard: Card[];
  table: Meld[];

  // Turn state
  turnState: TurnState;

  // May I tracking
  mayIWindow: MayIWindow | null;

  // History
  roundHistory: RoundRecord[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type RoundPhase = "dealing" | "playing" | "roundEnd" | "gameEnd";

export interface TurnState {
  hasDrawn: boolean;
  hasLaidDown: boolean; // This turn specifically
  laidDownThisTurn: boolean; // Prevents lay-off on same turn
}

export interface MayIWindow {
  discardedCard: Card;
  discardedBy: string; // Player ID
  claimants: string[]; // Player IDs who called May I
  nextPlayerDeclined: boolean;
}

export interface RoundRecord {
  roundNumber: number;
  scores: Record<string, number>; // playerId -> points
  winnerId: string; // Who went out
}
```

### Command Types

```typescript
// core/engine/types.ts

// Commands are player intentions - things they're trying to do
export type Command =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "DECLINE_DISCARD" } // Opens May I window
  | { type: "CALL_MAY_I" }
  | { type: "LAY_DOWN"; melds: ProposedMeld[] }
  | { type: "LAY_OFF"; cardId: string; targetMeldId: string }
  | {
      type: "SWAP_JOKER";
      naturalCardId: string;
      targetMeldId: string;
      jokerPosition: number;
    }
  | { type: "DISCARD"; cardId: string }
  | { type: "GO_OUT"; finalLayOffs?: LayOff[] }; // Round 6 only

export interface ProposedMeld {
  type: "set" | "run";
  cardIds: string[];
}

export interface LayOff {
  cardId: string;
  targetMeldId: string;
}
```

### Event Types

```typescript
// core/engine/types.ts

// Events are facts - things that happened after validation
export type GameEvent =
  | { type: "GAME_CREATED"; gameId: string; players: Player[] }
  | { type: "ROUND_STARTED"; roundNumber: number }
  | { type: "CARDS_DEALT" }
  | { type: "CARD_DRAWN"; playerId: string; source: "stock" | "discard" }
  | { type: "DISCARD_DECLINED"; playerId: string }
  | { type: "MAY_I_CALLED"; playerId: string }
  | { type: "MAY_I_RESOLVED"; winnerId: string; card: Card; penaltyCard: Card }
  | { type: "MELDS_LAID_DOWN"; playerId: string; melds: Meld[] }
  | { type: "CARD_LAID_OFF"; playerId: string; card: Card; meldId: string }
  | {
      type: "JOKER_SWAPPED";
      playerId: string;
      naturalCard: Card;
      meldId: string;
    }
  | { type: "CARD_DISCARDED"; playerId: string; card: Card }
  | { type: "PLAYER_WENT_OUT"; playerId: string }
  | { type: "ROUND_ENDED"; scores: Record<string, number> }
  | {
      type: "GAME_ENDED";
      finalScores: Record<string, number>;
      winnerId: string;
    };
```

### AI Interface

```typescript
// core/engine/types.ts

export interface PlayerVisibleState {
  // What this player can see
  myHand: Card[];
  myId: string;
  isDown: boolean;

  // Public info
  currentRound: number;
  contract: Contract;
  table: Meld[];
  discardTop: Card | null;
  stockCount: number;

  // Other players (hidden hand info)
  opponents: {
    id: string;
    name: string;
    cardCount: number;
    isDown: boolean;
    totalScore: number;
  }[];

  // Turn info
  isMyTurn: boolean;
  turnState: TurnState;
  mayIWindow: MayIWindow | null;

  // Scores
  roundHistory: RoundRecord[];
}

// The AI decision function signature
export type AIDecisionFn = (
  visibleState: PlayerVisibleState,
  availableCommands: Command[]
) => Promise<Command>;
```

---

## 4. XState Machine Design

_See separate document: `XStateMachine.md`_

---

## 5. Testing Strategy

### Philosophy

- **TDD approach**: Write tests first, then implement
- **State-based testing**: Given state X, when command Y, assert state Z
- **JSON fixtures**: Predefined game states for common scenarios
- **No mocks for core logic**: Engine is pure, no external dependencies to mock

### Test Categories

#### Card Engine Tests (`core/card/card.test.ts`)

```typescript
describe("Deck", () => {
  test("creates correct number of cards for 2 decks + 4 jokers", () => {
    const deck = createDeck({ deckCount: 2, jokerCount: 4 });
    expect(deck.length).toBe(108); // 52*2 + 4
  });

  test("shuffle produces different order", () => {
    const deck1 = createDeck({ deckCount: 1, jokerCount: 2 });
    const deck2 = shuffle([...deck1]);
    expect(deck1).not.toEqual(deck2);
  });
});

describe("Card properties", () => {
  test("2s are wild", () => {
    const two = { id: "1", suit: "hearts", rank: "2" } as Card;
    expect(isWild(two)).toBe(true);
  });

  test("Joker is worth 50 points", () => {
    const joker = { id: "1", suit: null, rank: "Joker" } as Card;
    expect(getPointValue(joker)).toBe(50);
  });
});
```

#### Meld Validation Tests (`core/meld/meld.test.ts`)

```typescript
describe("Set validation", () => {
  test("valid set: three 9s different suits", () => {
    const cards = [
      { id: "1", suit: "hearts", rank: "9" },
      { id: "2", suit: "clubs", rank: "9" },
      { id: "3", suit: "spades", rank: "9" },
    ] as Card[];
    expect(isValidSet(cards)).toBe(true);
  });

  test("valid set: two 9s and one wild", () => {
    const cards = [
      { id: "1", suit: "hearts", rank: "9" },
      { id: "2", suit: "clubs", rank: "9" },
      { id: "3", suit: null, rank: "Joker" },
    ] as Card[];
    expect(isValidSet(cards)).toBe(true);
  });

  test("invalid set: wilds outnumber naturals", () => {
    const cards = [
      { id: "1", suit: "hearts", rank: "9" },
      { id: "2", suit: null, rank: "Joker" },
      { id: "3", suit: "diamonds", rank: "2" },
    ] as Card[];
    expect(isValidSet(cards)).toBe(false);
  });
});

describe("Run validation", () => {
  test("valid run: 4 consecutive same suit", () => {
    const cards = [
      { id: "1", suit: "spades", rank: "6" },
      { id: "2", suit: "spades", rank: "7" },
      { id: "3", suit: "spades", rank: "8" },
      { id: "4", suit: "spades", rank: "9" },
    ] as Card[];
    expect(isValidRun(cards)).toBe(true);
  });

  test("invalid run: duplicate rank", () => {
    const cards = [
      { id: "1", suit: "spades", rank: "6" },
      { id: "2", suit: "spades", rank: "7" },
      { id: "3", suit: "spades", rank: "7" }, // Duplicate!
      { id: "4", suit: "spades", rank: "8" },
    ] as Card[];
    expect(isValidRun(cards)).toBe(false);
  });

  test("invalid run: only 3 cards", () => {
    const cards = [
      { id: "1", suit: "spades", rank: "6" },
      { id: "2", suit: "spades", rank: "7" },
      { id: "3", suit: "spades", rank: "8" },
    ] as Card[];
    expect(isValidRun(cards)).toBe(false);
  });
});
```

#### Engine Tests (`core/engine/engine.test.ts`)

```typescript
describe("Turn flow", () => {
  test("player must draw before discarding", () => {
    const state = hydrateGame(fixtures.midRoundNotDrawn);
    const result = send(state, { type: "DISCARD", cardId: "card-1" });
    expect(result.error).toBe("Must draw before discarding");
  });

  test("player can draw from stock", () => {
    const state = hydrateGame(fixtures.midRoundNotDrawn);
    const result = send(state, { type: "DRAW_FROM_STOCK" });
    expect(result.state.turnState.hasDrawn).toBe(true);
    expect(result.state.players[0].hand.length).toBe(12);
  });
});

describe("Laying down", () => {
  test("cannot lay down incomplete contract", () => {
    const state = hydrateGame(fixtures.round1IncompleteContract);
    const result = send(state, {
      type: "LAY_DOWN",
      melds: [{ type: "set", cardIds: ["c1", "c2", "c3"] }], // Only 1 set, need 2
    });
    expect(result.error).toContain("contract");
  });

  test("cannot lay off on same turn as laying down", () => {
    const state = hydrateGame(fixtures.justLaidDown);
    const result = send(state, {
      type: "LAY_OFF",
      cardId: "extra-card",
      targetMeldId: "meld-1",
    });
    expect(result.error).toContain("same turn");
  });
});

describe("May I", () => {
  test("May I gives penalty card", () => {
    const state = hydrateGame(fixtures.mayIWindowOpen);
    const result = send(state, { type: "CALL_MAY_I" });
    // Player gets discard + 1 from stock = 2 new cards
    expect(result.state.players[1].hand.length).toBe(13);
  });

  test("priority goes to nearest player in turn order", () => {
    const state = hydrateGame(fixtures.multipleMayICalls);
    // Player 2 and 4 both called, current player is 1
    // Player 2 should win (closer in turn order)
    expect(result.state.mayIWindow.winnerId).toBe("player-2");
  });
});

describe("Joker swapping", () => {
  test("can swap joker from run before laying down", () => {
    const state = hydrateGame(fixtures.jokerInRunNotDown);
    const result = send(state, {
      type: "SWAP_JOKER",
      naturalCardId: "seven-spades",
      targetMeldId: "run-with-joker",
      jokerPosition: 2,
    });
    expect(result.state.players[0].hand).toContainEqual(
      expect.objectContaining({ rank: "Joker" })
    );
  });

  test("cannot swap joker after laying down", () => {
    const state = hydrateGame(fixtures.jokerInRunAlreadyDown);
    const result = send(state, {
      type: "SWAP_JOKER",
      naturalCardId: "seven-spades",
      targetMeldId: "run-with-joker",
      jokerPosition: 2,
    });
    expect(result.error).toContain("already laid down");
  });

  test("cannot swap joker from set", () => {
    const state = hydrateGame(fixtures.jokerInSet);
    const result = send(state, {
      type: "SWAP_JOKER",
      naturalCardId: "nine-clubs",
      targetMeldId: "set-with-joker",
      jokerPosition: 1,
    });
    expect(result.error).toContain("runs only");
  });
});

describe("Round 6 going out", () => {
  test("must have zero cards (no final discard)", () => {
    const state = hydrateGame(fixtures.round6OneCardLeft);
    const result = send(state, { type: "DISCARD", cardId: "last-card" });
    expect(result.error).toContain("must play all cards");
  });

  test("can go out by laying off last card", () => {
    const state = hydrateGame(fixtures.round6CanLayOffToZero);
    const result = send(state, {
      type: "GO_OUT",
      finalLayOffs: [{ cardId: "last-card", targetMeldId: "meld-1" }],
    });
    expect(result.state.roundPhase).toBe("roundEnd");
  });
});
```

### Test Fixtures

```typescript
// core/engine/fixtures/index.ts

export const fixtures = {
  newGame: {
    /* Fresh game state */
  },
  midRoundNotDrawn: {
    /* Player's turn, hasn't drawn */
  },
  round1IncompleteContract: {
    /* Player has 1 set, needs 2 */
  },
  justLaidDown: {
    /* Player just laid down, same turn */
  },
  mayIWindowOpen: {
    /* Discard available for May I */
  },
  multipleMayICalls: {
    /* Multiple players called May I */
  },
  jokerInRunNotDown: {
    /* Joker in run, player not down */
  },
  jokerInRunAlreadyDown: {
    /* Joker in run, player already down */
  },
  jokerInSet: {
    /* Joker in set (can't swap) */
  },
  round6OneCardLeft: {
    /* Round 6, player has 1 card */
  },
  round6CanLayOffToZero: {
    /* Round 6, can lay off to win */
  },
  // ... more as needed
};
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test core/engine/engine.test.ts

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

---

## 6. Terminal Client Design

### Display Layout

```
╔══════════════════════════════════════════════════════════════════╗
║  MAY I? - Round 3 of 6                    Contract: 2 Runs       ║
╠══════════════════════════════════════════════════════════════════╣
║  PLAYERS                 │  TABLE                                ║
║  ─────────────────────── │  ─────────────────────────────────── ║
║  > You (12 cards) ✓ Down │  Alice's Run: 5♠ 6♠ 7♠ 8♠            ║
║    Alice (8 cards) ✓ Down│  Alice's Run: 10♥ J♥ Q♥ K♥ A♥        ║
║    Bob (11 cards)        │  Bob's Set: 9♣ 9♦ 9♠                  ║
║    Carol (9 cards) ✓ Down│                                       ║
║                          │                                       ║
╠══════════════════════════╧═══════════════════════════════════════╣
║  DISCARD: [K♣]                              STOCK: 34 cards      ║
╠══════════════════════════════════════════════════════════════════╣
║  YOUR HAND:                                                      ║
║  [3♥] [5♦] [6♦] [7♦] [8♦] [9♣] [9♥] [J♠] [Q♠] [K♠] [2♣] [🃏]   ║
║   1    2    3    4    5    6    7    8    9    10   11   12     ║
╠══════════════════════════════════════════════════════════════════╣
║  ACTIONS: (d)raw stock | (t)ake discard | (l)ay down |          ║
║           (o)ff to meld | (s)wap joker | (x) discard            ║
╚══════════════════════════════════════════════════════════════════╝
> _
```

### Command Interface

```
> d                    # Draw from stock
> t                    # Take top discard
> l 2,3,4,5 6,7,11,12  # Lay down: cards 2-5 as first meld, 6,7,11,12 as second
> o 8 1                # Lay off card 8 onto table meld 1
> s 4 2 3              # Swap card 4 for joker in meld 2, position 3
> x 1                  # Discard card 1
> help                 # Show help
> state                # Dump current state (debug)
> save                 # Save game to file
> quit                 # Exit
```

### Game Loop

```typescript
// cli/game-loop.ts

async function gameLoop(game: GameState, players: PlayerController[]) {
  while (game.roundPhase !== "gameEnd") {
    render(game);

    const currentPlayer = players[game.currentPlayerIndex];
    const visibleState = getVisibleState(game, currentPlayer.id);
    const availableCommands = getAvailableCommands(game);

    let command: Command;

    if (currentPlayer.type === "human") {
      command = await promptHumanPlayer(visibleState, availableCommands);
    } else {
      // AI player
      await artificialDelay(); // Simulate thinking
      command = await currentPlayer.decide(visibleState, availableCommands);
    }

    const result = send(game, command);

    if (result.error) {
      console.log(`Invalid: ${result.error}`);
      continue;
    }

    game = result.state;

    // Handle May I window if open
    if (game.mayIWindow && !game.mayIWindow.resolved) {
      game = await handleMayIWindow(game, players);
    }
  }

  renderFinalScores(game);
}
```

---

## 7. Web App / PartyKit Integration

### PartyKit Server

```typescript
// app/party/server.ts

import type { Party, Connection } from "partykit/server";
import { hydrateGame, send, createGame } from "@/core";

export default class MayIParty implements Party {
  game: GameState | null = null;

  async onConnect(conn: Connection) {
    // Send current state to new connection
    if (this.game) {
      const playerId = this.getPlayerIdFromConnection(conn);
      const visibleState = getVisibleState(this.game, playerId);
      conn.send(JSON.stringify({ type: "STATE_SYNC", state: visibleState }));
    }
  }

  async onMessage(message: string, sender: Connection) {
    const { command } = JSON.parse(message);
    const playerId = this.getPlayerIdFromConnection(sender);

    // Validate it's this player's turn (or May I window)
    if (!this.canPlayerAct(playerId, command)) {
      sender.send(JSON.stringify({ type: "ERROR", message: "Not your turn" }));
      return;
    }

    const result = send(this.game!, command);

    if (result.error) {
      sender.send(JSON.stringify({ type: "ERROR", message: result.error }));
      return;
    }

    this.game = result.state;
    await this.persistGame();
    this.broadcastState();
  }

  broadcastState() {
    for (const conn of this.party.getConnections()) {
      const playerId = this.getPlayerIdFromConnection(conn);
      const visibleState = getVisibleState(this.game!, playerId);
      conn.send(JSON.stringify({ type: "STATE_SYNC", state: visibleState }));
    }
  }

  async persistGame() {
    // Save to D1 via Drizzle
  }
}
```

### React Integration

```typescript
// app/lib/game-context.tsx

import { createContext, useContext } from "react";
import usePartySocket from "partysocket/react";

export function GameProvider({ roomId, children }) {
  const [state, setState] = useState<PlayerVisibleState | null>(null);

  const socket = usePartySocket({
    room: roomId,
    onMessage(event) {
      const msg = JSON.parse(event.data);
      if (msg.type === "STATE_SYNC") {
        setState(msg.state);
      }
    },
  });

  const sendCommand = (command: Command) => {
    socket.send(JSON.stringify({ command }));
  };

  return (
    <GameContext.Provider value={{ state, sendCommand }}>
      {children}
    </GameContext.Provider>
  );
}
```

### D1 Schema

```typescript
// app/db/schema.ts

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().unique(),
  state: text("state").notNull(), // JSON serialized GameState
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const gamePlayers = sqliteTable("game_players", {
  gameId: text("game_id").references(() => games.id),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  joinOrder: integer("join_order").notNull(),
});
```

---

## 8. AI Player Interface

### Interface Definition

```typescript
// core/engine/types.ts

export interface AIPlayerConfig {
  id: string;
  name: string;
  decide: AIDecisionFn;
  thinkingDelayMs?: { min: number; max: number }; // Artificial delay range
}

export type AIDecisionFn = (
  visibleState: PlayerVisibleState,
  availableCommands: Command[]
) => Promise<Command>;
```

### Prompt Construction Helper

```typescript
// cli/ai-adapter.ts

export function buildPromptContext(
  visibleState: PlayerVisibleState,
  availableCommands: Command[]
): string {
  return `
You are playing "May I?", a contract rummy card game.

CURRENT SITUATION:
- Round: ${visibleState.currentRound} of 6
- Contract needed: ${formatContract(visibleState.contract)}
- You are ${
    visibleState.isDown
      ? "DOWN (can lay off)"
      : "NOT DOWN (need to complete contract)"
  }
- Your turn: ${visibleState.isMyTurn ? "YES" : "NO (May I window open)"}

YOUR HAND (${visibleState.myHand.length} cards):
${formatHand(visibleState.myHand)}

TABLE MELDS:
${formatTable(visibleState.table)}

DISCARD PILE TOP: ${formatCard(visibleState.discardTop)}
STOCK REMAINING: ${visibleState.stockCount} cards

OPPONENTS:
${visibleState.opponents
  .map(
    (o) =>
      `- ${o.name}: ${o.cardCount} cards, ${
        o.isDown ? "DOWN" : "not down"
      }, score: ${o.totalScore}`
  )
  .join("\n")}

AVAILABLE ACTIONS:
${availableCommands
  .map((cmd, i) => `${i + 1}. ${formatCommand(cmd)}`)
  .join("\n")}

Choose the best action by responding with just the number.
`;
}
```

### Example AI Implementation (for reference)

```typescript
// cli/ai/simple-ai.ts

// This is a reference implementation - you'll replace with LLM
export const simpleAI: AIDecisionFn = async (state, commands) => {
  // Very basic strategy:
  // 1. If can lay down, do it
  // 2. If discard helps, take it
  // 3. Otherwise draw from stock
  // 4. Discard highest point card not in potential melds

  const layDown = commands.find((c) => c.type === "LAY_DOWN");
  if (layDown) return layDown;

  // ... more logic

  return commands[0]; // Fallback
};
```

---

## Appendix: Development Sequence

### Phase 1: Core Engine (TDD)

1. Card types and utilities
1. Deck creation and shuffle
1. Meld validation (sets, runs, wild rules)
1. Contract validation
1. Basic state machine (draw → discard)
1. Lay down logic
1. Lay off logic
1. May I mechanics
1. Joker swapping
1. Scoring
1. Round 6 special rules

### Phase 2: Terminal Client

1. State renderer
1. Input parser
1. Human player loop
1. AI interface integration
1. Game orchestration
1. JSON persistence

### Phase 3: Web App

1. PartyKit server setup
1. Room creation/joining
1. React game components
1. Real-time state sync
1. D1 persistence
1. Polish and deploy

---

_Document version: 0.1_
_Last updated: [Date]_
