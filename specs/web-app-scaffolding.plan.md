# Web App Scaffolding Plan

> **Status**: Planning Complete
> **Date**: December 29, 2024
> **Decision**: React Router 7 + PartyKit, both deployed to user's Cloudflare account

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Choices & Rationale](#technology-choices--rationale)
3. [Architecture](#architecture)
4. [Decisions Made](#decisions-made)
5. [How PartyKit Works](#how-partykit-works)
6. [How React Router 7 Framework Mode Works](#how-react-router-7-framework-mode-works)
7. [Project Structure](#project-structure)
8. [Scaffolding Commands](#scaffolding-commands)
9. [Configuration Files](#configuration-files)
10. [Implementation Code Examples](#implementation-code-examples)
11. [Development Workflow](#development-workflow)
12. [Deployment](#deployment)
13. [Type Sharing Strategy](#type-sharing-strategy)
14. [Hello-World Features](#hello-world-features)
15. [Future Considerations](#future-considerations)
16. [References](#references)

---

## Executive Summary

This document outlines the complete plan for scaffolding a web application for the "May I" card game. After extensive research into PartyKit, React Router 7, Cloudflare Workers, and various deployment strategies, we've decided on:

- **React Router 7** (framework mode) for the web application
- **PartyKit** for real-time WebSocket communication (abstracts Durable Objects)
- **Cloudflare Workers** as the deployment target for both (cloud-prem mode)

### Key Insight

PartyKit is built on top of Cloudflare Durable Objects, but **we don't need to touch Durable Objects directly**. PartyKit provides a clean `Party.Server` API that handles all the complexity of WebSocket connections, room management, and state persistence.

---

## Technology Choices & Rationale

### Why PartyKit (Not Raw Durable Objects)?

| Aspect | PartyKit | Raw Durable Objects |
|--------|----------|---------------------|
| **API** | Clean `Party.Server` class with lifecycle hooks | Low-level `DurableObject` class |
| **WebSocket** | Built-in `onConnect`, `onMessage`, `onClose` | Manual `acceptWebSocket`, hibernation handling |
| **Room concept** | Native - each "party" is a room | Must implement yourself |
| **Broadcast** | `room.broadcast()` one-liner | Manual iteration over connections |
| **Storage** | `room.storage` key-value API | Same underlying API, but more setup |
| **Development** | `npx partykit dev` with hot reload | Wrangler with more configuration |
| **Learning curve** | Lower | Higher |

**Decision**: Use PartyKit. It's purpose-built for real-time multiplayer applications and abstracts all the Durable Objects complexity.

### Why React Router 7 Framework Mode (Not Remix)?

- **Remix is now React Router 7**: The Remix team merged Remix into React Router 7 "framework mode"
- **Active development**: React Router 7 is the current focus, not Remix
- **Cloudflare support**: Official Cloudflare template and Vite plugin support
- **Server-side capabilities**: Full loaders (GET) and actions (POST) for server-side logic

### Why Cloudflare Workers (Not Vercel/Netlify)?

- **PartyKit compatibility**: PartyKit is built on Cloudflare's infrastructure
- **Cloud-prem**: Can deploy PartyKit to our own Cloudflare account (no platform fees)
- **Single vendor**: Both web app and PartyKit on same Cloudflare account
- **Edge performance**: ~50ms from 95% of internet users

### Why Not the Remix Starter?

The [partykit/remix-starter](https://github.com/partykit/remix-starter) uses Remix and a special `partymix` package. Since Remix has evolved into React Router 7, we'll start fresh with:
1. Official Cloudflare React Router 7 template
2. Add PartyKit separately with `partysocket` for client connections

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Cloudflare Account                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────┐      ┌────────────────────────────┐ │
│  │   React Router 7 App   │      │      PartyKit Server       │ │
│  │   (Cloudflare Worker)  │      │      (Cloud-Prem Mode)     │ │
│  │                        │      │                            │ │
│  │  Routes:               │      │  Rooms:                    │ │
│  │  /           (home)    │      │  /party/main/:roomId       │ │
│  │  /game/:id   (game)    │      │                            │ │
│  │                        │      │  Lifecycle:                │ │
│  │  Server-side:          │      │  • onConnect()             │ │
│  │  • loader() - fetch    │      │  • onMessage()             │ │
│  │  • action() - mutate   │      │  • onClose()               │ │
│  │                        │      │  • onRequest() (HTTP)      │ │
│  └────────────────────────┘      └────────────────────────────┘ │
│            │                                ▲                    │
│            │ HTTP                           │ WebSocket          │
│            ▼                                │                    │
└────────────┬────────────────────────────────┼────────────────────┘
             │                                │
             ▼                                │
       ┌───────────────────────────────────────┐
       │              Browser                  │
       │                                       │
       │  • React Router handles navigation   │
       │  • usePartySocket() for real-time    │
       │  • Forms trigger server actions      │
       └───────────────────────────────────────┘
```

### Request Flow

**Page Load (HTTP):**
1. Browser requests `/game/abc123`
2. Cloudflare Worker runs React Router
3. `loader()` executes (can fetch from PartyKit via HTTP if needed)
4. Server renders HTML, sends to browser
5. React hydrates on client

**Real-time Connection (WebSocket):**
1. React component mounts with `usePartySocket({ room: "abc123" })`
2. PartySocket connects to PartyKit server at `party.yourdomain.com/party/main/abc123`
3. PartyKit calls `onConnect()` on the GameRoom class
4. Bidirectional messages via `send()` and `onMessage()`

**Game Action (Hybrid):**
1. Player plays a card → UI sends message via WebSocket
2. PartyKit `onMessage()` validates and broadcasts state change
3. All connected clients receive update instantly

**OR (using React Router action):**
1. Player submits form → triggers `action()`
2. Server action could call PartyKit via HTTP
3. PartyKit broadcasts to other clients
4. Page revalidates via loader

---

## Decisions Made

Based on our discussion, here are the decisions:

| Question | Decision |
|----------|----------|
| **PartyKit deployment** | Cloud-prem (to our own Cloudflare account) |
| **Web app deployment** | Cloudflare Workers |
| **Web app location** | `app/` folder at project root |
| **Type sharing** | Direct imports via tsconfig paths from `../core` |
| **Hello-world features** | "Create Game" + "Join by ID" (no lobby list yet) |
| **Framework** | React Router 7 framework mode (not Remix) |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| PartyKit managed hosting | Want everything in our own Cloudflare account |
| Raw Durable Objects | PartyKit abstracts this; no need for complexity |
| Remix | Evolved into React Router 7; use the latest |
| Cloudflare Pages | Workers gives more flexibility for SSR |
| Separate repository | Type sharing is easier in monorepo |

---

## How PartyKit Works

### The Mental Model

PartyKit runs on Cloudflare's edge network using Durable Objects under the hood. Each "room" is a single Durable Object instance that:
- Maintains in-memory state
- Handles WebSocket connections
- Can persist data to storage
- Runs in one location (migrates to where clients are)

### Party.Server API

```typescript
import type * as Party from "partykit/server";

export default class GameRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Room object provides:
  // - room.id: string - the room identifier
  // - room.storage: PartyKitStorage - persistent key-value store
  // - room.broadcast(msg, without?) - send to all connections
  // - room.getConnections() - iterate over connections

  // Called when server starts or wakes from hibernation
  onStart() {}

  // Called when a WebSocket connects
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // ctx.request has the upgrade request (headers, etc.)
  }

  // Called when a message is received
  onMessage(message: string | ArrayBuffer, sender: Party.Connection) {}

  // Called when a WebSocket closes
  onClose(conn: Party.Connection) {}

  // Called when a WebSocket errors
  onError(conn: Party.Connection, error: Error) {}

  // Handle HTTP requests (not WebSocket)
  onRequest(request: Party.Request) {
    return new Response("OK");
  }
}
```

### Rooms Are Created On-Demand

When a client connects to `/party/main/my-room-id`:
- If no room exists with that ID, PartyKit creates one
- If room exists, client joins it
- Room persists as long as there are connections (then may hibernate)

This means the client can "create" a room just by connecting to a new ID.

### PartySocket Client

```typescript
import PartySocket from "partysocket";

const socket = new PartySocket({
  host: "your-project.your-username.partykit.dev",
  room: "my-room-id",
});

socket.addEventListener("open", () => {
  console.log("Connected!");
});

socket.addEventListener("message", (event) => {
  console.log("Received:", event.data);
});

socket.send("Hello from client!");
```

### React Hook

```typescript
import usePartySocket from "partysocket/react";

function GameComponent({ roomId }) {
  const socket = usePartySocket({
    host: "your-project.partykit.dev",
    room: roomId,
    onOpen() {
      console.log("Connected!");
    },
    onMessage(event) {
      const data = JSON.parse(event.data);
      // Handle incoming message
    },
    onClose() {
      console.log("Disconnected");
    },
  });

  // socket.send() to send messages
  // Hook handles cleanup on unmount
}
```

---

## How React Router 7 Framework Mode Works

### Overview

React Router 7 "framework mode" provides:
- **File-based or config-based routing**
- **Loaders**: Server-side data fetching (runs on GET requests)
- **Actions**: Server-side mutations (runs on POST/PUT/DELETE)
- **SSR**: Server-side rendering out of the box
- **Type safety**: Auto-generated route types

### Route Configuration

Routes are defined in `app/routes.ts`:

```typescript
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),                    // /
  route("game/:roomId", "./routes/game.tsx"),    // /game/:roomId
] satisfies RouteConfig;
```

### Loaders (Server-side GET)

```typescript
// app/routes/game.tsx
import type { Route } from "./+types/game";

// Runs on the SERVER when the route is requested
// Removed from client bundle - can use server-only APIs
export async function loader({ params, context }: Route.LoaderArgs) {
  const roomId = params.roomId;

  // Could fetch game state from PartyKit via HTTP
  // Or from a database, or anywhere

  return {
    roomId,
    // data...
  };
}

// Component receives loader data automatically
export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  return <div>Game: {roomId}</div>;
}
```

### Actions (Server-side POST)

```typescript
// app/routes/home.tsx
import type { Route } from "./+types/home";
import { redirect, Form } from "react-router";

// Runs on the SERVER when a form is submitted
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const roomId = generateRoomId(); // nanoid or similar
    // Could initialize game state in PartyKit here
    return redirect(`/game/${roomId}`);
  }

  if (intent === "join") {
    const roomId = formData.get("roomId");
    return redirect(`/game/${roomId}`);
  }
}

export default function Home() {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create" />
      <button type="submit">Start New Game</button>
    </Form>
  );
}
```

### Key Points

1. **Loaders and actions run on the server** - They're stripped from client bundles
2. **Automatic revalidation** - After an action, loaders re-run to refresh data
3. **Type safety** - Route types are generated in `+types/` folders
4. **Progressive enhancement** - Forms work without JavaScript

### Cloudflare-Specific Context

On Cloudflare Workers, you get access to Cloudflare bindings:

```typescript
export async function loader({ context }: Route.LoaderArgs) {
  // Access Cloudflare bindings
  const env = context.cloudflare.env;

  // Example: if you had D1 database bound
  // const db = env.DB;

  return { /* ... */ };
}
```

---

## Project Structure

```
mayi/                              # Existing project root
├── core/                          # Existing game engine
│   ├── engine/
│   ├── card/
│   └── ...
│
├── app/                           # NEW: React Router 7 web app
│   ├── routes.ts                  # Route definitions
│   ├── root.tsx                   # Root layout (html, head, body)
│   ├── routes/
│   │   ├── home.tsx               # / - create/join game
│   │   └── game.$roomId.tsx       # /game/:roomId - game room
│   ├── components/
│   │   └── ...
│   ├── lib/
│   │   └── partykit.client.ts     # PartyKit client utilities
│   ├── .env                       # Environment variables
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── react-router.config.ts
│   └── wrangler.jsonc
│
├── party/                         # NEW: PartyKit server
│   ├── main.ts                    # Main party server (game rooms)
│   └── partykit.json              # PartyKit configuration
│
├── specs/                         # Documentation
│   └── web-app-scaffolding.plan.md
│
└── package.json                   # Root package.json (workspace?)
```

### Notes on Structure

- **`app/`** contains the React Router 7 application with its own `package.json`
- **`party/`** contains the PartyKit server (could be inside `app/` but keeping separate for clarity)
- **`core/`** is imported by both via TypeScript paths
- Consider making this a **Bun workspace** for shared dependencies

---

## Scaffolding Commands

### Step 1: Create React Router 7 App with Cloudflare

```bash
# From project root
cd /Users/drew/code/mayi

# Create the app using Cloudflare's template
# This creates app/ folder with everything configured
npm create cloudflare@latest -- app --framework=react-router

# Or with Bun:
bun create cloudflare app --framework=react-router
```

This scaffolds:
- `app/package.json` - Dependencies (react-router, vite, wrangler)
- `app/vite.config.ts` - Vite with Cloudflare plugin
- `app/react-router.config.ts` - SSR enabled
- `app/wrangler.jsonc` - Cloudflare Workers config
- `app/workers/app.ts` - Worker entry point
- `app/app/` - React app source (routes, root.tsx)

### Step 2: Install Dependencies

```bash
cd app
bun install

# Add PartyKit client library
bun add partysocket

# Add nanoid for room ID generation
bun add nanoid
```

### Step 3: Initialize PartyKit

```bash
# From project root (not app/)
cd /Users/drew/code/mayi

# Initialize PartyKit
npx partykit init --typescript

# This creates:
# - partykit.json
# - party/index.ts (rename to main.ts)
```

Or manually create the files (see Configuration Files section).

### Step 4: Install PartyKit Dev Dependency

```bash
# In root or wherever you want to run PartyKit from
bun add -d partykit
```

---

## Configuration Files

### `partykit.json` (Project Root)

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "mayi-game",
  "main": "party/main.ts",
  "compatibilityDate": "2024-12-01",
  "port": 1999
}
```

### `app/react-router.config.ts`

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true, // Enable server-side rendering
  future: {
    unstable_viteEnvironmentApi: true, // Required for Cloudflare
  },
} satisfies Config;
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

### `app/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "mayi-web",
  "main": "./workers/app.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./build/client"
  },
  "observability": {
    "enabled": true
  }
}
```

### `app/.env.example`

```env
# PartyKit host for development
VITE_PARTYKIT_HOST=localhost:1999

# For production (after cloud-prem deployment)
# VITE_PARTYKIT_HOST=party.yourdomain.com
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
      "~/core/*": ["../core/*"]
    }
  },
  "include": ["app", "workers", "../core"]
}
```

---

## Implementation Code Examples

### PartyKit Server: `party/main.ts`

```typescript
import type * as Party from "partykit/server";

// Message types (could import from shared types)
type ClientMessage =
  | { type: "JOIN"; playerName: string }
  | { type: "GAME_ACTION"; action: unknown };

type ServerMessage =
  | { type: "WELCOME"; roomId: string; players: string[] }
  | { type: "PLAYER_JOINED"; playerName: string }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "STATE_UPDATE"; state: unknown };

export default class GameRoom implements Party.Server {
  // In-memory state for the room
  players: Map<string, string> = new Map(); // connectionId -> playerName

  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Could load persisted state from storage
    // const saved = await this.room.storage.get("gameState");
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[${this.room.id}] Connection opened: ${conn.id}`);

    // Send welcome message with current room state
    const message: ServerMessage = {
      type: "WELCOME",
      roomId: this.room.id,
      players: Array.from(this.players.values()),
    };
    conn.send(JSON.stringify(message));
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: ClientMessage;
    try {
      data = JSON.parse(message);
    } catch {
      console.error("Invalid JSON:", message);
      return;
    }

    switch (data.type) {
      case "JOIN": {
        this.players.set(sender.id, data.playerName);

        // Broadcast to all other players
        const joinMsg: ServerMessage = {
          type: "PLAYER_JOINED",
          playerName: data.playerName,
        };
        this.room.broadcast(JSON.stringify(joinMsg), [sender.id]);
        break;
      }

      case "GAME_ACTION": {
        // TODO: Validate action, update game state
        // For now, just broadcast to all
        const update: ServerMessage = {
          type: "STATE_UPDATE",
          state: data.action,
        };
        this.room.broadcast(JSON.stringify(update));
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    const playerName = this.players.get(conn.id);
    this.players.delete(conn.id);

    if (playerName) {
      const leftMsg: ServerMessage = {
        type: "PLAYER_LEFT",
        playerId: conn.id,
      };
      this.room.broadcast(JSON.stringify(leftMsg));
    }

    console.log(`[${this.room.id}] Connection closed: ${conn.id}`);
  }

  // Optional: Handle HTTP requests to the room
  async onRequest(request: Party.Request) {
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          roomId: this.room.id,
          playerCount: this.players.size,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Method not allowed", { status: 405 });
  }
}
```

### React Router Home Page: `app/app/routes/home.tsx`

```typescript
import type { Route } from "./+types/home";
import { Form, useActionData } from "react-router";
import { redirect } from "react-router";
import { nanoid } from "nanoid";
import { useState } from "react";

// Server-side action - runs on POST
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    // Generate a short, URL-friendly room ID
    const roomId = nanoid(8);
    // Room is created automatically when first client connects to PartyKit
    return redirect(`/game/${roomId}`);
  }

  if (intent === "join") {
    const roomId = formData.get("roomId");

    if (!roomId || typeof roomId !== "string") {
      return { error: "Please enter a room ID" };
    }

    // Basic validation
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
    <main className="container">
      <h1>May I?</h1>
      <p>A fun card game for friends and family</p>

      {/* Error display */}
      {actionData?.error && (
        <div className="error" role="alert">
          {actionData.error}
        </div>
      )}

      {/* Create New Game */}
      <section>
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <button type="submit" className="primary">
            Start New Game
          </button>
        </Form>
      </section>

      {/* Join Existing Game */}
      <section>
        {!showJoinForm ? (
          <button
            type="button"
            onClick={() => setShowJoinForm(true)}
            className="secondary"
          >
            Join Existing Game
          </button>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="join" />
            <label>
              Room ID:
              <input
                type="text"
                name="roomId"
                placeholder="Enter room ID"
                autoFocus
                required
                pattern="[a-zA-Z0-9_-]+"
              />
            </label>
            <div className="button-group">
              <button type="submit" className="primary">
                Join
              </button>
              <button
                type="button"
                onClick={() => setShowJoinForm(false)}
                className="secondary"
              >
                Cancel
              </button>
            </div>
          </Form>
        )}
      </section>
    </main>
  );
}
```

### React Router Game Page: `app/app/routes/game.$roomId.tsx`

```typescript
import type { Route } from "./+types/game.$roomId";
import usePartySocket from "partysocket/react";
import { useState, useCallback, useEffect } from "react";

// Server-side loader
export async function loader({ params }: Route.LoaderArgs) {
  // Validate room ID format
  const roomId = params.roomId;
  if (!roomId || !/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    throw new Response("Invalid room ID", { status: 400 });
  }

  // Could optionally check if room exists by calling PartyKit HTTP endpoint
  // const res = await fetch(`https://${PARTYKIT_HOST}/party/main/${roomId}`);

  return { roomId };
}

// Meta for the page
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `Game ${data?.roomId} | May I?` },
  ];
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  // Get PartyKit host from environment
  const partyHost = import.meta.env.VITE_PARTYKIT_HOST || "localhost:1999";

  const socket = usePartySocket({
    host: partyHost,
    room: roomId,

    onOpen() {
      setConnected(true);
      console.log("Connected to room:", roomId);
    },

    onMessage(event) {
      const message = JSON.parse(event.data);
      console.log("Received:", message);

      switch (message.type) {
        case "WELCOME":
          setPlayers(message.players);
          break;
        case "PLAYER_JOINED":
          setPlayers((prev) => [...prev, message.playerName]);
          break;
        case "PLAYER_LEFT":
          // Would need to map ID to name; simplified here
          break;
        case "STATE_UPDATE":
          // Handle game state updates
          break;
      }
    },

    onClose() {
      setConnected(false);
      console.log("Disconnected from room:", roomId);
    },

    onError(error) {
      console.error("WebSocket error:", error);
    },
  });

  const handleJoin = useCallback(() => {
    if (playerName.trim() && socket) {
      socket.send(JSON.stringify({
        type: "JOIN",
        playerName: playerName.trim(),
      }));
      setHasJoined(true);
    }
  }, [playerName, socket]);

  // Share URL
  const shareUrl = typeof window !== "undefined"
    ? window.location.href
    : "";

  return (
    <main className="game-container">
      <header>
        <h1>Game Room: {roomId}</h1>
        <div className="status">
          Status: {connected ? "Connected" : "Connecting..."}
        </div>
      </header>

      {/* Share Link */}
      <section className="share-section">
        <p>Share this link to invite players:</p>
        <code className="share-url">{shareUrl}</code>
        <button
          onClick={() => navigator.clipboard.writeText(shareUrl)}
          className="copy-button"
        >
          Copy Link
        </button>
      </section>

      {/* Join Form */}
      {!hasJoined && (
        <section className="join-section">
          <label>
            Your Name:
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={!connected}
            />
          </label>
          <button
            onClick={handleJoin}
            disabled={!connected || !playerName.trim()}
          >
            Join Game
          </button>
        </section>
      )}

      {/* Players List */}
      <section className="players-section">
        <h2>Players ({players.length})</h2>
        {players.length === 0 ? (
          <p>No players yet. Be the first to join!</p>
        ) : (
          <ul>
            {players.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Game area placeholder */}
      {hasJoined && (
        <section className="game-area">
          <h2>Game Area</h2>
          <p>Game UI will be implemented here...</p>
        </section>
      )}
    </main>
  );
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

---

## Development Workflow

### Running Locally

You need **two terminal windows** during development:

#### Terminal 1: PartyKit Server

```bash
# From project root
cd /Users/drew/code/mayi
npx partykit dev

# Output:
# 🎈 PartyKit dev server running at http://localhost:1999
```

#### Terminal 2: React Router App

```bash
cd /Users/drew/code/mayi/app
bun run dev

# Output:
# VITE v5.x.x ready
# Local: http://localhost:5173/
```

### Environment Variables

Create `app/.env` for local development:

```env
VITE_PARTYKIT_HOST=localhost:1999
```

The `VITE_` prefix makes it available in client-side code via `import.meta.env.VITE_PARTYKIT_HOST`.

### Recommended package.json Scripts

Add to `app/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "bun run build && wrangler deploy",
    "typecheck": "tsc --noEmit"
  }
}
```

Add to root `package.json` (optional convenience):

```json
{
  "scripts": {
    "dev:party": "npx partykit dev",
    "dev:web": "cd app && bun run dev",
    "dev": "concurrently \"bun run dev:party\" \"bun run dev:web\""
  }
}
```

---

## Deployment

### Deploy PartyKit (Cloud-Prem)

**Prerequisites:**
1. Get your Cloudflare Account ID from [Cloudflare Dashboard](https://dash.cloudflare.com) → Overview page
2. Create an API token at [API Tokens](https://dash.cloudflare.com/profile/api-tokens) using the "Edit Cloudflare Workers" template

**Deploy Command:**

```bash
# Option 1: Environment variables inline
CLOUDFLARE_ACCOUNT_ID=your_account_id \
CLOUDFLARE_API_TOKEN=your_api_token \
npx partykit deploy --domain party.yourdomain.com

# Option 2: Export environment variables first
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
npx partykit deploy --domain party.yourdomain.com
```

**What happens:**
- PartyKit deploys to YOUR Cloudflare account (not PartyKit's)
- Your domain `party.yourdomain.com` points to the PartyKit worker
- No PartyKit platform fees; you pay Cloudflare directly

### Deploy React Router App

```bash
cd app
bun run deploy

# This runs: vite build && wrangler deploy
```

**What happens:**
- Vite builds the app (client + server bundles)
- Wrangler deploys to Cloudflare Workers
- App is live at `mayi-web.your-subdomain.workers.dev` (or custom domain)

### Production Environment Variables

Update `app/.env` or use Cloudflare Dashboard secrets:

```env
VITE_PARTYKIT_HOST=party.yourdomain.com
```

Or set via wrangler:

```bash
wrangler secret put PARTYKIT_HOST
# Enter: party.yourdomain.com
```

---

## Type Sharing Strategy

### Decision: Direct Imports via tsconfig Paths

Since the web app and game engine are in the same repository, we'll use TypeScript path aliases.

**In `app/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "paths": {
      "~/core/*": ["../core/*"]
    }
  },
  "include": ["app", "workers", "../core"]
}
```

**Usage in app code:**

```typescript
// app/app/routes/game.$roomId.tsx
import type { Card, Hand } from "~/core/card/card.types";
import type { GameContext } from "~/core/engine/game.machine";
```

**In PartyKit server (`party/main.ts`):**

The PartyKit build process also needs to resolve these paths. Add to root `tsconfig.json` or create `party/tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "~/core/*": ["../core/*"]
    }
  }
}
```

### Alternative: Bun Workspace

If type sharing becomes complex, convert to a Bun workspace:

```json
// Root package.json
{
  "workspaces": ["core", "app", "party"]
}

// core/package.json
{
  "name": "@mayi/core",
  "main": "./index.ts"
}

// Then import as:
import type { Card } from "@mayi/core/card/card.types";
```

---

## Hello-World Features

Based on our discussion, the initial scaffolding will include:

### 1. Home Page (`/`)

- **"Start New Game" button**
  - Server action generates a random room ID (8-char nanoid)
  - Redirects to `/game/{roomId}`

- **"Join Game" button**
  - Reveals an input field for room ID
  - Server action validates and redirects

### 2. Game Page (`/game/:roomId`)

- **Connection status indicator**
  - Shows "Connecting..." / "Connected"

- **Share link**
  - Displays the current URL
  - "Copy Link" button

- **Player name input**
  - Text field to enter name
  - "Join" button sends JOIN message to PartyKit

- **Players list**
  - Shows all connected players
  - Updates in real-time as players join/leave

- **Placeholder game area**
  - "Game UI will be implemented here..."

### Not Included (Yet)

- Lobby with list of active games
- Player authentication
- Game state persistence
- Actual game logic integration

---

## Future Considerations

### State Persistence Options

| Storage | When to Use | Limits |
|---------|-------------|--------|
| **PartyKit memory** | Ephemeral data, live connections | Lost on hibernation |
| **PartyKit storage** | Per-room persistent data | 128KB per key, unlimited keys |
| **Cloudflare D1** | Relational data, cross-room queries | Separate billing |
| **Cloudflare KV** | Global config, user sessions | Eventually consistent |

**Recommendation**: Use PartyKit storage for active games. Consider D1 for user accounts/history if needed later.

### Authentication

Options to explore:
- **Cloudflare Access** - Zero-trust auth at the edge
- **Simple session tokens** - Generate on join, store in PartyKit
- **OAuth** - via Auth.js or similar

### Game Engine Integration

The existing game engine in `core/` uses XState. To integrate:

1. **Option A**: Run XState in PartyKit server
   - Import game machine into `party/main.ts`
   - Handle actions by sending events to machine
   - Broadcast state changes

2. **Option B**: Keep engine separate, call via HTTP
   - Game engine runs as another Worker
   - PartyKit proxies actions to it

Recommendation: Option A for simplicity, since PartyKit is stateful.

### Scaling Considerations

PartyKit/Durable Objects scale automatically, but be aware:
- Each room is a single instance (no sharding)
- Connections to one room go through one location
- ~32,000 concurrent WebSocket connections per room (Cloudflare limit)

For a card game with 2-8 players per room, this is more than sufficient.

---

## References

### React Router 7

- [React Router 7 Framework Mode](https://reactrouter.com/start/framework/installation)
- [Routing in Framework Mode](https://reactrouter.com/start/framework/routing)
- [Data Loading (Loaders)](https://reactrouter.com/start/framework/data-loading)
- [Actions (Mutations)](https://reactrouter.com/start/framework/actions)
- [Deployment Options](https://reactrouter.com/start/framework/deploying)
- [Official Cloudflare Template](https://github.com/remix-run/react-router-templates/tree/main/cloudflare)

### Cloudflare

- [React Router on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [Cloudflare Vite Plugin](https://blog.cloudflare.com/introducing-the-cloudflare-vite-plugin/)
- [Worker Templates](https://developers.cloudflare.com/workers/get-started/quickstarts/)
- [Durable Objects Overview](https://developers.cloudflare.com/durable-objects/)
- [Durable Objects WebSocket Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

### PartyKit

- [PartyKit Quickstart](https://docs.partykit.io/quickstart/)
- [How PartyKit Works](https://docs.partykit.io/how-partykit-works/)
- [Deploy to Cloudflare (Cloud-Prem)](https://docs.partykit.io/guides/deploy-to-cloudflare/)
- [Deploying Your Server](https://docs.partykit.io/guides/deploying-your-partykit-server/)
- [Party.Server API](https://docs.partykit.io/reference/partyserver-api/)
- [PartySocket Client API](https://docs.partykit.io/reference/partysocket-api/)
- [PartyKit CLI Reference](https://docs.partykit.io/reference/partykit-cli/)
- [PartyKit Configuration](https://docs.partykit.io/reference/partykit-configuration/)
- [Remix Starter (reference)](https://github.com/partykit/remix-starter)
- [PartyKit Starter Kits](https://blog.partykit.io/posts/introducing-starter-kits/)

### Community Resources

- [react-router-durable package](https://github.com/zebp/react-router-durable) - Durable Objects as loaders
- [React Router + Durable Objects Discussion](https://github.com/remix-run/react-router/discussions/12565)
- [Durable Objects Reference Sheet](https://tigerabrodi.blog/cloudflare-durable-objects-reference-sheet)
- [Building WebSocket Chat with Durable Objects](https://qiushiyan.dev/posts/durable-object-chat)
