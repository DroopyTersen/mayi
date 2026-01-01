# Phase 2: Lobby Identity, Presence, and Reconnection (MVP)

> **Status**: Planned (rewrite for MVP simplicity)
> **Depends on**: Phase 1 (Scaffolding / WebSocket wiring)
>
> **Nice-to-have (not required)**: UI Components Plan (`specs/ui-components.plan.md`) — if implemented first, we can reuse shared UI (e.g. `ResponsiveDrawer`) and match the future design system. Phase 2 can still be implemented without it using existing shadcn/ui primitives.
>
> **Estimated scope**: 1–2 days for a single engineer (plus polish)
>
> **Primary goal**: When you open a room link, you can enter a name, appear in a lobby list, and stay the “same player” when you refresh that tab. When you close the tab, you remain visible as “disconnected” for a few minutes.

---

## Executive Summary (What we are building in Phase 2)

In Phase 2 we implement a minimal “lobby presence” layer for multiplayer:

- A user can open `/game/:roomId` and connect to the room’s WebSocket server.
- The user is prompted for a name (no login).
- When the user submits a name, the server creates/updates a **player record** in Durable Object storage and broadcasts the lobby’s player list to everyone in the room.
- If the user refreshes the same browser tab, they automatically rejoin as the **same** player (same `playerId`).
- If the user closes the tab, they remain in the lobby as “disconnected” for a **grace period** (default: 5 minutes), then disappear.
- **Multiple tabs** are treated as **multiple players** by design (simplest MVP behavior).

We intentionally do **not** implement any of the actual May I game logic in Phase 2.

---

## Why this design (First principles)

### MVP constraints and UX target

We are optimizing for:

- **No authentication**: Anyone with a room link can join.
- **Simplicity**: Junior dev should be able to implement without ambiguity.
- **Small rooms**: 3–8 players typical.
- **Share link flow**: “Start a game → share link to family → they open link → enter name → see lobby.”
- **Tab-scoped identity**: A browser tab is “a player” for now.
- **Refresh resilience**: Refreshing should not create a new player; it should reconnect the same tab/player.
- **Forgiving disconnect**: If someone drops briefly, keep them visible for a few minutes.

### What we are deliberately not optimizing for (yet)

- Security or real identity (no login, no auth)
- Preventing griefing / room guessing / “random people joining”
- Massive scaling, throughput, or large-room performance
- Strict message ordering / sequencing (`serverSeq`) or command idempotency via `commandId`
- Complex reconnection correctness across DO hibernation boundaries

---

## Platform & SDK reality check (IMPORTANT)

We are **not** using hosted PartyKit servers directly. We are using:

- `partyserver` (`node_modules/partyserver`) running as a **Cloudflare Durable Object** server.
- `partysocket` (`node_modules/partysocket`) as the browser client WebSocket.
- React Router 7 **framework mode** SSR on Cloudflare Workers.

### Key SDK facts we must code against

#### `partyserver`

- Room server class extends `Server` from `"partyserver"`.
- Storage is Cloudflare Durable Object storage via `this.ctx.storage` (`get`, `put`, `delete`, `list`, `transaction`, etc).
- Connections are WebSockets augmented with:
  - `connection.id` (string)
  - `connection.state` (read-only, up to ~2KB)
  - `connection.setState()` to write `connection.state`
- Hibernation is controlled by:

```ts
export class MayIRoom extends Server {
  static options = { hibernate: true };
}
```

#### `partysocket/react` is SSR-hostile for our app

`usePartySocket()` uses `dummy-domain.com` on the server and still constructs a socket during SSR:

- That means if we call `usePartySocket()` in a React Router SSR route, we risk attempting to connect during SSR.
- For Phase 2, **DO NOT use** `usePartySocket` in SSR-rendered routes. Use the `PartySocket` class and create it inside `useEffect`.

---

## Phase 2 design decisions (Explicit)

### Decision 1: Hibernation is OFF for MVP

We will disable `partyserver` hibernation in Phase 2.

**Why**:

- We only have 3–8 players; we don’t need hibernation’s scale benefits.
- PartyKit docs note local dev doesn’t emulate hibernation well; behavior differs ([hibernation guide](https://docs.partykit.io/guides/scaling-partykit-servers-with-hibernation/)).
- Disabling hibernation makes the server lifecycle easier to reason about for a junior dev.

**Implementation requirement**:

- In `app/party/mayi-room.ts`, remove `static options = { hibernate: true }` OR explicitly set `static options = { hibernate: false }`.

**Important note**:

- Even with hibernation off, the Durable Object can still be restarted on deploy/crash; our design uses `this.ctx.storage` so we can recover lobby state.

### Decision 2: Each browser tab is a separate player

**Multiple tabs = multiple players** is the intentional MVP behavior.

**Implementation requirement**:

- Use `sessionStorage` (tab-scoped) to persist the player identity across refresh in the same tab.
- Do not use `localStorage` for the player id (because it is shared across tabs).

### Decision 3: No server-issued tokens, no “authentication”

There is no trusted identity. We will accept client-supplied player ids because:

- MVP / family use
- the room id is already a “shared secret”
- we prefer simplicity

We still validate basic input (e.g., name length) to avoid footguns.

### Decision 4: JOIN is idempotent by design (no `commandId` system)

Instead of “commandId + ACK”, we make JOIN idempotent:

- The client always sends the same `playerId` for that tab.
- The server upserts by `playerId`.
- If JOIN repeats (reconnect, refresh, retry), it does not create duplicates.

This is simpler and directly solves “JOIN response was lost”.

### Decision 5: Disconnects are “sticky” for a grace period

When a player disconnects, we keep them in the lobby for `DISCONNECT_GRACE_MS`:

- Default: 5 minutes (configurable constant)
- After the grace window, they disappear (record deleted).

---

## Terminology (use these words consistently)

- **Room**: a lobby identified by `roomId` (the `:roomId` in `/game/:roomId`).
- **Player**: a lobby participant. In MVP, a player is a browser tab.
- **Connection**: a single WebSocket connection to the room.
- **playerId**: stable id for a player (tab), stored in `sessionStorage`.

---

## Data model (Client + Server)

### Client storage (tab-scoped)

We store identity in `sessionStorage` so it survives refresh but is unique per tab.

Per room keys:

- `mayi:room:${roomId}:playerId` → string
- `mayi:room:${roomId}:playerName` → string

**playerId format**:

- Use `nanoid(12)` (short, URL-safe, random).
- This is not secret and not secure; it’s just a stable tab id.

### Server storage (Durable Object transactional storage)

We store each player under a separate key:

- Key: `player:${playerId}`
- Value: `StoredPlayer` (see below)

This matches the “shard by key” guidance in PartyKit storage docs ([persisting storage guide](https://docs.partykit.io/guides/persisting-state-into-storage/)).

#### `StoredPlayer` schema (exact)

```ts
interface StoredPlayer {
  playerId: string;
  name: string;

  // timestamps (ms since epoch)
  joinedAt: number; // first time we ever saw this playerId
  lastSeenAt: number; // updated on each JOIN

  // connection bookkeeping
  isConnected: boolean; // derived-ish, but stored for simplicity
  currentConnectionId: string | null; // used to ignore stale onClose

  connectedAt: number | null;
  disconnectedAt: number | null;
}
```

**Why store `currentConnectionId`?**

- On flaky networks, it is possible for “old connection closes” to arrive after “new connection joined”.
- Without a guard, `onClose` might mark an actively connected player as disconnected.
- We solve this by only applying `onClose` if `stored.currentConnectionId === closingConnection.id`.

### Server → Client view model

```ts
interface PlayerInfo {
  playerId: string;
  name: string;
  isConnected: boolean;
  disconnectedAt: number | null; // for UI (“disconnected 2m ago”)
}
```

---

## Wire protocol (Phase 2)

All messages are JSON strings.

### Client → Server

```ts
type ClientMessage = {
  type: "JOIN";
  playerId: string;
  playerName: string;
};
```

Notes:

- We always include `playerId`.
- We require `playerName` to be non-empty.
- We do not include `roomId` (the server already knows which room it is).

### Server → Client

```ts
type ServerMessage =
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; playerName: string }
  | { type: "PLAYERS"; players: PlayerInfo[] }
  | { type: "ERROR"; error: string; message: string };
```

Design notes:

- No `serverSeq` in Phase 2 (unneeded for lobby snapshot broadcasts).
- No `COMMAND_ACK` or `commandId` system in Phase 2.
- We broadcast full `PLAYERS` snapshots whenever lobby state changes.

---

## Server behavior (authoritative spec)

Implementation file: `app/party/mayi-room.ts`

### Constants

Define constants at top-level:

```ts
const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes

// Keep names reasonable; we can adjust later.
const MIN_NAME_LEN = 1;
const MAX_NAME_LEN = 24;
```

### On connect (`onConnect`)

When a new WebSocket connection is established:

1. Send `CONNECTED { roomId }` to the connecting client.
2. Send the current `PLAYERS` snapshot to the connecting client.

We do this even before JOIN so the “name prompt” can show existing players behind it.

### On message (`onMessage`)

Only support `JOIN` in Phase 2.

#### Message parsing rules

- If message is not JSON → send `ERROR { error: "PARSE_ERROR" }` and return.
- If JSON does not match expected shape → send `ERROR { error: "INVALID_MESSAGE" }` and return.
- If `type` is unknown → send `ERROR { error: "UNKNOWN_MESSAGE" }` and return.

#### JOIN rules (upsert)

On `JOIN`:

1. Validate `playerId`:
   - Must be a non-empty string.
   - Must be “reasonable” length (suggest max 64).
2. Validate `playerName`:
   - Trim whitespace.
   - Must be between `MIN_NAME_LEN` and `MAX_NAME_LEN`.
3. Load existing player record:
   - `const key = player:${playerId}`
   - `existing = await this.ctx.storage.get<StoredPlayer>(key)`
4. Compute new record:
   - If no existing:
     - `joinedAt = Date.now()`
   - If existing:
     - Preserve original `joinedAt`
   - Always set:
     - `name = validatedName`
     - `lastSeenAt = now`
     - `isConnected = true`
     - `currentConnectionId = conn.id`
     - `connectedAt = now`
     - `disconnectedAt = null`
5. Persist:
   - `await this.ctx.storage.put(key, updatedRecord)`
6. Set connection state (so `onClose` can attribute disconnect):
   - `conn.setState({ playerId })`
7. Reply to the joiner:
   - Send `JOINED { playerId, playerName }`
8. Broadcast lobby state:
   - `await broadcastPlayers()` (which broadcasts `PLAYERS` to everyone)

### On close (`onClose`)

When a connection closes:

1. Read `playerId` from connection state:
   - `const state = conn.state as { playerId?: string } | null`
   - If missing, do nothing.
2. Load the stored player record.
3. Ignore stale closes:
   - If `stored.currentConnectionId !== conn.id`, return without changes.
4. Mark disconnected:
   - `isConnected = false`
   - `currentConnectionId = null`
   - `disconnectedAt = now`
5. Persist record.
6. Broadcast lobby state:
   - `await broadcastPlayers()`

### Cleanup of expired disconnected players

We want “disconnected players stay for a few minutes”.

We do **opportunistic cleanup** (simple MVP):

- Every time we build the players snapshot, we:
  - delete any player with `isConnected === false` and `disconnectedAt != null` and `(now - disconnectedAt) > DISCONNECT_GRACE_MS`.

This avoids introducing Durable Object alarms in Phase 2.

### Building the PLAYERS snapshot

Implement a server helper `readPlayersSnapshot()` that:

1. `const entries = await this.ctx.storage.list<StoredPlayer>({ prefix: "player:" })`
2. Iterate entries and:
   - Validate shape minimally (skip invalid rows)
   - Apply expiration cleanup rules (delete old disconnected)
   - Build `PlayerInfo[]`
3. Sort players for stable UI:
   - Connected players first
   - Then by `joinedAt` ascending
4. Return array

Then `broadcastPlayers()`:

- `const players = await readPlayersSnapshot()`
- `this.broadcast(JSON.stringify({ type: "PLAYERS", players } satisfies ServerMessage))`

### Important notes for junior dev

- `this.broadcast()` broadcasts to **all** connections (we have no auth gating).
- `this.getConnections(tag?: string)` only supports a **single tag string** in `partyserver@0.1.0`. We will not use tags in Phase 2.
- Keep `conn.state` small (it’s limited in size).

---

## Client behavior (authoritative spec)

Implementation file: `app/routes/game.$roomId.tsx`

### UI components to use (from `specs/ui-components.plan.md`)

Phase 2’s UI is intentionally simple, but it should be built using the same primitives + conventions as the rest of the app.

**Important**: Phase 2 does **not** require any custom components from the UI components plan. It can be built today using only shadcn/ui primitives + straightforward JSX. If the UI components plan is completed first, we should reuse shared components where it makes sense.

#### shadcn/ui primitives (available in this repo)

Use shadcn/ui components from:

- `app/shadcn/components/ui/*`
- Import path prefix: `~/shadcn/components/ui/*`

Specifically for Phase 2:

- `Button` → `import { Button } from "~/shadcn/components/ui/button";`
- `Input` → `import { Input } from "~/shadcn/components/ui/input";`
- `Card` → `import { Card, CardContent, CardHeader, CardTitle } from "~/shadcn/components/ui/card";`

#### Shared UI components (expected to exist after the UI components plan)

If implemented by the time we do Phase 2, we should reuse:

- `ResponsiveDrawer` (Dialog on desktop / Drawer on mobile) for the “What’s your name?” prompt
  - Expected path (per UI plan): `~/ui/shared/ResponsiveDrawer`
  - If it does not exist yet, implement the name prompt inline as a simple `<form>` rendered on the page (still using `Input` + `Button`).

#### Lobby UI guidance (don’t over-build)

- **Players list**: render a small lobby-only list/table that shows:
  - player name
  - connected/disconnected status (and optionally “disconnected Xm ago”)

Do **not** force-fit game components like `PlayersTableDisplay` into Phase 2 unless they are designed to support a lobby mode; the UI plan’s `PlayersTableDisplay` assumes game-specific columns (cards, down, score) that we do not have in the lobby.

- **Copy share link button (optional)**: use a `Button` that calls `navigator.clipboard.writeText(location.href)` (with a fallback that selects/copies from a read-only input if clipboard is unavailable).

### SSR constraint: do not use `usePartySocket()`

We must not do:

```ts
import usePartySocket from "partysocket/react";
const socket = usePartySocket(...); // ❌ SSR can construct a socket
```

Instead:

- Import `PartySocket` from `"partysocket"`.
- Create the socket **inside `useEffect`** (client-only).

### Identity helpers (exact)

Implement helper functions:

```ts
function getOrCreatePlayerId(roomId: string): string;
function getStoredPlayerName(roomId: string): string | null;
function storePlayerName(roomId: string, name: string): void;
```

Rules:

- `getOrCreatePlayerId` uses `sessionStorage`.
- If missing, generate `nanoid(12)`, store, return.
- Player name is stored in `sessionStorage` too.

### Client state machine (simple)

Client UI has these coarse states:

- **Socket status**: `"connecting" | "connected" | "disconnected"`
- **Join status**: `"unjoined" | "joining" | "joined"`

### Connection flow

On mount:

1. Determine `playerId = getOrCreatePlayerId(roomId)`.
2. Determine `storedName = getStoredPlayerName(roomId)`.
3. Create `PartySocket` in `useEffect`:
   - Use `startClosed: true` so we can set handlers before connecting.
   - After handlers are set, call `.reconnect()`.

Socket `onopen`:

- Set socket status to `"connected"`.
- If `storedName` exists → automatically send `JOIN { playerId, playerName: storedName }`.
- If no storedName → show name prompt.

Socket `onmessage`:

- Parse JSON.
- Handle:
  - `CONNECTED`: store roomId (optional)
  - `PLAYERS`: set players list
  - `JOINED`: set join status `"joined"` (and ensure name is stored)
  - `ERROR`: show error message

Socket `onclose`:

- Set socket status `"disconnected"`.
- Set join status `"unjoined"` (or keep joined but show “reconnecting…” — either is acceptable; pick one and be consistent).

### Name prompt behavior

If `storedName` is missing:

- Show input: “What’s your name?”
- On submit:
  - Validate client-side (trim, enforce max len)
  - Save to `sessionStorage`
  - Send JOIN

If `storedName` exists:

- No prompt (auto-join on connect).
- Optional later: provide an “Edit name” button (out of scope).

### Multi-tab behavior (expected)

- Opening a new tab generates a new `playerId` because `sessionStorage` is tab-scoped.
- Therefore, a second tab acts as a second player. This is desired.

---

## Implementation steps (checklist for junior dev)

### Server: `app/party/mayi-room.ts`

1. Remove/disable hibernation (`static options = { hibernate: true }`).
2. Replace the Phase 1 stub messages with the Phase 2 wire protocol.
3. Add exact TypeScript types for `ClientMessage`, `ServerMessage`, `StoredPlayer`, `PlayerInfo`.
4. Implement `onConnect`:
   - send CONNECTED
   - send PLAYERS snapshot
5. Implement `onMessage`:
   - parse JSON safely
   - handle JOIN with upsert logic
   - conn.setState({ playerId })
   - send JOINED
   - broadcast PLAYERS
6. Implement `onClose`:
   - read conn.state.playerId
   - ignore stale closes via `currentConnectionId`
   - mark disconnected + persist
   - broadcast PLAYERS
7. Implement snapshot helpers:
   - `readPlayersSnapshot()`
   - `broadcastPlayers()`
   - cleanup old disconnected players during snapshot

### Client: `app/routes/game.$roomId.tsx`

1. Add sessionStorage identity helpers (playerId + playerName).
2. ~~Stop using `usePartySocket` (SSR risk). Use `PartySocket` created in `useEffect`.~~ - nah i think this is fine. we are succeeding right now with our web sockets as is.
3. Implement UI (use shadcn/ui primitives and UI plan conventions):
   - Status indicator (connecting/connected/disconnected) — small text near header
   - Room/share section:
     - Show the room id and/or share link inside a `Card`
     - Optional: “Copy share link” `Button`
   - Players list:
     - Simple lobby-only list/table with name + connection status
     - Do not require game-specific columns in Phase 2
   - Name prompt when needed:
     - Prefer `ResponsiveDrawer` if available (from the UI components plan)
     - Otherwise render an inline form using `Input` + `Button`
4. Implement auto-join:
   - On open, if name exists, send JOIN automatically.
5. Implement message handlers for CONNECTED / PLAYERS / JOINED / ERROR.

---

## Verification (manual, required)

> We are intentionally keeping verification practical and user-facing in Phase 2.

### Test A: Basic join

1. Navigate to `/game/test-phase2`.
2. Enter name “Alice”.
3. Verify:
   - You appear in the player list as connected.
   - No errors.

### Test B: Refresh keeps same player (critical)

1. Join as “Alice”.
2. Refresh the page in the same tab.
3. Verify:
   - No name prompt.
   - You reappear as the same `playerId` (optional to display `playerId` in UI for debug).
   - Other connected clients see you remain/return quickly.

### Test C: Multi-tab = multi-player

1. Open the same room in a second tab.
2. Enter name “Alice 2” (or whatever).
3. Verify:
   - Two players appear.
   - Closing one tab does not remove the other.

### Test D: Disconnect grace period

1. In tab 2, close the tab.
2. In tab 1, verify:
   - Player shows as disconnected (not removed immediately).
3. Wait ~5 minutes (or temporarily set `DISCONNECT_GRACE_MS` to 10s for testing).
4. Trigger a lobby update (refresh tab 1 or reconnect).
5. Verify:
   - Disconnected player disappears after grace.

---

## Verification (automated tests, recommended)

Phase 2 can be implemented with minimal tests, but we prefer some “logic-level” coverage:

- Unit test for “playerId is stable across refresh in same tab”:
  - Use an injected storage-like interface so you can test without a browser.
- Unit test for “stale onClose does not mark player disconnected”:
  - Simulate stored record with `currentConnectionId = "new"` and closing connection id `"old"`.

We will decide test harness details during implementation (Bun test runner required).

---

## Definition of Done (Phase 2)

- [ ] Opening `/game/:roomId` connects and shows lobby list.
- [ ] User can enter a name and join the lobby.
- [ ] Lobby list broadcasts to all connected clients on join/leave.
- [ ] Refreshing the same tab rejoins automatically as the **same player**.
- [ ] Closing a tab marks player disconnected, and they remain visible for ~5 minutes.
- [ ] After grace period, disconnected players are removed.
- [ ] Multi-tab in the same browser acts as multiple players (expected).
- [ ] Implementation does not use `usePartySocket` in SSR routes.
- [ ] Hibernation is disabled in Phase 2 for simplicity.

---

## Out of scope (explicit)

- “Start game” button / transitioning from lobby to game engine
- Real auth / identity
- Preventing multiple tabs per person
- Ready checks, host privileges, kicking
- Strict ordering / server sequence numbers
- Durable Object alarms-based cleanup (we use opportunistic cleanup)

---

## Notes / Future considerations (Phase 3+)

- If/when we enable hibernation later, our storage-first design should still work.
- If we later want “one person = one player across tabs/devices”, we’ll switch from `sessionStorage` to a stable identity source (auth, device id, etc).
- If we later need stronger anti-duplication for non-JOIN commands, we’ll reintroduce `commandId` with **response replay**, not “ACK-only”.
