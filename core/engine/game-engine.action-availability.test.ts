/**
 * Tests for action availability details derived from shared rules.
 */

import { describe, it, expect } from "bun:test";
import type { GameSnapshot } from "./game-engine.types";
import { getActionAvailabilityDetails } from "./game-engine.availability";

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

describe("getActionAvailabilityDetails", () => {
  it("returns aligned availability and hints for blocked lay off and swap joker", () => {
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

    const { availableActions, unavailabilityHints } = getActionAvailabilityDetails(
      snapshot,
      "player1"
    );

    expect(availableActions.canLayOff).toBe(false);
    expect(availableActions.canSwapJoker).toBe(false);
    expect(unavailabilityHints).toContainEqual({
      action: "Lay Off",
      reason: "Available next turn",
    });
    expect(unavailabilityHints).toContainEqual({
      action: "Swap Joker",
      reason: "Only before laying down",
    });
  });

  it("returns draw-discard hint when down and awaiting draw with discard available", () => {
    const snapshot = createTestSnapshot({
      players: [{ id: "player1", name: "Test", hand: [], isDown: true, totalScore: 0 }],
      turnPhase: "AWAITING_DRAW",
      hasDrawn: false,
      discard: [{ id: "d1", rank: "5" as const, suit: "hearts" as const }],
    });

    const { availableActions, unavailabilityHints } = getActionAvailabilityDetails(
      snapshot,
      "player1"
    );

    expect(availableActions.canDrawFromStock).toBe(true);
    expect(availableActions.canDrawFromDiscard).toBe(false);
    expect(unavailabilityHints).toContainEqual({
      action: "Pick Up Discard",
      reason: "Must draw from stock when down",
    });
  });
});
