import { describe, test, expect } from "bun:test";
import { getAvailableActions } from "./game-engine.availability";
import type { GameSnapshot } from "./game-engine.types";

// Helper to create minimal snapshots for testing
function createSnapshot(overrides: Partial<GameSnapshot>): GameSnapshot {
  return {
    version: "3.0",
    gameId: "test-game",
    phase: "ROUND_ACTIVE",
    currentRound: 1,
    turnNumber: 1,
    turnPhase: "AWAITING_DRAW",
    awaitingPlayerId: "player-1",
    lastDiscardedByPlayerId: "player-2",
    discardClaimed: false,
    stockCount: 50,
    discardCount: 1,
    hasDrawn: false,
    laidDownThisTurn: false,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    contract: { sets: 2, runs: 0 },
    stock: [],
    discard: [{ id: "7h", rank: "7", suit: "hearts" }],
    players: [
      { id: "player-1", name: "Player 1", hand: [], isDown: false, totalScore: 0 },
      { id: "player-2", name: "Player 2", hand: [], isDown: false, totalScore: 0 },
    ],
    table: [],
    mayIContext: null,
    lastError: null,
    roundHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as GameSnapshot;
}

describe("getAvailableActions", () => {
  describe("when not the player's turn", () => {
    test("returns all false except canMayI when eligible", () => {
      const snapshot = createSnapshot({
        awaitingPlayerId: "player-2",
        turnPhase: "AWAITING_DRAW",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDrawFromStock).toBe(false);
      expect(actions.canDrawFromDiscard).toBe(false);
      expect(actions.canLayDown).toBe(false);
      expect(actions.canDiscard).toBe(false);
      expect(actions.canLayOff).toBe(false);
      expect(actions.canSwapJoker).toBe(false);
      // Can call May I when not your turn and not down
      expect(actions.canMayI).toBe(true);
    });

    test("cannot call May I when down", () => {
      const snapshot = createSnapshot({
        awaitingPlayerId: "player-2",
        turnPhase: "AWAITING_DRAW",
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
          { id: "player-2", name: "Player 2", hand: [], isDown: false, totalScore: 0 },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });
  });

  describe("draw phase (AWAITING_DRAW)", () => {
    test("player NOT down can draw from stock or discard", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-1",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDrawFromStock).toBe(true);
      expect(actions.canDrawFromDiscard).toBe(true);
      expect(actions.canLayDown).toBe(false);
      expect(actions.canDiscard).toBe(false);
    });

    test("player who IS down can only draw from stock", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-1",
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
          { id: "player-2", name: "Player 2", hand: [], isDown: false, totalScore: 0 },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDrawFromStock).toBe(true);
      expect(actions.canDrawFromDiscard).toBe(false);
    });
  });

  describe("action phase - not down (AWAITING_ACTION)", () => {
    test("can lay down, discard, but not lay off", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        hasDrawn: true,
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canLayDown).toBe(true);
      expect(actions.canDiscard).toBe(true);
      expect(actions.canLayOff).toBe(false); // not down yet
      expect(actions.canDrawFromStock).toBe(false); // already drew
    });

    test("can swap joker when runs with jokers exist on table and not round 6", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        currentRound: 1,
        hasDrawn: true,
        table: [
          {
            id: "meld-1",
            ownerId: "player-2",
            type: "run",
            cards: [
              { id: "5h", rank: "5", suit: "hearts" },
              { id: "joker-1", rank: "Joker", suit: null },
              { id: "7h", rank: "7", suit: "hearts" },
              { id: "8h", rank: "8", suit: "hearts" },
            ],
          },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canSwapJoker).toBe(true);
    });

    test("cannot swap joker when only sets with jokers (not runs)", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        currentRound: 1,
        hasDrawn: true,
        table: [
          {
            id: "meld-1",
            ownerId: "player-2",
            type: "set",
            cards: [
              { id: "7h", rank: "7", suit: "hearts" },
              { id: "7s", rank: "7", suit: "spades" },
              { id: "joker-1", rank: "Joker", suit: null },
            ],
          },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canSwapJoker).toBe(false);
    });

    test("cannot swap joker in round 6", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        currentRound: 6,
        hasDrawn: true,
        table: [],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canSwapJoker).toBe(false);
    });

    test("cannot swap joker when no melds on table", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        currentRound: 1,
        hasDrawn: true,
        table: [],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canSwapJoker).toBe(false);
    });
  });

  describe("action phase - is down (AWAITING_ACTION)", () => {
    test("can lay off and discard, but NOT swap joker or lay down", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        hasDrawn: true,
        laidDownThisTurn: false, // Was down from a previous turn
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
          { id: "player-2", name: "Player 2", hand: [], isDown: false, totalScore: 0 },
        ],
        table: [
          {
            id: "meld-1",
            ownerId: "player-1",
            type: "set",
            cards: [
              { id: "7h", rank: "7", suit: "hearts" },
              { id: "7s", rank: "7", suit: "spades" },
              { id: "7c", rank: "7", suit: "clubs" },
            ],
          },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canLayOff).toBe(true);
      expect(actions.canDiscard).toBe(true);
      expect(actions.canSwapJoker).toBe(false); // Can't swap joker when down
      expect(actions.canLayDown).toBe(false); // Already down
    });

    test("cannot lay off on same turn as laying down (house rule)", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        hasDrawn: true,
        laidDownThisTurn: true, // Just laid down THIS turn
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
          { id: "player-2", name: "Player 2", hand: [], isDown: false, totalScore: 0 },
        ],
        table: [
          {
            id: "meld-1",
            ownerId: "player-1",
            type: "set",
            cards: [
              { id: "7h", rank: "7", suit: "hearts" },
              { id: "7s", rank: "7", suit: "spades" },
              { id: "7c", rank: "7", suit: "clubs" },
            ],
          },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canLayOff).toBe(false); // Cannot lay off same turn as laying down
      expect(actions.canDiscard).toBe(true); // Can still discard
    });

    test("cannot lay off in round 6 (no melds until someone wins)", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-1",
        currentRound: 6,
        hasDrawn: true,
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
        ],
        table: [],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      // In round 6, no one is ever "down" until they win, but if somehow they were:
      expect(actions.canLayOff).toBe(false);
    });
  });

  describe("discard phase (AWAITING_DISCARD)", () => {
    test("can only discard", () => {
      const snapshot = createSnapshot({
        turnPhase: "AWAITING_DISCARD",
        awaitingPlayerId: "player-1",
        hasDrawn: true,
        players: [
          { id: "player-1", name: "Player 1", hand: [], isDown: true, totalScore: 0 },
        ],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDiscard).toBe(true);
      expect(actions.canDrawFromStock).toBe(false);
      expect(actions.canLayOff).toBe(false);
      expect(actions.canLayDown).toBe(false);
    });
  });

  describe("May I eligibility", () => {
    test("cannot call May I when it's your turn", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-1",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });

    test("cannot call May I when May I resolution in progress", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-2",
        mayIContext: {
          originalCaller: "player-3",
          cardBeingClaimed: { id: "7h", rank: "7", suit: "hearts" },
          playersToCheck: [],
          currentPromptIndex: 0,
          playerBeingPrompted: null,
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });

    test("cannot call May I when no discard on pile", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-2",
        discard: [],
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });

    test("cannot call May I for card you discarded", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "player-2",
        lastDiscardedByPlayerId: "player-1",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });

    test("cannot call May I when discard has been claimed (current player drew from discard)", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-2",
        discardClaimed: true, // Current player drew from discard
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(false);
    });

    test("CAN call May I during AWAITING_ACTION when current player drew from stock", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "player-2",
        discardClaimed: false, // Current player drew from stock, not discard
        hasDrawn: true,
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(true);
    });

    test("CAN call May I during AWAITING_DISCARD when current player drew from stock", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DISCARD",
        awaitingPlayerId: "player-2",
        discardClaimed: false, // Current player drew from stock
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canMayI).toBe(true);
    });
  });

  describe("resolving May I phase", () => {
    test("prompted player can allow or claim", () => {
      const snapshot = createSnapshot({
        phase: "RESOLVING_MAY_I",
        awaitingPlayerId: "player-1",
        mayIContext: {
          originalCaller: "player-3",
          cardBeingClaimed: { id: "7h", rank: "7", suit: "hearts" },
          playersToCheck: ["player-1"],
          currentPromptIndex: 0,
          playerBeingPrompted: "player-1",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canAllowMayI).toBe(true);
      expect(actions.canClaimMayI).toBe(true);
      // Other actions not available during resolution
      expect(actions.canDrawFromStock).toBe(false);
      expect(actions.canDiscard).toBe(false);
    });

    test("non-prompted player cannot allow or claim", () => {
      const snapshot = createSnapshot({
        phase: "RESOLVING_MAY_I",
        awaitingPlayerId: "player-1",
        mayIContext: {
          originalCaller: "player-3",
          cardBeingClaimed: { id: "7h", rank: "7", suit: "hearts" },
          playersToCheck: ["player-1"],
          currentPromptIndex: 0,
          playerBeingPrompted: "player-1",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });
      const actions = getAvailableActions(snapshot, "player-2");

      expect(actions.canAllowMayI).toBe(false);
      expect(actions.canClaimMayI).toBe(false);
    });
  });

  describe("round end and game end phases", () => {
    test("no actions available at round end", () => {
      const snapshot = createSnapshot({
        phase: "ROUND_END",
        awaitingPlayerId: "player-1",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDrawFromStock).toBe(false);
      expect(actions.canDrawFromDiscard).toBe(false);
      expect(actions.canLayDown).toBe(false);
      expect(actions.canDiscard).toBe(false);
      expect(actions.canMayI).toBe(false);
    });

    test("no actions available at game end", () => {
      const snapshot = createSnapshot({
        phase: "GAME_END",
        awaitingPlayerId: "player-1",
      });
      const actions = getAvailableActions(snapshot, "player-1");

      expect(actions.canDrawFromStock).toBe(false);
      expect(actions.canDrawFromDiscard).toBe(false);
      expect(actions.canLayDown).toBe(false);
      expect(actions.canDiscard).toBe(false);
      expect(actions.canMayI).toBe(false);
    });
  });
});
