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

  describe("getAIPlayerMappings", () => {
    it("returns only AI player mappings", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const aiMappings = adapter.getAIPlayerMappings();
      expect(aiMappings).toHaveLength(1);
      expect(aiMappings[0]?.isAI).toBe(true);
      expect(aiMappings[0]?.name).toBe("ClaudeBot");
    });

    it("returns empty array when no AI players", () => {
      const threeHumans: HumanPlayerInfo[] = [
        { playerId: "h1", name: "P1", isConnected: true, disconnectedAt: null },
        { playerId: "h2", name: "P2", isConnected: true, disconnectedAt: null },
        { playerId: "h3", name: "P3", isConnected: true, disconnectedAt: null },
      ];

      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: threeHumans,
        aiPlayers: [],
        startingRound: 1,
      });

      const aiMappings = adapter.getAIPlayerMappings();
      expect(aiMappings).toHaveLength(0);
    });
  });

  describe("getPhase and getTurnPhase", () => {
    it("returns the current game phase", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const phase = adapter.getPhase();
      expect(phase).toBe("ROUND_ACTIVE");
    });

    it("returns the current turn phase", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const turnPhase = adapter.getTurnPhase();
      expect(turnPhase).toBe("AWAITING_DRAW");
    });
  });

  describe("additional commands", () => {
    it("executes drawFromDiscard with lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const snapshot = adapter.drawFromDiscard(awaitingId);

      // Drawing from discard should work (first card is face up)
      expect(snapshot).not.toBe(null);
      expect(snapshot?.hasDrawn).toBe(true);
    });

    it("returns null for drawFromDiscard with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.drawFromDiscard("unknown")).toBe(null);
    });

    it("executes skip with lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      adapter.drawFromStock(awaitingId);

      // After drawing, skip should work
      const snapshot = adapter.skip(awaitingId);
      expect(snapshot).not.toBe(null);
    });

    it("returns null for skip with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.skip("unknown")).toBe(null);
    });

    it("returns null for layDown with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.layDown("unknown", [])).toBe(null);
    });

    it("returns null for layOff with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.layOff("unknown", "card-1", "meld-1")).toBe(null);
    });

    it("returns null for swapJoker with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.swapJoker("unknown", "meld-1", "joker-1", "card-1")).toBe(null);
    });

    it("returns null for callMayI with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.callMayI("unknown")).toBe(null);
    });

    it("returns null for allowMayI with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.allowMayI("unknown")).toBe(null);
    });

    it("returns null for claimMayI with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.claimMayI("unknown")).toBe(null);
    });

    it("returns null for reorderHand with invalid player ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      expect(adapter.reorderHand("unknown", [])).toBe(null);
    });

    it("executes reorderHand with valid lobby ID", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const view = adapter.getPlayerView(awaitingId);
      const cardIds = view!.yourHand.map((c) => c.id);

      // Reverse the order
      const reversed = [...cardIds].reverse();
      const snapshot = adapter.reorderHand(awaitingId, reversed);

      expect(snapshot).not.toBe(null);
    });
  });

  describe("activity logging", () => {
    it("logs draw actions correctly", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const snapshotBefore = adapter.getSnapshot();
      const snapshotAfter = adapter.drawFromStock(awaitingId)!;

      // Log the draw
      adapter.logDraw(awaitingId, snapshotBefore, snapshotAfter, "stock");

      // Check the log - should have "Game started" filtered out, only draw remains
      const log = adapter.getRecentActivityLog(10);
      expect(log.length).toBeGreaterThanOrEqual(1);

      const drawEntry = log.find((e) => e.action.includes("drew from the draw pile"));
      expect(drawEntry).toBeDefined();
      expect(drawEntry!.playerId).toBe(awaitingId);
      // Stock draws should not reveal the card (it's face-down)
      expect(drawEntry!.details).toBeUndefined();
    });

    it("persists activity log across save/restore", () => {
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers,
        aiPlayers,
        startingRound: 1,
      });

      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const snapshotBefore = adapter.getSnapshot();
      const snapshotAfter = adapter.drawFromStock(awaitingId)!;
      adapter.logDraw(awaitingId, snapshotBefore, snapshotAfter, "stock");

      // Save and restore
      const stored = adapter.getStoredState();
      expect(stored.activityLog.length).toBeGreaterThan(0);

      const adapter2 = PartyGameAdapter.fromStoredState(stored);
      const log = adapter2.getRecentActivityLog(10);
      expect(log.length).toBeGreaterThanOrEqual(1);

      const drawEntry = log.find((e) => e.action.includes("drew from the draw pile"));
      expect(drawEntry).toBeDefined();
    });

    it("logs multiple actions and persists them", () => {
      const threeHumans: HumanPlayerInfo[] = [
        { playerId: "h1", name: "P1", isConnected: true, disconnectedAt: null },
        { playerId: "h2", name: "P2", isConnected: true, disconnectedAt: null },
        { playerId: "h3", name: "P3", isConnected: true, disconnectedAt: null },
      ];

      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: threeHumans,
        aiPlayers: [],
        startingRound: 1,
      });

      // First player draws
      const player1 = adapter.getAwaitingLobbyPlayerId()!;
      const before1 = adapter.getSnapshot();
      const after1 = adapter.drawFromStock(player1)!;
      adapter.logDraw(player1, before1, after1, "stock");

      // Skip, then discard
      const afterSkip = adapter.skip(player1)!;
      const player = afterSkip.players.find((p) => p.id === adapter.lobbyIdToEngineId(player1));
      const cardToDiscard = player!.hand[0]!;
      const beforeDiscard = afterSkip;
      const afterDiscard = adapter.discard(player1, cardToDiscard.id)!;
      adapter.logDiscard(player1, beforeDiscard, afterDiscard, cardToDiscard.id);

      // Check we have 2 interesting entries
      const log = adapter.getRecentActivityLog(10);
      expect(log.length).toBe(2);
      expect(log.some((e) => e.action.includes("drew"))).toBe(true);
      expect(log.some((e) => e.action.includes("discarded"))).toBe(true);

      // Save and restore
      const stored = adapter.getStoredState();
      const adapter2 = PartyGameAdapter.fromStoredState(stored);

      // Second player draws
      const player2 = adapter2.getAwaitingLobbyPlayerId()!;
      const before2 = adapter2.getSnapshot();
      const after2 = adapter2.drawFromStock(player2)!;
      adapter2.logDraw(player2, before2, after2, "stock");

      // Should now have 3 entries
      const log2 = adapter2.getRecentActivityLog(10);
      expect(log2.length).toBe(3);

      // Save and restore again
      const stored2 = adapter2.getStoredState();
      const adapter3 = PartyGameAdapter.fromStoredState(stored2);
      const log3 = adapter3.getRecentActivityLog(10);
      expect(log3.length).toBe(3);
    });
  });
});
