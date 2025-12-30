# Web App Scaffolding Plan

> **Status**: Planning Complete
> **Date**: December 29, 2024
> **Decision**: React Router 7 + PartyServer consolidated in a single Cloudflare Worker

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [State Synchronization Strategy](#state-synchronization-strategy)
4. [Technology Decisions](#technology-decisions)
5. [How the Consolidated Architecture Works](#how-the-consolidated-architecture-works)
6. [Project Structure](#project-structure)
7. [Configuration Files](#configuration-files)
8. [Implementation Code Examples](#implementation-code-examples)
9. [Development Workflow](#development-workflow)
10. [Deployment](#deployment)
11. [Hello-World Features](#hello-world-features)
12. [Future Considerations](#future-considerations)
13. [References](#references)

---

## Executive Summary

This document outlines the complete plan for scaffolding a web application for the "May I?" card game. After extensive research, we've decided on a **consolidated architecture**:

- **Single Cloudflare Worker** running both React Router 7 AND PartyServer
- **Server-authoritative state** with full state broadcast to clients
- **XState stays on server only** — clients are "dumb renderers" that receive state and send commands
- **No separate PartyKit deployment** — use `partyserver` package directly in the Worker

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Deployment model** | Single consolidated Worker | Simpler ops, no CORS, same-origin WebSocket |
| **State ownership** | Server-authoritative | Turn-based game; no client prediction needed |
| **State sync pattern** | Full state broadcast | Simple, debuggable, ~5KB state is trivial |
| **XState location** | Server only (in Orchestrator) | Clients don't need machine complexity |
| **Client role** | Dumb renderer + command sender | Receive `SerializableGameState`, send commands |

---

## Architecture Overview

### Consolidated Single-Worker Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Single Cloudflare Worker                              │
│                        (Your Cloudflare Account)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        workers/app.ts                                │ │
│  │                      (Entry Point)                                   │ │
│  │                                                                      │ │
│  │   export default {                                                   │ │
│  │     async fetch(request, env) {                                      │ │
│  │       // 1. Try PartyServer first (WebSocket + /parties/* routes)    │ │
│  │       const partyResponse = await routePartykitRequest(request, env);│ │
│  │       if (partyResponse) return partyResponse;                       │ │
│  │                                                                      │ │
│  │       // 2. Fall back to React Router (everything else)              │ │
│  │       return reactRouterHandler(request, env);                       │ │
│  │     }                                                                │ │
│  │   }                                                                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│            │                                    │                         │
│            ▼                                    ▼                         │
│  ┌──────────────────────┐          ┌──────────────────────────────────┐  │
│  │  React Router 7 App  │          │   MayIRoom (Durable Object)      │  │
│  │                      │          │   extends PartyServer.Server     │  │
│  │  Routes:             │          │                                  │  │
│  │  /         (home)    │          │   • Orchestrator instance        │  │
│  │  /game/:id (game)    │          │   • XState machine (internal)    │  │
│  │                      │          │   • WebSocket connections        │  │
│  │  Loaders/Actions:    │          │   • State persistence            │  │
│  │  • SSR rendering     │          │                                  │  │
│  │  • Form handling     │          │   Lifecycle:                     │  │
│  │                      │          │   • onStart() - load state       │  │
│  └──────────────────────┘          │   • onConnect() - new player     │  │
│                                    │   • onMessage() - game commands  │  │
│                                    │   • onClose() - player left      │  │
│                                    └──────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                    │                              ▲
                    │ HTTP (pages)                 │ WebSocket (game state)
                    ▼                              │
              ┌─────────────────────────────────────┐
              │              Browser                │
              │                                     │
              │  • React Router handles navigation  │
              │  • usePartySocket() for real-time   │
              │  • Receives full game state         │
              │  • Sends commands (not XState events)│
              │  • NO local XState machine          │
              └─────────────────────────────────────┘
```

### Why Consolidation Works

The `partyserver` npm package is designed to be embedded in any Cloudflare Worker. It's a library, not a separate service. Key insight from [threepointone/partyvite](https://github.com/threepointone/partyvite):

```typescript
import { routePartykitRequest, Server } from "partyserver";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||  // PartyServer handles /parties/*
      new Response("Not Found", { status: 404 })     // Fallback
    );
  }
}
```

**Benefits of consolidation:**
- Single deployment to Cloudflare
- No CORS between web app and WebSocket server
- Same-origin WebSocket connections
- Unified environment (env.DB, env.KV all available to both)
- Simpler development (one process, not two)

---

## State Synchronization Strategy

### Decision: Server-Authoritative with Full State Broadcast

For a turn-based card game like May I?, we use **Pattern A: Authoritative Server with Full State Broadcast**.

```
┌─────────────────────────────────────────────────────────────────┐
│ MayIRoom (Durable Object)                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Orchestrator                                                │ │
│  │ • XState machine hierarchy (GameMachine → RoundMachine →   │ │
│  │   TurnMachine → MayIWindowMachine)                          │ │
│  │ • Source of truth for all game state                        │ │
│  │ • Validates all commands                                    │ │
│  │ • Serializes state via getSerializableState()               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  onMessage(cmd) {                                                │
│    // 1. Execute command on Orchestrator                         │
│    const result = this.orchestrator.executeCommand(cmd);         │
│                                                                  │
│    // 2. If successful, send per-player views (NOT broadcast!)   │
│    if (result.success) {                                         │
│      for (const conn of this.room.getConnections()) {            │
│        const view = this.computePlayerView(conn.playerId);       │
│        conn.send(JSON.stringify({ type: "STATE_UPDATE", view }));│
│      }                         ↑ Each player sees only their hand │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↑
               Commands       │        ↓ Per-player views
               (draw, discard,│        (public state + YOUR hand only)
                lay down)     │
                              │
┌─────────────────────────────┴────────────────────────────────────┐
│                         Clients                                   │
│                                                                   │
│   • NO local XState machine                                       │
│   • Receive YOUR view → replace local state → re-render           │
│   • Send commands: { type: "DRAW_FROM_STOCK", playerId: "..." }   │
│   • Wait for new state from server                                │
│   • You see: your hand, card counts, table, discard               │
│   • You DON'T see: other players' hands                           │
└───────────────────────────────────────────────────────────────────┘
```

### Why This Pattern for May I?

| Aspect | Full State Broadcast | Event Forwarding |
|--------|---------------------|------------------|
| **Complexity** | Simple | Complex (need determinism) |
| **Debugging** | Easy (see full state) | Hard (state depends on history) |
| **Bandwidth** | ~5KB per update | Lower |
| **Client prediction** | Not needed | Enables it |
| **Best for** | Turn-based games | Real-time games (FPS, racing) |

**May I? is turn-based** — one player acts at a time. There's no need for client-side prediction or event forwarding. Full state broadcast is simpler and perfectly adequate.

### What Clients Send vs. Receive

**Clients send COMMANDS (not XState events):**
```typescript
// Commands map to Orchestrator methods
{ type: "DRAW_FROM_STOCK" }           → orchestrator.drawFromStock()
{ type: "DRAW_FROM_DISCARD" }         → orchestrator.drawFromDiscard()
{ type: "LAY_DOWN", meldGroups: [...] } → orchestrator.layDown(meldGroups)
{ type: "DISCARD", position: 3 }      → orchestrator.discardCard(3)
{ type: "LAY_OFF", cardPos, meldNum } → orchestrator.layOff(cardPos, meldNum)
{ type: "CALL_MAY_I" }                → orchestrator.callMayI()
{ type: "PASS" }                      → orchestrator.pass()
```

**Clients receive PER-PLAYER VIEWS (not raw state):**

> **Important**: You can't broadcast the full authoritative state to everyone — hands are secret! The server must compute a per-player "view" and send it per-connection.

```typescript
// Each player receives a personalized view
interface PlayerView {
  gameId: string;

  // Public information (same for everyone)
  public: {
    currentPlayerIndex: number;
    turnPhase: "DRAW" | "PLAY" | "DISCARD" | "MAY_I_WINDOW";
    round: number;
    discard: Card[];              // Top card(s) visible
    stockCount: number;           // How many cards in stock (not contents!)
    table: Meld[];                // Melds on table
    scores: Record<string, number>;
  };

  // Per-player information
  players: Array<{
    name: string;
    cardCount: number;            // How many cards they have (not contents!)
    hasLaidDown: boolean;
  }>;

  // Private: only YOUR hand (sent only to you)
  yourHand: Card[];
  yourPlayerIndex: number;
}
```

**Two approaches for sending views:**

1. **Per-connection send** (simpler): Loop through connections, compute view for each, send individually
   ```typescript
   for (const conn of this.room.getConnections()) {
     const playerId = this.connectionToPlayer.get(conn.id);
     const view = this.computePlayerView(playerId);
     conn.send(JSON.stringify({ type: "STATE_UPDATE", state: view }));
   }
   ```

2. **Broadcast public + unicast private**: Broadcast public state to all, then send private hand to each
   ```typescript
   // Everyone gets public state
   this.room.broadcast(JSON.stringify({ type: "PUBLIC_STATE", state: publicState }));

   // Each player gets their private hand
   for (const conn of this.room.getConnections()) {
     const playerId = this.connectionToPlayer.get(conn.id);
     conn.send(JSON.stringify({ type: "YOUR_HAND", hand: getHand(playerId) }));
   }
   ```

For May I?, approach #1 (per-connection send) is simpler since state is small.

### XState Is a Server-Side Implementation Detail

The XState actor hierarchy (GameMachine → RoundMachine → TurnMachine → MayIWindowMachine) stays entirely on the server. Clients never see XState events — they see serialized game state.

This is the "black box" approach: XState manages game logic internally, but the Orchestrator exposes a simple command-based API.

**Optional: Client-side UI state machine**

You can optionally use XState on the client for UI/connection concerns (not game rules):

```typescript
// Client-side machine for UI state only
const connectionMachine = createMachine({
  id: 'connection',
  initial: 'connecting',
  states: {
    connecting: { on: { CONNECTED: 'lobby' } },
    lobby: { on: { GAME_STARTED: 'playing' } },
    playing: { on: { GAME_ENDED: 'results' } },
    results: { on: { NEW_GAME: 'lobby' } },
    disconnected: { on: { RECONNECT: 'connecting' } }
  }
});
```

This is separate from the authoritative game state machine on the server. The client UI machine tracks connection state, screen transitions, and local UI concerns — not game rules.

---

## Technology Decisions

### Final Decisions Table

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Deployment model** | Single consolidated Worker | No separate PartyKit deployment; simpler ops |
| **Framework** | React Router 7 framework mode | Latest version, Cloudflare support |
| **Real-time** | `partyserver` package (embedded) | Library, not platform; no platform fees |
| **State sync** | Server-authoritative, full broadcast | Turn-based game; simple and debuggable |
| **XState location** | Server only | Clients don't need machine complexity |
| **Web app location** | `app/` folder at project root | Contains both RR7 routes and PartyServer |
| **Type sharing** | Direct imports via tsconfig paths | Same repo; no workspace needed initially |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Separate PartyKit deployment | Consolidation is simpler, no CORS |
| PartyKit managed platform | Want control; cloud-prem in own account |
| Event forwarding to clients | Overkill for turn-based game |
| XState on client | Adds complexity; server is source of truth |
| Remix | Evolved into React Router 7 |
| Two terminal dev workflow | Consolidated = single process |

---

## How the Consolidated Architecture Works

### Request Routing

The Worker entry point (`workers/app.ts`) routes requests:

1. **PartyServer routes** (`/parties/:server/:name`) → Durable Object
2. **Everything else** → React Router

```typescript
// workers/app.ts
import { routePartykitRequest } from "partyserver";
import { createRequestHandler } from "@react-router/cloudflare";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // PartyServer handles WebSocket upgrades and /parties/* routes
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    // React Router handles all other routes
    return createRequestHandler({ build: ... })(request, { env, ctx });
  }
}
```

### PartyServer Lifecycle

The `partyserver` package provides a `Server` class that manages:

- **Room creation**: Rooms are created on-demand when clients connect
- **WebSocket handling**: `onConnect`, `onMessage`, `onClose` lifecycle hooks
- **State persistence**: `this.room.storage` for key-value persistence
- **Broadcasting**: `this.room.broadcast()` to send to all connections

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";

export class MayIRoom extends Server {
  orchestrator: Orchestrator;

  async onStart() {
    // Load persisted state if exists
    const saved = await this.room.storage.get("game:state");
    if (saved) {
      this.orchestrator = Orchestrator.fromState(JSON.parse(saved));
    }
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    // Send current state to new connection
    if (this.orchestrator) {
      conn.send(JSON.stringify({
        type: "STATE_UPDATE",
        state: this.orchestrator.getSerializableState()
      }));
    }
  }

  onMessage(message: string, sender: Connection) {
    const cmd = JSON.parse(message);
    const result = this.executeCommand(cmd);

    if (result.success) {
      // Send per-player views (not broadcast!) because hands are private
      for (const conn of this.room.getConnections()) {
        const view = this.computePlayerView(conn.id);
        conn.send(JSON.stringify({ type: "STATE_UPDATE", state: view }));
      }
      this.room.storage.put("game:state", JSON.stringify(this.orchestrator.getSerializableState()));
    }
  }
}
```

### React Router Integration

React Router 7 handles:

- **SSR**: Server-side rendering for initial page loads
- **Loaders**: Data fetching on GET requests
- **Actions**: Form handling on POST requests
- **Client navigation**: SPA-style navigation after hydration

The game page establishes a WebSocket connection via `usePartySocket`:

```typescript
// routes/game.$roomId.tsx
import usePartySocket from "partysocket/react";

export default function Game({ loaderData }) {
  const { roomId } = loaderData;
  const [gameState, setGameState] = useState(null);

  const socket = usePartySocket({
    host: window.location.host,  // Same origin!
    room: roomId,
    party: "mayi",  // Maps to MayIRoom Durable Object

    onMessage(event) {
      const msg = JSON.parse(event.data);
      if (msg.type === "STATE_UPDATE") {
        setGameState(msg.state);  // Replace entire state
      }
    }
  });

  // Render based on gameState
  // Send commands via socket.send(JSON.stringify({ type: "DRAW_FROM_STOCK" }))
}
```

---

## Project Structure

```
mayi/                              # Existing project root
├── core/                          # Existing game engine (unchanged)
│   ├── engine/
│   │   ├── game.machine.ts
│   │   ├── round.machine.ts
│   │   ├── turn.machine.ts
│   │   └── ...
│   ├── card/
│   └── ...
│
├── cli/                           # Existing CLI (unchanged)
│   ├── harness/
│   │   └── orchestrator.ts        # Reused by PartyServer!
│   └── ...
│
├── app/                           # NEW: Consolidated web application
│   ├── workers/
│   │   └── app.ts                 # Worker entry: routes to Party or RR7
│   │
│   ├── party/
│   │   └── mayi-room.ts           # MayIRoom extends Server (uses Orchestrator)
│   │
│   ├── app/                       # React Router 7 app source
│   │   ├── root.tsx               # Root layout
│   │   ├── routes.ts              # Route definitions
│   │   └── routes/
│   │       ├── home.tsx           # / - create/join game
│   │       └── game.$roomId.tsx   # /game/:roomId - game UI
│   │
│   ├── lib/
│   │   ├── game-client.ts         # WebSocket client wrapper
│   │   └── game.types.ts          # Shared types for client/server messages
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── react-router.config.ts
│   └── wrangler.jsonc             # Durable Object bindings here!
│
├── specs/
│   └── web-app-scaffolding.plan.md
│
└── package.json                   # Root (optional workspace config)
```

### Key Differences from Original Plan

| Original Plan | New Consolidated Plan |
|--------------|----------------------|
| Separate `party/` folder at root | `app/party/` inside the app |
| `partykit.json` config | `wrangler.jsonc` with DO bindings |
| Two dev processes | Single `bun run dev` |
| Separate PartyKit deployment | Single Worker deployment |

---

## Configuration Files

### `app/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "mayi-web",
  "main": "./workers/app.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets (client-side JS, CSS, etc.)
  "assets": {
    "directory": "./build/client"
  },

  // Durable Object bindings for PartyServer
  "durable_objects": {
    "bindings": [
      {
        "name": "MayIRoom",
        "class_name": "MayIRoom"
      }
    ]
  },

  // Required for new Durable Object classes
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["MayIRoom"]
    }
  ],

  "observability": {
    "enabled": true
  }
}
```

### `app/vite.config.ts`

```typescript
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
```

### `app/react-router.config.ts`

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
```

### `app/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "~/core/*": ["../core/*"],
      "~/cli/*": ["../cli/*"]
    }
  },
  "include": ["app", "workers", "party", "../core", "../cli"]
}
```

### `app/package.json`

```json
{
  "name": "mayi-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "bun run build && wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router": "^7.0.0",
    "partysocket": "^1.0.0",
    "partyserver": "^0.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.0.0",
    "@react-router/cloudflare": "^7.0.0",
    "@react-router/dev": "^7.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

---

## Implementation Code Examples

### Worker Entry Point: `app/workers/app.ts`

```typescript
import { routePartykitRequest } from "partyserver";
import { createRequestHandler } from "@react-router/cloudflare";
// @ts-expect-error - virtual module from React Router build
import * as build from "virtual:react-router/server-build";

// Re-export the Durable Object class
export { MayIRoom } from "../party/mayi-room";

// Environment type with Durable Object bindings
interface Env {
  MayIRoom: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Try PartyServer first
    // Routes matching /parties/:server/:name go to Durable Objects
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    // 2. Everything else goes to React Router
    const requestHandler = createRequestHandler(build, "production");
    return requestHandler(request, { env, ctx });
  },
};
```

### PartyServer Room: `app/party/mayi-room.ts`

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";
import { Orchestrator, type SerializableGameState } from "~/cli/harness/orchestrator";

// Command types from client
type ClientCommand =
  | { type: "JOIN"; playerName: string }
  | { type: "START_GAME"; playerNames: string[] }
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "LAY_DOWN"; meldGroups: number[][] }
  | { type: "DISCARD"; position: number }
  | { type: "LAY_OFF"; cardPos: number; meldNum: number }
  | { type: "CALL_MAY_I" }
  | { type: "PASS" };

// Messages to client
type ServerMessage =
  | { type: "STATE_UPDATE"; state: SerializableGameState }
  | { type: "ERROR"; error: string; message: string }
  | { type: "WELCOME"; roomId: string; players: string[] };

export class MayIRoom extends Server {
  orchestrator: Orchestrator | null = null;
  players: Map<string, string> = new Map(); // connectionId -> playerName

  async onStart() {
    // Try to load persisted game state
    const saved = await this.room.storage.get<string>("game:state");
    if (saved) {
      try {
        const state = JSON.parse(saved) as SerializableGameState;
        this.orchestrator = Orchestrator.fromState(state);
        console.log(`[${this.room.id}] Loaded game state`);
      } catch (e) {
        console.error(`[${this.room.id}] Failed to load state:`, e);
      }
    }
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    console.log(`[${this.room.id}] Connection: ${conn.id}`);

    // Send welcome with current state
    const welcome: ServerMessage = {
      type: "WELCOME",
      roomId: this.room.id,
      players: Array.from(this.players.values()),
    };
    conn.send(JSON.stringify(welcome));

    // If game exists, send current state
    if (this.orchestrator) {
      const stateMsg: ServerMessage = {
        type: "STATE_UPDATE",
        state: this.orchestrator.getSerializableState(),
      };
      conn.send(JSON.stringify(stateMsg));
    }
  }

  onMessage(message: string, sender: Connection) {
    let cmd: ClientCommand;
    try {
      cmd = JSON.parse(message);
    } catch {
      this.sendError(sender, "PARSE_ERROR", "Invalid JSON");
      return;
    }

    switch (cmd.type) {
      case "JOIN":
        this.handleJoin(cmd.playerName, sender);
        break;

      case "START_GAME":
        this.handleStartGame(cmd.playerNames, sender);
        break;

      default:
        this.handleGameCommand(cmd, sender);
    }
  }

  onClose(conn: Connection) {
    const playerName = this.players.get(conn.id);
    this.players.delete(conn.id);
    console.log(`[${this.room.id}] Disconnected: ${conn.id} (${playerName})`);
  }

  private handleJoin(playerName: string, sender: Connection) {
    this.players.set(sender.id, playerName);

    // Broadcast to all other players
    this.room.broadcast(
      JSON.stringify({ type: "PLAYER_JOINED", playerName }),
      [sender.id]
    );
  }

  private handleStartGame(playerNames: string[], sender: Connection) {
    if (this.orchestrator) {
      this.sendError(sender, "GAME_EXISTS", "Game already started");
      return;
    }

    // Create new game
    this.orchestrator = new Orchestrator();
    this.orchestrator.startGame(playerNames);

    this.sendStateToAll();
    this.persistState();
  }

  private handleGameCommand(cmd: ClientCommand, sender: Connection) {
    if (!this.orchestrator) {
      this.sendError(sender, "NO_GAME", "Game not started");
      return;
    }

    let result: { success: boolean; error?: string; message?: string };

    switch (cmd.type) {
      case "DRAW_FROM_STOCK":
        result = this.orchestrator.drawFromStock();
        break;
      case "DRAW_FROM_DISCARD":
        result = this.orchestrator.drawFromDiscard();
        break;
      case "LAY_DOWN":
        result = this.orchestrator.layDown(cmd.meldGroups);
        break;
      case "DISCARD":
        result = this.orchestrator.discardCard(cmd.position);
        break;
      case "LAY_OFF":
        result = this.orchestrator.layOff(cmd.cardPos, cmd.meldNum);
        break;
      case "CALL_MAY_I":
        result = this.orchestrator.callMayI();
        break;
      case "PASS":
        result = this.orchestrator.pass();
        break;
      default:
        result = { success: false, error: "UNKNOWN", message: "Unknown command" };
    }

    if (!result.success) {
      this.sendError(sender, result.error || "ERROR", result.message || "Command failed");
      return;
    }

    // Send per-player views to all clients (not broadcast - hands are private!)
    this.sendStateToAll();
    this.persistState();
  }

  private sendStateToAll() {
    if (!this.orchestrator) return;

    // Send per-player views (not broadcast!) because hands are private
    for (const conn of this.room.getConnections()) {
      const playerId = this.players.get(conn.id);
      if (playerId) {
        const view = this.computePlayerView(playerId);
        conn.send(JSON.stringify({ type: "STATE_UPDATE", state: view }));
      }
    }
  }

  private computePlayerView(playerId: string): PlayerView {
    const state = this.orchestrator!.getSerializableState();
    const playerIndex = state.players.findIndex(p => p.name === playerId);

    return {
      gameId: state.gameId,
      public: {
        currentPlayerIndex: state.currentPlayerIndex,
        turnPhase: state.turnPhase,
        round: state.round,
        discard: state.discard,           // Top card visible
        stockCount: state.stock.length,   // Count only, not contents
        table: state.table,
        scores: state.scores,
      },
      players: state.players.map(p => ({
        name: p.name,
        cardCount: p.hand.length,         // Count only, not contents
        hasLaidDown: p.hasLaidDown,
      })),
      yourHand: state.players[playerIndex]?.hand ?? [],
      yourPlayerIndex: playerIndex,
    };
  }

  private async persistState() {
    if (!this.orchestrator) return;

    const state = this.orchestrator.getSerializableState();
    await this.room.storage.put("game:state", JSON.stringify(state));
  }

  private sendError(conn: Connection, error: string, message: string) {
    const msg: ServerMessage = { type: "ERROR", error, message };
    conn.send(JSON.stringify(msg));
  }
}
```

### Routes Configuration: `app/app/routes.ts`

```typescript
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  route("game/:roomId", "./routes/game.$roomId.tsx"),
] satisfies RouteConfig;
```

### Home Page: `app/app/routes/home.tsx`

```typescript
import type { Route } from "./+types/home";
import { Form, useActionData } from "react-router";
import { redirect } from "react-router";
import { nanoid } from "nanoid";
import { useState } from "react";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const roomId = nanoid(8);
    return redirect(`/game/${roomId}`);
  }

  if (intent === "join") {
    const roomId = formData.get("roomId");
    if (!roomId || typeof roomId !== "string") {
      return { error: "Please enter a room ID" };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
      return { error: "Invalid room ID format" };
    }
    return redirect(`/game/${roomId}`);
  }

  return { error: "Unknown action" };
}

export default function Home() {
  const actionData = useActionData<typeof action>();
  const [showJoinForm, setShowJoinForm] = useState(false);

  return (
    <main>
      <h1>May I?</h1>

      {actionData?.error && <div role="alert">{actionData.error}</div>}

      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        <button type="submit">Start New Game</button>
      </Form>

      {!showJoinForm ? (
        <button onClick={() => setShowJoinForm(true)}>Join Existing Game</button>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="join" />
          <input type="text" name="roomId" placeholder="Room ID" required />
          <button type="submit">Join</button>
          <button type="button" onClick={() => setShowJoinForm(false)}>Cancel</button>
        </Form>
      )}
    </main>
  );
}
```

### Game Page: `app/app/routes/game.$roomId.tsx`

```typescript
import type { Route } from "./+types/game.$roomId";
import usePartySocket from "partysocket/react";
import { useState, useCallback } from "react";
import type { SerializableGameState } from "~/cli/harness/orchestrator";

export async function loader({ params }: Route.LoaderArgs) {
  const roomId = params.roomId;
  if (!roomId || !/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    throw new Response("Invalid room ID", { status: 400 });
  }
  return { roomId };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Game ${data?.roomId} | May I?` }];
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<SerializableGameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : "",
    room: roomId,
    party: "mayi",

    onOpen() {
      setConnected(true);
    },

    onMessage(event) {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "STATE_UPDATE":
          setGameState(msg.state);
          break;
        case "ERROR":
          console.error("Game error:", msg.error, msg.message);
          break;
      }
    },

    onClose() {
      setConnected(false);
    },
  });

  const sendCommand = useCallback((cmd: object) => {
    socket?.send(JSON.stringify(cmd));
  }, [socket]);

  const handleJoin = () => {
    if (playerName.trim()) {
      sendCommand({ type: "JOIN", playerName: playerName.trim() });
      setHasJoined(true);
    }
  };

  const handleStartGame = () => {
    // For hello-world, just use connected player names
    // In real implementation, would collect from lobby
    sendCommand({ type: "START_GAME", playerNames: [playerName] });
  };

  return (
    <main>
      <h1>Game: {roomId}</h1>
      <p>Status: {connected ? "Connected" : "Connecting..."}</p>

      {!hasJoined && (
        <section>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your name"
            disabled={!connected}
          />
          <button onClick={handleJoin} disabled={!connected || !playerName.trim()}>
            Join Game
          </button>
        </section>
      )}

      {hasJoined && !gameState && (
        <button onClick={handleStartGame}>Start Game</button>
      )}

      {gameState && (
        <section>
          <h2>Game State</h2>
          <pre>{JSON.stringify(gameState, null, 2)}</pre>
          {/* Actual game UI would go here */}
        </section>
      )}
    </main>
  );
}
```

---

## Development Workflow

### Single Process Development

With the consolidated architecture, you only need **one terminal**:

```bash
cd app
bun run dev

# Output:
# VITE v6.x.x ready
# Local: http://localhost:5173/
# Wrangler: Durable Objects available
```

The Cloudflare Vite plugin runs Wrangler in the background, providing:
- React Router with hot reload
- Durable Objects (PartyServer rooms)
- All Cloudflare bindings

### Environment Variables

No separate PartyKit host needed! WebSocket connections use same origin:

```typescript
// Client connects to same origin
const socket = usePartySocket({
  host: window.location.host,  // localhost:5173 in dev, your-domain.com in prod
  room: roomId,
  party: "mayi",
});
```

---

## Deployment

### Single Deployment Command

```bash
cd app
bun run deploy

# This runs: vite build && wrangler deploy
```

**What happens:**
1. Vite builds client + server bundles
2. Wrangler deploys Worker with Durable Object bindings
3. Both React Router and PartyServer are live

### Prerequisites

1. Cloudflare account
2. `wrangler login` (one-time auth)
3. Durable Objects enabled (automatic with paid plan or free tier)

---

## Hello-World Features

### Initial Scaffolding Includes

**Home Page (`/`):**
- "Start New Game" button → generates room ID, redirects
- "Join Game" → enter room ID, redirects

**Game Page (`/game/:roomId`):**
- Connection status indicator
- Share link with copy button
- Player name input + join button
- Start game button (when enough players)
- Raw state display (placeholder for real UI)

### Not Included (Yet)

- Actual game UI (cards, melds, etc.)
- Player turns and actions beyond state display
- Lobby with game listing
- Player authentication
- Reconnection handling

---

## Future Considerations

### State Optimization (If Needed)

If full state broadcast becomes a bandwidth concern:

```typescript
// Calculate delta between states
function getDelta(old: SerializableGameState, next: SerializableGameState) {
  const delta: Partial<SerializableGameState> = { gameId: next.gameId };
  if (old.players !== next.players) delta.players = next.players;
  if (old.discard !== next.discard) delta.discard = next.discard;
  // ... etc
  return delta;
}

// Broadcast delta instead
this.room.broadcast(JSON.stringify({ type: "STATE_DELTA", delta }));

// Client merges delta
gameState = { ...gameState, ...delta };
```

For May I? with ~5KB state, this is premature optimization.

### Authentication

Options:
- **Cloudflare Access**: Zero-trust at the edge
- **Simple tokens**: Generated on join, validated on reconnect
- **OAuth**: Via Auth.js when needed

### Reconnection

PartySocket handles automatic reconnection. On reconnect:
1. Client reconnects to same room
2. Server sends current state in `onConnect`
3. Client resumes from current state

### Spectators

If spectators are added later, they would receive a "spectator view" with no private hands:

```typescript
if (isSpectator(conn)) {
  conn.send(JSON.stringify({ type: "STATE_UPDATE", state: publicStateOnly }));
} else {
  conn.send(JSON.stringify({ type: "STATE_UPDATE", state: playerView }));
}
```

This is an extension of the per-player view pattern.

---

## References

### PartyServer (Embedded Library)

- [PartyServer npm package](https://www.npmjs.com/package/partyserver)
- [PartyServer GitHub README](https://github.com/cloudflare/partykit/tree/main/packages/partyserver)
- [Party.Server API Blog Post](https://blog.partykit.io/posts/partyserver-api/)
- [threepointone/partyvite example](https://github.com/threepointone/partyvite)

### React Router 7

- [React Router 7 Framework Mode](https://reactrouter.com/start/framework/installation)
- [Data Loading (Loaders)](https://reactrouter.com/start/framework/data-loading)
- [Actions (Mutations)](https://reactrouter.com/start/framework/actions)
- [Cloudflare Template](https://github.com/remix-run/react-router-templates/tree/main/cloudflare)

### Cloudflare

- [React Router on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Cloudflare Vite Plugin](https://blog.cloudflare.com/introducing-the-cloudflare-vite-plugin/)
- [Durable Objects Overview](https://developers.cloudflare.com/durable-objects/)
- [Durable Objects WebSocket Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

### State Synchronization Patterns

- [Gaffer on Games: State Synchronization](https://gafferongames.com/post/state_synchronization/)
- [XState Actors Documentation](https://stately.ai/docs/actors)
- [Actor Model Overview](https://stately.ai/docs/actor-model/)

### Community Resources

- [Cloudflare Acquires PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- [PartyKit How It Works](https://docs.partykit.io/how-partykit-works/)
- [Durable Objects Reference Sheet](https://tigerabrodi.blog/cloudflare-durable-objects-reference-sheet)
