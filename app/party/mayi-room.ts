import {
  Server,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";

import {
  buildPlayersSnapshotFromStorageEntries,
  maybeUpdateStoredPlayerOnClose,
  upsertStoredPlayerOnJoin,
  type PlayerInfo,
  type StoredPlayer,
} from "./mayi-room.presence";

const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const MIN_NAME_LEN = 1;
const MAX_NAME_LEN = 24;
const MAX_PLAYER_ID_LEN = 64;

type ClientMessage = {
  type: "JOIN";
  playerId: string;
  playerName: string;
};

type ServerMessage =
  | { type: "CONNECTED"; roomId: string }
  | { type: "JOINED"; playerId: string; playerName: string }
  | { type: "PLAYERS"; players: PlayerInfo[] }
  | { type: "ERROR"; error: string; message: string };

type MayIRoomConnectionState = { playerId: string };

function safeJsonParse(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function isJoinMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "JOIN" &&
    typeof v.playerId === "string" &&
    typeof v.playerName === "string"
  );
}

export class MayIRoom extends Server {
  // MVP: disable hibernation for simplicity + dev/prod parity.
  static override options = { hibernate: false };

  override async onConnect(
    conn: Connection<MayIRoomConnectionState>,
    _ctx: ConnectionContext
  ) {
    conn.send(
      JSON.stringify({
        type: "CONNECTED",
        roomId: this.name,
      } satisfies ServerMessage)
    );

    const players = await this.readPlayersSnapshot();
    conn.send(JSON.stringify({ type: "PLAYERS", players } satisfies ServerMessage));
  }

  override async onMessage(conn: Connection<MayIRoomConnectionState>, message: WSMessage) {
    const textMessage =
      typeof message === "string"
        ? message
        : message instanceof ArrayBuffer
          ? new TextDecoder().decode(message)
          : ArrayBuffer.isView(message)
            ? new TextDecoder().decode(message.buffer)
            : null;

    if (textMessage === null) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_MESSAGE",
          message: "Message must be a string",
        } satisfies ServerMessage)
      );
      return;
    }

    let parsed: unknown;
    try {
      parsed = safeJsonParse(textMessage);
    } catch {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "PARSE_ERROR",
          message: "Message must be valid JSON",
        } satisfies ServerMessage)
      );
      return;
    }

    if (!isJoinMessage(parsed)) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_MESSAGE",
          message: "Unsupported message type",
        } satisfies ServerMessage)
      );
      return;
    }

    const playerId = parsed.playerId.trim();
    const playerName = parsed.playerName.trim();

    if (playerId.length < 1 || playerId.length > MAX_PLAYER_ID_LEN) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_MESSAGE",
          message: "Invalid playerId",
        } satisfies ServerMessage)
      );
      return;
    }

    if (playerName.length < MIN_NAME_LEN || playerName.length > MAX_NAME_LEN) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_MESSAGE",
          message: "Invalid playerName",
        } satisfies ServerMessage)
      );
      return;
    }

    const now = Date.now();
    const key = `player:${playerId}`;
    const existing = (await this.ctx.storage.get<StoredPlayer>(key)) ?? null;
    const updated = upsertStoredPlayerOnJoin(existing, {
      playerId,
      playerName,
      connectionId: conn.id,
      now,
    });

    await this.ctx.storage.put(key, updated);

    // Attribute this connection to the player so onClose can mark them disconnected.
    conn.setState({ playerId });

    conn.send(
      JSON.stringify({
        type: "JOINED",
        playerId,
        playerName: updated.name,
      } satisfies ServerMessage)
    );

    await this.broadcastPlayers();
  }

  override async onClose(
    conn: Connection<MayIRoomConnectionState>,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    const playerId = conn.state?.playerId;
    if (!playerId) return;

    const key = `player:${playerId}`;
    const existing = await this.ctx.storage.get<StoredPlayer>(key);
    if (!existing) return;

    const updated = maybeUpdateStoredPlayerOnClose(existing, {
      closingConnectionId: conn.id,
      now: Date.now(),
    });
    if (!updated) return;

    await this.ctx.storage.put(key, updated);
    await this.broadcastPlayers();
  }

  private async readPlayersSnapshot(): Promise<PlayerInfo[]> {
    const now = Date.now();
    const entries = await this.ctx.storage.list<StoredPlayer>({
      prefix: "player:",
    });

    const snapshot = buildPlayersSnapshotFromStorageEntries(entries, {
      now,
      disconnectGraceMs: DISCONNECT_GRACE_MS,
    });

    if (snapshot.expiredKeys.length > 0) {
      await this.ctx.storage.delete(snapshot.expiredKeys);
    }

    return snapshot.players;
  }

  private async broadcastPlayers() {
    const players = await this.readPlayersSnapshot();
    this.broadcast(JSON.stringify({ type: "PLAYERS", players } satisfies ServerMessage));
  }
}
