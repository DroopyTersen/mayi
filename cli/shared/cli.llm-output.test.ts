import { describe, it, expect } from "bun:test";
import { outputGameStateForLLM } from "./cli.llm-output";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { Card } from "../../core/card/card.types";

/**
 * Create a minimal valid GameSnapshot for testing
 */
function createMockSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const defaultPlayers = [
    {
      id: "p1",
      name: "Alice",
      hand: [
        { id: "c1", rank: "7", suit: "hearts" },
        { id: "c2", rank: "8", suit: "hearts" },
        { id: "c3", rank: "9", suit: "hearts" },
      ] as Card[],
      isDown: false,
      totalScore: 0,
    },
    {
      id: "p2",
      name: "Bob",
      hand: [
        { id: "c4", rank: "K", suit: "spades" },
        { id: "c5", rank: "K", suit: "clubs" },
      ] as Card[],
      isDown: false,
      totalScore: 50,
    },
  ];

  return {
    version: "3.0",
    gameId: `test-llm-output-${Date.now()}`, // Non-existent game ID
    lastError: null,
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_DRAW",
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: defaultPlayers,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    awaitingPlayerId: "p1",
    stock: [],
    discard: [{ id: "d1", rank: "Q", suit: "diamonds" }] as Card[],
    table: [],
    hasDrawn: false,
    laidDownThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("outputGameStateForLLM", () => {
  describe("basic output structure", () => {
    it("returns error for unknown player", () => {
      const state = createMockSnapshot();
      const result = outputGameStateForLLM(state, "unknown-player");
      expect(result).toContain("ERROR: Player unknown-player not found");
    });

    it("includes round number and contract in header", () => {
      const state = createMockSnapshot({ currentRound: 3, contract: { roundNumber: 3, sets: 2, runs: 0 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("Round 3 of 6");
      expect(result).toContain("2 sets");
    });

    it("shows Hand 6 warning for final round", () => {
      const state = createMockSnapshot({ currentRound: 6, contract: { roundNumber: 6, sets: 1, runs: 2 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("Must lay down ALL cards to win");
    });
  });

  describe("player section", () => {
    it("marks current player with arrow indicator", () => {
      const state = createMockSnapshot({ currentPlayerIndex: 0 });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("→ Alice");
    });

    it("shows (you) label for viewing player", () => {
      const state = createMockSnapshot();
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("Alice (you)");
    });

    it("shows DOWN status for players who laid down", () => {
      const state = createMockSnapshot({
        players: [
          { id: "p1", name: "Alice", hand: [], isDown: true, totalScore: 0 },
          { id: "p2", name: "Bob", hand: [], isDown: false, totalScore: 0 },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("DOWN");
    });

    it("shows card count for each player", () => {
      const state = createMockSnapshot();
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("3 cards"); // Alice has 3
      expect(result).toContain("2 cards"); // Bob has 2
    });

    it("shows total score only for viewing player", () => {
      const state = createMockSnapshot({
        players: [
          { id: "p1", name: "Alice", hand: [], isDown: false, totalScore: 25 },
          { id: "p2", name: "Bob", hand: [], isDown: false, totalScore: 50 },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("(25 pts)");
      // Bob's score should not be shown
      expect(result).not.toContain("(50 pts)");
    });
  });

  describe("table section", () => {
    it("shows no melds message when table is empty", () => {
      const state = createMockSnapshot({ table: [] });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("(no melds yet)");
    });

    it("shows numbered melds with owner and type", () => {
      const state = createMockSnapshot({
        table: [
          {
            id: "m1",
            type: "set",
            cards: [
              { id: "c1", rank: "7", suit: "hearts" },
              { id: "c2", rank: "7", suit: "spades" },
              { id: "c3", rank: "7", suit: "clubs" },
            ] as Card[],
            ownerId: "p1",
          },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("[1]");
      expect(result).toContain("Alice");
      expect(result).toContain("Set:");
    });
  });

  describe("discard and stock section", () => {
    it("shows top discard card", () => {
      const state = createMockSnapshot({
        discard: [{ id: "d1", rank: "Q", suit: "diamonds" }] as Card[],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("DISCARD:");
      expect(result).toContain("Q"); // Queen
    });

    it("shows discard pile count", () => {
      const state = createMockSnapshot({
        discard: [
          { id: "d1", rank: "Q", suit: "diamonds" },
          { id: "d2", rank: "5", suit: "clubs" },
          { id: "d3", rank: "3", suit: "hearts" },
        ] as Card[],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("3 in pile");
    });

    it("shows stock pile count", () => {
      const state = createMockSnapshot({
        stock: Array(45)
          .fill(null)
          .map((_, i) => ({ id: `s${i}`, rank: "A", suit: "hearts" })) as Card[],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("STOCK: 45 cards");
    });
  });

  describe("phase-specific context", () => {
    it("shows draw prompt for AWAITING_DRAW phase", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("YOUR TURN");
      expect(result).toContain("draw");
    });

    it("shows action prompt for AWAITING_ACTION phase", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("YOUR TURN");
      expect(result).toContain("act");
    });

    it("shows contract needed when not down in AWAITING_ACTION", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "p1",
        contract: { roundNumber: 2, sets: 1, runs: 1 },
        players: [
          { id: "p1", name: "Alice", hand: [], isDown: false, totalScore: 0 },
          { id: "p2", name: "Bob", hand: [], isDown: false, totalScore: 0 },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("Contract needed:");
      expect(result).toContain("1 set + 1 run");
    });

    it("shows discard prompt for AWAITING_DISCARD phase", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DISCARD",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("discard");
    });

    it("shows waiting message when not your decision", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "p2",
        currentPlayerIndex: 1,
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("Waiting for Bob");
    });

    it("shows May I context for RESOLVING_MAY_I phase", () => {
      const state = createMockSnapshot({
        phase: "RESOLVING_MAY_I",
        awaitingPlayerId: "p1",
        mayIContext: {
          originalCaller: "p2",
          cardBeingClaimed: { id: "d1", rank: "Q", suit: "diamonds" } as Card,
          playersToCheck: ["p1"],
          currentPromptIndex: 0,
          playerBeingPrompted: "p1",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("MAY I?");
    });

    it("shows ROUND COMPLETE for ROUND_END phase", () => {
      const state = createMockSnapshot({ phase: "ROUND_END" });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("ROUND COMPLETE");
    });

    it("shows GAME OVER for GAME_END phase", () => {
      const state = createMockSnapshot({ phase: "GAME_END" });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("GAME OVER");
    });
  });

  describe("hand display", () => {
    it("shows player hand with numbered cards", () => {
      const state = createMockSnapshot({
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: [
              { id: "c1", rank: "7", suit: "hearts" },
              { id: "c2", rank: "8", suit: "spades" },
            ] as Card[],
            isDown: false,
            totalScore: 0,
          },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("YOUR HAND");
      expect(result).toContain("2 cards");
    });
  });

  describe("available actions", () => {
    it("shows draw options for AWAITING_DRAW when not down", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("AVAILABLE ACTIONS");
      expect(result).toContain("draw_from_stock");
      expect(result).toContain("draw_from_discard");
    });

    it("shows only stock draw for AWAITING_DRAW when down", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "p1",
        players: [
          { id: "p1", name: "Alice", hand: [], isDown: true, totalScore: 0 },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("draw_from_stock");
      expect(result).not.toContain("draw_from_discard");
    });

    it("shows action options for AWAITING_ACTION when not down", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("lay_down");
      expect(result).toContain("swap_joker");
      expect(result).toContain("discard");
    });

    it("shows lay_off option for AWAITING_ACTION when down", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_ACTION",
        awaitingPlayerId: "p1",
        players: [
          { id: "p1", name: "Alice", hand: [], isDown: true, totalScore: 0 },
        ],
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("lay_off");
      expect(result).toContain("discard");
      expect(result).not.toContain("lay_down");
    });

    it("shows only discard for AWAITING_DISCARD", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DISCARD",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("discard");
    });

    it("shows May I response options for RESOLVING_MAY_I", () => {
      const state = createMockSnapshot({
        phase: "RESOLVING_MAY_I",
        awaitingPlayerId: "p1",
        mayIContext: {
          originalCaller: "p2",
          cardBeingClaimed: { id: "d1", rank: "Q", suit: "diamonds" } as Card,
          playersToCheck: ["p1"],
          currentPromptIndex: 0,
          playerBeingPrompted: "p1",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("allow_may_i");
      expect(result).toContain("claim_may_i");
    });

    it("shows no actions for non-current player", () => {
      const state = createMockSnapshot({
        phase: "ROUND_ACTIVE",
        turnPhase: "AWAITING_DRAW",
        awaitingPlayerId: "p2",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).not.toContain("AVAILABLE ACTIONS");
    });
  });

  describe("error display", () => {
    it("shows last error when awaiting current player", () => {
      const state = createMockSnapshot({
        lastError: "Invalid meld: not enough cards",
        awaitingPlayerId: "p1",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("ERROR: Invalid meld: not enough cards");
    });

    it("does not show error for other players", () => {
      const state = createMockSnapshot({
        lastError: "Invalid meld: not enough cards",
        awaitingPlayerId: "p2",
      });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).not.toContain("ERROR:");
    });
  });

  describe("contract formatting", () => {
    it("formats sets only contract", () => {
      const state = createMockSnapshot({ contract: { roundNumber: 4, sets: 3, runs: 0 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("3 sets");
    });

    it("formats runs only contract", () => {
      const state = createMockSnapshot({ contract: { roundNumber: 3, sets: 0, runs: 2 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("2 runs");
    });

    it("formats mixed contract", () => {
      const state = createMockSnapshot({ contract: { roundNumber: 5, sets: 2, runs: 1 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("2 sets + 1 run");
    });

    it("uses singular for single set/run", () => {
      const state = createMockSnapshot({ contract: { roundNumber: 2, sets: 1, runs: 1 } });
      const result = outputGameStateForLLM(state, "p1");
      expect(result).toContain("1 set + 1 run");
    });
  });
});
