/**
 * Tests for unavailability hint derivation logic.
 *
 * Per house rules:
 * - Lay Off: Cannot lay off on same turn as laying down
 * - Lay Off: Cannot lay off until you've laid down your contract
 * - Swap Joker: Can only swap jokers BEFORE laying down, not after
 * - Draw Discard: Once down, can only draw from stock
 */

import { describe, it, expect } from "bun:test";
import type { GameSnapshot } from "./game-engine.types";
import { getUnavailabilityHints } from "./game-engine.hints";

/**
 * Create a minimal GameSnapshot for testing hints.
 * Only includes fields that affect hint derivation.
 */
function createTestSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const defaultPlayer = {
    id: "player1",
    name: "Test Player",
    hand: [],
    isDown: false,
    totalScore: 0,
  };

  return {
    version: "3.0",
    gameId: "test-game",
    lastError: null,
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_ACTION",
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [defaultPlayer],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    awaitingPlayerId: "player1",
    stock: [],
    discard: [],
    table: [],
    hasDrawn: true,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("getUnavailabilityHints", () => {
  describe("Lay Off hints", () => {
    it("returns 'available next turn' when down and laidDownThisTurn is true", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        laidDownThisTurn: true,
        hasDrawn: true,
        table: [{ id: "meld1", type: "set", cards: [], ownerId: "player1" }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toContainEqual({
        action: "Lay Off",
        reason: "Available next turn",
      });
    });

    it("returns 'lay down contract first' when not down and has drawn", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 }],
        hasDrawn: true,
        table: [{ id: "meld1", type: "set", cards: [], ownerId: "player2" }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toContainEqual({
        action: "Lay Off",
        reason: "Lay down your contract first",
      });
    });

    it("does NOT show lay off hint when player is down and can lay off", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        laidDownThisTurn: false,
        hasDrawn: true,
        table: [{ id: "meld1", type: "set", cards: [], ownerId: "player1" }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const layOffHints = hints.filter((h) => h.action === "Lay Off");
      expect(layOffHints).toHaveLength(0);
    });

    it("does NOT show lay off hint when no melds on table", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        laidDownThisTurn: true,
        hasDrawn: true,
        table: [],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const layOffHints = hints.filter((h) => h.action === "Lay Off");
      expect(layOffHints).toHaveLength(0);
    });

    it("does NOT show 'lay down contract first' hint during AWAITING_DRAW phase", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 }],
        turnPhase: "AWAITING_DRAW",
        hasDrawn: false,
        table: [{ id: "meld1", type: "set", cards: [], ownerId: "player2" }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const layOffHints = hints.filter((h) => h.action === "Lay Off");
      expect(layOffHints).toHaveLength(0);
    });
  });

  describe("Swap Joker hints", () => {
    it("returns swap joker hint when down and runs with jokers exist", () => {
      const jokerCard = { id: "joker1", rank: "Joker" as const, suit: null };
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        hasDrawn: true,
        table: [
          {
            id: "run1",
            type: "run",
            cards: [jokerCard, { id: "c1", rank: "5" as const, suit: "hearts" as const }],
            ownerId: "player2",
          },
        ],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toContainEqual({
        action: "Swap Joker",
        reason: "Only before laying down",
      });
    });

    it("does NOT show swap joker hint when not down (can still swap)", () => {
      const jokerCard = { id: "joker1", rank: "Joker" as const, suit: null };
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 }],
        hasDrawn: true,
        table: [
          {
            id: "run1",
            type: "run",
            cards: [jokerCard, { id: "c1", rank: "5" as const, suit: "hearts" as const }],
            ownerId: "player2",
          },
        ],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const swapHints = hints.filter((h) => h.action === "Swap Joker");
      expect(swapHints).toHaveLength(0);
    });

    it("does NOT show swap joker hint when no runs with jokers", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        hasDrawn: true,
        table: [{ id: "set1", type: "set", cards: [], ownerId: "player1" }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const swapHints = hints.filter((h) => h.action === "Swap Joker");
      expect(swapHints).toHaveLength(0);
    });

    it("does NOT show swap joker hint when runs exist but have no jokers", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        hasDrawn: true,
        table: [
          {
            id: "run1",
            type: "run",
            cards: [
              { id: "c1", rank: "5" as const, suit: "hearts" as const },
              { id: "c2", rank: "6" as const, suit: "hearts" as const },
            ],
            ownerId: "player1",
          },
        ],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const swapHints = hints.filter((h) => h.action === "Swap Joker");
      expect(swapHints).toHaveLength(0);
    });
  });

  describe("Draw Discard hints", () => {
    it("returns draw discard hint when down and awaiting draw", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        turnPhase: "AWAITING_DRAW",
        hasDrawn: false,
        discard: [{ id: "d1", rank: "5" as const, suit: "hearts" as const }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toContainEqual({
        action: "Pick Up Discard",
        reason: "Must draw from stock when down",
      });
    });

    it("does NOT show draw discard hint when not down", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 }],
        turnPhase: "AWAITING_DRAW",
        hasDrawn: false,
        discard: [{ id: "d1", rank: "5" as const, suit: "hearts" as const }],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const discardHints = hints.filter((h) => h.action === "Pick Up Discard");
      expect(discardHints).toHaveLength(0);
    });

    it("does NOT show draw discard hint when not awaiting draw", () => {
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const discardHints = hints.filter((h) => h.action === "Pick Up Discard");
      expect(discardHints).toHaveLength(0);
    });
  });

  describe("Not your turn", () => {
    it("returns empty when not your turn", () => {
      const snapshot = createTestSnapshot({
        players: [
          { id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 },
          { id: "player2", name: "Other", hand: [], isDown: false, totalScore: 0 },
        ],
        awaitingPlayerId: "player2",
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toHaveLength(0);
    });
  });

  describe("Round 6 special rules", () => {
    it("does NOT show lay off hint in Round 6 (laying off doesn't exist)", () => {
      const snapshot = createTestSnapshot({
        currentRound: 6,
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        laidDownThisTurn: true,
        hasDrawn: true,
        table: [],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const layOffHints = hints.filter((h) => h.action === "Lay Off");
      expect(layOffHints).toHaveLength(0);
    });

    it("does NOT show swap joker hint in Round 6 (no melds on table)", () => {
      const snapshot = createTestSnapshot({
        currentRound: 6,
        players: [{ id: "player1", name: "Test", hand: [], isDown: false, totalScore: 0 }],
        hasDrawn: true,
        table: [],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      const swapHints = hints.filter((h) => h.action === "Swap Joker");
      expect(swapHints).toHaveLength(0);
    });
  });

  describe("Multiple hints", () => {
    it("can return multiple hints when multiple actions are unavailable", () => {
      const jokerCard = { id: "joker1", rank: "Joker" as const, suit: null };
      const snapshot = createTestSnapshot({
        players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
        laidDownThisTurn: true,
        hasDrawn: true,
        table: [
          {
            id: "run1",
            type: "run",
            cards: [jokerCard, { id: "c1", rank: "5" as const, suit: "hearts" as const }],
            ownerId: "player2",
          },
        ],
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints.length).toBeGreaterThanOrEqual(2);
      expect(hints).toContainEqual({
        action: "Lay Off",
        reason: "Available next turn",
      });
      expect(hints).toContainEqual({
        action: "Swap Joker",
        reason: "Only before laying down",
      });
    });
  });

  describe("Edge cases", () => {
    it("returns empty array when phase is not ROUND_ACTIVE", () => {
      const snapshot = createTestSnapshot({
        phase: "ROUND_END",
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toHaveLength(0);
    });

    it("returns empty array when phase is RESOLVING_MAY_I", () => {
      const snapshot = createTestSnapshot({
        phase: "RESOLVING_MAY_I",
        mayIContext: {
          originalCaller: "player2",
          cardBeingClaimed: { id: "c1", rank: "5" as const, suit: "hearts" as const },
          playersToCheck: [],
          currentPromptIndex: 0,
          playerBeingPrompted: null,
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toHaveLength(0);
    });

    it("returns empty array when phase is GAME_END", () => {
      const snapshot = createTestSnapshot({
        phase: "GAME_END",
      });

      const hints = getUnavailabilityHints(snapshot, "player1");

      expect(hints).toHaveLength(0);
    });

    it("handles player not found gracefully", () => {
      const snapshot = createTestSnapshot();

      const hints = getUnavailabilityHints(snapshot, "nonexistent-player");

      expect(hints).toHaveLength(0);
    });
  });
});
