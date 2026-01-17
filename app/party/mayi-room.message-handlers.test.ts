import { describe, expect, it } from "bun:test";

import { createInitialLobbyState, MAX_PLAYERS } from "./mayi-room.lobby";
import {
  handleAddAIPlayerMessage,
  handleGameActionMessage,
  handleJoinMessage,
  handleRemoveAIPlayerMessage,
  handleStartGameMessage,
  handleSetStartingRoundMessage,
} from "./mayi-room.message-handlers";
import type { StoredPlayer } from "./mayi-room.presence";
import type {
  AIPlayerInfo,
  AddAIPlayerMessage,
  GameAction,
  HumanPlayerInfo,
  JoinMessage,
} from "./protocol.types";
import { AI_MODEL_DISPLAY_NAMES } from "./protocol.types";
import { PartyGameAdapter } from "./party-game-adapter";

describe("mayi-room.message-handlers", () => {
  const baseLobbyState = createInitialLobbyState();
  const baseHumanPlayers: HumanPlayerInfo[] = [];

  const buildJoin = (overrides: Partial<JoinMessage> = {}): JoinMessage => ({
    type: "JOIN",
    playerId: "player-1",
    playerName: "Alice",
    ...overrides,
  });

  it("rejects empty playerId after trimming", () => {
    const result = handleJoinMessage({
      message: buildJoin({ playerId: "   " }),
      state: {
        connectionId: "conn-1",
        now: 123,
        existingPlayer: null,
        humanPlayers: baseHumanPlayers,
        lobbyState: baseLobbyState,
        roomPhase: "lobby",
        gameState: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outboundMessages[0]).toEqual({
        type: "ERROR",
        error: "INVALID_MESSAGE",
        message: "Invalid playerId",
      });
    }
  });

  it("rejects empty playerName after trimming", () => {
    const result = handleJoinMessage({
      message: buildJoin({ playerName: "   " }),
      state: {
        connectionId: "conn-1",
        now: 123,
        existingPlayer: null,
        humanPlayers: baseHumanPlayers,
        lobbyState: baseLobbyState,
        roomPhase: "lobby",
        gameState: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outboundMessages[0]).toEqual({
        type: "ERROR",
        error: "INVALID_MESSAGE",
        message: "Invalid playerName",
      });
    }
  });

  it("rejects avatar collisions with existing humans", () => {
    const humanPlayers: HumanPlayerInfo[] = [
      {
        playerId: "h1",
        name: "Existing",
        avatarId: "ethel",
        isConnected: true,
        disconnectedAt: null,
      },
    ];

    const result = handleJoinMessage({
      message: buildJoin({ avatarId: "ethel" }),
      state: {
        connectionId: "conn-1",
        now: 123,
        existingPlayer: null,
        humanPlayers,
        lobbyState: baseLobbyState,
        roomPhase: "lobby",
        gameState: null,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outboundMessages[0]).toEqual({
        type: "ERROR",
        error: "AVATAR_TAKEN",
        message: "That character is already taken in this lobby",
      });
    }
  });

  it("returns state updates and messages for a valid join", () => {
    const now = 456;
    const result = handleJoinMessage({
      message: buildJoin({
        playerId: "  player-2 ",
        playerName: "  Bob  ",
        avatarId: "  curt ",
      }),
      state: {
        connectionId: "conn-2",
        now,
        existingPlayer: null,
        humanPlayers: baseHumanPlayers,
        lobbyState: baseLobbyState,
        roomPhase: "lobby",
        gameState: null,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextState.storedPlayerKey).toBe("player:player-2");
      expect(result.nextState.storedPlayer).toEqual({
        playerId: "player-2",
        name: "Bob",
        avatarId: "curt",
        joinedAt: now,
        lastSeenAt: now,
        isConnected: true,
        currentConnectionId: "conn-2",
        connectedAt: now,
        disconnectedAt: null,
      });
      expect(result.outboundMessages).toEqual([
        {
          type: "JOINED",
          playerId: "player-2",
          playerName: "Bob",
        },
      ]);
      expect(result.afterBroadcastMessages).toEqual([]);
      expect(result.sideEffects[0]).toEqual({
        type: "setConnectionState",
        state: { playerId: "player-2" },
      });
      expect(result.sideEffects[1]).toEqual({ type: "broadcastPlayersAndLobby" });
    }
  });

  it("returns GAME_STARTED when joining during an active game", () => {
    const now = 789;
    const humanPlayers: HumanPlayerInfo[] = [
      { playerId: "h1", name: "Alice", isConnected: true, disconnectedAt: null },
      { playerId: "h2", name: "Bob", isConnected: true, disconnectedAt: null },
      { playerId: "h3", name: "Cara", isConnected: true, disconnectedAt: null },
    ];
    const adapter = PartyGameAdapter.createFromLobby({
      roomId: "room-1",
      humanPlayers,
      aiPlayers: [],
      startingRound: 1,
    });

    const result = handleJoinMessage({
      message: buildJoin({
        playerId: "h2",
        playerName: "Bob",
      }),
      state: {
        connectionId: "conn-3",
        now,
        existingPlayer: null,
        humanPlayers,
        lobbyState: baseLobbyState,
        roomPhase: "playing",
        gameState: adapter.getStoredState(),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.afterBroadcastMessages[0]?.type).toBe("GAME_STARTED");
    }
  });

  describe("lobby action handlers", () => {
    const buildAddAI = (
      overrides: Partial<AddAIPlayerMessage> = {}
    ): AddAIPlayerMessage => ({
      type: "ADD_AI_PLAYER",
      name: "Grok",
      modelId: "default:grok",
      ...overrides,
    });

    it("rejects add AI when avatar is already taken", () => {
      const humanPlayers: HumanPlayerInfo[] = [
        {
          playerId: "h1",
          name: "Existing",
          avatarId: "ethel",
          isConnected: true,
          disconnectedAt: null,
        },
      ];

      const result = handleAddAIPlayerMessage({
        message: buildAddAI({ avatarId: "ethel" }),
        state: {
          lobbyState: baseLobbyState,
          humanPlayers,
          humanPlayerCount: humanPlayers.length,
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "AVATAR_TAKEN",
          message: "That character is already taken in this lobby",
        });
      }
    });

    it("rejects add AI when lobby is full", () => {
      const result = handleAddAIPlayerMessage({
        message: buildAddAI(),
        state: {
          lobbyState: baseLobbyState,
          humanPlayers: [],
          humanPlayerCount: MAX_PLAYERS,
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "MAX_PLAYERS",
          message: "Cannot add more players (max 8)",
        });
      }
    });

    it("returns lobby state updates on add AI success", () => {
      const result = handleAddAIPlayerMessage({
        message: buildAddAI({ name: "  Grok  ", avatarId: "bart" }),
        state: {
          lobbyState: baseLobbyState,
          humanPlayers: [],
          humanPlayerCount: 2,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.lobbyState.aiPlayers.length).toBe(1);
        expect(result.nextState.lobbyState.aiPlayers[0]?.name).toBe("Grok");
        expect(result.nextState.lobbyState.aiPlayers[0]?.avatarId).toBe("bart");
        expect(result.nextState.lobbyState.aiPlayers[0]?.modelDisplayName).toBe(
          AI_MODEL_DISPLAY_NAMES["default:grok"]
        );
        expect(result.outboundMessages).toEqual([]);
        expect(result.sideEffects[0]).toEqual({
          type: "setLobbyState",
          state: result.nextState.lobbyState,
        });
        expect(result.sideEffects[1]).toEqual({ type: "broadcastLobbyState" });
      }
    });

    it("rejects removing a missing AI player", () => {
      const result = handleRemoveAIPlayerMessage({
        message: { type: "REMOVE_AI_PLAYER", playerId: "missing-ai" },
        state: { lobbyState: baseLobbyState },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "PLAYER_NOT_FOUND",
          message: "AI player not found",
        });
      }
    });

    it("returns lobby state updates on remove AI success", () => {
      const lobbyState = {
        ...baseLobbyState,
        aiPlayers: [
          {
            playerId: "ai-1",
            name: "Grok",
            modelId: "default:grok",
            modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
          },
        ] satisfies AIPlayerInfo[],
      };

      const result = handleRemoveAIPlayerMessage({
        message: { type: "REMOVE_AI_PLAYER", playerId: "ai-1" },
        state: { lobbyState },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.lobbyState.aiPlayers).toEqual([]);
        expect(result.sideEffects[0]).toEqual({
          type: "setLobbyState",
          state: result.nextState.lobbyState,
        });
        expect(result.sideEffects[1]).toEqual({ type: "broadcastLobbyState" });
      }
    });

    it("rejects invalid starting rounds", () => {
      const result = handleSetStartingRoundMessage({
        message: { type: "SET_STARTING_ROUND", round: 7 },
        state: { lobbyState: baseLobbyState },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "INVALID_ROUND",
          message: "Invalid round number (must be 1-6)",
        });
      }
    });

    it("returns lobby state updates on valid starting round", () => {
      const result = handleSetStartingRoundMessage({
        message: { type: "SET_STARTING_ROUND", round: 3 },
        state: { lobbyState: baseLobbyState },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.lobbyState.startingRound).toBe(3);
        expect(result.sideEffects[0]).toEqual({
          type: "setLobbyState",
          state: result.nextState.lobbyState,
        });
        expect(result.sideEffects[1]).toEqual({ type: "broadcastLobbyState" });
      }
    });
  });

  describe("start game handler", () => {
    const buildStoredPlayer = (
      overrides: Partial<StoredPlayer> & { playerId: string; name: string }
    ): StoredPlayer => ({
      playerId: overrides.playerId,
      name: overrides.name,
      avatarId: overrides.avatarId,
      joinedAt: overrides.joinedAt ?? 1,
      lastSeenAt: overrides.lastSeenAt ?? 1,
      isConnected: overrides.isConnected ?? true,
      currentConnectionId: overrides.currentConnectionId ?? "conn-1",
      connectedAt: overrides.connectedAt ?? 1,
      disconnectedAt: overrides.disconnectedAt ?? null,
    });

    it("rejects starting a game when already playing", () => {
      const result = handleStartGameMessage({
        state: {
          roomId: "room-1",
          roomPhase: "playing",
          callerPlayerId: "h1",
          lobbyState: baseLobbyState,
          storedPlayers: [],
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "GAME_ALREADY_STARTED",
          message: "Game has already started",
        });
      }
    });

    it("rejects starting a game when caller has not joined", () => {
      const result = handleStartGameMessage({
        state: {
          roomId: "room-1",
          roomPhase: "lobby",
          callerPlayerId: null,
          lobbyState: baseLobbyState,
          storedPlayers: [],
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "NOT_JOINED",
          message: "You must join before starting the game",
        });
      }
    });

    it("rejects starting a game with invalid player count", () => {
      const storedPlayers = [
        buildStoredPlayer({ playerId: "h1", name: "Alice" }),
        buildStoredPlayer({ playerId: "h2", name: "Bob" }),
      ];

      const result = handleStartGameMessage({
        state: {
          roomId: "room-1",
          roomPhase: "lobby",
          callerPlayerId: "h1",
          lobbyState: baseLobbyState,
          storedPlayers,
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "INVALID_PLAYER_COUNT",
          message: "Need 3-8 players to start the game",
        });
      }
    });

    it("returns game state updates on valid start", () => {
      const storedPlayers = [
        buildStoredPlayer({ playerId: "h1", name: "Alice", avatarId: "ethel" }),
        buildStoredPlayer({ playerId: "h2", name: "Bob", avatarId: "curt" }),
      ];
      const lobbyState = {
        ...baseLobbyState,
        aiPlayers: [
          {
            playerId: "ai-1",
            name: "Grok",
            modelId: "default:grok",
            modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
          },
        ] satisfies AIPlayerInfo[],
      };

      const result = handleStartGameMessage({
        state: {
          roomId: "room-1",
          roomPhase: "lobby",
          callerPlayerId: "h1",
          lobbyState,
          storedPlayers,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.roomPhase).toBe("playing");
        expect(result.nextState.gameState.roomId).toBe("room-1");
        expect(result.nextState.gameState.playerMappings.length).toBe(3);
        expect(
          result.nextState.gameState.playerMappings.map((mapping) => mapping.lobbyId)
        ).toEqual(["h1", "h2", "ai-1"]);
        expect(
          result.nextState.gameState.playerMappings.find((mapping) => mapping.lobbyId === "ai-1")
            ?.isAI
        ).toBe(true);
        expect(result.sideEffects.map((effect) => effect.type)).toEqual([
          "setGameState",
          "setRoomPhase",
          "broadcastPlayerViews",
          "executeAITurnsIfNeeded",
        ]);
      }
    });
  });

  describe("game action handler", () => {
    const humanPlayers: HumanPlayerInfo[] = [
      { playerId: "h1", name: "Alice", isConnected: true, disconnectedAt: null },
      { playerId: "h2", name: "Bob", isConnected: true, disconnectedAt: null },
      { playerId: "h3", name: "Cara", isConnected: true, disconnectedAt: null },
    ];
    const mayIPlayers: HumanPlayerInfo[] = [
      { playerId: "h1", name: "Alice", isConnected: true, disconnectedAt: null },
      { playerId: "h2", name: "Bob", isConnected: true, disconnectedAt: null },
      { playerId: "h3", name: "Cara", isConnected: true, disconnectedAt: null },
      { playerId: "h4", name: "Dave", isConnected: true, disconnectedAt: null },
    ];

    const createGameStateWithAwaiting = () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "room-1",
        humanPlayers,
        aiPlayers: [],
        startingRound: 1,
      });
      const awaitingPlayerId = adapter.getAwaitingLobbyPlayerId();
      if (!awaitingPlayerId) {
        throw new Error("Expected an awaiting player");
      }
      return { gameState: adapter.getStoredState(), awaitingPlayerId };
    };

    const createMayIResolutionState = () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "room-1",
        humanPlayers: mayIPlayers,
        aiPlayers: [],
        startingRound: 1,
      });
      const awaiting = adapter.getAwaitingLobbyPlayerId();
      if (!awaiting) {
        throw new Error("Expected an awaiting player");
      }
      const callerLobbyId = "h4";
      adapter.callMayI(callerLobbyId);
      const snapshot = adapter.getSnapshot();
      const promptedEngineId = snapshot.mayIContext?.playerBeingPrompted;
      if (!promptedEngineId) {
        throw new Error("Expected a prompted player after CALL_MAY_I");
      }
      const promptedLobbyId = adapter.engineIdToLobbyId(promptedEngineId);
      if (!promptedLobbyId) {
        throw new Error("Expected a prompted lobby player");
      }
      return {
        gameState: adapter.getStoredState(),
        callerLobbyId,
        promptedLobbyId,
      };
    };

    it("rejects actions when game is not started", () => {
      const result = handleGameActionMessage({
        state: {
          roomPhase: "lobby",
          callerPlayerId: "h1",
          gameState: null,
          action: { type: "DRAW_FROM_STOCK" },
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "GAME_NOT_STARTED",
          message: "Game has not started yet",
        });
      }
    });

    it("rejects actions when caller has not joined", () => {
      const { gameState } = createGameStateWithAwaiting();
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: null,
          gameState,
          action: { type: "DRAW_FROM_STOCK" },
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "NOT_JOINED",
          message: "You must join before performing actions",
        });
      }
    });

    it("rejects actions when game state is missing", () => {
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: "h1",
          gameState: null,
          action: { type: "DRAW_FROM_STOCK" },
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "GAME_NOT_FOUND",
          message: "Game state not found",
        });
      }
    });

    it("returns action failures as errors", () => {
      const { gameState, awaitingPlayerId } = createGameStateWithAwaiting();
      const action: GameAction = { type: "DISCARD", cardId: "card-1" };
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: awaitingPlayerId,
          gameState,
          action,
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.outboundMessages[0]).toEqual({
          type: "ERROR",
          error: "INVALID_PHASE",
          message: "Action failed: INVALID_PHASE",
        });
      }
    });

    it("returns updated state and effects on success", () => {
      const { gameState, awaitingPlayerId } = createGameStateWithAwaiting();
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: awaitingPlayerId,
          gameState,
          action: { type: "DRAW_FROM_STOCK" },
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.gameState.roomId).toBe("room-1");
        expect(result.sideEffects.map((effect) => effect.type)).toEqual([
          "setGameState",
          "detectAndBroadcastTransitions",
          "broadcastGameState",
          "executeAITurnsIfNeeded",
        ]);
        const transitionEffect = result.sideEffects.find(
          (effect) => effect.type === "detectAndBroadcastTransitions"
        );
        if (transitionEffect && transitionEffect.type === "detectAndBroadcastTransitions") {
          expect(transitionEffect.roundBefore).toBe(1);
        }
      }
    });

    it("adds May-I prompt effects when CALL_MAY_I starts resolution", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "room-1",
        humanPlayers: mayIPlayers,
        aiPlayers: [],
        startingRound: 1,
      });
      const awaiting = adapter.getAwaitingLobbyPlayerId();
      if (!awaiting) {
        throw new Error("Expected an awaiting player");
      }
      const caller = "h4";
      if (caller === awaiting) {
        throw new Error("Expected caller to be different from awaiting player");
      }

      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: caller,
          gameState: adapter.getStoredState(),
          action: { type: "CALL_MAY_I" },
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const effectTypes = result.sideEffects.map((effect) => effect.type);
        expect(effectTypes).toContain("broadcastMayIPrompt");
        expect(effectTypes).toContain("executeAIMayIResponseIfNeeded");
      }
    });

    it("adds May-I prompt effects when resolution continues", () => {
      const { gameState, promptedLobbyId } = createMayIResolutionState();
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: promptedLobbyId,
          gameState,
          action: { type: "ALLOW_MAY_I" },
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const effectTypes = result.sideEffects.map((effect) => effect.type);
        expect(effectTypes).toContain("broadcastMayIPrompt");
        expect(effectTypes).toContain("executeAIMayIResponseIfNeeded");
      }
    });

    it("adds May-I resolved effect when resolution ends", () => {
      const { gameState, promptedLobbyId } = createMayIResolutionState();
      const result = handleGameActionMessage({
        state: {
          roomPhase: "playing",
          callerPlayerId: promptedLobbyId,
          gameState,
          action: { type: "CLAIM_MAY_I" },
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const effectTypes = result.sideEffects.map((effect) => effect.type);
        expect(effectTypes).toContain("broadcastMayIResolved");
      }
    });
  });
});
