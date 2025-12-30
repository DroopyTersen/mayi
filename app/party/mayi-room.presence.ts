/**
 * Pure “lobby presence” logic for `MayIRoom`.
 *
 * This file intentionally contains NO Durable Object / WebSocket code so we can unit test it
 * with Bun (TDD) without needing a Workers runtime.
 */

export interface StoredPlayer {
  playerId: string;
  name: string;

  // timestamps (ms since epoch)
  joinedAt: number; // first time we ever saw this playerId
  lastSeenAt: number; // updated on each JOIN

  // connection bookkeeping
  isConnected: boolean;
  currentConnectionId: string | null; // used to ignore stale onClose

  connectedAt: number | null;
  disconnectedAt: number | null;
}

export interface PlayerInfo {
  playerId: string;
  name: string;
  isConnected: boolean;
  disconnectedAt: number | null;
}

export function upsertStoredPlayerOnJoin(
  existing: StoredPlayer | null,
  args: {
    playerId: string;
    playerName: string;
    connectionId: string;
    now: number;
  }
): StoredPlayer {
  const trimmedName = args.playerName.trim();

  const joinedAt = existing ? existing.joinedAt : args.now;

  return {
    playerId: args.playerId,
    name: trimmedName,
    joinedAt,
    lastSeenAt: args.now,
    isConnected: true,
    currentConnectionId: args.connectionId,
    connectedAt: args.now,
    disconnectedAt: null,
  };
}

export function maybeUpdateStoredPlayerOnClose(
  existing: StoredPlayer,
  args: { closingConnectionId: string; now: number }
): StoredPlayer | null {
  if (existing.currentConnectionId !== args.closingConnectionId) {
    return null;
  }

  return {
    ...existing,
    isConnected: false,
    currentConnectionId: null,
    disconnectedAt: args.now,
  };
}

export function buildPlayersSnapshotFromStorageEntries(
  entries: Map<string, StoredPlayer>,
  args: { now: number; disconnectGraceMs: number }
): { players: PlayerInfo[]; expiredKeys: string[] } {
  const players: PlayerInfo[] = [];
  const expiredKeys: string[] = [];

  for (const [key, stored] of entries) {
    const isExpired =
      stored.isConnected === false &&
      stored.disconnectedAt !== null &&
      args.now - stored.disconnectedAt > args.disconnectGraceMs;

    if (isExpired) {
      expiredKeys.push(key);
      continue;
    }

    players.push({
      playerId: stored.playerId,
      name: stored.name,
      isConnected: stored.isConnected,
      disconnectedAt: stored.disconnectedAt,
    });
  }

  players.sort((a, b) => {
    // connected first
    if (a.isConnected !== b.isConnected) {
      return a.isConnected ? -1 : 1;
    }

    // stable UI: joinedAt ascending (requires a lookup)
    const aJoinedAt = entries.get(`player:${a.playerId}`)?.joinedAt ?? 0;
    const bJoinedAt = entries.get(`player:${b.playerId}`)?.joinedAt ?? 0;
    return aJoinedAt - bJoinedAt;
  });

  return { players, expiredKeys };
}


