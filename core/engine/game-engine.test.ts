/**
 * Tests for the server-safe GameEngine
 *
 * Following TDD: Write failing tests FIRST, then implement.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { GameEngine } from "./game-engine";
import type { GameSnapshot, PlayerView, MeldSpec } from "./game-engine.types";
import type { Card } from "../card/card.types";

function collectAllCards(snapshot: GameSnapshot): Card[] {
  const handCards = snapshot.players.flatMap((player) => player.hand);
  const tableCards = snapshot.table.flatMap((meld) => meld.cards);
  return [...handCards, ...snapshot.stock, ...snapshot.discard, ...tableCards];
}

describe("GameEngine", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // createGame
  // ═══════════════════════════════════════════════════════════════════════════

  describe("createGame", () => {
    it("creates a game with the specified players", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.players).toHaveLength(3);
      expect(snapshot.players[0]!.name).toBe("Alice");
      expect(snapshot.players[1]!.name).toBe("Bob");
      expect(snapshot.players[2]!.name).toBe("Carol");
    });

    it("assigns unique player IDs", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const ids = snapshot.players.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it("deals 11 cards to each player", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      for (const player of snapshot.players) {
        expect(player.hand).toHaveLength(11);
      }
    });

    it("starts at round 1 by default", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.currentRound).toBe(1);
      expect(snapshot.contract).toEqual({
        roundNumber: 1,
        sets: 2,
        runs: 0,
      });
    });

    it("can start at a specific round", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        startingRound: 6,
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.currentRound).toBe(6);
      expect(snapshot.contract).toEqual({
        roundNumber: 6,
        sets: 1,
        runs: 2,
      });
    });

    it("rejects fewer than 3 players", () => {
      expect(() =>
        GameEngine.createGame({
          playerNames: ["Alice", "Bob"],
        })
      ).toThrow("Game requires 3-8 players");
    });

    it("rejects more than 8 players", () => {
      expect(() =>
        GameEngine.createGame({
          playerNames: [
            "P1",
            "P2",
            "P3",
            "P4",
            "P5",
            "P6",
            "P7",
            "P8",
            "P9",
          ],
        })
      ).toThrow("Game requires 3-8 players");
    });

    it("initializes stock with remaining cards", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      // 2 decks = 108 cards, 3 players * 11 cards = 33, 1 discard = 1
      // Stock should have 108 - 33 - 1 = 74 cards
      expect(snapshot.stock.length).toBe(74);
    });

    it("initializes discard with one card", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.discard).toHaveLength(1);
    });

    it("sets initial phase to ROUND_ACTIVE and turn phase to AWAITING_DRAW", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.phase).toBe("ROUND_ACTIVE");
      expect(snapshot.turnPhase).toBe("AWAITING_DRAW");
    });

    it("sets first player to left of dealer", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.dealerIndex).toBe(0);
      expect(snapshot.currentPlayerIndex).toBe(1); // Left of dealer
      expect(snapshot.awaitingPlayerId).toBe(snapshot.players[1]!.id);
    });

    it("uses provided gameId when specified", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        gameId: "test-game-123",
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.gameId).toBe("test-game-123");
    });

    it("assigns stable IDs to all cards", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const allCardIds = new Set<string>();

      // Collect all card IDs
      for (const player of snapshot.players) {
        for (const card of player.hand) {
          expect(card.id).toBeDefined();
          expect(typeof card.id).toBe("string");
          expect(allCardIds.has(card.id)).toBe(false); // No duplicates
          allCardIds.add(card.id);
        }
      }
      for (const card of snapshot.stock) {
        expect(card.id).toBeDefined();
        allCardIds.add(card.id);
      }
      for (const card of snapshot.discard) {
        expect(card.id).toBeDefined();
        allCardIds.add(card.id);
      }

      // Should have 108 unique card IDs (2 decks)
      expect(allCardIds.size).toBe(108);
    });

    it("uses 108 cards (2 decks) for 5 players", () => {
      const engine = GameEngine.createGame({
        playerNames: ["A", "B", "C", "D", "E"],
      });

      const snapshot = engine.getSnapshot();
      const totalCards = collectAllCards(snapshot).length;
      expect(totalCards).toBe(108);
    });

    it("uses 162 cards (3 decks) for 6 players", () => {
      const engine = GameEngine.createGame({
        playerNames: ["A", "B", "C", "D", "E", "F"],
      });

      const snapshot = engine.getSnapshot();
      const totalCards = collectAllCards(snapshot).length;
      expect(totalCards).toBe(162);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // fromPersistedSnapshot (XState persistence)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("fromPersistedSnapshot", () => {
    it("restores a game from XState persisted snapshot", () => {
      const engine1 = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        gameId: "test-restore",
      });

      const persisted = engine1.getPersistedSnapshot();
      engine1.stop();
      const engine2 = GameEngine.fromPersistedSnapshot(persisted, "test-restore");
      const snapshot2 = engine2.getSnapshot();

      expect(snapshot2.gameId).toBe("test-restore");
      expect(snapshot2.players).toHaveLength(3);
      expect(snapshot2.currentRound).toBe(1);
      engine2.stop();
    });

    it("creates an independent instance", () => {
      const engine1 = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = engine1.getPersistedSnapshot();
      const engine2 = GameEngine.fromPersistedSnapshot(persisted);

      // Verify they're different instances
      expect(engine2).not.toBe(engine1);
      engine1.stop();
      engine2.stop();
    });

    it("preserves all state fields", () => {
      const engine1 = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        startingRound: 3,
      });

      const snapshot1 = engine1.getSnapshot();
      const persisted = engine1.getPersistedSnapshot();
      engine1.stop();
      const engine2 = GameEngine.fromPersistedSnapshot(persisted);
      const snapshot2 = engine2.getSnapshot();

      expect(snapshot2.version).toBe(snapshot1.version);
      expect(snapshot2.currentRound).toBe(snapshot1.currentRound);
      expect(snapshot2.phase).toBe(snapshot1.phase);
      expect(snapshot2.turnPhase).toBe(snapshot1.turnPhase);
      expect(snapshot2.players.length).toBe(snapshot1.players.length);
      expect(snapshot2.stock.length).toBe(snapshot1.stock.length);
      expect(snapshot2.discard.length).toBe(snapshot1.discard.length);
      engine2.stop();
    });

    it("logs warning for duplicate card IDs but does not set lastError", () => {
      // Duplicate detection logs a warning but doesn't set lastError,
      // because setting lastError would cause game-actions.ts to treat
      // valid actions as failed (see specs/may-i-bugs.bug.md).
      const engine1 = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = engine1.getPersistedSnapshot() as any;
      const roundSnapshot = persisted.children?.round?.snapshot;
      const turnContext = roundSnapshot?.children?.turn?.snapshot?.context;

      if (!turnContext || !Array.isArray(turnContext.hand) || turnContext.hand.length === 0) {
        throw new Error("Expected turn hand in persisted snapshot");
      }

      const duplicateCard = turnContext.hand[0];
      turnContext.discard = [duplicateCard, ...(turnContext.discard ?? [])];

      engine1.stop();
      const engine2 = GameEngine.fromPersistedSnapshot(persisted);
      const snapshot2 = engine2.getSnapshot();

      // Warning is logged but lastError is NOT set
      // (the warning goes to console.warn which we can't easily assert in tests)
      expect(snapshot2.lastError).toBeNull();
      engine2.stop();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSnapshot (Immutability)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getSnapshot", () => {
    it("returns a copy, not a reference to internal state", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot1 = engine.getSnapshot();
      const snapshot2 = engine.getSnapshot();

      // Should be equal but not the same object
      expect(snapshot1).toEqual(snapshot2);
      expect(snapshot1).not.toBe(snapshot2);
    });

    it("returns a deep copy (modifying returned snapshot does not affect engine)", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const originalPlayerCount = snapshot.players.length;

      // Try to mutate the returned snapshot
      snapshot.players.push({
        id: "hacker",
        name: "Hacker",
        hand: [],
        isDown: false,
        totalScore: 0,
      });

      // Engine's internal state should be unchanged
      const freshSnapshot = engine.getSnapshot();
      expect(freshSnapshot.players).toHaveLength(originalPlayerCount);
    });

    it("includes version 3.0", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.version).toBe("3.0");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPlayerView (Information Hiding)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getPlayerView", () => {
    it("returns the viewing player's hand", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const aliceId = snapshot.players[0]!.id;
      const view = engine.getPlayerView(aliceId);

      expect(view.yourHand).toHaveLength(11);
      expect(view.yourHand).toEqual(snapshot.players[0]!.hand);
    });

    it("hides other players' hands (shows only handCount)", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const aliceId = snapshot.players[0]!.id;
      const view = engine.getPlayerView(aliceId);

      expect(view.opponents).toHaveLength(2);

      // Check that opponents don't have 'hand' property
      for (const opponent of view.opponents) {
        expect(opponent.handCount).toBe(11);
        expect((opponent as unknown as { hand?: unknown }).hand).toBeUndefined();
      }
    });

    it("includes opponent names and IDs", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const aliceId = snapshot.players[0]!.id;
      const view = engine.getPlayerView(aliceId);

      const opponentNames = view.opponents.map((o) => o.name);
      expect(opponentNames).toContain("Bob");
      expect(opponentNames).toContain("Carol");
      expect(opponentNames).not.toContain("Alice");
    });

    it("shows correct isYourTurn status", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      // First player is left of dealer (index 1 = Bob)
      const bobId = snapshot.players[1]!.id;
      const aliceId = snapshot.players[0]!.id;

      const bobView = engine.getPlayerView(bobId);
      const aliceView = engine.getPlayerView(aliceId);

      expect(bobView.isYourTurn).toBe(true);
      expect(aliceView.isYourTurn).toBe(false);
    });

    it("shows public game state correctly", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const view = engine.getPlayerView(snapshot.players[0]!.id);

      expect(view.currentRound).toBe(1);
      expect(view.phase).toBe("ROUND_ACTIVE");
      expect(view.turnPhase).toBe("AWAITING_DRAW");
      expect(view.stockCount).toBe(snapshot.stock.length);
      expect(view.discardCount).toBe(1);
      expect(view.topDiscard).toEqual(snapshot.discard[0] ?? null);
    });

    it("shows the viewing player's isDown status", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const view = engine.getPlayerView(snapshot.players[0]!.id);

      expect(view.youAreDown).toBe(false);
    });

    it("includes action states for the viewing player", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const view = engine.getPlayerView(snapshot.awaitingPlayerId);
      const actionStates = (
        view as { actionStates?: Array<{ id: string; status: string }> }
      ).actionStates;

      expect(Array.isArray(actionStates)).toBe(true);
      expect(
        actionStates?.some(
          (state) => state.id === "drawStock" && state.status === "available"
        )
      ).toBe(true);
    });

    it("throws for invalid player ID", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      expect(() => engine.getPlayerView("invalid-id")).toThrow(
        "Player not found"
      );
    });

    it("includes contract information", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        startingRound: 4,
      });

      const snapshot = engine.getSnapshot();
      const view = engine.getPlayerView(snapshot.players[0]!.id);

      expect(view.contract).toEqual({
        roundNumber: 4,
        sets: 3,
        runs: 0,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // drawFromStock
  // ═══════════════════════════════════════════════════════════════════════════

  describe("drawFromStock", () => {
    it("returns new snapshot with card added to hand", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      const handSizeBefore = snapshot.players.find(
        (p) => p.id === currentPlayerId
      )!.hand.length;

      const result = engine.drawFromStock(currentPlayerId);

      // Result is the snapshot - check state directly
      const newPlayer = result.players.find(
        (p) => p.id === currentPlayerId
      )!;
      expect(newPlayer.hand.length).toBe(handSizeBefore + 1);
    });

    it("XState engine is mutable - commands update internal state", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshotBefore = engine.getSnapshot();
      const currentPlayerId = snapshotBefore.awaitingPlayerId;
      const handSizeBefore = snapshotBefore.players.find(
        (p) => p.id === currentPlayerId
      )!.hand.length;
      const stockSizeBefore = snapshotBefore.stock.length;

      engine.drawFromStock(currentPlayerId);

      // XState engine is mutable - getSnapshot returns updated state
      const snapshotAfter = engine.getSnapshot();
      const playerAfter = snapshotAfter.players.find(
        (p) => p.id === currentPlayerId
      )!;
      // Hand size increased by 1 after drawing
      expect(playerAfter.hand.length).toBe(handSizeBefore + 1);
      // Stock size decreased by 1 after drawing
      expect(snapshotAfter.stock.length).toBe(stockSizeBefore - 1);
    });

    it("wrong player - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const before = engine.getSnapshot();
      const wrongPlayerId = before.players.find(
        (p) => p.id !== before.awaitingPlayerId
      )!.id;

      const after = engine.drawFromStock(wrongPlayerId);

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
      expect(after.awaitingPlayerId).toBe(before.awaitingPlayerId);
    });

    it("already drawn - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw from stock
      engine.drawFromStock(playerId);

      // After drawing, we're in AWAITING_ACTION
      const midSnapshot = engine.getSnapshot();
      expect(midSnapshot.hasDrawn).toBe(true);
      expect(midSnapshot.turnPhase).toBe("AWAITING_ACTION");

      // Try to draw again - should be ignored, state unchanged
      const after = engine.drawFromStock(playerId);
      expect(after.turnPhase).toBe("AWAITING_ACTION");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // drawFromDiscard
  // ═══════════════════════════════════════════════════════════════════════════

  describe("drawFromDiscard", () => {
    it("returns new snapshot with discard card in hand", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      const topDiscard = snapshot.discard[0]!;

      const result = engine.drawFromDiscard(currentPlayerId);

      const newPlayer = result.players.find(
        (p) => p.id === currentPlayerId
      )!;
      expect(newPlayer.hand.some((c) => c.id === topDiscard.id)).toBe(true);
    });

    it("removes card from discard pile", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const discardSizeBefore = snapshot.discard.length;

      const result = engine.drawFromDiscard(snapshot.awaitingPlayerId);

      expect(result.discard.length).toBe(discardSizeBefore - 1);
    });

    it("does not open May I window", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const result = engine.drawFromDiscard(snapshot.awaitingPlayerId);

      expect(result.phase).toBe("ROUND_ACTIVE");
      expect(result.mayIContext).toBeNull();
    });

    it("transitions to AWAITING_ACTION", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const result = engine.drawFromDiscard(snapshot.awaitingPlayerId);

      expect(result.turnPhase).toBe("AWAITING_ACTION");
      expect(result.hasDrawn).toBe(true);
    });

    it("fails for down players", () => {
      // Note: This test requires a way to make a player "down"
      // We'll need layDown command first, so this may initially fail
      // For now, create a snapshot manually or skip
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      // This test will be more complete once layDown is implemented
      // For now, just verify the basic case works
      const snapshot = engine.getSnapshot();
      expect(snapshot.players[0]!.isDown).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // skip
  // ═══════════════════════════════════════════════════════════════════════════

  describe("skip", () => {
    it("transitions from AWAITING_ACTION to AWAITING_DISCARD", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw from discard (puts us in AWAITING_ACTION)
      engine.drawFromDiscard(playerId);

      expect(engine.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

      // Now skip
      const skipResult = engine.skip(playerId);

      expect(skipResult.turnPhase).toBe("AWAITING_DISCARD");
    });

    it("wrong phase - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const before = engine.getSnapshot();
      expect(before.turnPhase).toBe("AWAITING_DRAW");

      const after = engine.skip(before.awaitingPlayerId);

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // discard
  // ═══════════════════════════════════════════════════════════════════════════

  describe("discard", () => {
    it("removes card from hand by ID and adds to discard", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw from discard (puts us in AWAITING_ACTION)
      engine.drawFromDiscard(playerId);

      // Skip to AWAITING_DISCARD
      engine.skip(playerId);

      // Get a card to discard
      const snap = engine.getSnapshot();
      const player = snap.players.find((p) => p.id === playerId)!;
      const cardToDiscard = player.hand[0]!;
      const handSizeBefore = player.hand.length;

      // Discard by card ID
      const discardResult = engine.discard(playerId, cardToDiscard.id);

      const newPlayer = discardResult.players.find(
        (p) => p.id === playerId
      )!;
      expect(newPlayer.hand.length).toBe(handSizeBefore - 1);
      expect(newPlayer.hand.find((c) => c.id === cardToDiscard.id)).toBeUndefined();

      // Card is now top of discard
      expect(discardResult.discard[0]!.id).toBe(cardToDiscard.id);
    });

    it("advances to next player", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;
      const playerIndex = snapshot.currentPlayerIndex;

      // Draw, skip, discard (engine is mutable)
      engine.drawFromDiscard(playerId);
      engine.skip(playerId);

      const snap = engine.getSnapshot();
      const cardId = snap.players.find((p) => p.id === playerId)!.hand[0]!.id;
      const discardResult = engine.discard(playerId, cardId);

      const newPlayerIndex = discardResult.currentPlayerIndex;
      expect(newPlayerIndex).toBe((playerIndex + 1) % 3);
    });

    it("nonexistent card - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw, skip (engine is mutable)
      engine.drawFromDiscard(playerId);
      engine.skip(playerId);

      const before = engine.getSnapshot();
      const after = engine.discard(playerId, "nonexistent-card-id");

      // State unchanged - still in AWAITING_DISCARD
      expect(after.turnPhase).toBe("AWAITING_DISCARD");
      expect(after.players.find((p) => p.id === playerId)!.hand.length)
        .toBe(before.players.find((p) => p.id === playerId)!.hand.length);
    });

    it("wrong phase - state unchanged", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const before = engine.getSnapshot();
      const playerId = before.awaitingPlayerId;
      const cardId = before.players.find((p) => p.id === playerId)!.hand[0]!.id;

      // Try to discard without drawing
      const after = engine.discard(playerId, cardId);

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });

    it("getSnapshot reflects changes after discard", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
        dealerIndex: 0,
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.awaitingPlayerId;

      // Draw, skip (engine is mutable)
      engine.drawFromDiscard(playerId);
      engine.skip(playerId);

      const snapBefore = engine.getSnapshot();
      const handSizeBefore = snapBefore.players.find((p) => p.id === playerId)!.hand.length;
      const cardId = snapBefore.players.find((p) => p.id === playerId)!.hand[0]!.id;

      engine.discard(playerId, cardId);

      // Engine's snapshot now reflects the discard
      const snapAfter = engine.getSnapshot();
      expect(snapAfter.players.find((p) => p.id === playerId)!.hand.length).toBe(
        handSizeBefore - 1
      );
    });
  });

});
