# Agent Web Testing

Routes and tooling for end-to-end testing of AI agents playing May I? through the web UI.

## Quick Start

The fastest way to start testing is:

```bash
# Start the dev server
bun run dev

# Navigate to quick start (auto-starts a 3-player game)
# In a browser or via curl:
curl -L http://localhost:5173/game/agent/new
# Redirects to /game/:roomId?agent=true
```

## Testing Routes

### `/game/agent/new` — Quick Start

This route is only enabled in development mode. In production, it returns `404`.

Creates a new room and auto-starts a game with:

- 1 human: "Agent" (the UI automation agent)
- 2 AI players: Grok

**Response:** Redirects to `/game/:roomId?agent=true` (the param is removed after setup succeeds)

### `/game/agent/state/:state` — Custom State Injection

This route is only enabled in development mode. In production, it returns `404`.

Creates a new room with a custom game state.

**Parameters:**
- `:state` — Base64url-encoded JSON of either:
  - an `AgentTestState` object (simple format)
  - an `AgentStoredStateV1` object (engine snapshot + mappings; best parity with CLI harness)

**Response:** Redirects to `/game/:roomId?agentState=<base64url>`
The `agentState` query param is removed after setup succeeds so refreshes don't re-inject.

**Example:**
```bash
# Create state JSON
STATE='{"players":[...],"roundNumber":1,...}'

# Base64url encode it
ENCODED=$(echo -n "$STATE" | base64 | tr '+/' '-_' | tr -d '=')

# Navigate to the route
curl -L "http://localhost:5173/game/agent/state/$ENCODED"
```

## AgentTestState Format

The simplified state format for test injection:

```typescript
interface AgentTestState {
  // Players in turn order (first is the agent being tested)
  players: AgentTestPlayer[];

  // Current round (1-6)
  roundNumber: 1 | 2 | 3 | 4 | 5 | 6;

  // Cards in stock (draw) pile
  stock: Card[];

  // Cards in discard pile (top card is first)
  discard: Card[];

  // Melds on the table
  table: Meld[];

  // Current turn state
  turn: {
    currentPlayerIndex: number;
    hasDrawn: boolean;
    drawSource?: "stock" | "discard";
    phase: "awaitingDraw" | "awaitingAction" | "awaitingDiscard";
  };
}

interface AgentTestPlayer {
  id: string;           // Unique player ID
  name: string;         // Display name
  isAI: boolean;        // true for AI opponents
  aiModelId?: string;   // Required if isAI (e.g., "default:grok")
  hand: Card[];         // Cards in hand
  isDown: boolean;      // Has laid down contract
  totalScore?: number;  // Cumulative score (defaults to 0)
}

interface Card {
  id: string;                  // Unique card ID (e.g., "card-1")
  suit: "hearts" | "diamonds" | "clubs" | "spades" | null; // null for Joker
  rank: "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2" | "Joker";
}

interface Meld {
  id: string;           // Unique meld ID (e.g., "meld-1")
  type: "set" | "run";  // Meld type
  cards: Card[];        // Cards in the meld (min 3)
  ownerId: string;      // Must match one of players[].id (owner of the meld)
}
```

## AgentStoredStateV1 Format (CLI-Parity)

For best parity with the CLI harness, you can inject the engine’s persisted snapshot directly.

```typescript
interface AgentStoredStateV1 {
  version: 1;
  // The exact JSON string returned by GameEngine.toJSON()
  engineSnapshot: string;
  // Lobby IDs (socket identities) ↔ engine IDs ("player-0", ...)
  playerMappings: Array<{
    lobbyId: string;
    engineId: `player-${number}`;
    name: string;
    isAI: boolean;
    aiModelId?: "default:grok" | "default:claude" | "default:openai" | "default:gemini";
  }>;
}
```

## Available AI Models

When specifying `aiModelId` for AI players:

| Model ID | Description |
|----------|-------------|
| `default:grok` | Grok (xAI) |
| `default:claude` | Claude (Anthropic) |
| `default:openai` | GPT (OpenAI) |
| `default:gemini` | Gemini (Google) |

## Example: Custom Test State

Create a state where the agent is about to lay down a contract:

```javascript
const state = {
  players: [
    {
      id: "agent-player",
      name: "Agent",
      isAI: false,
      hand: [
        // Two sets ready to lay down
        { id: "c1", suit: "hearts", rank: "K" },
        { id: "c2", suit: "diamonds", rank: "K" },
        { id: "c3", suit: "clubs", rank: "K" },
        { id: "c4", suit: "hearts", rank: "Q" },
        { id: "c5", suit: "diamonds", rank: "Q" },
        { id: "c6", suit: "clubs", rank: "Q" },
        // Extra cards
        { id: "c7", suit: "spades", rank: "5" },
        { id: "c8", suit: "hearts", rank: "3" },
      ],
      isDown: false,
    },
    {
      id: "ai-1",
      name: "Grok-1",
      isAI: true,
      aiModelId: "default:grok",
      hand: [
        { id: "c10", suit: "spades", rank: "10" },
        { id: "c11", suit: "hearts", rank: "9" },
      ],
      isDown: false,
    },
    {
      id: "ai-2",
      name: "Grok-2",
      isAI: true,
      aiModelId: "default:grok",
      hand: [
        { id: "c20", suit: "clubs", rank: "7" },
        { id: "c21", suit: "diamonds", rank: "6" },
      ],
      isDown: false,
    },
  ],
  roundNumber: 1,
  stock: [
    { id: "s1", suit: "hearts", rank: "10" },
    { id: "s2", suit: "diamonds", rank: "4" },
    // ... more cards
  ],
  discard: [
    { id: "d1", suit: "spades", rank: "A" },
  ],
  table: [],
  turn: {
    currentPlayerIndex: 0,  // Agent's turn
    hasDrawn: true,         // Already drew
    drawSource: "stock",    // "stock" or "discard" (defaults to "stock" if omitted)
    phase: "awaitingAction", // Can lay down or skip
  },
};
```

## WebSocket Protocol

When the game loads with `?agent=true` or `?agentState=...`, it sends a single `AGENT_SETUP` message and the server handles join + setup.

```typescript
// Client → Server (quick start)
{
  type: "AGENT_SETUP",
  requestId: "agent-<roomId>",
  mode: "quickStart",
  human: { playerId: "<session-id>", name: "Agent" },
  ai: { modelId: "default:grok", count: 2, namePrefix: "Grok" }
}

// Client → Server (state injection)
{
  type: "AGENT_SETUP",
  requestId: "agent-<roomId>",
  mode: "injectAgentTestState",
  human: { playerId: "agent-player", name: "Agent" },
  agentTestState: AgentTestState
}

// Client → Server (state injection, CLI-parity)
{
  type: "AGENT_SETUP",
  requestId: "agent-<roomId>",
  mode: "injectStoredState",
  human: { playerId: "agent-player", name: "Agent" },
  storedState: AgentStoredStateV1
}
```

The server responds with:
1. `JOINED` — Confirms the agent player is joined
2. `GAME_STARTED` — Contains the PlayerView for the agent

## Important Notes

1. **Card IDs must be unique** across all cards (hands, stock, discard, table)
2. **Joker cards must have `suit: null`**
3. **Non-Joker cards must have a valid suit**
4. **AI players must have `aiModelId` specified**
5. **Exactly one human player (`isAI: false`) is required**
6. **Agent harness routes are disabled in production**

## Validation

States are validated using Zod schemas before injection. Invalid states return a 400 error with details.

Common validation errors:
- Duplicate card IDs
- Invalid round number (must be 1-6)
- Joker with non-null suit
- AI player missing aiModelId
- Invalid meld owner ID
- Too few players (min 3) or too many (max 8)
