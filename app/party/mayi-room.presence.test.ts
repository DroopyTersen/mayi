import { describe, expect, it } from "bun:test";

import {
  buildPlayersSnapshotFromStorageEntries,
  maybeUpdateStoredPlayerOnClose,
  upsertStoredPlayerOnJoin,
  type StoredPlayer,
} from "./mayi-room.presence";

describe("MayIRoom presence logic", () => {
  it("upsertStoredPlayerOnJoin creates a new player record (trimmed name, connected, timestamps)", () => {
    const now = 1_700_000_000_000;

    const created = upsertStoredPlayerOnJoin(null, {
      playerId: "p_123",
      playerName: "  Alice  ",
      connectionId: "c_1",
      now,
    });

    expect(created).toEqual({
      playerId: "p_123",
      name: "Alice",
      joinedAt: now,
      lastSeenAt: now,
      isConnected: true,
      currentConnectionId: "c_1",
      connectedAt: now,
      disconnectedAt: null,
    } satisfies StoredPlayer);
  });

  it("upsertStoredPlayerOnJoin preserves joinedAt for existing players and updates connection metadata", () => {
    const existing: StoredPlayer = {
      playerId: "p_123",
      name: "Alice",
      joinedAt: 111,
      lastSeenAt: 222,
      isConnected: false,
      currentConnectionId: null,
      connectedAt: 222,
      disconnectedAt: 333,
    };

    const now = 444;
    const updated = upsertStoredPlayerOnJoin(existing, {
      playerId: "p_123",
      playerName: "Alice Cooper",
      connectionId: "c_new",
      now,
    });

    expect(updated.joinedAt).toBe(111);
    expect(updated.name).toBe("Alice Cooper");
    expect(updated.lastSeenAt).toBe(now);
    expect(updated.isConnected).toBe(true);
    expect(updated.currentConnectionId).toBe("c_new");
    expect(updated.connectedAt).toBe(now);
    expect(updated.disconnectedAt).toBeNull();
  });

  it("maybeUpdateStoredPlayerOnClose ignores stale closes (connection id does not match currentConnectionId)", () => {
    const existing: StoredPlayer = {
      playerId: "p_123",
      name: "Alice",
      joinedAt: 111,
      lastSeenAt: 222,
      isConnected: true,
      currentConnectionId: "c_current",
      connectedAt: 222,
      disconnectedAt: null,
    };

    const updated = maybeUpdateStoredPlayerOnClose(existing, {
      closingConnectionId: "c_old",
      now: 999,
    });

    expect(updated).toBeNull();
  });

  it("maybeUpdateStoredPlayerOnClose marks the player disconnected when close matches currentConnectionId", () => {
    const existing: StoredPlayer = {
      playerId: "p_123",
      name: "Alice",
      joinedAt: 111,
      lastSeenAt: 222,
      isConnected: true,
      currentConnectionId: "c_current",
      connectedAt: 222,
      disconnectedAt: null,
    };

    const now = 999;
    const updated = maybeUpdateStoredPlayerOnClose(existing, {
      closingConnectionId: "c_current",
      now,
    });

    expect(updated).toEqual({
      ...existing,
      isConnected: false,
      currentConnectionId: null,
      disconnectedAt: now,
    } satisfies StoredPlayer);
  });

  it("buildPlayersSnapshotFromStorageEntries returns sorted player list and deletes expired disconnected players", () => {
    const now = 1_000_000;
    const graceMs = 5 * 60 * 1000;

    const connected: StoredPlayer = {
      playerId: "p_connected",
      name: "Connected",
      joinedAt: 200,
      lastSeenAt: 500,
      isConnected: true,
      currentConnectionId: "c1",
      connectedAt: 500,
      disconnectedAt: null,
    };

    const disconnectedRecent: StoredPlayer = {
      playerId: "p_recent",
      name: "Recent",
      joinedAt: 100,
      lastSeenAt: 900,
      isConnected: false,
      currentConnectionId: null,
      connectedAt: 900,
      disconnectedAt: now - 60_000, // 1m ago
    };

    const disconnectedExpired: StoredPlayer = {
      playerId: "p_expired",
      name: "Expired",
      joinedAt: 50,
      lastSeenAt: 800,
      isConnected: false,
      currentConnectionId: null,
      connectedAt: 800,
      disconnectedAt: now - graceMs - 1, // just over grace window
    };

    const entries = new Map<string, StoredPlayer>([
      ["player:p_connected", connected],
      ["player:p_recent", disconnectedRecent],
      ["player:p_expired", disconnectedExpired],
    ]);

    const snapshot = buildPlayersSnapshotFromStorageEntries(entries, {
      now,
      disconnectGraceMs: graceMs,
    });

    // expired should be scheduled for deletion
    expect(snapshot.expiredKeys).toEqual(["player:p_expired"]);

    // remaining players sorted: connected first, then by joinedAt asc
    expect(snapshot.players.map((p) => p.playerId)).toEqual([
      "p_connected",
      "p_recent",
    ]);
  });
});


