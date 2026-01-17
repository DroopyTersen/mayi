import {
  Server,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";

import {
  buildPlayersSnapshotFromStorageEntries,
  maybeUpdateStoredPlayerOnClose,
  type StoredPlayer,
} from "./mayi-room.presence";

import {
  createInitialLobbyState,
  buildLobbyStatePayload,
  storedPlayersToHumanPlayerInfo,
  addAIPlayer,
  setStartingRound,
  type LobbyState,
} from "./mayi-room.lobby";
import {
  handleAddAIPlayerMessage,
  handleGameActionMessage,
  handleJoinMessage,
  handleRemoveAIPlayerMessage,
  handleStartGameMessage,
  handleSetStartingRoundMessage,
  type RoomPhase,
} from "./mayi-room.message-handlers";

import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
  type HumanPlayerInfo,
  type InjectStateMessage,
  type AgentSetupMessage,
  type MayINotificationMessage,
} from "./protocol.types";

import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { AgentStoredStateV1 } from "./agent-harness.types";
import { AI_MODEL_DISPLAY_NAMES } from "./ai-models";

import {
  PartyGameAdapter,
  type StoredGameState,
} from "./party-game-adapter";

import { captureRoundSummary } from "./round-summary.capture";
import type { RoundSummaryPayload } from "./round-summary.types";

import {
  executeAITurn,
  executeFallbackTurn,
  isAIPlayerTurn,
} from "./ai-turn-handler";
import { AITurnCoordinator } from "./ai-turn-coordinator";
import type { AIEnv } from "./ai-model-factory";

const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_PLAY_TIMEOUT_MS = 30 * 1000; // 30 seconds before auto-play for disconnected
const LOBBY_STATE_KEY = "lobby:state";
const GAME_STATE_KEY = "game:state";
const ROOM_PHASE_KEY = "room:phase";

type MayIRoomConnectionState = { playerId: string };

const AGENT_TESTING_ENABLED = import.meta.env.MODE !== "production";

function safeJsonParse(value: string): unknown {
  return JSON.parse(value) as unknown;
}

export class MayIRoom extends Server {
  // MVP: disable hibernation for simplicity + dev/prod parity.
  static override options = { hibernate: false };

  /** AI turn coordinator for abort support */
  private aiCoordinator: AITurnCoordinator | null = null;

  /** Debug logging with game ID prefix */
  private log(message: string, ...args: unknown[]): void {
    console.log(`[Game ${this.name}] ${message}`, ...args);
  }

  /** Debug logging for May-I specific events */
  private logMayI(message: string, ...args: unknown[]): void {
    console.log(`[Game ${this.name}] [May-I] ${message}`, ...args);
  }

  /** Get or create the AI turn coordinator */
  private getAICoordinator(): AITurnCoordinator {
    if (!this.aiCoordinator) {
      // Enable debug and tool delay for May-I testing
      // TODO: Make these configurable via environment variables
      const enableMayITestMode = true; // Set to true to slow down AI for May-I testing

      this.aiCoordinator = new AITurnCoordinator({
        getState: () => this.getGameState(),
        setState: (s) => this.setGameState(s),
        broadcast: () => this.broadcastGameState(),
        executeAITurn: (options) => executeAITurn(options),
        env: this.env as AIEnv,
        // Debug mode: shows whether LLM or fallback is used
        debug: enableMayITestMode,
        // Add 2 second delay after each tool execution to give time for May-I clicks
        // This is critical for testing - without it, AI turns complete too fast
        toolDelayMs: enableMayITestMode ? 2000 : 0,
      });
    }
    return this.aiCoordinator;
  }

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

      case "PING":
        // Respond immediately with PONG for heartbeat
        conn.send(JSON.stringify({ type: "PONG" } satisfies ServerMessage));
        break;

      case "AGENT_SETUP":
        await this.handleAgentSetup(conn, msg);
        break;

      case "INJECT_STATE":
        await this.handleInjectState(conn, msg);
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
    const now = Date.now();
    const trimmedPlayerId = msg.playerId.trim();
    const trimmedAvatarId = msg.avatarId?.trim();
    const needsAvatarCheck = typeof trimmedAvatarId === "string" && trimmedAvatarId.length > 0;
    const humanPlayers = needsAvatarCheck ? await this.readPlayersSnapshot() : [];
    const lobbyState = await this.getLobbyState();
    const roomPhase = await this.getRoomPhase();
    const gameState = roomPhase === "playing" ? await this.getGameState() : null;
    const existingKey = `player:${trimmedPlayerId}`;
    const existing = (await this.ctx.storage.get<StoredPlayer>(existingKey)) ?? null;

    const result = handleJoinMessage({
      message: msg,
      state: {
        connectionId: conn.id,
        now,
        existingPlayer: existing,
        humanPlayers,
        lobbyState,
        roomPhase,
        gameState,
      },
    });

    if (!result.ok) {
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    await this.ctx.storage.put(
      result.nextState.storedPlayerKey,
      result.nextState.storedPlayer
    );

    for (const effect of result.sideEffects) {
      if (effect.type === "setConnectionState") {
        conn.setState(effect.state);
      }
    }

    for (const message of result.outboundMessages) {
      conn.send(JSON.stringify(message));
    }

    const shouldBroadcast = result.sideEffects.some(
      (effect) => effect.type === "broadcastPlayersAndLobby"
    );
    if (shouldBroadcast) {
      await this.broadcastPlayersAndLobby();
    }

    for (const message of result.afterBroadcastMessages) {
      conn.send(JSON.stringify(message));
    }
  }

  private async handleAddAIPlayer(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "ADD_AI_PLAYER" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const storedPlayers = await this.getStoredPlayers();
    const humansSnapshot = await this.readPlayersSnapshot();

    const result = handleAddAIPlayerMessage({
      message: msg,
      state: {
        lobbyState,
        humanPlayers: humansSnapshot,
        humanPlayerCount: storedPlayers.length,
      },
    });

    if (!result.ok) {
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    for (const effect of result.sideEffects) {
      if (effect.type === "setLobbyState") {
        await this.setLobbyState(effect.state);
      } else if (effect.type === "broadcastLobbyState") {
        await this.broadcastLobbyState();
      }
    }
  }

  private async handleRemoveAIPlayer(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "REMOVE_AI_PLAYER" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const result = handleRemoveAIPlayerMessage({
      message: msg,
      state: { lobbyState },
    });

    if (!result.ok) {
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    for (const effect of result.sideEffects) {
      if (effect.type === "setLobbyState") {
        await this.setLobbyState(effect.state);
      } else if (effect.type === "broadcastLobbyState") {
        await this.broadcastLobbyState();
      }
    }
  }

  private async handleSetStartingRound(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "SET_STARTING_ROUND" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const result = handleSetStartingRoundMessage({
      message: msg,
      state: { lobbyState },
    });

    if (!result.ok) {
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    for (const effect of result.sideEffects) {
      if (effect.type === "setLobbyState") {
        await this.setLobbyState(effect.state);
      } else if (effect.type === "broadcastLobbyState") {
        await this.broadcastLobbyState();
      }
    }
  }

  private async handleStartGame(
    conn: Connection<MayIRoomConnectionState>
  ) {
    const roomPhase = await this.getRoomPhase();
    const lobbyState = await this.getLobbyState();
    const storedPlayers = await this.getStoredPlayers();

    const result = handleStartGameMessage({
      state: {
        roomId: this.name,
        roomPhase,
        callerPlayerId: conn.state?.playerId ?? null,
        lobbyState,
        storedPlayers,
      },
    });

    if (!result.ok) {
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    for (const effect of result.sideEffects) {
      if (effect.type === "setGameState") {
        await this.setGameState(effect.state);
      } else if (effect.type === "setRoomPhase") {
        await this.setRoomPhase(effect.phase);
      } else if (effect.type === "broadcastPlayerViews") {
        await this.broadcastPlayerViews(effect.adapter);
      } else if (effect.type === "executeAITurnsIfNeeded") {
        await this.executeAITurnsIfNeeded();
      }
    }
  }

  /**
   * Handle INJECT_STATE message for agent testing
   *
   * This creates a game with a specific state for E2E testing.
   * It bypasses normal game setup and directly injects the provided state.
   */
  private async handleInjectState(
    conn: Connection<MayIRoomConnectionState>,
    msg: InjectStateMessage
  ) {
    // Back-compat: route legacy INJECT_STATE through AGENT_SETUP (injectAgentTestState).
    const human = msg.state.players.find((p) => !p.isAI);
    if (!human) {
      conn.send(
        JSON.stringify({
          type: "ERROR",
          error: "INVALID_STATE",
          message: "Injected state must include exactly one human player",
        } satisfies ServerMessage)
      );
      return;
    }

    await this.handleAgentSetup(conn, {
      type: "AGENT_SETUP",
      requestId: "legacy",
      mode: "injectAgentTestState",
      human: { playerId: human.id, name: human.name },
      agentTestState: msg.state,
    });
  }

  private async handleAgentSetup(
    conn: Connection<MayIRoomConnectionState>,
    msg: AgentSetupMessage
  ) {
    if (!AGENT_TESTING_ENABLED) {
      conn.send(
        JSON.stringify({
          type: "AGENT_SETUP_RESULT",
          requestId: msg.requestId,
          status: "error",
          message: "Agent harness is disabled in production",
        } satisfies ServerMessage)
      );
      return;
    }

    // Ensure the caller is joined with the requested identity.
    await this.handleJoin(conn, {
      type: "JOIN",
      playerId: msg.human.playerId,
      playerName: msg.human.name,
    });

    const roomPhase = await this.getRoomPhase();
    if (roomPhase === "playing") {
      conn.send(
        JSON.stringify({
          type: "AGENT_SETUP_RESULT",
          requestId: msg.requestId,
          status: "already_setup",
        } satisfies ServerMessage)
      );
      return;
    }

    try {
      switch (msg.mode) {
        case "quickStart":
          await this.handleAgentQuickStart(conn, msg);
          break;
        case "injectStoredState":
          await this.handleAgentInjectStoredState(conn, msg.storedState);
          break;
        case "injectAgentTestState":
          await this.handleAgentInjectAgentTestState(conn, msg);
          break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      conn.send(
        JSON.stringify({
          type: "AGENT_SETUP_RESULT",
          requestId: msg.requestId,
          status: "error",
          message,
        } satisfies ServerMessage)
      );
      return;
    }

    conn.send(
      JSON.stringify({
        type: "AGENT_SETUP_RESULT",
        requestId: msg.requestId,
        status: "ok",
      } satisfies ServerMessage)
    );
  }

  private async handleAgentQuickStart(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<AgentSetupMessage, { mode: "quickStart" }>
  ) {
    const lobbyState = await this.getLobbyState();
    const storedPlayers = await this.getStoredPlayers();
    const humanCount = storedPlayers.length;

    // Starting round (defaults to 1)
    const startingRound = (msg.startingRound ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const updatedRoundState = setStartingRound(lobbyState, startingRound);
    if (!updatedRoundState) {
      throw new Error("Invalid starting round");
    }

    // Ensure 2 Grok AI players exist.
    let nextLobbyState: LobbyState = updatedRoundState;
    const existingGrok = nextLobbyState.aiPlayers.filter(
      (p) => p.modelId === "default:grok"
    ).length;
    const desired = msg.ai.count;
    const toAdd = Math.max(0, desired - existingGrok);

    for (let i = 0; i < toAdd; i++) {
      const index = existingGrok + i + 1;
      const name = `${msg.ai.namePrefix ?? "Grok"}-${index}`;
      const newState = addAIPlayer(nextLobbyState, humanCount, name, "default:grok");
      if (!newState) {
        throw new Error("Unable to add AI players (max players exceeded)");
      }
      nextLobbyState = newState;
    }

    await this.setLobbyState(nextLobbyState);
    await this.broadcastLobbyState();

    await this.handleStartGame(conn);
  }

  private async handleAgentInjectStoredState(
    conn: Connection<MayIRoomConnectionState>,
    stored: AgentStoredStateV1
  ) {
    // Basic consistency checks
    const humanMappings = stored.playerMappings.filter((m) => !m.isAI);
    if (humanMappings.length !== 1) {
      throw new Error(`Stored state must include exactly one human mapping; found ${humanMappings.length}`);
    }
    const aiMappings = stored.playerMappings.filter((m) => m.isAI);
    for (const mapping of aiMappings) {
      if (!mapping.aiModelId) {
        throw new Error(`AI mapping "${mapping.name}" must include aiModelId`);
      }
    }

    const now = new Date().toISOString();

    const storedState: StoredGameState = {
      engineSnapshot: stored.engineSnapshot,
      playerMappings: stored.playerMappings,
      roomId: this.name,
      createdAt: now,
      updatedAt: now,
      activityLog: [
        {
          id: "log-1",
          timestamp: now,
          roundNumber: 1,
          turnNumber: 1,
          playerId: "system",
          playerName: "System",
          action: "State injected for agent testing",
        },
      ],
    };

    // Validate snapshot can be hydrated
    const adapter = PartyGameAdapter.fromStoredState(storedState);
    const snapshot = adapter.getSnapshot();

    const aiPlayers = stored.playerMappings
      .filter((m) => m.isAI && m.aiModelId)
      .map((m) => ({
        playerId: m.lobbyId,
        name: m.name,
        modelId: m.aiModelId!,
        modelDisplayName: AI_MODEL_DISPLAY_NAMES[m.aiModelId!] ?? m.name,
      }));

    const lobbyState: LobbyState = {
      aiPlayers,
      startingRound: snapshot.currentRound,
    };

    await this.setLobbyState(lobbyState);
    await this.setGameState(storedState);
    await this.setRoomPhase("playing");

    await this.broadcastPlayerViews(adapter);
    await this.executeAITurnsIfNeeded();
  }

  private async handleAgentInjectAgentTestState(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<AgentSetupMessage, { mode: "injectAgentTestState" }>
  ) {
    const state = msg.agentTestState;
    const stateHuman = state.players.find((p) => !p.isAI);
    if (!stateHuman || stateHuman.id !== msg.human.playerId) {
      throw new Error("AGENT_SETUP.human.playerId must match the injected state's human player id");
    }

    const storedState = convertAgentTestStateToStoredState(state, this.name);

    const aiPlayers = state.players
      .filter((p) => p.isAI && p.aiModelId)
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        modelId: p.aiModelId!,
        modelDisplayName: AI_MODEL_DISPLAY_NAMES[p.aiModelId!] ?? p.name,
      }));

    const lobbyState: LobbyState = {
      aiPlayers,
      startingRound: state.roundNumber,
    };

    await this.setLobbyState(lobbyState);
    await this.setGameState(storedState);
    await this.setRoomPhase("playing");

    const adapter = PartyGameAdapter.fromStoredState(storedState);
    await this.broadcastPlayerViews(adapter);
    await this.executeAITurnsIfNeeded();

    this.log(`State injected for agent testing: round ${state.roundNumber}`);
  }

  private async handleGameAction(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "GAME_ACTION" }>
  ) {
    const roomPhase = await this.getRoomPhase();
    const callerPlayerId = conn.state?.playerId ?? null;
    const gameState = roomPhase === "playing" ? await this.getGameState() : null;

    if (msg.action.type === "CALL_MAY_I" && roomPhase === "playing" && callerPlayerId && gameState) {
      const wasRunning = this.getAICoordinator().isRunning();
      this.logMayI(`CALL_MAY_I received from ${callerPlayerId}, AI turn running: ${wasRunning}`);
      this.getAICoordinator().abortCurrentTurn();
      this.logMayI(`AI turn aborted`);
    }

    const result = handleGameActionMessage({
      state: {
        roomPhase,
        callerPlayerId,
        gameState,
        action: msg.action,
      },
    });

    if (!result.ok) {
      this.log(`Action ${msg.action.type} failed: ${result.outboundMessages[0].error}`);
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    const transitionEffect = result.sideEffects.find(
      (effect) => effect.type === "detectAndBroadcastTransitions"
    );
    const mayIPhaseBefore =
      transitionEffect && transitionEffect.type === "detectAndBroadcastTransitions"
        ? transitionEffect.phaseBefore
        : null;
    const mayIPhaseAfter =
      transitionEffect && transitionEffect.type === "detectAndBroadcastTransitions"
        ? transitionEffect.adapter.getSnapshot().phase
        : null;
    if (transitionEffect && transitionEffect.type === "detectAndBroadcastTransitions") {
      const snapshotAfter = transitionEffect.adapter.getSnapshot();
      const phaseAfter = snapshotAfter.phase;

      if (msg.action.type === "CALL_MAY_I") {
        this.logMayI(`Phase transition: ${transitionEffect.phaseBefore} -> ${phaseAfter}`);
        if (snapshotAfter.mayIContext) {
          this.logMayI(
            `May-I context: caller=${snapshotAfter.mayIContext.originalCaller}, prompted=${snapshotAfter.mayIContext.playerBeingPrompted}, card=${JSON.stringify(snapshotAfter.mayIContext.cardBeingClaimed)}`
          );
        } else {
          this.logMayI(`WARNING: No May-I context after CALL_MAY_I!`);
        }
      }
    }

    for (const effect of result.sideEffects) {
      if (effect.type === "setGameState") {
        await this.setGameState(effect.state);
      } else if (effect.type === "broadcastMayIPrompt") {
        if (
          mayIPhaseBefore === "RESOLVING_MAY_I" &&
          mayIPhaseAfter === "RESOLVING_MAY_I"
        ) {
          this.logMayI(`Still in RESOLVING_MAY_I, prompting next player...`);
        } else {
          this.logMayI(`Entering RESOLVING_MAY_I phase, broadcasting prompt...`);
          // Notify ALL players when someone first calls May I
          await this.broadcastMayINotification(effect.adapter);
        }
        await this.broadcastMayIPrompt(effect.adapter);
      } else if (effect.type === "executeAIMayIResponseIfNeeded") {
        this.logMayI(`Checking if prompted player is AI...`);
        await this.executeAIMayIResponseIfNeeded(effect.adapter);
      } else if (effect.type === "broadcastMayIResolved") {
        const phaseAfter = effect.adapter.getSnapshot().phase;
        this.logMayI(`May-I resolved, new phase: ${phaseAfter}`);
        await this.broadcastMayIResolved(effect.adapter);
      } else if (effect.type === "detectAndBroadcastTransitions") {
        await this.detectAndBroadcastTransitions(
          effect.adapter,
          effect.phaseBefore,
          effect.roundBefore,
          effect.snapshotBefore
        );
      } else if (effect.type === "broadcastGameState") {
        await this.broadcastGameState();
      } else if (effect.type === "executeAITurnsIfNeeded") {
        await this.executeAITurnsIfNeeded();
      }
    }
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
    const activityLog = adapter.getRecentActivityLog(10);

    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      const lobbyPlayerId = conn.state?.playerId;
      if (!lobbyPlayerId) continue;

      const playerView = adapter.getPlayerView(lobbyPlayerId);
      if (!playerView) continue;

      conn.send(
        JSON.stringify({
          type: "GAME_STARTED",
          state: playerView,
          activityLog,
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
    const activityLog = adapter.getRecentActivityLog(10);

    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      const lobbyPlayerId = conn.state?.playerId;
      if (!lobbyPlayerId) continue;

      const playerView = adapter.getPlayerView(lobbyPlayerId);
      if (!playerView) continue;

      conn.send(
        JSON.stringify({
          type: "GAME_STATE",
          state: playerView,
          activityLog,
        } satisfies ServerMessage)
      );
    }
  }

  /**
   * Detect and broadcast round/game end transitions
   *
   * Compares game state before/after an action and broadcasts:
   * - ROUND_ENDED if a round completed (either new round started OR game ended)
   * - GAME_ENDED if the game ended
   *
   * This handles the edge case where round 6 ends and the game ends -
   * in that case, currentRound doesn't increment but we still need to
   * show the round summary before the game end screen.
   */
  private async detectAndBroadcastTransitions(
    adapter: PartyGameAdapter,
    phaseBefore: string,
    roundBefore: number,
    snapshotBefore: import("../../core/engine/game-engine.types").GameSnapshot
  ): Promise<void> {
    const snapshot = adapter.getSnapshot();
    const phaseAfter = snapshot.phase;
    const roundAfter = snapshot.currentRound;

    // Detect round completion
    if (roundAfter > roundBefore) {
      // Normal case: round completed and new round started
      await this.broadcastRoundEnded(adapter, roundBefore, snapshotBefore);
    } else if (phaseAfter === "GAME_END" && phaseBefore === "ROUND_ACTIVE") {
      // Edge case: final round ended, game ended (round number doesn't increment)
      // Still need to broadcast round end for the final round before game end
      await this.broadcastRoundEnded(adapter, roundBefore, snapshotBefore);
    }

    // Detect game end
    if (phaseAfter === "GAME_END" && phaseBefore !== "GAME_END") {
      await this.broadcastGameEnded(adapter);
    }
  }

  /**
   * Broadcast ROUND_ENDED to all clients
   *
   * Uses snapshotBefore (captured BEFORE the round transition) to get accurate
   * hand contents - after transition, hands have been dealt for the new round.
   */
  private async broadcastRoundEnded(
    adapter: PartyGameAdapter,
    completedRoundNumber: number,
    snapshotBefore: import("../../core/engine/game-engine.types").GameSnapshot
  ): Promise<void> {
    // Capture round summary from the snapshot BEFORE round transition
    // This ensures we have the actual hands at round end, not new dealt cards
    const summary = captureRoundSummary(snapshotBefore, adapter.getAllPlayerMappings());

    // Use current snapshot for updated scores (after points were added)
    const snapshotAfter = adapter.getSnapshot();
    const scores: Record<string, number> = {};
    for (const mapping of adapter.getAllPlayerMappings()) {
      const player = snapshotAfter.players.find((p) => p.id === mapping.engineId);
      if (player) {
        scores[mapping.lobbyId] = player.totalScore;
      }
    }

    // Include player names map for UI display
    const playerNames = adapter.getPlayerNamesMap();

    this.broadcast(
      JSON.stringify({
        type: "ROUND_ENDED",
        roundNumber: completedRoundNumber,
        scores,
        playerNames,
        summary,
      } satisfies ServerMessage)
    );
  }

  /**
   * Broadcast GAME_ENDED to all clients
   */
  private async broadcastGameEnded(adapter: PartyGameAdapter): Promise<void> {
    const snapshot = adapter.getSnapshot();

    // Build final scores map and find winner (lowest score wins)
    const finalScores: Record<string, number> = {};
    let winnerId = "";
    let lowestScore = Infinity;

    for (const mapping of adapter.getAllPlayerMappings()) {
      const player = snapshot.players.find((p) => p.id === mapping.engineId);
      if (player) {
        finalScores[mapping.lobbyId] = player.totalScore;
        if (player.totalScore < lowestScore) {
          lowestScore = player.totalScore;
          winnerId = mapping.lobbyId;
        }
      }
    }

    // Include player names map for UI display
    const playerNames = adapter.getPlayerNamesMap();

    this.broadcast(
      JSON.stringify({
        type: "GAME_ENDED",
        finalScores,
        winnerId,
        playerNames,
      } satisfies ServerMessage)
    );
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
   * Broadcast MAY_I_NOTIFICATION to ALL connected players
   *
   * This is separate from MAY_I_PROMPT (which only goes to the current player being asked).
   * MAY_I_NOTIFICATION lets all players see that someone has called May I in the table view.
   */
  private async broadcastMayINotification(adapter: PartyGameAdapter): Promise<void> {
    const snapshot = adapter.getSnapshot();
    const mayIContext = snapshot.mayIContext;
    if (!mayIContext) return;

    // Get caller info
    const callerMapping = adapter.getAllPlayerMappings().find(
      (m) => m.engineId === mayIContext.originalCaller
    );
    if (!callerMapping) return;

    const message: MayINotificationMessage = {
      type: "MAY_I_NOTIFICATION",
      callerId: callerMapping.lobbyId,
      callerName: callerMapping.name,
      card: mayIContext.cardBeingClaimed,
    };

    // Broadcast to ALL connected players
    this.broadcast(JSON.stringify(message satisfies ServerMessage));
  }

  /**
   * Execute AI response if the player being prompted for May-I is an AI
   *
   * When May-I is called and we're prompting players in turn order,
   * if the prompted player is an AI, we need to execute their turn
   * so they can respond (allowMayI or claimMayI).
   */
  private async executeAIMayIResponseIfNeeded(adapter: PartyGameAdapter): Promise<void> {
    const snapshot = adapter.getSnapshot();
    const mayIContext = snapshot.mayIContext;
    if (!mayIContext) {
      this.logMayI(`executeAIMayIResponseIfNeeded: No May-I context, skipping`);
      return;
    }

    const promptedEngineId = mayIContext.playerBeingPrompted;
    if (!promptedEngineId) {
      this.logMayI(`executeAIMayIResponseIfNeeded: No player being prompted, skipping`);
      return;
    }

    // Find the prompted player's mapping
    const promptedMapping = adapter.getAllPlayerMappings().find(
      (m) => m.engineId === promptedEngineId
    );
    if (!promptedMapping?.isAI) {
      this.logMayI(`executeAIMayIResponseIfNeeded: Prompted player ${promptedMapping?.name || promptedEngineId} is human, waiting for their response`);
      return;
    }

    this.logMayI(`AI ${promptedMapping.name} (${promptedMapping.lobbyId}) being prompted for May-I response`);

    // It's an AI's turn to respond to May-I
    this.broadcastAIThinking(promptedMapping.lobbyId, promptedMapping.name);

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const modelToUse = promptedMapping.aiModelId ?? "default:grok";
    this.logMayI(`Executing AI May-I response with model ${modelToUse}`);

    try {
      // Execute AI turn - the AI will use allowMayI or claimMayI tools
      // Note: May-I responses are short and don't need abort support
      // (they happen after the main turn was already aborted)
      const result = await executeAITurn({
        adapter,
        aiPlayerId: promptedMapping.lobbyId,
        modelId: modelToUse,
        env: this.env as AIEnv,
        playerName: promptedMapping.name,
        maxSteps: 5, // May-I response is simple - allow or claim
        debug: true, // Enable debug for May-I responses
        useFallbackOnError: true, // Use fallback if AI fails - auto-allow
        onPersist: async () => {
          await this.setGameState(adapter.getStoredState());
          await this.broadcastGameState();
        },
      });

      this.broadcastAIDone(promptedMapping.lobbyId);
      this.logMayI(`AI May-I response result: success=${result.success}, actions=${result.actions.join(", ")}, error=${result.error || "none"}`);

      if (result.success) {
        // Save state after AI response
        await this.setGameState(adapter.getStoredState());

        // Check new phase
        const newSnapshot = adapter.getSnapshot();
        const newPhase = newSnapshot.phase;
        this.logMayI(`After AI May-I response, phase is: ${newPhase}`);

        if (newPhase === "RESOLVING_MAY_I") {
          // Still resolving - prompt next player (may trigger another AI)
          this.logMayI(`Still resolving, prompting next player...`);
          await this.broadcastMayIPrompt(adapter);
          await this.executeAIMayIResponseIfNeeded(adapter);
        } else if (newPhase === "ROUND_ACTIVE") {
          // May-I resolved - broadcast and continue with turns
          this.logMayI(`May-I fully resolved, continuing game`);
          await this.broadcastMayIResolved(adapter);
          await this.broadcastGameState();
          // Continue with AI turns if needed
          await this.executeAITurnsIfNeeded();
        } else {
          this.logMayI(`Unexpected phase after May-I response: ${newPhase}`);
        }
      } else {
        this.logMayI(`AI May-I response FAILED for ${promptedMapping.name}: ${result.error}`);
        console.error(`[AI] May-I response failed for ${promptedMapping.name}: ${result.error}`);
        // AI failed to respond - human will need to handle via timeout or retry
      }
    } catch (error) {
      this.broadcastAIDone(promptedMapping.lobbyId);
      this.logMayI(`AI May-I response ERROR for ${promptedMapping.name}: ${error}`);
      console.error(`[AI] May-I response error for ${promptedMapping.name}:`, error);
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
   *
   * Delegates to AITurnCoordinator which handles:
   * - AbortController lifecycle for interrupting AI turns (e.g., when May-I is called)
   * - Immediate state persistence via onPersist callbacks
   * - Chained AI turns with safety limits
   */
  private async executeAITurnsIfNeeded(): Promise<void> {
    await this.getAICoordinator().executeAITurnsIfNeeded({
      onAIThinking: (playerId, playerName) => {
        this.broadcastAIThinking(playerId, playerName);
      },
      onAIDone: (playerId) => {
        this.broadcastAIDone(playerId);
      },
      onTransitionCheck: async (adapter, phaseBefore, roundBefore, snapshotBefore) => {
        await this.detectAndBroadcastTransitions(adapter, phaseBefore, roundBefore, snapshotBefore);
      },
    });
  }

  /**
   * Check if a disconnected human player needs auto-play and execute it
   *
   * This is called after AI turns to handle the case where a human player
   * has been disconnected for more than AUTO_PLAY_TIMEOUT_MS.
   */
  private async executeAutoPlayIfNeeded(): Promise<boolean> {
    const gameState = await this.getGameState();
    if (!gameState) return false;

    const adapter = PartyGameAdapter.fromStoredState(gameState);
    const awaitingId = adapter.getAwaitingLobbyPlayerId();
    if (!awaitingId) return false;

    // Check if it's an AI player's turn (AI is handled separately)
    const aiPlayer = isAIPlayerTurn(adapter);
    if (aiPlayer) return false;

    // Check if the player is a human
    const mapping = adapter.getPlayerMapping(awaitingId);
    if (!mapping || mapping.isAI) return false;

    // Check if the player is disconnected
    const storedPlayer = await this.ctx.storage.get<StoredPlayer>(`player:${awaitingId}`);
    if (!storedPlayer || !storedPlayer.disconnectedAt) return false;

    // Check if they've been disconnected long enough
    const now = Date.now();
    const disconnectedDuration = now - storedPlayer.disconnectedAt;
    if (disconnectedDuration < AUTO_PLAY_TIMEOUT_MS) return false;

    // Execute auto-play for the disconnected player
    console.log(
      `[Auto-play] Executing fallback for disconnected player ${mapping.name} (${awaitingId})`
    );

    const result = await executeFallbackTurn(adapter, awaitingId);

    if (result.success) {
      // Save updated state
      await this.setGameState(adapter.getStoredState());
      // Broadcast updated game state
      await this.broadcastGameState();
    }

    return result.success;
  }
}
