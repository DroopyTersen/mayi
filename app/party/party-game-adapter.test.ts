import { describe, it, expect } from "bun:test";
import { PartyGameAdapter } from "./party-game-adapter";
import type { HumanPlayerInfo, AIPlayerInfo } from "./protocol.types";

describe("PartyGameAdapter", () => {
  const humanPlayers: HumanPlayerInfo[] = [
    { playerId: "human-1", name: "Alice", isConnected: true, disconnectedAt: null },
    { playerId: "human-2", name: "Bob", isConnected: true, disconnectedAt: null },
  ];

  const aiPlayers: AIPlayerInfo[] = [
    {
      playerId: "ai-abc123",
      name: "ClaudeBot",
      modelId: "anthropic:claude-haiku-4-5",
      modelDisplayName: "Claude",
    },
  ];

  describe("createFromLobby", () => {
    it("creates a game with human and AI players", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const snapshot = adapter.getSnapshot();
      expect(snapshot.gameId).toBe("test-room");
      expect(snapshot.players).toHaveLength(3);
      expect(snapshot.players[0]?.name).toBe("Alice");
      expect(snapshot.players[1]?.name).toBe("Bob");
      expect(snapshot.players[2]?.name).toBe("ClaudeBot");
    });

    it("creates correct player mappings", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const mappings = adapter.getAllPlayerMappings();
      expect(mappings).toHaveLength(3);

      // Human players
      expect(mappings[0]).toEqual({
        lobbyId: "human-1",
        engineId: "player-0",
        name: "Alice",
        isAI: false,
      });
      expect(mappings[1]).toEqual({
        lobbyId: "human-2",
        engineId: "player-1",
        name: "Bob",
        isAI: false,
      });

      // AI player
      expect(mappings[2]).toEqual({
        lobbyId: "ai-abc123",
        engineId: "player-2",
        name: "ClaudeBot",
        isAI: true,
        aiModelId: "anthropic:claude-haiku-4-5",
      });
    });

    it("throws if not enough players", () => {
      expect(() =>
        PartyGameAdapter.createFromLobby({
          roomId: "test-room",
          humanPlayers: [humanPlayers[0]!],
          aiPlayers: [],
          startingRound: 1,
        })
      ).toThrow("Game requires 3-8 players");
    });
  });

  describe("ID translation", () => {
    it("translates lobby ID to engine ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.lobbyIdToEngineId("human-1")).toBe("player-0");
      expect(adapter.lobbyIdToEngineId("human-2")).toBe("player-1");
      expect(adapter.lobbyIdToEngineId("ai-abc123")).toBe("player-2");
      expect(adapter.lobbyIdToEngineId("unknown")).toBe(null);
    });

    it("translates engine ID to lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.engineIdToLobbyId("player-0")).toBe("human-1");
      expect(adapter.engineIdToLobbyId("player-1")).toBe("human-2");
      expect(adapter.engineIdToLobbyId("player-2")).toBe("ai-abc123");
      expect(adapter.engineIdToLobbyId("player-99")).toBe(null);
    });

    it("identifies AI players", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.isAIPlayer("human-1")).toBe(false);
      expect(adapter.isAIPlayer("human-2")).toBe(false);
      expect(adapter.isAIPlayer("ai-abc123")).toBe(true);
    });
  });

  describe("getPlayerView", () => {
    it("returns player view for valid lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const view = adapter.getPlayerView("human-1");
      expect(view).not.toBe(null);
      expect(view?.viewingPlayerId).toBe("player-0");
      expect(view?.yourHand).toHaveLength(11); // Starting hand
      expect(view?.opponents).toHaveLength(2);
    });

    it("returns null for invalid lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.getPlayerView("unknown")).toBe(null);
    });
  });

  describe("serialization", () => {
    it("serializes and restores game state", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const storedState = adapter.getStoredState();
      expect(storedState.roomId).toBe("test-room");
      expect(storedState.playerMappings).toHaveLength(3);
      expect(storedState.engineSnapshot).toContain("player-0");

      // Restore
      const restored = PartyGameAdapter.fromStoredState(storedState);
      const restoredSnapshot = restored.getSnapshot();

      expect(restoredSnapshot.gameId).toBe("test-room");
      expect(restoredSnapshot.players).toHaveLength(3);
      expect(restored.lobbyIdToEngineId("human-1")).toBe("player-0");
    });
  });

  describe("commands", () => {
    it("executes draw from stock with lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      // First player's turn - draw from stock
      const awaitingId = adapter.getAwaitingLobbyPlayerId();
      const snapshot = adapter.drawFromStock(awaitingId!);

      expect(snapshot).not.toBe(null);
      expect(snapshot?.hasDrawn).toBe(true);
    });

    it("returns null for invalid player ID in commands", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.drawFromStock("unknown")).toBe(null);
      expect(adapter.discard("unknown", "some-card")).toBe(null);
    });
  });

  describe("getAwaitingLobbyPlayerId", () => {
    it("returns the lobby ID of the current player", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId();
      // Should be one of the players
      expect(awaitingId).not.toBe(null);
      expect(["human-1", "human-2", "ai-abc123"]).toContain(awaitingId!);
    });
  });
});
