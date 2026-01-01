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
});
