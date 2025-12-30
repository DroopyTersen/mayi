# Web App Scaffolding Plan

> **Status**: Planning Complete
> **Architecture**: React Router 7 + PartyServer in a single Cloudflare Worker

---

## Implementation Phases

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| [0](web-app-phase-00.plan.md) | Server-Safe Engine | Not Started | Refactor game engine to be Worker-compatible |
| [1](web-app-phase-01.plan.md) | Scaffolding | Not Started | Basic RR7 + PartyServer, WebSocket "hello world" |
| [2](web-app-phase-02.plan.md) | Identity & Reconnect | Not Started | Auth flow, localStorage, hibernation survival |
| 3 | Game Integration | TBD | Lobby, starting games, AI players, game commands |
| 4 | Client UI | TBD | Card rendering, interactions, polish |

**Start with Phase 0** — the web app cannot proceed until the game engine is extracted from CLI dependencies.

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Deployment** | Single consolidated Worker | No CORS, same-origin WebSocket, simpler ops |
| **State ownership** | Server-authoritative | Turn-based game; no client prediction needed |
| **State sync** | Per-player views (not broadcast) | Hands are private; each player sees only their cards |
| **XState location** | Server only | Clients are "dumb renderers" |
| **Identity** | Server-issued playerId + token | Survives reconnection and hibernation |

---

## Wire Protocol (Reference)

### Client → Server Commands

```typescript
type ClientCommand = {
  commandId: string;     // Client-generated UUID, for idempotency
  playerId: string;      // Server-issued (empty on first JOIN)
  token: string;         // Server-issued (empty on first JOIN)
} & (
  | { type: "JOIN"; playerName: string }
  | { type: "START_GAME" }
  | { type: "DRAW"; source: "stock" | "discard" }
  | { type: "LAY_DOWN"; cardIds: string[][] }
  | { type: "DISCARD"; cardId: string }        // Stable ID, not index!
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "CALL_MAY_I" }
  | { type: "PASS" }
);
```

### Server → Client Messages

```typescript
type ServerMessage = {
  serverSeq: number;     // Monotonic sequence for ordering
} & (
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; token: string }
  | { type: "STATE_UPDATE"; state: PlayerView }
  | { type: "COMMAND_ACK"; commandId: string }
  | { type: "COMMAND_REJECTED"; commandId: string; error: string; message: string }
  | { type: "ERROR"; error: string; message: string }
);
```

### PlayerView (Per-Player State)

```typescript
interface PlayerView {
  gameId: string;
  public: {
    phase: "lobby" | "playing" | "ended";
    currentPlayerIndex: number;
    turnPhase: "DRAW" | "PLAY" | "DISCARD" | "MAY_I_WINDOW";
    round: number;
    discardTop: Card | null;
    stockCount: number;
    table: Meld[];              // Melds have stable meldId
    scores: Record<string, number>;
  };
  players: Array<{
    playerId: string;
    name: string;
    cardCount: number;          // NOT their actual cards!
    hasLaidDown: boolean;
    isConnected: boolean;
  }>;
  yourPlayerId: string;
  yourHand: Card[];             // Only YOUR cards, with stable cardId
}
```

---

## Project Structure

```
mayi/
├── core/                     # Server-safe engine (Phase 0)
│   ├── engine/
│   │   └── game-engine.ts    # Pure game logic, no I/O
│   └── types/
│       └── game.types.ts     # PlayerView, Card, Meld, etc.
│
├── cli/                      # CLI adapter (uses node:fs)
│   └── harness/
│       └── cli-orchestrator.ts
│
├── app/                      # Web app (Phases 1-4)
│   ├── workers/
│   │   └── app.ts            # Worker entry point
│   ├── party/
│   │   └── mayi-room.ts      # Durable Object
│   ├── app/
│   │   └── routes/           # React Router pages
│   ├── package.json
│   ├── wrangler.jsonc
│   └── vite.config.ts
│
└── specs/
    ├── web-app-scaffolding.plan.md  # This file (index)
    ├── web-app-phase-00.plan.md     # Server-Safe Engine
    ├── web-app-phase-01.plan.md     # Scaffolding
    └── web-app-phase-02.plan.md     # Identity & Reconnect
```

---

## PartyServer API Quick Reference

**Correct API** (partyserver package):
```typescript
this.ctx.storage        // Durable Object storage
this.broadcast(msg)     // Send to all connections
this.getConnections()   // Get all connections (no tag filtering post-JOIN)
this.name               // Room ID
conn.setState(data)     // Per-connection state (survives hibernation)
conn.state              // Read connection state
```

**Wrong API** (will not work):
```typescript
this.room.storage       // ❌ No this.room
this.room.broadcast()   // ❌
this.room.getConnections() // ❌
this.room.id            // ❌ Use this.name
```

**Connection Tags Caveat**: `getConnectionTags()` runs at connect time, before JOIN. You cannot use `getConnections("player")` to filter authenticated users. Instead, iterate all connections and check `conn.state`.

---

## Configuration Templates

### wrangler.jsonc

```jsonc
{
  "name": "mayi-web",
  "main": "./workers/app.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "./build/client" },
  "durable_objects": {
    "bindings": [{ "name": "MayIRoom", "class_name": "MayIRoom" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["MayIRoom"] }
  ]
}
```

> Use `new_sqlite_classes` (not `new_classes`) for SQLite-backed DOs.

### package.json scripts

```json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "wrangler dev",
    "deploy": "react-router build && wrangler deploy",
    "typecheck": "react-router typegen && tsc"
  }
}
```

---

## References

- [PartyServer npm package](https://www.npmjs.com/package/partyserver)
- [React Router 7 Cloudflare Template](https://github.com/remix-run/react-router-templates/tree/main/cloudflare)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [threepointone/partyvite](https://github.com/threepointone/partyvite) - Consolidated architecture example

---

## Open Questions (Phase 3+)

These need discussion before Phase 3 planning:

1. **Lobby Flow**: How do players ready up? Auto-start at N players or explicit host action?
2. **AI Players**: Add during lobby? Replace disconnected players? Difficulty levels?
3. **Game Start**: Who can start the game? First player = host?
4. **Spectators**: Allow spectators? What do they see?
5. **Rematch**: After game ends, same room or new?
