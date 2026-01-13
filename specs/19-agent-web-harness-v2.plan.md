# Plan: Agent Web Harness v2 (Best-Architecture Rebuild)

## Goal

Re-implement the web “agent testing harness” so it is:

- **Fast**: `/game/agent/new` gets to a playable game with zero form filling.
- **Correct**: refresh/reconnect never strands the player; “You” markers and views remain consistent.
- **CLI-parity**: supports injecting **the same canonical game state artifact** the CLI harness persists (engine persisted snapshot), plus minimal web metadata.
- **Stable**: avoids hand-constructing or hand-patching XState internals wherever possible.
- **Minimal duplication**: share utilities/constants across CLI/web; reuse existing server/lobby/game adapter logic.
- **Safe**: disabled by default in production; can be enabled explicitly in controlled environments.

This plan is written to be executable by a junior developer with minimal context.

---

## Core Principle (Architecture Decision)

### Canonical injection format = Engine persisted snapshot (+ web metadata)

The CLI harness already treats the engine’s persisted snapshot as the source of truth. The web harness should do the same.

**Canonical injection payload** should be either:

1) A full `StoredGameState` compatible with `PartyGameAdapter.fromStoredState()`
   - `engineSnapshot` is the output of `GameEngine.toJSON()`
   - `playerMappings` includes AI model IDs for AI turns

2) A “CLI save” format that contains the engine persisted snapshot, plus a mapping section for web-only needs (AI model ids + lobby ids)

The web should still allow a simplified “author friendly” format (like your current `AgentTestState`) **as a convenience**, but that should be explicitly labeled as “best-effort” / “limited fidelity” compared to snapshot injection.

---

## User-Facing Routes (Stable Contract)

### 1) Quick start

`GET /game/agent/new`

- Generates a fresh `roomId`
- Redirects to `/game/:roomId?agent=quick`
- The param is removed client-side after setup succeeds

### 2) State injection (recommended)

`GET /game/agent/state/:payload`

Where `:payload` is either:

- **Option A (simple / small):** base64url-encoded JSON of `AgentHarnessPayload` (may be large; see token flow below)
- **Option B (recommended / scalable):** a short token (e.g. `st_abc123`) that the client uses to retrieve the payload via a dev-only upload endpoint (or a DO-backed store)

**Important:** after setup succeeds, the client removes the query params so refresh does not re-inject.

---

## WebSocket Protocol (Single Entry Point)

### Replace ad-hoc injection with `AGENT_SETUP`

Add a single client→server message that covers:
- quick start lobby creation
- snapshot injection
- simplified state injection (optional)

This is the most important change because it fixes:
- reload behavior
- idempotency
- duplicated orchestration in the client

#### Client → Server

```ts
type AgentSetupMessage =
  | {
      type: "AGENT_SETUP";
      requestId: string; // nanoid or uuid for correlating logs
      mode: "quickStart";
      human: { playerId: string; name: string };
      ai: { modelId: "default:grok"; count: 2; namePrefix?: string };
      startingRound?: 1 | 2 | 3 | 4 | 5 | 6;
    }
  | {
      type: "AGENT_SETUP";
      requestId: string;
      mode: "injectStoredState";
      human: { playerId: string; name: string };
      storedState: {
        version: 1;
        engineSnapshot: string; // GameEngine.toJSON()
        playerMappings: Array<{
          lobbyId: string;
          engineId: string; // "player-0", "player-1"...
          name: string;
          isAI: boolean;
          aiModelId?: "default:grok" | "default:claude" | "default:openai" | "default:gemini";
        }>;
      };
    }
  | {
      type: "AGENT_SETUP";
      requestId: string;
      mode: "injectAgentTestState"; // OPTIONAL convenience mode
      human: { playerId: string; name: string };
      agentTestState: AgentTestState; // current simplified format
    };
```

#### Server → Client

```ts
type AgentSetupResultMessage = {
  type: "AGENT_SETUP_RESULT";
  requestId: string;
  status: "ok" | "already_setup" | "error";
  message?: string;
};
```

**Idempotency rule:** If a client sends `AGENT_SETUP` and the room is already `"playing"`, the server returns `status: "already_setup"` and immediately sends the caller a `GAME_STARTED` view (same behavior as a normal reconnect).

---

## Server Behavior (Authoritative)

### General constraints

- Agent harness messages are only accepted when enabled:
  - `import.meta.env.MODE !== "production"` **AND**
  - optionally `env.ENABLE_AGENT_HARNESS === "true"`
  - optionally a secret header or token (recommended if ever enabled outside local dev)

### Identity rules (avoid “wrong you”)

- The **client chooses** a stable `playerId` per room and sends it in `AGENT_SETUP.human.playerId`.
- The **server is authoritative**: on success it must send `JOINED` with the accepted `playerId` and the client must persist it.

### Quick start flow (server-side)

When `mode: "quickStart"`:

1. Ensure room phase is `lobby`
   - If already `playing`, respond `already_setup` and send `GAME_STARTED` to caller.
2. Ensure human presence exists for `human.playerId`
   - Store presence for the human only.
3. Ensure lobbyState contains requested AI players
   - Reuse `addAIPlayer(...)` from `app/party/mayi-room.lobby.ts`
   - Use stable names `Grok-1`, `Grok-2` unless collisions; collisions are OK for testing.
4. Start game
   - Reuse existing `handleStartGame` logic, but allow the harness request to start even if “host” rules would block (or explicitly ensure the harness human becomes host).
5. Send `AGENT_SETUP_RESULT(ok)` and then (or before) normal `GAME_STARTED` messages.

### Inject stored state flow (server-side)

When `mode: "injectStoredState"`:

1. If already `playing`, respond `already_setup` and send `GAME_STARTED` view.
2. Validate `storedState` (zod) and validate internal consistency:
   - engineSnapshot parses as JSON
   - `playerMappings` cover engine ids `player-0..player-(n-1)` without duplicates
   - exactly one human player exists (isAI:false)
   - AI players have `aiModelId` (needed for AI turns)
3. Store presence only for the harness human.
4. Convert `playerMappings` to lobbyState aiPlayers:
   - `LobbyState.aiPlayers` expects `{ playerId, name, modelId, modelDisplayName }`
   - `modelDisplayName` should come from `app/party/ai-models.ts`
5. Store game state:
   - `StoredGameState.engineSnapshot` (string)
   - `StoredGameState.playerMappings` (from payload)
   - `roomId`, `createdAt`, `updatedAt`, `activityLog` (can be minimal)
6. Set room phase to `playing`
7. Broadcast player views via existing `broadcastPlayerViews(adapter)`
8. Return `AGENT_SETUP_RESULT(ok)`

---

## Client Behavior (Dumb + Stable)

### Use a hook: `useAgentHarnessSetup`

All “agent harness logic” should live in one hook so `game.$roomId.tsx` stays readable.

Responsibilities:

- Detect agent mode from URL params:
  - `?agent=quick`
  - `?agentState=<payloadOrToken>`
- Decode / fetch payload if needed
- Persist identity:
  - on startup: if injection payload includes human id/name, seed sessionStorage before joining
  - on `JOINED`: overwrite local id with server-accepted id
- Send a single `AGENT_SETUP` request after socket is open
- After receiving `GAME_STARTED`, strip the agent params from the URL

### URL stripping rule

Once we have **any** successful path into gameplay (`GAME_STARTED` received), remove:
- `agent`
- `agentState`
- any upload token params

This ensures refresh behaves like normal gameplay (just JOIN).

---

## State Transport (How do we get payload into the browser?)

You have three workable options; implement in this order:

### Option 1 (fastest): base64url in URL

Keep `GET /game/agent/state/:payload` where payload is base64url JSON.

Pros:
- trivial to implement

Cons:
- URL length limits
- visible in logs/history

### Option 2 (recommended): dev-only upload endpoint + token

Implement:

`POST /game/agent/upload`

- Accept JSON body: `{ storedState: AgentStoredStateV1 }`
- Return: `{ token: "st_xxx" }`

Then:

`GET /game/agent/state/:token`

- Redirects to `/game/:roomId?agentStateToken=:token`
- Client fetches `/game/agent/upload/:token` to retrieve payload and then sends `AGENT_SETUP(mode=injectStoredState, storedState=...)`

Storage choices:
- simplest: in-memory map in dev server (not reliable)
- better: a small dedicated Durable Object “AgentHarnessStore” with storage keys and timestamp GC

### Option 3: extension injection (no URL payload at all)

The Chrome extension can inject a script that:
- opens `/game/agent/state` (no payload)
- sets payload into sessionStorage
- triggers navigation to `/game/:roomId?agentStateKey=...`

This is the cleanest UX but requires extension changes; consider later.

---

## Reuse / Deduplication

### 1) Base64url utilities

Create a shared util (usable by CLI + web):

`core/utils/base64url.ts`

Exports:
- `encodeUtf8ToBase64Url(text: string): string`
- `decodeBase64UrlToUtf8(encoded: string): string`

Then:
- CLI can use it for exporting/importing test fixtures
- Web uses it for route params and state payloads

### 2) AI model IDs and display names

Keep:

`app/party/ai-models.ts`

and import it from:
- `app/party/protocol.types.ts`
- `app/party/agent-state.validation.ts`
- new harness schemas

---

## Concrete File Plan (Exact Edits)

### A) New files

1) `app/party/agent-harness.types.ts`
   - Zod schemas for `AgentSetupMessage` and `AgentSetupResultMessage`
   - Export `agentSetupMessageSchema`

2) `app/ui/agent-harness/useAgentHarnessSetup.ts`
   - The client orchestration hook

3) `core/utils/base64url.ts` (if adopting shared util)

4) (Optional) `app/routes/game.agent.upload.tsx`
   - action/loader for upload token workflow

### B) Modify existing files

1) `app/party/protocol.types.ts`
   - Add `AGENT_SETUP` to `clientMessageSchema` union
   - Add `AGENT_SETUP_RESULT` to `ServerMessage` union

2) `app/party/mayi-room.ts`
   - Add `case "AGENT_SETUP": await this.handleAgentSetup(conn, msg)`
   - Implement `handleAgentSetup`
   - Prefer deprecating direct `INJECT_STATE` (keep temporarily as alias that maps to `AGENT_SETUP(mode=injectAgentTestState)` if you want backward compatibility)

3) `app/routes/game.$roomId.tsx`
   - Remove inline “agent quick start / injection” logic
   - Use `useAgentHarnessSetup` hook

4) `app/routes/game.agent.new.tsx`
   - Keep as redirect-only route

5) `app/routes/game.agent.state.$state.tsx`
   - Validate param (basic)
   - Redirect with query param so hook can act

6) `docs/agent-web-testing.md`
   - Document quick start, injection formats, and “URL params removed after success”
   - Provide example of snapshot injection (see below)

---

## Example Code Snippets (Implementation Templates)

### 1) Zod schema (`app/party/agent-harness.types.ts`)

```ts
import { z } from "zod";
import { AI_MODEL_IDS } from "./ai-models";

const humanSchema = z.object({
  playerId: z.string().min(1).max(64),
  name: z.string().min(1).max(24),
});

const playerMappingSchema = z.object({
  lobbyId: z.string().min(1),
  engineId: z.string().regex(/^player-\\d+$/),
  name: z.string().min(1).max(24),
  isAI: z.boolean(),
  aiModelId: z.enum(AI_MODEL_IDS).optional(),
});

const storedStateV1Schema = z.object({
  version: z.literal(1),
  engineSnapshot: z.string().min(1),
  playerMappings: z.array(playerMappingSchema).min(3).max(8),
});

export const agentSetupMessageSchema = z.discriminatedUnion("mode", [
  z.object({
    type: z.literal("AGENT_SETUP"),
    requestId: z.string().min(1),
    mode: z.literal("quickStart"),
    human: humanSchema,
    ai: z.object({
      modelId: z.literal("default:grok"),
      count: z.literal(2),
      namePrefix: z.string().optional(),
    }),
    startingRound: z.number().int().min(1).max(6).optional(),
  }),
  z.object({
    type: z.literal("AGENT_SETUP"),
    requestId: z.string().min(1),
    mode: z.literal("injectStoredState"),
    human: humanSchema,
    storedState: storedStateV1Schema,
  }),
]);
```

### 2) Server handler skeleton (`app/party/mayi-room.ts`)

```ts
private async handleAgentSetup(conn, msg: AgentSetupMessage) {
  if (!AGENT_TESTING_ENABLED) { /* send ERROR */ return; }

  const roomPhase = await this.getRoomPhase();
  if (roomPhase === "playing") {
    conn.send(JSON.stringify({ type: "AGENT_SETUP_RESULT", requestId: msg.requestId, status: "already_setup" }));
    // If conn isn't associated yet, require JOIN first or set state from msg.human.playerId.
    conn.setState({ playerId: msg.human.playerId });
    const gameState = await this.getGameState();
    if (gameState) {
      const adapter = PartyGameAdapter.fromStoredState(gameState);
      const view = adapter.getPlayerView(msg.human.playerId);
      conn.send(JSON.stringify({ type: "GAME_STARTED", state: view, activityLog: adapter.getRecentActivityLog(10) }));
    }
    return;
  }

  switch (msg.mode) {
    case "quickStart":
      // store human presence, ensure 2 AIs, start game, broadcast views
      break;
    case "injectStoredState":
      // validate, store presence, store lobbyState.aiPlayers, store game, broadcast views
      break;
  }

  conn.send(JSON.stringify({ type: "AGENT_SETUP_RESULT", requestId: msg.requestId, status: "ok" }));
}
```

### 3) Client hook skeleton (`app/ui/agent-harness/useAgentHarnessSetup.ts`)

```ts
export function useAgentHarnessSetup(opts: {
  roomId: string;
  socket: PartySocket | null;
  agentMode: "none" | "quickStart" | "inject";
  encodedPayload?: string;
  onJoined: (playerId: string, name: string) => void;
  onSetupComplete: () => void;
}) {
  // - decode payload (if any)
  // - seed sessionStorage player id/name if payload says so
  // - send AGENT_SETUP once per connection
  // - on GAME_STARTED: strip url params + call onSetupComplete()
}
```

---

## Snapshot Injection Example (Docs)

### Create payload from CLI game

Add a CLI helper command later (optional):

`bun cli/play.ts <gameId> export --format agentStoredState`

Outputs JSON:

```json
{
  "version": 1,
  "engineSnapshot": "{...GameEngine.toJSON()...}",
  "playerMappings": [
    { "lobbyId": "agent-player", "engineId": "player-0", "name": "Agent", "isAI": false },
    { "lobbyId": "ai-1", "engineId": "player-1", "name": "Grok-1", "isAI": true, "aiModelId": "default:grok" },
    { "lobbyId": "ai-2", "engineId": "player-2", "name": "Grok-2", "isAI": true, "aiModelId": "default:grok" }
  ]
}
```

Then base64url encode and navigate:

`/game/agent/state/<base64url(payload)>`

---

## Testing Plan

### Unit tests

1) `app/party/agent-harness.types.test.ts`
   - valid quickStart parses
   - valid injectStoredState parses
   - rejects missing aiModelId for AI
   - rejects non-sequential engineId mapping

2) Pure helper tests (recommended)

Extract logic from `MayIRoom.handleAgentSetup` into pure functions, e.g.:

- `buildLobbyStateFromPlayerMappings(...)`
- `validateStoredStateConsistency(...)`

Test with Bun without Workers runtime.

### Manual QA checklist

1) `/game/agent/new`
   - lands in game view quickly
   - AIs appear and play
2) refresh mid-game
   - reconnect works
   - no prompts, “You” still correct
3) `/game/agent/state/:payload` inject mid-round
   - table meld ownership displays correctly
   - discard draw pulls expected top card
   - May-I eligibility behaves as expected

---

## Migration / Rollout Steps

1) Implement `AGENT_SETUP` while keeping existing `INJECT_STATE` temporarily.
2) Update routes/docs to use `AGENT_SETUP`.
3) Deprecate `INJECT_STATE` and remove once extension/tests are migrated.

