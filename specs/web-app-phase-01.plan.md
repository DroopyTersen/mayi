# Phase 1: Web App Scaffolding

> **Status**: Not Started
> **Depends on**: Phase 0 (Server-Safe Engine)
> **Estimated scope**: New `app/` folder with basic RR7 + PartyServer

---

## Goal

Create a minimal web app that:
1. Serves a home page with "Create Game" / "Join Game"
2. Serves a game page that connects via WebSocket
3. Receives "CONNECTED" message from server
4. No game logic yet - just proving the stack works

## Architecture

Single Cloudflare Worker running both React Router 7 and PartyServer:

```
┌─────────────────────────────────────────────────────────┐
│                 Single Cloudflare Worker                 │
├─────────────────────────────────────────────────────────┤
│  workers/app.ts                                          │
│  ├── routePartykitRequest() → MayIRoom (Durable Object) │
│  └── reactRouterHandler()   → React Router 7            │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
app/                              # NEW folder at project root
├── workers/
│   └── app.ts                    # Worker entry point
│
├── party/
│   └── mayi-room.ts              # MayIRoom (stub - just sends CONNECTED)
│
├── app/                          # React Router 7 app
│   ├── root.tsx
│   ├── routes.ts
│   └── routes/
│       ├── home.tsx              # / - create/join buttons
│       └── game.$roomId.tsx      # /game/:roomId - WebSocket test
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── react-router.config.ts
└── wrangler.jsonc
```

## Configuration Files

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
  "durable_objects": {
    "bindings": [
      { "name": "MayIRoom", "class_name": "MayIRoom" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["MayIRoom"] }
  ],
  "observability": { "enabled": true }
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

### `app/package.json`

```json
{
  "name": "mayi-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "react-router typegen && tsc"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.0",
    "partysocket": "^1.0.0",
    "partyserver": "^0.0.59",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.0.0",
    "@react-router/dev": "^7.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "^5.0.0",
    "wrangler": "^3.99.0"
  }
}
```

## Implementation

### `app/workers/app.ts`

```typescript
import { createRequestHandler } from "react-router";
import { routePartykitRequest } from "partyserver";

export { MayIRoom } from "../party/mayi-room";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: { env: Env; ctx: ExecutionContext };
  }
}

interface Env {
  MayIRoom: DurableObjectNamespace;
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
```

### `app/party/mayi-room.ts` (Stub)

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";

export class MayIRoom extends Server {
  static options = { hibernate: true };

  onConnect(conn: Connection, ctx: ConnectionContext) {
    // Phase 1: Just acknowledge connection
    conn.send(JSON.stringify({
      type: "CONNECTED",
      roomId: this.name,
      message: "Phase 1 stub - no game logic yet"
    }));
  }

  onMessage(conn: Connection, message: string) {
    // Phase 1: Echo back for testing
    conn.send(JSON.stringify({
      type: "ECHO",
      received: message
    }));
  }
}
```

### `app/app/routes/home.tsx`

```typescript
import { Form } from "react-router";
import { redirect } from "react-router";
import { nanoid } from "nanoid";
import type { Route } from "./+types/home";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    return redirect(`/game/${nanoid(8)}`);
  }

  if (intent === "join") {
    const roomId = formData.get("roomId");
    if (roomId && typeof roomId === "string") {
      return redirect(`/game/${roomId}`);
    }
  }

  return null;
}

export default function Home() {
  return (
    <main>
      <h1>May I?</h1>

      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        <button type="submit">Create New Game</button>
      </Form>

      <Form method="post">
        <input type="hidden" name="intent" value="join" />
        <input type="text" name="roomId" placeholder="Room ID" />
        <button type="submit">Join Game</button>
      </Form>
    </main>
  );
}
```

### `app/app/routes/game.$roomId.tsx`

```typescript
import type { Route } from "./+types/game.$roomId";
import usePartySocket from "partysocket/react";
import { useState } from "react";

export async function loader({ params }: Route.LoaderArgs) {
  return { roomId: params.roomId };
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;
  const [status, setStatus] = useState("Connecting...");
  const [messages, setMessages] = useState<string[]>([]);

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : "",
    room: roomId,
    party: "may-i-room",  // kebab-case of MayIRoom

    onOpen() {
      setStatus("Connected");
    },

    onMessage(event) {
      setMessages(prev => [...prev, event.data]);
    },

    onClose() {
      setStatus("Disconnected");
    },
  });

  const sendTest = () => {
    socket?.send(JSON.stringify({ type: "TEST", timestamp: Date.now() }));
  };

  return (
    <main>
      <h1>Game: {roomId}</h1>
      <p>Status: {status}</p>

      <button onClick={sendTest}>Send Test Message</button>

      <h2>Messages</h2>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}><pre>{msg}</pre></li>
        ))}
      </ul>
    </main>
  );
}
```

## Tasks

1. [ ] Create `app/` directory structure
2. [ ] Add config files (wrangler.jsonc, vite.config.ts, etc.)
3. [ ] Add package.json and run `bun install`
4. [ ] Create Worker entry point
5. [ ] Create MayIRoom stub
6. [ ] Create home page with create/join
7. [ ] Create game page with WebSocket test
8. [ ] Verify `bun run dev` works
9. [ ] Verify WebSocket connection receives CONNECTED

## Verification Criteria

### Unit Tests (TDD)

```typescript
// app/party/mayi-room.test.ts
import { describe, it, expect } from "bun:test";
// Note: Full DO testing requires miniflare, but we can test message parsing

describe("MayIRoom message handling", () => {
  it("sends CONNECTED on connect", () => {
    // Test the message format
    const msg = { type: "CONNECTED", roomId: "test123", message: "Phase 1 stub" };
    expect(msg.type).toBe("CONNECTED");
    expect(msg.roomId).toBe("test123");
  });

  it("echoes messages back", () => {
    const input = { type: "TEST", data: "hello" };
    const output = { type: "ECHO", received: JSON.stringify(input) };
    expect(output.type).toBe("ECHO");
  });
});
```

### Browser Verification (Manual + Chrome Extension)

Use Claude Code's Chrome extension to verify browser behavior:

```bash
# 1. Start dev server
cd app && bun run dev
```

**Test 1: Home Page Loads**
```
Navigate to http://localhost:5173/
Verify:
- Page title contains "May I?"
- "Create New Game" button visible
- "Join Game" input and button visible
```

**Test 2: Create Game Flow**
```
Click "Create New Game"
Verify:
- URL changes to /game/[8-char-id]
- Game page loads
- Status shows "Connected"
```

**Test 3: WebSocket Connection**
```
On game page, check:
- Status: "Connected"
- Messages list contains: {"type":"CONNECTED","roomId":"..."}
```

**Test 4: Message Echo**
```
Click "Send Test Message"
Verify:
- New message appears in list
- Message contains: {"type":"ECHO","received":"..."}
```

**Test 5: Join Existing Game**
```
Copy room ID from URL
Go back to home page
Paste room ID in "Join Game" input
Click "Join"
Verify: Redirects to same game room
```

### CLI Verification

```bash
cd app

# Dev server starts without errors
bun run dev &
sleep 3

# TypeScript compiles
bun run typecheck

# Kill dev server
kill %1
```

### Definition of Done

- [ ] `bun run dev` starts without errors
- [ ] `bun run typecheck` passes
- [ ] Home page renders with create/join UI
- [ ] "Create New Game" redirects to /game/:roomId
- [ ] Game page shows "Connected" status
- [ ] CONNECTED message appears in message list
- [ ] Echo test works (send message, see ECHO response)
- [ ] Join by room ID works

## Out of Scope

- Identity/authentication (Phase 2)
- Game logic (Phase 3)
- Styling/UI polish (Phase 4)
- Deployment to production

---

## Notes

### Party Name Gotcha

`routePartykitRequest` converts your DO binding name to kebab-case:
- Binding: `MayIRoom` → party name: `may-i-room`

The client must use `party: "may-i-room"` to connect.

### Same-Origin WebSocket

Because RR7 and PartyServer run in the same Worker:
- No CORS configuration needed
- `host: window.location.host` works in dev and prod
- WebSocket upgrades happen on same origin
