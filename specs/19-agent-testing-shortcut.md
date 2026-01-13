# Spec: Agent Testing Shortcut Route (#19)

## Summary

Create a comprehensive agent testing subsystem for web E2E testing that mimics the CLI agent harness capabilities. This allows Claude (via Chrome extension) to instantly set up test scenarios by injecting custom game state.

## Decision

**Approaches Considered:**
1. **Minimal** — Query param redirect with inline setup logic
2. **Clean Architecture** — Full testing subsystem with state injection (SELECTED)
3. **Pragmatic** — Hook-based auto-setup without state injection

**Selected:** Clean Architecture (Approach 2)

**Rationale:** Human feedback requested that we mimic the CLI agent harness capabilities, specifically the ability to inject full game state including players, round, hands, melds, etc. This enables instant setup of edge case scenarios for UI testing. The added complexity is justified by the testing power it provides.

## Technical Design

### Overview

The web agent testing system provides two modes:
1. **Quick Start Mode** — Navigate to `/game/agent/new`, get a game with auto-added AI players
2. **State Injection Mode** — Navigate to `/game/agent/state/<encoded-state>` to inject custom game state

Both modes bypass the normal lobby flow and drop the agent directly into gameplay.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Testing Routes                          │
├─────────────────────────────────────────────────────────────────┤
│  /game/agent/new                                                 │
│  └── Creates new room, redirects with ?agent=true                │
│                                                                  │
│  /game/agent/state/:base64State                                  │
│  └── Creates new room, injects state via query param             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    game.$roomId.tsx                              │
├─────────────────────────────────────────────────────────────────┤
│  useAgentTestSetup(agentMode, injectedState)                     │
│  └── Detects agent mode from URL params                          │
│  └── If injectedState: sends INJECT_STATE message                │
│  └── If agentMode only: sends ADD_AI_PLAYER messages, START_GAME │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MayIRoom (PartyServer)                        │
├─────────────────────────────────────────────────────────────────┤
│  INJECT_STATE message handler                                    │
│  └── Validates state format                                      │
│  └── Sets room phase to "playing"                                │
│  └── Creates PartyGameAdapter from injected state                │
│  └── Broadcasts GAME_STATE to all clients                        │
└─────────────────────────────────────────────────────────────────┘
```

### Files to Create

| File | Purpose |
|------|---------|
| `app/routes/game.agent.new.tsx` | Quick start route - creates room and redirects |
| `app/routes/game.agent.state.$state.tsx` | State injection route - creates room with injected state |
| `app/ui/agent-test/useAgentTestSetup.ts` | Hook that orchestrates agent test setup |
| `app/ui/agent-test/useAgentTestSetup.test.ts` | Tests for the hook |
| `app/party/agent-state.types.ts` | Types for injected state format |
| `app/party/agent-state.validation.ts` | Zod validation for injected state |
| `docs/agent-web-testing.md` | Documentation for the web agent testing system |

### Files to Modify

| File | Changes |
|------|---------|
| `app/routes.ts` | Add new agent routes |
| `app/routes/game.$roomId.tsx` | Use useAgentTestSetup hook, handle query params |
| `app/party/protocol.types.ts` | Add INJECT_STATE client message type |
| `app/party/mayi-room.ts` | Handle INJECT_STATE message |

### Implementation Sequence

1. **Define injected state types** (`agent-state.types.ts`)
   - Simplified state format (subset of full engine snapshot)
   - Player definitions with hands
   - Table melds
   - Stock and discard
   - Round/turn info

2. **Create validation** (`agent-state.validation.ts`)
   - Zod schema for state format
   - Validation for card uniqueness, valid ranks/suits

3. **Add protocol messages** (`protocol.types.ts`)
   - Add INJECT_STATE message to client messages
   - Add INJECT_STATE_FAILED response

4. **Implement server handler** (`mayi-room.ts`)
   - Parse and validate injected state
   - Convert to StoredGameState format
   - Initialize game in "playing" phase
   - Broadcast to all clients

5. **Create useAgentTestSetup hook**
   - Detect agent mode from URL params
   - Wait for WebSocket connection
   - Send appropriate setup messages
   - Track setup completion

6. **Create route files**
   - `game.agent.new.tsx` - generate room ID, redirect with ?agent=true
   - `game.agent.state.$state.tsx` - decode state, redirect with params

7. **Update game.$roomId.tsx**
   - Use the hook to handle agent test setup
   - Parse query params for agent mode and injected state

8. **Write documentation** (`docs/agent-web-testing.md`)
   - How to use quick start mode
   - How to create and inject custom state
   - Example scenarios (Round 2 with specific hands, etc.)

### Injected State Format

A simplified format that's easier to write than full XState snapshots:

```typescript
interface AgentTestState {
  /** Players (first is the agent/human) */
  players: Array<{
    id: string;
    name: string;
    isAI: boolean;
    hand: Card[];
    isDown: boolean;
    totalScore?: number;
  }>;
  /** Current round (1-6) */
  roundNumber: RoundNumber;
  /** Cards in stock pile */
  stock: Card[];
  /** Cards in discard pile (top card last) */
  discard: Card[];
  /** Melds on the table */
  table: Meld[];
  /** Turn state */
  turn: {
    currentPlayerIndex: number;
    hasDrawn: boolean;
    phase: "awaitingDraw" | "awaitingAction" | "awaitingDiscard";
  };
}
```

This format is converted to the full XState snapshot format server-side.

### URL Encoding

State is base64url encoded for URL safety:
```
/game/agent/state/eyJwbGF5ZXJzIjpbLi4uXX0
```

For large states, consider:
1. Client stores state in sessionStorage before redirect
2. Route passes a key instead of full state
3. Game route retrieves from sessionStorage

### Quick Start Flow

```
Browser → /game/agent/new
        → Generates roomId (nanoid)
        → Stores playerId/name in sessionStorage
        → Redirects to /game/{roomId}?agent=true

game.$roomId.tsx
        → useAgentTestSetup detects ?agent=true
        → Waits for WebSocket CONNECTED
        → Sends JOIN message
        → Waits for JOINED
        → Sends ADD_AI_PLAYER × 2 (Grok models)
        → Sends START_GAME
        → Game begins, agent can play
```

### State Injection Flow

```
Browser → /game/agent/state/{base64State}
        → Decodes state
        → Generates roomId (nanoid)
        → Stores state + playerId in sessionStorage
        → Redirects to /game/{roomId}?injectState=true

game.$roomId.tsx
        → useAgentTestSetup detects ?injectState=true
        → Retrieves state from sessionStorage
        → Waits for WebSocket CONNECTED
        → Sends JOIN message
        → Sends INJECT_STATE with state payload
        → Server validates, creates game, broadcasts GAME_STATE
        → Agent is in the middle of the game, can act immediately
```

### Verification Steps

| Step | Command | Expected |
|------|---------|----------|
| Type check | `bun run typecheck` | No errors |
| Unit tests | `bun test app/ui/agent-test` | All pass |
| Build | `bun run build` | Success |
| Quick start | Navigate to `/game/agent/new` | Game starts with 2 AI players |
| State inject | Use Claude Chrome to inject Round 2 scenario | Game shows injected state |

### TDD Plan

- [ ] Write test for AgentTestState Zod validation (valid state passes)
- [ ] Write test for AgentTestState validation (invalid cards rejected)
- [ ] Write test for useAgentTestSetup hook (detects agent mode)
- [ ] Write test for useAgentTestSetup hook (sends correct messages)
- [ ] Write test for INJECT_STATE handler (creates valid game)
- [ ] Write test for INJECT_STATE handler (rejects invalid state)

### Security Considerations

- State injection is only available in development or with explicit flag
- Injected state is validated to prevent XSS or prototype pollution
- No sensitive data exposed in URLs (state in sessionStorage)
