# Phase 2: Identity & Reconnection

> **Status**: Not Started
> **Depends on**: Phase 1 (Scaffolding)
> **Estimated scope**: Add auth flow, no game logic yet

---

## Goal

Implement the identity and reconnection system:
1. Server issues `playerId` + `token` on JOIN
2. Client stores credentials in localStorage
3. Reconnection uses stored credentials
4. Connection state survives hibernation

## Why This Matters

- Players need stable identity across reconnects
- Can't use `connection.id` (changes each connection)
- Can't trust client-provided identity (must be server-issued)
- Hibernation wipes in-memory state (need `conn.setState`)

## Wire Protocol

### Client → Server

```typescript
type ClientCommand = {
  commandId: string;     // Client-generated, for idempotency
  playerId: string;      // Server-issued (empty on first JOIN)
  token: string;         // Server-issued (empty on first JOIN)
} & (
  | { type: "JOIN"; playerName: string }
  // Future: game commands added in Phase 3
);
```

### Server → Client

```typescript
type ServerMessage = {
  serverSeq: number;     // Monotonic, for ordering
} & (
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; token: string }
  | { type: "COMMAND_ACK"; commandId: string }
  | { type: "COMMAND_REJECTED"; commandId: string; error: string; message: string }
  | { type: "ERROR"; error: string; message: string }
  // Future: STATE_UPDATE added in Phase 3
);
```

## Connection State

Per-connection data stored via `conn.setState()` survives hibernation:

```typescript
interface ConnectionState {
  playerId: string;
  token: string;
  playerName: string;
  joinedAt: number;
}
```

## Implementation

### `app/party/mayi-room.ts`

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";
import { nanoid } from "nanoid";

// Wire protocol types
type ClientCommand = {
  commandId: string;
  playerId: string;
  token: string;
} & (
  | { type: "JOIN"; playerName: string }
);

type ServerMessage = {
  serverSeq: number;
} & (
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; token: string }
  | { type: "PLAYERS"; players: PlayerInfo[] }
  | { type: "COMMAND_ACK"; commandId: string }
  | { type: "COMMAND_REJECTED"; commandId: string; error: string; message: string }
  | { type: "ERROR"; error: string; message: string }
);

interface PlayerInfo {
  playerId: string;
  name: string;
  isConnected: boolean;
}

interface ConnectionState {
  playerId: string;
  token: string;
  playerName: string;
}

interface StoredPlayer {
  playerId: string;
  token: string;
  name: string;
  joinedAt: number;
  isConnected: boolean;
}

export class MayIRoom extends Server {
  static options = { hibernate: true };

  private serverSeq = 0;

  async onStart() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const seq = await this.ctx.storage.get<number>("serverSeq");
      this.serverSeq = seq ?? 0;
    });
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    // Don't send player list yet - wait for JOIN with auth
    this.send(conn, { type: "CONNECTED", roomId: this.name });
  }

  async onMessage(conn: Connection, message: string) {
    let cmd: ClientCommand;
    try {
      cmd = JSON.parse(message);
    } catch {
      this.send(conn, { type: "ERROR", error: "PARSE_ERROR", message: "Invalid JSON" });
      return;
    }

    if (!cmd.commandId) {
      this.send(conn, { type: "ERROR", error: "MISSING_COMMAND_ID", message: "commandId required" });
      return;
    }

    // Check idempotency
    // NOTE: This get-then-put pattern has a race condition if two identical
    // commands arrive simultaneously. For production, wrap in a transaction:
    //   await this.ctx.storage.transaction(async (txn) => { ... });
    // Or use blockConcurrencyWhile, or an in-memory inflight Set.
    // For Phase 2 (low traffic), this is acceptable.
    const processedKey = `cmd:${cmd.commandId}`;
    if (await this.ctx.storage.get<boolean>(processedKey)) {
      this.send(conn, { type: "COMMAND_ACK", commandId: cmd.commandId });
      return;
    }

    const result = await this.handleCommand(cmd, conn);

    if (result.success) {
      await this.ctx.storage.put(processedKey, true);
      this.send(conn, { type: "COMMAND_ACK", commandId: cmd.commandId });
    } else {
      this.send(conn, {
        type: "COMMAND_REJECTED",
        commandId: cmd.commandId,
        error: result.error!,
        message: result.message!,
      });
    }
  }

  async onClose(conn: Connection) {
    const state = conn.state as ConnectionState | undefined;
    if (state?.playerId) {
      await this.updatePlayerConnected(state.playerId, false);
      await this.broadcastPlayerList();
    }
  }

  private async handleCommand(
    cmd: ClientCommand,
    conn: Connection
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    switch (cmd.type) {
      case "JOIN":
        return this.handleJoin(cmd, conn);
      default:
        return { success: false, error: "UNKNOWN_COMMAND", message: `Unknown: ${cmd.type}` };
    }
  }

  private async handleJoin(
    cmd: ClientCommand & { type: "JOIN" },
    conn: Connection
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    // Try reconnection with existing credentials
    if (cmd.playerId && cmd.token) {
      const existing = await this.ctx.storage.get<StoredPlayer>(`player:${cmd.playerId}`);
      if (existing && existing.token === cmd.token) {
        // Valid reconnection
        conn.setState({ playerId: cmd.playerId, token: cmd.token, playerName: existing.name });
        await this.updatePlayerConnected(cmd.playerId, true);
        this.send(conn, { type: "JOINED", playerId: cmd.playerId, token: cmd.token });
        await this.broadcastPlayerList();
        return { success: true };
      }
      // Invalid credentials - fall through to create new player
    }

    // New player
    const playerId = nanoid(12);
    const token = nanoid(24);
    const playerName = cmd.playerName?.trim() || "Anonymous";

    const player: StoredPlayer = {
      playerId,
      token,
      name: playerName,
      joinedAt: Date.now(),
      isConnected: true,
    };

    await this.ctx.storage.put(`player:${playerId}`, player);

    // Track player list
    const playerIds = (await this.ctx.storage.get<string[]>("playerIds")) ?? [];
    playerIds.push(playerId);
    await this.ctx.storage.put("playerIds", playerIds);

    // Set connection state (survives hibernation)
    conn.setState({ playerId, token, playerName } as ConnectionState);

    this.send(conn, { type: "JOINED", playerId, token });
    await this.broadcastPlayerList();

    return { success: true };
  }

  private async updatePlayerConnected(playerId: string, isConnected: boolean) {
    const player = await this.ctx.storage.get<StoredPlayer>(`player:${playerId}`);
    if (player) {
      player.isConnected = isConnected;
      await this.ctx.storage.put(`player:${playerId}`, player);
    }
  }

  private async broadcastPlayerList() {
    const playerIds = (await this.ctx.storage.get<string[]>("playerIds")) ?? [];
    const players: PlayerInfo[] = [];

    for (const id of playerIds) {
      const player = await this.ctx.storage.get<StoredPlayer>(`player:${id}`);
      if (player) {
        players.push({
          playerId: player.playerId,
          name: player.name,
          isConnected: player.isConnected,
        });
      }
    }

    // Send to all authenticated connections
    // NOTE: getConnections() returns all connections. We filter by checking conn.state
    // because connection tags are set at connect time (before JOIN), so we can't use
    // getConnections("player") to filter authenticated users.
    for (const conn of this.getConnections()) {
      const state = conn.state as ConnectionState | undefined;
      if (state?.playerId) {
        this.send(conn, { type: "PLAYERS", players });
      }
    }
  }

  private send(conn: Connection, msg: Omit<ServerMessage, "serverSeq">) {
    this.serverSeq++;
    conn.send(JSON.stringify({ ...msg, serverSeq: this.serverSeq }));
    if (this.serverSeq % 10 === 0) {
      this.ctx.storage.put("serverSeq", this.serverSeq);
    }
  }
}
```

### `app/app/routes/game.$roomId.tsx`

```typescript
import type { Route } from "./+types/game.$roomId";
import usePartySocket from "partysocket/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { nanoid } from "nanoid";

// Storage helpers
function getStoredIdentity(roomId: string) {
  if (typeof window === "undefined") return null;
  const playerId = localStorage.getItem(`game:${roomId}:playerId`);
  const token = localStorage.getItem(`game:${roomId}:token`);
  return playerId && token ? { playerId, token } : null;
}

function storeIdentity(roomId: string, playerId: string, token: string) {
  localStorage.setItem(`game:${roomId}:playerId`, playerId);
  localStorage.setItem(`game:${roomId}:token`, token);
}

interface PlayerInfo {
  playerId: string;
  name: string;
  isConnected: boolean;
}

export async function loader({ params }: Route.LoaderArgs) {
  return { roomId: params.roomId! };
}

export default function Game({ loaderData }: Route.ComponentProps) {
  const { roomId } = loaderData;

  const [phase, setPhase] = useState<"connecting" | "connected" | "joined">("connecting");
  const [identity, setIdentity] = useState<{ playerId: string; token: string } | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastServerSeq = useRef(0);

  // Check for stored identity on mount
  useEffect(() => {
    const stored = getStoredIdentity(roomId);
    if (stored) setIdentity(stored);
  }, [roomId]);

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : "",
    room: roomId,
    party: "may-i-room",

    onOpen() {
      setPhase("connected");
      setError(null);
    },

    onMessage(event) {
      const msg = JSON.parse(event.data);

      // Ignore stale messages
      if (msg.serverSeq <= lastServerSeq.current && msg.type !== "CONNECTED") {
        return;
      }
      lastServerSeq.current = msg.serverSeq;

      switch (msg.type) {
        case "CONNECTED":
          setPhase("connected");
          break;

        case "JOINED":
          setIdentity({ playerId: msg.playerId, token: msg.token });
          storeIdentity(roomId, msg.playerId, msg.token);
          setPhase("joined");
          break;

        case "PLAYERS":
          setPlayers(msg.players);
          break;

        case "COMMAND_REJECTED":
        case "ERROR":
          setError(`${msg.error}: ${msg.message}`);
          break;
      }
    },

    onClose() {
      setPhase("connecting");
    },
  });

  const handleJoin = useCallback(() => {
    if (!socket) return;
    const stored = getStoredIdentity(roomId);
    socket.send(JSON.stringify({
      type: "JOIN",
      commandId: nanoid(12),
      playerId: stored?.playerId ?? "",
      token: stored?.token ?? "",
      playerName: playerName.trim() || "Anonymous",
    }));
  }, [socket, roomId, playerName]);

  // Auto-rejoin on reconnect if we have stored identity
  useEffect(() => {
    if (phase === "connected" && identity) {
      handleJoin();
    }
  }, [phase, identity, handleJoin]);

  return (
    <main>
      <h1>Game: {roomId}</h1>
      <p>Status: {phase}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {phase === "connected" && !identity && (
        <section>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Your name"
          />
          <button onClick={handleJoin}>Join</button>
        </section>
      )}

      {phase === "joined" && (
        <section>
          <h2>Players</h2>
          <ul>
            {players.map((p) => (
              <li key={p.playerId}>
                {p.name}
                {p.playerId === identity?.playerId && " (you)"}
                {!p.isConnected && " (disconnected)"}
              </li>
            ))}
          </ul>
          <p><em>Waiting for Phase 3: Game Logic</em></p>
        </section>
      )}
    </main>
  );
}
```

## Tasks

1. [ ] Add wire protocol types to `party/mayi-room.ts`
2. [ ] Implement `onStart` with `blockConcurrencyWhile`
3. [ ] Implement JOIN handler with new player / reconnection logic
4. [ ] Implement `conn.setState` for hibernation survival
5. [ ] Implement player list storage and broadcast
6. [ ] Implement `onClose` to mark player disconnected
7. [ ] Update game page with identity persistence
8. [ ] Add auto-rejoin on reconnect
9. [ ] Test hibernation (wait 30s, refresh)

## Verification Criteria

### Unit Tests (TDD)

```typescript
// app/party/identity.test.ts
import { describe, it, expect } from "bun:test";

describe("Wire Protocol Types", () => {
  it("JOIN command has required fields", () => {
    const cmd = {
      type: "JOIN",
      commandId: "abc123",
      playerId: "",  // Empty for new player
      token: "",
      playerName: "Alice",
    };
    expect(cmd.type).toBe("JOIN");
    expect(cmd.commandId).toBeTruthy();
  });

  it("JOINED response includes credentials", () => {
    const msg = {
      type: "JOINED",
      playerId: "p_abc123",
      token: "t_secrettoken",
      serverSeq: 1,
    };
    expect(msg.playerId).toMatch(/^p_/);
    expect(msg.token.length).toBeGreaterThan(10);
  });

  it("serverSeq is monotonic", () => {
    let seq = 0;
    const messages = [
      { type: "CONNECTED", serverSeq: ++seq },
      { type: "JOINED", serverSeq: ++seq },
      { type: "PLAYERS", serverSeq: ++seq },
    ];
    expect(messages[2].serverSeq).toBeGreaterThan(messages[0].serverSeq);
  });
});

describe("Identity Persistence (localStorage)", () => {
  it("stores and retrieves identity", () => {
    // Mock localStorage for testing
    const storage: Record<string, string> = {};
    const roomId = "test123";

    // Store
    storage[`game:${roomId}:playerId`] = "p_abc";
    storage[`game:${roomId}:token`] = "t_xyz";

    // Retrieve
    const playerId = storage[`game:${roomId}:playerId`];
    const token = storage[`game:${roomId}:token`];

    expect(playerId).toBe("p_abc");
    expect(token).toBe("t_xyz");
  });
});
```

### Browser Verification (Manual + Chrome Extension)

**Test 1: Fresh Join**
```
1. Navigate to http://localhost:5173/game/test-phase2
2. Enter name "Alice", click Join
3. Verify:
   - Status changes to "joined"
   - Player list shows "Alice (you)"
   - localStorage has game:test-phase2:playerId and :token
```

**Test 2: Identity Persists on Refresh**
```
1. After joining, refresh the page
2. Verify:
   - Auto-rejoins without name prompt
   - Same player name appears
   - Check localStorage - same playerId as before
```

**Test 3: Multiple Players**
```
1. Open same URL in incognito window
2. Join as "Bob"
3. Verify both windows show:
   - "Alice (you)" or "Bob (you)" depending on window
   - Both players in list
   - Both marked as connected
```

**Test 4: Disconnect Detection**
```
1. Close incognito window (Bob disconnects)
2. In Alice's window, verify:
   - Bob shows as "(disconnected)"
   - Alice still shows as connected
```

**Test 5: Reconnection**
```
1. Reopen incognito, navigate to same game
2. Should auto-rejoin as Bob (stored credentials)
3. Verify:
   - Bob shows as connected again
   - Same playerId as before (check localStorage)
```

**Test 6: Hibernation Survival**
```
1. Join a game, note your playerId
2. Wait 60 seconds (DO hibernates after ~30s inactivity)
3. Refresh the page
4. Verify:
   - Successfully reconnects
   - Same playerId preserved
   - Player list restored
```

### CLI Verification

```bash
cd app

# TypeScript compiles with new types
bun run typecheck

# Dev server handles WebSocket lifecycle
bun run dev &
sleep 3
# ... run browser tests ...
kill %1
```

### Definition of Done

- [ ] JOIN command creates new player with server-issued ID + token
- [ ] JOIN with valid credentials reconnects existing player
- [ ] JOIN with invalid credentials creates new player (graceful fallback)
- [ ] Player list updates broadcast to all authenticated connections
- [ ] Disconnect marks player as disconnected (not removed)
- [ ] Reconnect marks player as connected again
- [ ] localStorage persists identity across page refreshes
- [ ] Hibernation wake restores serverSeq and processes commands correctly
- [ ] commandId prevents duplicate command processing

## Out of Scope

- Game state / commands (Phase 3)
- Lobby "ready" state (Phase 3)
- Kicking inactive players
- Admin/host privileges

---

## Notes

### Idempotency

Every command has a `commandId`. Before processing, we check:
```typescript
const processedKey = `cmd:${cmd.commandId}`;
if (await this.ctx.storage.get<boolean>(processedKey)) {
  // Already processed - just ACK
  return;
}
```

This prevents duplicate processing if client retries.

### serverSeq

Every server message has a monotonic `serverSeq`. Client ignores messages where `serverSeq <= lastServerSeq`. This handles:
- Out-of-order delivery
- Duplicate messages
- Stale messages after reconnect

### Hibernation

Durable Objects hibernate after ~30s of inactivity. When hibernated:
- In-memory state is lost
- `onStart()` runs again on wake
- `conn.setState()` data survives
- `ctx.storage` data survives

That's why we store `serverSeq` in storage and player identity in both storage and connection state.

### Command ID Storage Cleanup

The `cmd:{commandId}` keys grow forever. For production, add cleanup:

```typescript
// Option 1: Per-player LRU window (keep last N commands per player)
// Option 2: TTL-based expiry using Durable Object alarms
// Option 3: Periodic cleanup in onStart()

async onStart() {
  await this.ctx.blockConcurrencyWhile(async () => {
    // Cleanup old command keys (older than 1 hour)
    const cutoff = Date.now() - 60 * 60 * 1000;
    const allKeys = await this.ctx.storage.list({ prefix: "cmd:" });
    for (const [key, timestamp] of allKeys) {
      if (typeof timestamp === "number" && timestamp < cutoff) {
        await this.ctx.storage.delete(key);
      }
    }
  });
}
```

For Phase 2, this is not critical (low traffic), but note it for Phase 3+.

### Connection Tags Caveat

`getConnectionTags()` is called at connect time, **before** `onMessage` processes the JOIN command. This means you cannot use tags to filter authenticated connections — the tag is set before authentication happens.

**Wrong approach:**
```typescript
// This won't work - tags set before JOIN
for (const conn of this.getConnections("player")) { ... }
```

**Correct approach:**
```typescript
// Filter by checking connection state instead
for (const conn of this.getConnections()) {
  const state = conn.state as ConnectionState | undefined;
  if (state?.playerId) {
    // This connection is authenticated
  }
}
```

If you need tag-based filtering, pass identity in the initial WebSocket URL query string and validate in `onBeforeConnect`.
