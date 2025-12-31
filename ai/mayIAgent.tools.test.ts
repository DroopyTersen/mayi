/**
 * Unit tests for mayIAgent.tools
 *
 * Tests getAvailableToolNames - a pure function that determines
 * which tools are available based on game state.
 */

import { describe, it, expect } from "bun:test";
import { getAvailableToolNames } from "./mayIAgent.tools";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import type { Player } from "../core/engine/engine.types";
import type { Meld } from "../core/meld/meld.types";

/**
 * Helper to create minimal snapshots for testing.
 * Only includes fields that getAvailableToolNames actually checks.
 */
function makeSnapshot(overrides: {
  phase?: GameSnapshot["phase"];
  turnPhase?: GameSnapshot["turnPhase"];
  awaitingPlayerId?: string;
  isDown?: boolean;
  currentRound?: number;
  tableMelds?: number;
}): GameSnapshot {
  const {
    phase = "ROUND_ACTIVE",
    turnPhase = "AWAITING_DRAW",
    awaitingPlayerId = "ai",
    isDown = false,
    currentRound = 1,
    tableMelds = 0,
  } = overrides;

  const player: Player = {
    id: "ai",
    name: "AI Bot",
    hand: [],
    isDown,
    totalScore: 0,
  };

  // Create fake table melds if needed (runs with jokers for swap testing)
  const table: Meld[] = [];
  for (let i = 0; i < tableMelds; i++) {
    table.push({
      id: `meld-${i}`,
      ownerId: "other",
      type: "run",
      cards: [
        { id: `5h-${i}`, rank: "5", suit: "hearts" },
        { id: `joker-${i}`, rank: "Joker", suit: null },
        { id: `7h-${i}`, rank: "7", suit: "hearts" },
        { id: `8h-${i}`, rank: "8", suit: "hearts" },
      ],
    });
  }

  return {
    version: "3.0",
    gameId: "test-game",
    lastError: null,
    phase,
    turnPhase,
    awaitingPlayerId,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    currentRound,
    contract: { roundNumber: currentRound, sets: 2, runs: 0 },
    players: [player],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    table,
    stock: [],
    discard: [],
    stockCount: 50,
    discardCount: 0,
    turnNumber: 1,
    hasDrawn: false,
    laidDownThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as GameSnapshot;
}

describe("getAvailableToolNames", () => {
  describe("when not player's turn", () => {
    it("returns empty array", () => {
      const snapshot = makeSnapshot({ awaitingPlayerId: "someone-else" });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual([]);
    });
  });

  describe("RESOLVING_MAY_I phase", () => {
    it("returns allow and claim tools when player is being prompted", () => {
      const snapshot = makeSnapshot({ phase: "RESOLVING_MAY_I" });
      // Need to set mayIContext with playerBeingPrompted for allow/claim to be available
      snapshot.mayIContext = {
        originalCaller: "other",
        cardBeingClaimed: { id: "7h", rank: "7", suit: "hearts" },
        playersToCheck: ["ai"],
        currentPromptIndex: 0,
        playerBeingPrompted: "ai",
        playersWhoAllowed: [],
        winner: null,
        outcome: null,
      };
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["allow_may_i", "claim_may_i"]);
    });

    it("returns empty for non-prompted player during resolution", () => {
      const snapshot = makeSnapshot({ phase: "RESOLVING_MAY_I" });
      snapshot.mayIContext = {
        originalCaller: "other",
        cardBeingClaimed: { id: "7h", rank: "7", suit: "hearts" },
        playersToCheck: ["someone-else"],
        currentPromptIndex: 0,
        playerBeingPrompted: "someone-else",
        playersWhoAllowed: [],
        winner: null,
        outcome: null,
      };
      expect(getAvailableToolNames(snapshot, "ai")).toEqual([]);
    });
  });

  describe("non-ROUND_ACTIVE phases", () => {
    it("returns empty for ROUND_END", () => {
      const snapshot = makeSnapshot({ phase: "ROUND_END" });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual([]);
    });

    it("returns empty for GAME_END", () => {
      const snapshot = makeSnapshot({ phase: "GAME_END" });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual([]);
    });
  });

  describe("AWAITING_DRAW phase", () => {
    it("offers stock or discard when NOT down", () => {
      const snapshot = makeSnapshot({ turnPhase: "AWAITING_DRAW", isDown: false });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["draw_from_stock", "draw_from_discard"]);
    });

    it("offers only stock when DOWN (per house rules: down players cannot draw from discard)", () => {
      const snapshot = makeSnapshot({ turnPhase: "AWAITING_DRAW", isDown: true });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["draw_from_stock"]);
    });
  });

  describe("AWAITING_ACTION phase", () => {
    it("offers lay_down, swap_joker, discard when NOT down and runs with jokers exist", () => {
      const snapshot = makeSnapshot({
        turnPhase: "AWAITING_ACTION",
        isDown: false,
        tableMelds: 2,
        currentRound: 3,
      });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["lay_down", "swap_joker", "discard"]);
    });

    it("offers lay_down, discard (no swap_joker) when NOT down but no melds on table", () => {
      const snapshot = makeSnapshot({
        turnPhase: "AWAITING_ACTION",
        isDown: false,
        tableMelds: 0,
        currentRound: 1,
      });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["lay_down", "discard"]);
    });

    it("offers lay_off, discard when DOWN and melds exist (can add to melds but not lay down again)", () => {
      const snapshot = makeSnapshot({
        turnPhase: "AWAITING_ACTION",
        isDown: true,
        tableMelds: 1, // Need melds on table to lay off to
      });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["lay_off", "discard"]);
    });

    it("offers only discard when DOWN but no melds on table", () => {
      const snapshot = makeSnapshot({
        turnPhase: "AWAITING_ACTION",
        isDown: true,
        tableMelds: 0, // No melds to lay off to
      });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["discard"]);
    });
  });

  describe("AWAITING_DISCARD phase", () => {
    it("only offers discard", () => {
      const snapshot = makeSnapshot({ turnPhase: "AWAITING_DISCARD" });
      expect(getAvailableToolNames(snapshot, "ai")).toEqual(["discard"]);
    });
  });

  describe("Round 6 special rules", () => {
    it("should NOT offer swap_joker in Round 6 (no melds on table until someone wins)", () => {
      const snapshot = makeSnapshot({
        currentRound: 6,
        turnPhase: "AWAITING_ACTION",
        isDown: false,
        tableMelds: 0,
      });

      const tools = getAvailableToolNames(snapshot, "ai");

      expect(tools).not.toContain("swap_joker");
      expect(tools).toContain("lay_down");
      expect(tools).toContain("discard");
    });

    it("should offer swap_joker in earlier rounds when runs with jokers exist on table", () => {
      const snapshot = makeSnapshot({
        currentRound: 3,
        turnPhase: "AWAITING_ACTION",
        isDown: false,
        tableMelds: 2,
      });

      const tools = getAvailableToolNames(snapshot, "ai");

      expect(tools).toContain("swap_joker");
    });

    it("should NOT offer swap_joker even with melds if Round 6 (edge case)", () => {
      // This shouldn't happen in practice (no one is down in Round 6 until they win)
      // but the rule is explicit: no joker swapping in Round 6
      const snapshot = makeSnapshot({
        currentRound: 6,
        turnPhase: "AWAITING_ACTION",
        isDown: false,
        tableMelds: 1, // hypothetical edge case
      });

      const tools = getAvailableToolNames(snapshot, "ai");

      expect(tools).not.toContain("swap_joker");
    });
  });
});
