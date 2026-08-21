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
  handleJoinMessage,
  handleRemoveAIPlayerMessage,
  handleStartGameMessage,
  handleSetStartingRoundMessage,
  type GameActionDomainEvent,
  type RoomPhase,
} from "./mayi-room.message-handlers";
import { GameActionQueue } from "./game-action-queue";
import { submitQueuedGameAction } from "./queued-game-action";

import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
  type HumanPlayerInfo,
  type InjectStateMessage,
  type AgentSetupMessage,
} from "./protocol.types";
import type { GameAction } from "../../core/engine/game-action.command";

import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { AgentStoredStateV1 } from "./agent-harness.types";
import {
  AI_MODEL_DISPLAY_NAMES,
  DEFAULT_AI_MODEL_ID,
  DEFAULT_AI_PLAYER_NAME_PREFIX,
} from "./ai-models";

import {
  PartyGameAdapter,
  type StoredGameState,
} from "./party-game-adapter";

import type { RoundSummaryPayload } from "./round-summary.types";
import {
  projectGameEndedMessage,
  projectMayINotificationMessage,
  projectMayIPromptMessage,
  projectMayIResolvedMessage,
  projectPlayerViewMessages,
  projectRoundEndedMessage,
  type ProjectedServerMessage,
} from "./game-action-event.projection";

import {
  executeAITurn,
} from "./ai-turn-handler";
import { AITurnCoordinator } from "./ai-turn-coordinator";
import type { AIEnv } from "./ai-model-factory";
import type {
  AIActionResult,
  AIActionRuntime,
} from "../../ai/ai-action-runtime.types";
import type { OpenAIResponseLineage } from "../../ai/openai-response-lineage";

const DISCONNECT_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const LOBBY_STATE_KEY = "lobby:state";
const GAME_STATE_KEY = "game:state";
const ROOM_PHASE_KEY = "room:phase";
const AI_RESPONSE_LINEAGE_KEY_PREFIX = "ai:continuity:";

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

  /** Serializes game mutations so each action reads the latest stored state. */
  private gameActionQueue = new GameActionQueue();

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
      const aiEnv = this.env as AIEnv;
      const responseLineageStore = {
        get: (playerId: string) => this.getAIResponseLineage(playerId),
        set: (lineage: OpenAIResponseLineage) =>
          this.setAIResponseLineage(lineage),
        clear: (playerId: string) => this.clearAIResponseLineage(playerId),
      };

      this.aiCoordinator = new AITurnCoordinator({
        getState: () => this.getGameState(),
        executeAITurn: (options) =>
          executeAITurn({ ...options, responseLineageStore }),
        executeAIAction: (playerId, action) => this.executeAIAction(playerId, action),
        recordMetrics: (metrics) => this.log("AI turn metrics", metrics),
        env: aiEnv,
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
        await this.clearAllAIResponseLineages();
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

    // Ensure the requested default AI players exist.
    let nextLobbyState: LobbyState = updatedRoundState;
    const existingDefaultPlayers = nextLobbyState.aiPlayers.filter(
      (p) => p.modelId === msg.ai.modelId
    ).length;
    const desired = msg.ai.count;
    const toAdd = Math.max(0, desired - existingDefaultPlayers);

    for (let i = 0; i < toAdd; i++) {
      const index = existingDefaultPlayers + i + 1;
      const name = `${msg.ai.namePrefix ?? DEFAULT_AI_PLAYER_NAME_PREFIX}-${index}`;
      const newState = addAIPlayer(nextLobbyState, humanCount, name, msg.ai.modelId);
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

    const aiPlayers = stored.playerMappings.flatMap((mapping) => {
      const modelId = mapping.aiModelId;
      return mapping.isAI && modelId
        ? [{
            playerId: mapping.lobbyId,
            name: mapping.name,
            modelId,
            modelDisplayName: AI_MODEL_DISPLAY_NAMES[modelId],
          }]
        : [];
    });

    const lobbyState: LobbyState = {
      aiPlayers,
      startingRound: snapshot.currentRound,
    };

    await this.setLobbyState(lobbyState);
    await this.clearAllAIResponseLineages();
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

    const aiPlayers = state.players.flatMap((player) => {
      const modelId = player.aiModelId;
      return player.isAI && modelId
        ? [{
            playerId: player.id,
            name: player.name,
            modelId,
            modelDisplayName: AI_MODEL_DISPLAY_NAMES[modelId],
          }]
        : [];
    });

    const lobbyState: LobbyState = {
      aiPlayers,
      startingRound: state.roundNumber,
    };

    await this.setLobbyState(lobbyState);
    await this.clearAllAIResponseLineages();
    await this.setGameState(storedState);
    await this.setRoomPhase("playing");

    const adapter = PartyGameAdapter.fromStoredState(storedState);
    await this.broadcastPlayerViews(adapter);
    await this.executeAITurnsIfNeeded();

    this.log(`State injected for agent testing: round ${state.roundNumber}`);
  }

  private createAIActionRuntime(
    playerId: string,
    options: { skipAITurnsIfNeeded?: boolean } = {}
  ): AIActionRuntime {
    return {
      getSnapshot: async () => {
        const gameState = await this.getGameState();
        if (!gameState) {
          throw new Error("Game state not found");
        }
        return PartyGameAdapter.fromStoredState(gameState).getSnapshot();
      },
      executeAction: (action) => this.executeAIAction(playerId, action, options),
    };
  }

  private async executeAIAction(
    playerId: string,
    action: GameAction,
    options: { skipAITurnsIfNeeded?: boolean } = {}
  ): Promise<AIActionResult> {
    const result = await submitQueuedGameAction({
      queue: this.gameActionQueue,
      getRoomPhase: () => this.getRoomPhase(),
      callerPlayerId: playerId,
      action,
      getState: () => this.getGameState(),
      setState: (state) => this.setGameState(state),
    });

    if (!result.ok) {
      this.log(`AI action ${action.type} failed for ${playerId}: ${result.outboundMessages[0].error}`);
      const latestState = await this.getGameState();
      if (!latestState) {
        throw new Error(result.outboundMessages[0].message);
      }
      const snapshot = PartyGameAdapter.fromStoredState(latestState).getSnapshot();
      return {
        ok: false,
        snapshot: {
          ...snapshot,
          lastError: result.outboundMessages[0].error,
        },
        error: result.outboundMessages[0].error,
      };
    }

    await this.processGameActionSideEffects(result.sideEffects, {
      actionType: action.type,
      skipAITurnsIfNeeded: options.skipAITurnsIfNeeded ?? true,
    });

    return {
      ok: true,
      snapshot: result.snapshot,
    };
  }

  private async processGameActionSideEffects(
    sideEffects: GameActionDomainEvent[],
    options: {
      actionType: GameAction["type"];
      skipAITurnsIfNeeded?: boolean;
    }
  ): Promise<void> {
    const transitionEffect = sideEffects.find(
      (effect) => effect.type === "gameTransitionsDetected"
    );
    const mayIPhaseBefore =
      transitionEffect && transitionEffect.type === "gameTransitionsDetected"
        ? transitionEffect.phaseBefore
        : null;
    const mayIPhaseAfter =
      transitionEffect && transitionEffect.type === "gameTransitionsDetected"
        ? transitionEffect.adapter.getSnapshot().phase
        : null;
    if (transitionEffect && transitionEffect.type === "gameTransitionsDetected") {
      const snapshotAfter = transitionEffect.adapter.getSnapshot();
      const phaseAfter = snapshotAfter.phase;

      if (options.actionType === "CALL_MAY_I") {
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

    for (const effect of sideEffects) {
      if (effect.type === "gameStateCommitted") {
        await this.setGameState(effect.state);
      } else if (effect.type === "mayIPromptNeeded") {
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
      } else if (effect.type === "aiMayIResponseNeeded") {
        this.logMayI(`Checking if prompted player is AI...`);
        await this.executeAITurnsIfNeeded();
      } else if (effect.type === "mayIResolved") {
        const phaseAfter = effect.adapter.getSnapshot().phase;
        this.logMayI(`May-I resolved, new phase: ${phaseAfter}`);
        await this.broadcastMayIResolved(effect.adapter);
      } else if (effect.type === "gameTransitionsDetected") {
        await this.detectAndBroadcastTransitions(
          effect.adapter,
          effect.phaseBefore,
          effect.roundBefore,
          effect.snapshotBefore
        );
      } else if (effect.type === "playerViewsChanged") {
        await this.broadcastGameState();
      } else if (effect.type === "aiTurnEligible" && !options.skipAITurnsIfNeeded) {
        await this.executeAITurnsIfNeeded();
      }
    }
  }

  private async handleGameAction(
    conn: Connection<MayIRoomConnectionState>,
    msg: Extract<ClientMessage, { type: "GAME_ACTION" }>
  ) {
    const callerPlayerId = conn.state?.playerId ?? null;
    const roomPhaseBeforeQueue = await this.getRoomPhase();

    if (msg.action.type === "CALL_MAY_I" && roomPhaseBeforeQueue === "playing" && callerPlayerId) {
      const wasRunning = this.getAICoordinator().isRunning();
      this.logMayI(`CALL_MAY_I received from ${callerPlayerId}, AI turn running: ${wasRunning}`);
      this.getAICoordinator().abortCurrentTurn();
      this.logMayI(`AI turn aborted`);
    }

    const result = await submitQueuedGameAction({
      queue: this.gameActionQueue,
      getRoomPhase: () => this.getRoomPhase(),
      callerPlayerId,
      action: msg.action,
      getState: () => this.getGameState(),
      setState: (state) => this.setGameState(state),
    });

    if (!result.ok) {
      this.log(`Action ${msg.action.type} failed: ${result.outboundMessages[0].error}`);
      conn.send(JSON.stringify(result.outboundMessages[0]));
      return;
    }

    await this.processGameActionSideEffects(result.sideEffects, {
      actionType: msg.action.type,
    });
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

  private getAIResponseLineageKey(playerId: string): string {
    return `${AI_RESPONSE_LINEAGE_KEY_PREFIX}${playerId}`;
  }

  private async getAIResponseLineage(
    playerId: string,
  ): Promise<OpenAIResponseLineage | undefined> {
    return this.ctx.storage.get<OpenAIResponseLineage>(
      this.getAIResponseLineageKey(playerId),
    );
  }

  private async setAIResponseLineage(
    lineage: OpenAIResponseLineage,
  ): Promise<void> {
    await this.ctx.storage.put(
      this.getAIResponseLineageKey(lineage.playerId),
      lineage,
    );
  }

  private async clearAIResponseLineage(playerId: string): Promise<void> {
    await this.ctx.storage.delete(this.getAIResponseLineageKey(playerId));
  }

  private async clearAllAIResponseLineages(): Promise<void> {
    const entries = await this.ctx.storage.list<OpenAIResponseLineage>({
      prefix: AI_RESPONSE_LINEAGE_KEY_PREFIX,
    });
    const keys = Array.from(entries.keys());
    if (keys.length > 0) {
      await this.ctx.storage.delete(keys);
    }
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

  private connectedPlayerIds(): string[] {
    const playerIds: string[] = [];
    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      const playerId = conn.state?.playerId;
      if (playerId) {
        playerIds.push(playerId);
      }
    }
    return playerIds;
  }

  private sendProjectedMessage(projected: ProjectedServerMessage | null): void {
    if (!projected) return;

    const payload = JSON.stringify(projected.message satisfies ServerMessage);
    if (projected.recipient === "all") {
      this.broadcast(payload);
      return;
    }

    for (const conn of this.getConnections<MayIRoomConnectionState>()) {
      if (conn.state?.playerId === projected.recipient.playerId) {
        conn.send(payload);
        break;
      }
    }
  }

  /**
   * Broadcast GAME_STARTED to each connected player with their specific PlayerView
   */
  private async broadcastPlayerViews(adapter: PartyGameAdapter): Promise<void> {
    for (const projected of projectPlayerViewMessages({
      adapter,
      messageType: "GAME_STARTED",
      recipientPlayerIds: this.connectedPlayerIds(),
    })) {
      this.sendProjectedMessage(projected);
    }
  }

  /**
   * Broadcast GAME_STATE to each connected player with their specific PlayerView
   */
  private async broadcastGameState(): Promise<void> {
    const gameState = await this.getGameState();
    if (!gameState) return;

    const adapter = PartyGameAdapter.fromStoredState(gameState);
    for (const projected of projectPlayerViewMessages({
      adapter,
      messageType: "GAME_STATE",
      recipientPlayerIds: this.connectedPlayerIds(),
    })) {
      this.sendProjectedMessage(projected);
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
    this.sendProjectedMessage(
      projectRoundEndedMessage({
        adapter,
        completedRoundNumber,
        snapshotBefore,
      })
    );
  }

  /**
   * Broadcast GAME_ENDED to all clients
   */
  private async broadcastGameEnded(adapter: PartyGameAdapter): Promise<void> {
    this.sendProjectedMessage(projectGameEndedMessage(adapter));
  }

  /**
   * Broadcast MAY_I_PROMPT to the player being prompted
   */
  private async broadcastMayIPrompt(adapter: PartyGameAdapter): Promise<void> {
    this.sendProjectedMessage(projectMayIPromptMessage(adapter));
  }

  /**
   * Broadcast MAY_I_NOTIFICATION to ALL connected players
   *
   * This is separate from MAY_I_PROMPT (which only goes to the current player being asked).
   * MAY_I_NOTIFICATION lets all players see that someone has called May I in the table view.
   */
  private async broadcastMayINotification(adapter: PartyGameAdapter): Promise<void> {
    this.sendProjectedMessage(projectMayINotificationMessage(adapter));
  }

  /**
   * Broadcast MAY_I_RESOLVED to all clients
   */
  private async broadcastMayIResolved(_adapter: PartyGameAdapter): Promise<void> {
    this.sendProjectedMessage(projectMayIResolvedMessage());
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
   * - Tool actions through the serialized GameAction queue
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
    });
  }
}
