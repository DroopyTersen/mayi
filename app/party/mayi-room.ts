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
  type StoredPlayer,
} from "./mayi-room.presence";

import {
  createInitialLobbyState,
  addAIPlayer,
  removeAIPlayer,
  setStartingRound,
  buildLobbyStatePayload,
  storedPlayersToHumanPlayerInfo,
  type LobbyState,
} from "./mayi-room.lobby";

import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
  type HumanPlayerInfo,
} from "./protocol.types";

const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const MIN_NAME_LEN = 1;
const MAX_NAME_LEN = 24;
const MAX_PLAYER_ID_LEN = 64;

const LOBBY_STATE_KEY = "lobby:state";

type MayIRoomConnectionState = { playerId: string };

function safeJsonParse(value: string): unknown {
  return JSON.parse(value) as unknown;
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

    // Send current player list
    const players = await this.readPlayersSnapshot();
    conn.send(JSON.stringify({ type: "PLAYERS", players } satisfies ServerMessage));

    // Send current lobby state (Phase 3)
    const lobbyState = await this.getLobbyState();
    const humanPlayers = storedPlayersToHumanPlayerInfo(
      await this.getStoredPlayers()
    );
    const lobbyPayload = buildLobbyStatePayload(humanPlayers, lobbyState);
    conn.send(JSON.stringify({ type: "LOBBY_STATE", lobbyState: lobbyPayload } satisfies ServerMessage));
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

    const result = parseClientMessage(parsed);
    if (!result.success) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_MESSAGE",
          message: result.error,
        } satisfies ServerMessage)
      );
      return;
    }

    const msg = result.data;

    switch (msg.type) {
      case "JOIN":
        await this.handleJoin(conn, msg);
        break;

      case "ADD_AI_PLAYER":
        await this.handleAddAIPlayer(conn, msg);
        break;

      case "REMOVE_AI_PLAYER":
        await this.handleRemoveAIPlayer(conn, msg);
        break;

      case "SET_STARTING_ROUND":
        await this.handleSetStartingRound(conn, msg);
        break;

      case "START_GAME":
        // Phase 3.2 - to be implemented
        conn.send(
          JSON.stringify({
            type: "ERROR",
            error: "NOT_IMPLEMENTED",
            message: "START_GAME not yet implemented",
          } satisfies ServerMessage)
        );
        break;

      case "GAME_ACTION":
        // Phase 3.4 - to be implemented
        conn.send(
          JSON.stringify({
            type: "ERROR",
            error: "NOT_IMPLEMENTED",
            message: "GAME_ACTION not yet implemented",
          } satisfies ServerMessage)
        );
        break;

      default:
        conn.send(
          JSON.stringify({
            type: "ERROR",
            error: "INVALID_MESSAGE",
            message: "Unsupported message type",
          } satisfies ServerMessage)
        );
    }
  }

  private async handleJoin(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "JOIN" }>
  ) {
    const playerId = msg.playerId.trim();
    const playerName = msg.playerName.trim();

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

    await this.broadcastPlayersAndLobby();
  }

  private async handleAddAIPlayer(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "ADD_AI_PLAYER" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const humanPlayers = await this.getStoredPlayers();
    const humanCount = humanPlayers.length;

    const newState = addAIPlayer(lobbyState, humanCount, msg.name, msg.modelId);

    if (!newState) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "MAX_PLAYERS",
          message: "Cannot add more players (max 8)",
        } satisfies ServerMessage)
      );
      return;
    }

    await this.setLobbyState(newState);
    await this.broadcastLobbyState();
  }

  private async handleRemoveAIPlayer(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "REMOVE_AI_PLAYER" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const newState = removeAIPlayer(lobbyState, msg.playerId);

    if (!newState) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "PLAYER_NOT_FOUND",
          message: "AI player not found",
        } satisfies ServerMessage)
      );
      return;
    }

    await this.setLobbyState(newState);
    await this.broadcastLobbyState();
  }

  private async handleSetStartingRound(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "SET_STARTING_ROUND" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const newState = setStartingRound(lobbyState, msg.round);

    if (!newState) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_ROUND",
          message: "Invalid round number (must be 1-6)",
        } satisfies ServerMessage)
      );
      return;
    }

    await this.setLobbyState(newState);
    await this.broadcastLobbyState();
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
    await this.broadcastPlayersAndLobby();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Storage Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async getLobbyState(): Promise<LobbyState> {
    const stored = await this.ctx.storage.get<LobbyState>(LOBBY_STATE_KEY);
    return stored ?? createInitialLobbyState();
  }

  private async setLobbyState(state: LobbyState): Promise<void> {
    await this.ctx.storage.put(LOBBY_STATE_KEY, state);
  }

  private async getStoredPlayers(): Promise<StoredPlayer[]> {
    const entries = await this.ctx.storage.list<StoredPlayer>({
      prefix: "player:",
    });
    return Array.from(entries.values());
  }

  private async readPlayersSnapshot(): Promise<HumanPlayerInfo[]> {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Broadcast Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async broadcastPlayers(): Promise<void> {
    const players = await this.readPlayersSnapshot();
    this.broadcast(JSON.stringify({ type: "PLAYERS", players } satisfies ServerMessage));
  }

  private async broadcastLobbyState(): Promise<void> {
    const lobbyState = await this.getLobbyState();
    const humanPlayers = storedPlayersToHumanPlayerInfo(
      await this.getStoredPlayers()
    );
    const lobbyPayload = buildLobbyStatePayload(humanPlayers, lobbyState);
    this.broadcast(JSON.stringify({ type: "LOBBY_STATE", lobbyState: lobbyPayload } satisfies ServerMessage));
  }

  private async broadcastPlayersAndLobby(): Promise<void> {
    await this.broadcastPlayers();
    await this.broadcastLobbyState();
  }
}
