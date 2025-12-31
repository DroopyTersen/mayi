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
  canStartGame,
  type LobbyState,
} from "./mayi-room.lobby";

import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
  type HumanPlayerInfo,
} from "./protocol.types";

import {
  PartyGameAdapter,
  type StoredGameState,
} from "./party-game-adapter";

import { executeGameAction } from "./game-actions";
import {
  executeAITurn,
  isAIPlayerTurn,
  type AITurnResult,
} from "./ai-turn-handler";

const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const MIN_NAME_LEN = 1;
const MAX_NAME_LEN = 24;
const MAX_PLAYER_ID_LEN = 64;

const LOBBY_STATE_KEY = "lobby:state";
const GAME_STATE_KEY = "game:state";
const ROOM_PHASE_KEY = "room:phase";

type RoomPhase = "lobby" | "playing";

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

    // Check room phase
    const roomPhase = await this.getRoomPhase();

    if (roomPhase === "playing") {
      // Game in progress - send game state (will be sent on JOIN when player ID is known)
      // For now, just send lobby state for reference
      const lobbyState = await this.getLobbyState();
      const humanPlayers = storedPlayersToHumanPlayerInfo(
        await this.getStoredPlayers()
      );
      const lobbyPayload = buildLobbyStatePayload(humanPlayers, lobbyState);
      conn.send(JSON.stringify({ type: "LOBBY_STATE", lobbyState: lobbyPayload } satisfies ServerMessage));
    } else {
      // Lobby phase - send lobby state
      const lobbyState = await this.getLobbyState();
      const humanPlayers = storedPlayersToHumanPlayerInfo(
        await this.getStoredPlayers()
      );
      const lobbyPayload = buildLobbyStatePayload(humanPlayers, lobbyState);
      conn.send(JSON.stringify({ type: "LOBBY_STATE", lobbyState: lobbyPayload } satisfies ServerMessage));
    }
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
        await this.handleStartGame(conn);
        break;

      case "GAME_ACTION":
        await this.handleGameAction(conn, msg);
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

    // If game is in progress, send game state to this player
    const roomPhase = await this.getRoomPhase();
    if (roomPhase === "playing") {
      const gameState = await this.getGameState();
      if (gameState) {
        const adapter = PartyGameAdapter.fromStoredState(gameState);
        const playerView = adapter.getPlayerView(playerId);
        if (playerView) {
          conn.send(
            JSON.stringify({
              type: "GAME_STARTED",
              state: playerView,
            } satisfies ServerMessage)
          );
        }
      }
    }
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

  private async handleStartGame(
    conn: Connection<MayIRoomConnectionState>
  ) {
    // Check if already in a game
    const roomPhase = await this.getRoomPhase();
    if (roomPhase === "playing") {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "GAME_ALREADY_STARTED",
          message: "Game has already started",
        } satisfies ServerMessage)
      );
      return;
    }

    // Verify caller is the host (first player)
    const callerPlayerId = conn.state?.playerId;
    if (!callerPlayerId) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "NOT_JOINED",
          message: "You must join before starting the game",
        } satisfies ServerMessage)
      );
      return;
    }

    const storedPlayers = await this.getStoredPlayers();
    // Sort by join time to find the host (first player to join)
    const sortedPlayers = [...storedPlayers].sort((a, b) => a.joinedAt - b.joinedAt);
    const hostPlayerId = sortedPlayers[0]?.playerId;

    if (callerPlayerId !== hostPlayerId) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "NOT_HOST",
          message: "Only the host can start the game",
        } satisfies ServerMessage)
      );
      return;
    }

    // Check player count
    const lobbyState = await this.getLobbyState();
    const humanPlayers = storedPlayersToHumanPlayerInfo(storedPlayers);
    const humanCount = humanPlayers.length;
    const aiCount = lobbyState.aiPlayers.length;

    if (!canStartGame(humanCount, aiCount)) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_PLAYER_COUNT",
          message: "Need 3-8 players to start the game",
        } satisfies ServerMessage)
      );
      return;
    }

    // Create game from lobby state
    const adapter = PartyGameAdapter.createFromLobby({
      roomId: this.name,
      humanPlayers,
      aiPlayers: lobbyState.aiPlayers,
      startingRound: lobbyState.startingRound,
    });

    // Store game state
    await this.setGameState(adapter.getStoredState());
    await this.setRoomPhase("playing");

    // Broadcast GAME_STARTED to each player with their specific view
    await this.broadcastPlayerViews(adapter);

    // Execute AI turns if the first player is an AI
    await this.executeAITurnsIfNeeded();
  }

  private async handleGameAction(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "GAME_ACTION" }>
  ) {
    // Verify game is in playing phase
    const roomPhase = await this.getRoomPhase();
    if (roomPhase !== "playing") {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "GAME_NOT_STARTED",
          message: "Game has not started yet",
        } satisfies ServerMessage)
      );
      return;
    }

    // Get caller's player ID
    const callerPlayerId = conn.state?.playerId;
    if (!callerPlayerId) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "NOT_JOINED",
          message: "You must join before performing actions",
        } satisfies ServerMessage)
      );
      return;
    }

    // Load game state
    const gameState = await this.getGameState();
    if (!gameState) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "GAME_NOT_FOUND",
          message: "Game state not found",
        } satisfies ServerMessage)
      );
      return;
    }

    const adapter = PartyGameAdapter.fromStoredState(gameState);

    // Track phase before action for May I detection
    const phaseBefore = adapter.getSnapshot().phase;

    // Execute the action
    const result = executeGameAction(adapter, callerPlayerId, msg.action);

    if (!result.success) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: result.error ?? "ACTION_FAILED",
          message: `Action failed: ${result.error}`,
        } satisfies ServerMessage)
      );
      return;
    }

    // Save updated state
    await this.setGameState(adapter.getStoredState());

    // Check for May I phase transitions
    const snapshot = adapter.getSnapshot();
    const phaseAfter = snapshot.phase;

    if (phaseBefore !== "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
      // May I was just called - broadcast MAY_I_PROMPT
      await this.broadcastMayIPrompt(adapter);
    } else if (phaseBefore === "RESOLVING_MAY_I" && phaseAfter === "RESOLVING_MAY_I") {
      // Still resolving (someone allowed) - prompt next player
      await this.broadcastMayIPrompt(adapter);
    } else if (phaseBefore === "RESOLVING_MAY_I" && phaseAfter !== "RESOLVING_MAY_I") {
      // May I was just resolved
      await this.broadcastMayIResolved(adapter);
    }

    // Broadcast updated state to all players
    await this.broadcastGameState();

    // Execute AI turns if next player is an AI
    await this.executeAITurnsIfNeeded();
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

  private async getRoomPhase(): Promise<RoomPhase> {
    const phase = await this.ctx.storage.get<RoomPhase>(ROOM_PHASE_KEY);
    return phase ?? "lobby";
  }

  private async setRoomPhase(phase: RoomPhase): Promise<void> {
    await this.ctx.storage.put(ROOM_PHASE_KEY, phase);
  }

  private async getGameState(): Promise<StoredGameState | null> {
    return await this.ctx.storage.get<StoredGameState>(GAME_STATE_KEY) ?? null;
  }

  private async setGameState(state: StoredGameState): Promise<void> {
    await this.ctx.storage.put(GAME_STATE_KEY, state);
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

  /**
   * Broadcast GAME_STARTED to each connected player with their specific PlayerView
   */
  private async broadcastPlayerViews(adapter: PartyGameAdapter): Promise<void> {
    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      const lobbyPlayerId = conn.state?.playerId;
      if (!lobbyPlayerId) continue;

      const playerView = adapter.getPlayerView(lobbyPlayerId);
      if (!playerView) continue;

      conn.send(
        JSON.stringify({
          type: "GAME_STARTED",
          state: playerView,
        } satisfies ServerMessage)
      );
    }
  }

  /**
   * Broadcast GAME_STATE to each connected player with their specific PlayerView
   */
  private async broadcastGameState(): Promise<void> {
    const gameState = await this.getGameState();
    if (!gameState) return;

    const adapter = PartyGameAdapter.fromStoredState(gameState);

    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      const lobbyPlayerId = conn.state?.playerId;
      if (!lobbyPlayerId) continue;

      const playerView = adapter.getPlayerView(lobbyPlayerId);
      if (!playerView) continue;

      conn.send(
        JSON.stringify({
          type: "GAME_STATE",
          state: playerView,
        } satisfies ServerMessage)
      );
    }
  }

  /**
   * Broadcast MAY_I_PROMPT to the player being prompted
   */
  private async broadcastMayIPrompt(adapter: PartyGameAdapter): Promise<void> {
    const snapshot = adapter.getSnapshot();
    const mayIContext = snapshot.mayIContext;
    if (!mayIContext) return;

    // Find the connection for the player being prompted
    const promptedEngineId = mayIContext.playerBeingPrompted;
    if (!promptedEngineId) return;

    // Get caller info
    const callerMapping = adapter.getAllPlayerMappings().find(
      (m) => m.engineId === mayIContext.originalCaller
    );
    if (!callerMapping) return;

    const promptedMapping = adapter.getAllPlayerMappings().find(
      (m) => m.engineId === promptedEngineId
    );
    if (!promptedMapping) return;

    // Send prompt to the prompted player
    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      if (conn.state?.playerId === promptedMapping.lobbyId) {
        conn.send(
          JSON.stringify({
            type: "MAY_I_PROMPT",
            callerId: callerMapping.lobbyId,
            callerName: callerMapping.name,
            card: mayIContext.cardBeingClaimed,
          } satisfies ServerMessage)
        );
        break;
      }
    }
  }

  /**
   * Broadcast MAY_I_RESOLVED to all clients
   */
  private async broadcastMayIResolved(adapter: PartyGameAdapter): Promise<void> {
    // The May I has been resolved - we need to determine the outcome
    // If phase returned to ROUND_ACTIVE, the original caller got the card (if there was one)
    // Check who drew from discard last
    const snapshot = adapter.getSnapshot();

    // Find who claimed the card (if anyone)
    // We can infer this from the game state or track it during resolution
    // For now, we'll just broadcast that it was resolved
    this.broadcast(
      JSON.stringify({
        type: "MAY_I_RESOLVED",
        winnerId: null, // TODO: track the actual winner during resolution
        outcome: "resolved",
      } satisfies ServerMessage)
    );
  }

  /**
   * Broadcast AI_THINKING indicator to all clients
   */
  private broadcastAIThinking(playerId: string, playerName: string): void {
    this.broadcast(
      JSON.stringify({
        type: "AI_THINKING",
        playerId,
        playerName,
      } satisfies ServerMessage)
    );
  }

  /**
   * Broadcast AI_DONE indicator to all clients
   */
  private broadcastAIDone(playerId: string): void {
    this.broadcast(
      JSON.stringify({
        type: "AI_DONE",
        playerId,
      } satisfies ServerMessage)
    );
  }

  /**
   * Execute AI turns if it's an AI player's turn
   * Handles chained AI turns (multiple AIs in a row)
   */
  private async executeAITurnsIfNeeded(): Promise<void> {
    const MAX_CHAINED_TURNS = 8; // Safety limit to prevent infinite loops
    let turnsExecuted = 0;

    while (turnsExecuted < MAX_CHAINED_TURNS) {
      const gameState = await this.getGameState();
      if (!gameState) return;

      const adapter = PartyGameAdapter.fromStoredState(gameState);

      // Check if it's an AI player's turn
      const aiPlayer = isAIPlayerTurn(adapter);
      if (!aiPlayer) {
        // Not an AI's turn, exit the loop
        return;
      }

      // Broadcast AI_THINKING
      this.broadcastAIThinking(aiPlayer.lobbyId, aiPlayer.name);

      // Small delay to let clients see the thinking indicator
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Execute the AI turn
      const result = await executeAITurn({
        adapter,
        aiPlayerId: aiPlayer.lobbyId,
        modelId: aiPlayer.aiModelId ?? "grok-3-mini",
        playerName: aiPlayer.name,
        maxSteps: 10,
        debug: false,
        useFallbackOnError: true,
      });

      // Broadcast AI_DONE
      this.broadcastAIDone(aiPlayer.lobbyId);

      // Save updated state
      await this.setGameState(adapter.getStoredState());

      // Broadcast updated game state
      await this.broadcastGameState();

      turnsExecuted++;

      if (!result.success) {
        console.error(`[AI] Turn failed for ${aiPlayer.name}: ${result.error}`);
        // Continue to next iteration to check if it's still an AI's turn
        // (fallback should have completed the turn)
      }

      // Small delay between AI turns for better UX
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (turnsExecuted >= MAX_CHAINED_TURNS) {
      console.warn("[AI] Hit max chained turns limit");
    }
  }
}
