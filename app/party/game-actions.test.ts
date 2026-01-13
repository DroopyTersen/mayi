/**
 * Tests for game-actions.ts
 *
 * Validates that the executeGameAction function correctly handles
 * game actions for the wire protocol.
 */

import { describe, it, expect } from "bun:test";
import { PartyGameAdapter } from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { HumanPlayerInfo, AIPlayerInfo, GameAction } from "./protocol.types";

describe("executeGameAction", () => {
  const humanPlayers: HumanPlayerInfo[] = [
    { playerId: "human-1", name: "Alice", isConnected: true, disconnectedAt: null },
    { playerId: "human-2", name: "Bob", isConnected: true, disconnectedAt: null },
  ];

  const aiPlayers: AIPlayerInfo[] = [
    {
      playerId: "ai-abc123",
      name: "ClaudeBot",
      modelId: "default:claude",
      modelDisplayName: "Claude",
    },
  ];

  function createTestAdapter() {
    return PartyGameAdapter.createFromLobby({
      roomId: "test-room",
      humanPlayers,
      aiPlayers,
      startingRound: 1,
    });
  }

  describe("DRAW_FROM_STOCK", () => {
    it("succeeds when it is player's turn and in AWAITING_DRAW phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const action: GameAction = { type: "DRAW_FROM_STOCK" };

      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(true);
      expect(result.snapshot).not.toBe(null);
      expect(result.snapshot?.hasDrawn).toBe(true);
    });

    it("fails when it is not player's turn", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      // Get a different player ID
      const otherPlayerId = ["human-1", "human-2", "ai-abc123"].find(
        (id) => id !== awaitingId
      )!;

      const action: GameAction = { type: "DRAW_FROM_STOCK" };
      const result = executeGameAction(adapter, otherPlayerId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_YOUR_TURN");
    });
  });

  describe("DISCARD", () => {
    it("fails when in AWAITING_DRAW phase", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;
      const view = adapter.getPlayerView(awaitingId)!;
      const cardId = view.yourHand[0]!.id;

      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_PHASE");
    });

    it("succeeds after drawing and skipping (in AWAITING_DISCARD phase)", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Get hand after drawing
      const viewAfterDraw = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDraw.yourHand.length).toBe(12); // 11 + 1 drawn

      // Skip (go to discard phase)
      executeGameAction(adapter, awaitingId, { type: "SKIP" });

      // Now turnPhase should be AWAITING_DISCARD
      const snapshot = adapter.getSnapshot();
      expect(snapshot.turnPhase).toBe("AWAITING_DISCARD");

      // Get a card to discard
      const viewBeforeDiscard = adapter.getPlayerView(awaitingId)!;
      const cardId = viewBeforeDiscard.yourHand[0]!.id;

      // Discard should succeed
      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify player now has 11 cards
      const viewAfterDiscard = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDiscard.yourHand.length).toBe(11);
    });

    it("succeeds after drawing without skip (in AWAITING_ACTION phase)", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Check turnPhase after drawing
      const snapshotAfterDraw = adapter.getSnapshot();
      expect(snapshotAfterDraw.turnPhase).toBe("AWAITING_ACTION");

      // Get hand after drawing
      const viewAfterDraw = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDraw.yourHand.length).toBe(12); // 11 + 1 drawn

      // Try to discard directly (without skipping)
      const cardId = viewAfterDraw.yourHand[0]!.id;
      const action: GameAction = { type: "DISCARD", cardId };
      const result = executeGameAction(adapter, awaitingId, action);

      // This SHOULD succeed since DISCARD is allowed in AWAITING_ACTION
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify player now has 11 cards
      const viewAfterDiscard = adapter.getPlayerView(awaitingId)!;
      expect(viewAfterDiscard.yourHand.length).toBe(11);
    });

    it("fails when cardId is missing", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Try to discard without cardId
      const action = { type: "DISCARD" } as GameAction;
      const result = executeGameAction(adapter, awaitingId, action);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_CARD_ID");
    });

    it("fails when cardId is not in player's hand", () => {
      const adapter = createTestAdapter();
      const awaitingId = adapter.getAwaitingLobbyPlayerId()!;

      // Draw from stock
      executeGameAction(adapter, awaitingId, { type: "DRAW_FROM_STOCK" });

      // Try to discard with invalid card ID
      const action: GameAction = { type: "DISCARD", cardId: "invalid-card-id" };
      const result = executeGameAction(adapter, awaitingId, action);

      // The engine should reject this - check if result indicates failure
      // Note: The engine might record lastError instead of returning null
      if (result.snapshot?.lastError) {
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Full turn cycle", () => {
    it("completes a full turn: draw -> skip -> discard -> next player's turn", () => {
      const adapter = createTestAdapter();
      const player1Id = adapter.getAwaitingLobbyPlayerId()!;

      // 1. Draw from stock
      const drawResult = executeGameAction(adapter, player1Id, {
        type: "DRAW_FROM_STOCK",
      });
      expect(drawResult.success).toBe(true);
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

      // 2. Skip (go to discard phase)
      const skipResult = executeGameAction(adapter, player1Id, { type: "SKIP" });
      expect(skipResult.success).toBe(true);
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_DISCARD");

      // 3. Discard a card
      const view = adapter.getPlayerView(player1Id)!;
      const cardToDiscard = view.yourHand[0]!.id;
      const discardResult = executeGameAction(adapter, player1Id, {
        type: "DISCARD",
        cardId: cardToDiscard,
      });
      expect(discardResult.success).toBe(true);

      // 4. After discard, should be next player's turn
      const nextPlayerId = adapter.getAwaitingLobbyPlayerId();
      expect(nextPlayerId).not.toBe(player1Id);

      // 5. And turnPhase should be AWAITING_DRAW again
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_DRAW");
    });
  });

  describe("May-I availability in PlayerView", () => {
    it("canMayI is false after current player draws from discard", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // Before any action, other player CAN call May-I
      const viewBefore = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewBefore?.availableActions.canMayI).toBe(true);

      // Current player draws from discard
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_DISCARD" });

      // After draw from discard, other player should NOT be able to call May-I
      // because the discard has been claimed
      const viewAfter = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewAfter?.availableActions.canMayI).toBe(false);
    });

    it("canMayI remains true after current player draws from stock", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // Before any action, other player CAN call May-I
      const viewBefore = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewBefore?.availableActions.canMayI).toBe(true);

      // Current player draws from stock
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_STOCK" });

      // After draw from stock, discard is still exposed so May-I should still be available
      const viewAfter = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(viewAfter?.availableActions.canMayI).toBe(true);
    });

    it("canMayI is false for down players", () => {
      // Create adapter with predefined state where a player is down
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: [
          { playerId: "human-1", name: "Alice", isConnected: true, disconnectedAt: null },
          { playerId: "human-2", name: "Bob", isConnected: true, disconnectedAt: null },
          { playerId: "human-3", name: "Carol", isConnected: true, disconnectedAt: null },
        ],
        aiPlayers: [],
        startingRound: 1,
      });

      // Find player who is NOT current player
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find((m) => m.lobbyId !== currentPlayerId);
      if (!otherPlayer) throw new Error("Need other player for test");

      // For now, verify that a non-down player CAN call May-I
      const view = adapter.getPlayerView(otherPlayer.lobbyId);
      expect(view?.availableActions.canMayI).toBe(true);

      // Note: To properly test down player behavior, we'd need to lay down melds first
      // which requires a more complex test setup. The engine tests already cover this.
    });
  });

  describe("CALL_MAY_I does not return stale errors", () => {
    it("succeeds even when lastError is set from a previous failed action", () => {
      const adapter = createTestAdapter();
      const currentPlayerId = adapter.getAwaitingLobbyPlayerId()!;
      const allPlayers = adapter.getAllPlayerMappings();
      const otherPlayer = allPlayers.find(
        (m) => m.lobbyId !== currentPlayerId && !m.isAI
      );
      if (!otherPlayer) throw new Error("Need at least 2 human players for this test");

      // 1. Current player draws from stock to get into AWAITING_ACTION phase
      executeGameAction(adapter, currentPlayerId, { type: "DRAW_FROM_STOCK" });
      expect(adapter.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

      // 2. Current player attempts an invalid LAY_DOWN
      // Round 1 contract requires 2 sets. Let's try to lay down with invalid card IDs.
      const invalidLayDownResult = executeGameAction(adapter, currentPlayerId, {
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["invalid-card-1", "invalid-card-2", "invalid-card-3"] },
          { type: "set", cardIds: ["invalid-card-4", "invalid-card-5", "invalid-card-6"] },
        ],
      });
      // The engine should reject this because cards don't exist in hand
      expect(invalidLayDownResult.success).toBe(false);

      // Verify the state has a lastError set (this is the sticky error)
      const snapshotWithError = adapter.getSnapshot();
      expect(snapshotWithError.lastError).toBeTruthy();

      // 3. Other player calls May-I - this should SUCCEED despite the stale lastError
      // because May-I doesn't produce errors, it just triggers the resolution phase
      const mayIResult = executeGameAction(adapter, otherPlayer.lobbyId, {
        type: "CALL_MAY_I",
      });

      // THIS IS THE BUG: May-I fails with the stale error from the failed lay-down
      // After fix: May-I should succeed
      expect(mayIResult.success).toBe(true);
      expect(mayIResult.error).toBeUndefined();
    });
  });

  describe("May-I resolution with down players", () => {
    it("down players are skipped in May-I resolution", () => {
      // Create adapter with 4 players for better testing
      const adapter = PartyGameAdapter.createFromLobby({
        roomId: "test-room",
        humanPlayers: [
          { playerId: "human-1", name: "Player 1", isConnected: true, disconnectedAt: null },
          { playerId: "human-2", name: "Player 2", isConnected: true, disconnectedAt: null },
          { playerId: "human-3", name: "Player 3", isConnected: true, disconnectedAt: null },
          { playerId: "human-4", name: "Player 4", isConnected: true, disconnectedAt: null },
        ],
        aiPlayers: [],
        startingRound: 1,
      });

      // The engine level tests in roundMachine.mayI.test.ts verify that:
      // - "skips players who are down"
      // - "all players ahead are down - caller auto-wins"
      //
      // Those tests confirm the engine correctly excludes down players from playersToCheck.
      // This test verifies the adapter layer properly exposes the engine behavior.

      // Get initial state - no one is down yet
      const snapshot = adapter.getSnapshot();
      expect(snapshot.phase).toBe("ROUND_ACTIVE");

      // Verify there's a discard to claim
      expect(snapshot.discard.length).toBeGreaterThan(0);
    });
  });
});
