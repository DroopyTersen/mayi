import { describe, it, expect } from "bun:test";

import {
  applyAddAIPlayerAction,
  applyRemoveAIPlayerAction,
  applySetStartingRoundAction,
} from "./mayi-room.lobby-actions";
import {
  createInitialLobbyState,
  MAX_PLAYERS,
} from "./mayi-room.lobby";
import { AI_MODEL_DISPLAY_NAMES } from "./protocol.types";
import type { AIPlayerInfo, HumanPlayerInfo } from "./protocol.types";

describe("mayi-room.lobby-actions", () => {
  const humanPlayers: HumanPlayerInfo[] = [
    { playerId: "h1", name: "Alice", avatarId: "ethel", isConnected: true, disconnectedAt: null },
    { playerId: "h2", name: "Bob", avatarId: "curt", isConnected: true, disconnectedAt: null },
  ];

  describe("applyAddAIPlayerAction", () => {
    it("returns AVATAR_TAKEN when avatar is already used", () => {
      const lobbyState = createInitialLobbyState();
      const result = applyAddAIPlayerAction({
        lobbyState,
        humanPlayers,
        humanPlayerCount: humanPlayers.length,
        message: {
          type: "ADD_AI_PLAYER",
          name: "Grok",
          avatarId: "ethel",
          modelId: "default:grok",
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe("AVATAR_TAKEN");
      }
    });

    it("returns MAX_PLAYERS when lobby is full", () => {
      const lobbyState = createInitialLobbyState();
      const fullHumanPlayers: HumanPlayerInfo[] = Array.from({ length: MAX_PLAYERS }, (_, index) => ({
        playerId: `h-${index}`,
        name: `Player ${index}`,
        isConnected: true,
        disconnectedAt: null,
      }));

      const result = applyAddAIPlayerAction({
        lobbyState,
        humanPlayers: fullHumanPlayers,
        humanPlayerCount: fullHumanPlayers.length,
        message: {
          type: "ADD_AI_PLAYER",
          name: "Grok",
          modelId: "default:grok",
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe("MAX_PLAYERS");
      }
    });

    it("adds AI player when valid", () => {
      const lobbyState = createInitialLobbyState();
      const result = applyAddAIPlayerAction({
        lobbyState,
        humanPlayers,
        humanPlayerCount: humanPlayers.length,
        message: {
          type: "ADD_AI_PLAYER",
          name: "  Grok  ",
          avatarId: "bart",
          modelId: "default:grok",
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lobbyState.aiPlayers.length).toBe(1);
        expect(result.lobbyState.aiPlayers[0]?.name).toBe("Grok");
        expect(result.lobbyState.aiPlayers[0]?.modelDisplayName).toBe(
          AI_MODEL_DISPLAY_NAMES["default:grok"]
        );
      }
    });
  });

  describe("applyRemoveAIPlayerAction", () => {
    it("returns PLAYER_NOT_FOUND when missing", () => {
      const lobbyState = createInitialLobbyState();
      const result = applyRemoveAIPlayerAction({
        lobbyState,
        message: { type: "REMOVE_AI_PLAYER", playerId: "missing-ai" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe("PLAYER_NOT_FOUND");
      }
    });

    it("removes AI player when present", () => {
      const lobbyState = {
        ...createInitialLobbyState(),
        aiPlayers: [
          {
            playerId: "ai-1",
            name: "Grok",
            modelId: "default:grok",
            modelDisplayName: AI_MODEL_DISPLAY_NAMES["default:grok"],
          },
        ] satisfies AIPlayerInfo[],
      };

      const result = applyRemoveAIPlayerAction({
        lobbyState,
        message: { type: "REMOVE_AI_PLAYER", playerId: "ai-1" },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lobbyState.aiPlayers).toEqual([]);
      }
    });
  });

  describe("applySetStartingRoundAction", () => {
    it("returns INVALID_ROUND for out-of-range values", () => {
      const lobbyState = createInitialLobbyState();
      const result = applySetStartingRoundAction({
        lobbyState,
        message: { type: "SET_STARTING_ROUND", round: 7 },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe("INVALID_ROUND");
      }
    });

    it("updates starting round when valid", () => {
      const lobbyState = createInitialLobbyState();
      const result = applySetStartingRoundAction({
        lobbyState,
        message: { type: "SET_STARTING_ROUND", round: 3 },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lobbyState.startingRound).toBe(3);
      }
    });
  });
});
