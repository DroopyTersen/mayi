import { describe, expect, it } from "bun:test";

import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_STARTING_ROUND,
  createInitialLobbyState,
  addAIPlayer,
  removeAIPlayer,
  setStartingRound,
  canStartGame,
  getTotalPlayerCount,
  buildLobbyStatePayload,
  storedPlayersToHumanPlayerInfo,
  buildPlayerNamesForGame,
  buildPlayerIdToNameMap,
  getAIPlayerByEngineId,
  isAIPlayer,
  isAvatarIdTaken,
} from "./mayi-room.lobby";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";
import { AI_MODEL_DISPLAY_NAMES } from "./protocol.types";
import type { StoredPlayer } from "./mayi-room.presence";

describe("mayi-room.lobby", () => {
  describe("createInitialLobbyState", () => {
    it("uses defaults with no AI players", () => {
      const state = createInitialLobbyState();

      expect(state.aiPlayers).toEqual([]);
      expect(state.startingRound).toBe(DEFAULT_STARTING_ROUND);
    });
  });

  describe("addAIPlayer", () => {
    it("returns null when adding would exceed max players", () => {
      const state = createInitialLobbyState();
      const result = addAIPlayer(state, MAX_PLAYERS, "Bot", "default:grok");

      expect(result).toBeNull();
    });

    it("adds a trimmed AI player with display name", () => {
      const state = createInitialLobbyState();
      const result = addAIPlayer(state, 2, "  Grok  ", "default:grok", "bot-avatar");

      expect(result).not.toBeNull();
      expect(result?.aiPlayers.length).toBe(1);
      expect(result?.aiPlayers[0]?.name).toBe("Grok");
      expect(result?.aiPlayers[0]?.modelId).toBe("default:grok");
      expect(result?.aiPlayers[0]?.modelDisplayName).toBe(
        AI_MODEL_DISPLAY_NAMES["default:grok"]
      );
      expect(result?.aiPlayers[0]?.avatarId).toBe("bot-avatar");
      expect(result?.aiPlayers[0]?.playerId.startsWith("ai-")).toBe(true);
    });
  });

  describe("removeAIPlayer", () => {
    it("returns null when playerId is not found", () => {
      const state = createInitialLobbyState();
      const result = removeAIPlayer(state, "missing-ai");

      expect(result).toBeNull();
    });

    it("removes a matching AI player", () => {
      const initial: AIPlayerInfo = {
        playerId: "ai-1",
        name: "Bot",
        modelId: "default:grok",
        modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
      };
      const state = { aiPlayers: [initial], startingRound: DEFAULT_STARTING_ROUND };
      const result = removeAIPlayer(state, "ai-1");

      expect(result).not.toBeNull();
      expect(result?.aiPlayers).toEqual([]);
    });
  });

  describe("setStartingRound", () => {
    it("returns null for invalid rounds", () => {
      const state = createInitialLobbyState();

      expect(setStartingRound(state, 0)).toBeNull();
      expect(setStartingRound(state, 7)).toBeNull();
      expect(setStartingRound(state, 1.5)).toBeNull();
    });

    it("accepts valid rounds", () => {
      const state = createInitialLobbyState();
      const result = setStartingRound(state, 3);

      expect(result?.startingRound).toBe(3);
    });
  });

  describe("canStartGame", () => {
    it("requires between min and max players", () => {
      expect(canStartGame(MIN_PLAYERS - 1, 0)).toBe(false);
      expect(canStartGame(MIN_PLAYERS, 0)).toBe(true);
      expect(canStartGame(MAX_PLAYERS, 0)).toBe(true);
      expect(canStartGame(MAX_PLAYERS + 1, 0)).toBe(false);
    });
  });

  describe("getTotalPlayerCount", () => {
    it("returns the sum of human and AI counts", () => {
      expect(getTotalPlayerCount(2, 1)).toBe(3);
    });
  });

  describe("buildLobbyStatePayload", () => {
    it("includes canStart based on total players", () => {
      const humans: HumanPlayerInfo[] = [
        { playerId: "h1", name: "A", isConnected: true, disconnectedAt: null },
        { playerId: "h2", name: "B", isConnected: true, disconnectedAt: null },
      ];
      const lobbyState = {
        aiPlayers: [
          {
            playerId: "ai-1",
            name: "Bot",
            modelId: "default:grok",
            modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
          },
        ],
        startingRound: 1,
      };

      const payload = buildLobbyStatePayload(humans, lobbyState);

      expect(payload.players).toBe(humans);
      expect(payload.aiPlayers).toBe(lobbyState.aiPlayers);
      expect(payload.startingRound).toBe(1);
      expect(payload.canStart).toBe(true);
    });
  });

  describe("storedPlayersToHumanPlayerInfo", () => {
    it("maps stored players into lobby payload shape", () => {
      const stored: StoredPlayer[] = [
        {
          playerId: "p1",
          name: "Alice",
          avatarId: "ethel",
          isConnected: true,
          disconnectedAt: null,
          socketIds: ["s1"],
        },
      ];

      const humans = storedPlayersToHumanPlayerInfo(stored);

      expect(humans).toEqual([
        {
          playerId: "p1",
          name: "Alice",
          avatarId: "ethel",
          isConnected: true,
          disconnectedAt: null,
        },
      ]);
    });
  });

  describe("buildPlayerNamesForGame", () => {
    it("orders human names before AI names", () => {
      const humans: HumanPlayerInfo[] = [
        { playerId: "h1", name: "Alice", isConnected: true, disconnectedAt: null },
        { playerId: "h2", name: "Bob", isConnected: true, disconnectedAt: null },
      ];
      const ai: AIPlayerInfo[] = [
        {
          playerId: "ai-1",
          name: "Grok",
          modelId: "default:grok",
          modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
        },
      ];

      expect(buildPlayerNamesForGame(humans, ai)).toEqual(["Alice", "Bob", "Grok"]);
    });
  });

  describe("buildPlayerIdToNameMap", () => {
    it("maps engine IDs to names in join order", () => {
      const humans: HumanPlayerInfo[] = [
        { playerId: "h1", name: "Alice", isConnected: true, disconnectedAt: null },
        { playerId: "h2", name: "Bob", isConnected: true, disconnectedAt: null },
      ];
      const ai: AIPlayerInfo[] = [
        {
          playerId: "ai-1",
          name: "Grok",
          modelId: "default:grok",
          modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
        },
      ];

      const map = buildPlayerIdToNameMap(humans, ai);

      expect(map.get("player-0")).toBe("Alice");
      expect(map.get("player-1")).toBe("Bob");
      expect(map.get("player-2")).toBe("Grok");
    });
  });

  describe("getAIPlayerByEngineId", () => {
    const ai: AIPlayerInfo[] = [
      {
        playerId: "ai-1",
        name: "Grok",
        modelId: "default:grok",
        modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
      },
    ];

    it("returns null for invalid engine IDs", () => {
      expect(getAIPlayerByEngineId("bad-id", 2, ai)).toBeNull();
    });

    it("returns null for human engine IDs", () => {
      expect(getAIPlayerByEngineId("player-1", 2, ai)).toBeNull();
    });

    it("returns AI info when index maps to AI player", () => {
      expect(getAIPlayerByEngineId("player-2", 2, ai)).toBe(ai[0]);
    });
  });

  describe("isAIPlayer", () => {
    it("identifies AI indices based on human count", () => {
      expect(isAIPlayer("player-0", 2, 1)).toBe(false);
      expect(isAIPlayer("player-1", 2, 1)).toBe(false);
      expect(isAIPlayer("player-2", 2, 1)).toBe(true);
      expect(isAIPlayer("player-3", 2, 1)).toBe(false);
    });
  });

  describe("isAvatarIdTaken", () => {
    const humans: HumanPlayerInfo[] = [
      { playerId: "p1", name: "Alice", avatarId: "ethel", isConnected: true, disconnectedAt: null },
      { playerId: "p2", name: "Bob", avatarId: "curt", isConnected: false, disconnectedAt: 123 },
      { playerId: "p3", name: "NoAvatar", isConnected: true, disconnectedAt: null },
    ];

    const aiPlayers: AIPlayerInfo[] = [
      { playerId: "ai-1", name: "Grok-1", avatarId: "bart", modelId: "default:grok", modelDisplayName: "Grok" },
    ];

    it("returns false for blank avatarId", () => {
      expect(isAvatarIdTaken("   ", { humanPlayers: humans, aiPlayers })).toBe(false);
    });

    it("detects avatars used by humans", () => {
      expect(isAvatarIdTaken("ethel", { humanPlayers: humans, aiPlayers })).toBe(true);
    });

    it("detects avatars used by AI players", () => {
      expect(isAvatarIdTaken("bart", { humanPlayers: humans, aiPlayers })).toBe(true);
    });

    it("excludes the specified human playerId (rejoin with same avatar)", () => {
      expect(
        isAvatarIdTaken("ethel", {
          humanPlayers: humans,
          aiPlayers,
          excludeHumanPlayerId: "p1",
        })
      ).toBe(false);
    });
  });
});
