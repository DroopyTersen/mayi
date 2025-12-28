/**
 * MayIWindowMachine tests - Phase 6
 *
 * Tests for the May I window state machine
 */

import { describe, it, expect } from "bun:test";

describe("MayIWindowMachine - initialization", () => {
  describe("context from input", () => {
    it.todo("discardedCard: the card just discarded", () => {});
    it.todo("discardedByPlayerId: player who discarded", () => {});
    it.todo("currentPlayerId: player whose turn is next", () => {});
    it.todo("currentPlayerIndex: index of player whose turn it is", () => {});
    it.todo("playerOrder: array of player IDs in turn order", () => {});
    it.todo("claimants: [] (empty initially)", () => {});
    it.todo("currentPlayerClaimed: false", () => {});
    it.todo("currentPlayerPassed: false", () => {});
    it.todo("winnerId: null", () => {});
    it.todo("stock: current stock pile (for penalty card)", () => {});
  });

  describe("initial state", () => {
    it.todo("starts in 'open' state", () => {});
    it.todo("discard is available for claiming", () => {});
    it.todo("current player hasn't decided yet", () => {});
    it.todo("no claimants yet", () => {});
  });
});

describe("MayIWindowMachine - open state", () => {
  describe("current player takes discard (immediate claim)", () => {
    it.todo("given: window is open, when: current player issues DRAW_FROM_DISCARD, then: currentPlayerClaimed = true", () => {});
    it.todo("transitions to 'closedByCurrentPlayer'", () => {});
    it.todo("current player receives discard (NO penalty)", () => {});
    it.todo("this counts as their draw", () => {});
    it.todo("all May I claims voided", () => {});
  });

  describe("current player draws from stock (passes)", () => {
    it.todo("given: window is open, when: current player issues DRAW_FROM_STOCK, then: currentPlayerPassed = true", () => {});
    it.todo("current player loses veto rights", () => {});
    it.todo("transitions to 'resolvingClaims'", () => {});
    it.todo("May I claims will be resolved", () => {});
  });

  describe("other player calls May I (before current player decides)", () => {
    it.todo("given: window is open, when: player-3 calls May I, then: player-3 added to claimants array", () => {});
    it.todo("remains in 'open' state", () => {});
    it.todo("waiting for current player to decide", () => {});
  });

  describe("multiple players call May I before current player decides", () => {
    it.todo("given: window is open, when: player-3 and player-0 call May I, then: claimants = [player-3, player-0]", () => {});
    it.todo("still waiting for current player", () => {});
  });

  describe("current player vetoes (claims after others called)", () => {
    it.todo("given: player-3 has called May I, when: current player issues DRAW_FROM_DISCARD, then: current player takes discard", () => {});
    it.todo("transitions to 'closedByCurrentPlayer'", () => {});
    it.todo("player-3's May I claim is denied", () => {});
    it.todo("current player takes discard with NO penalty (veto)", () => {});
  });

  describe("guards - canCallMayI", () => {
    it.todo("returns false if caller is the one who discarded", () => {});
    it.todo("returns true for current player (they can claim as their draw)", () => {});
    it.todo("returns true for any other player", () => {});
  });

  describe("guards - isCurrentPlayer", () => {
    it.todo("returns true if event.playerId === currentPlayerId", () => {});
    it.todo("used to handle current player's draw actions", () => {});
  });
});

describe("MayIWindowMachine - resolvingClaims state", () => {
  describe("entering state", () => {
    it.todo("given: current player drew from stock (passed), then: window transitions to 'resolvingClaims'", () => {});
    it.todo("resolve claims by priority", () => {});
  });

  describe("no claimants", () => {
    it.todo("given: in resolvingClaims, claimants = [], then: transitions to 'closedNoClaim'", () => {});
    it.todo("discard remains on pile", () => {});
    it.todo("no one gets penalty card", () => {});
  });

  describe("single claimant", () => {
    it.todo("given: in resolvingClaims, claimants = [player-3], then: player-3 wins", () => {});
    it.todo("player-3 receives discard + penalty card", () => {});
    it.todo("transitions to 'resolved'", () => {});
  });

  describe("multiple claimants - priority resolution", () => {
    it.todo("given: claimants = [player-3, player-0], currentPlayerIndex = 1, then: player-3 wins (closer in priority)", () => {});
    it.todo("player-3 receives discard + penalty card", () => {});
    it.todo("player-0 receives nothing", () => {});
  });

  describe("veto between non-current players", () => {
    it.todo("given: player-0 calls May I (3 turns away), player-3 calls May I (1 turn away), then: player-3 wins", () => {});
    it.todo("player-3 receives discard + penalty card", () => {});
    it.todo("player-0 receives nothing", () => {});
  });
});

describe("MayIWindowMachine - priority calculation", () => {
  describe("basic priority", () => {
    it.todo("given: 4 players, P1 discarded, P2 is current (passed), then: priority order: P3 → P0", () => {});
    it.todo("P1 cannot claim (discarded the card)", () => {});
    it.todo("claimants = [P0, P3], then: winner = P3 (P3 comes before P0)", () => {});
  });

  describe("wrap-around priority", () => {
    it.todo("given: 4 players, P3 discarded, P0 is current (passed), then: priority order: P1 → P2", () => {});
    it.todo("claimants = [P1, P2], then: winner = P1 (closest to P0)", () => {});
  });

  describe("current player in priority (but already passed)", () => {
    it.todo("given: P2 is current, already drew from stock (passed), then: P2 cannot win", () => {});
    it.todo("claimants = [P3, P0], then: winner = P3 (priority among remaining)", () => {});
  });

  describe("5 player scenario", () => {
    it.todo("given: 5 players, P2 discarded, P3 is current (passed), then: priority: P4 → P0 → P1", () => {});
    it.todo("claimants = [P0, P1], then: winner = P0", () => {});
    it.todo("claimants = [P4, P0], then: winner = P4", () => {});
  });
});

describe("MayIWindowMachine - final states", () => {
  describe("closedByCurrentPlayer", () => {
    it.todo("is final state", () => {});
    it.todo("output type: 'CURRENT_PLAYER_CLAIMED'", () => {});
    it.todo("current player received discard (no penalty)", () => {});
    it.todo("all May I claims voided", () => {});
    it.todo("current player's turn continues (they've drawn)", () => {});
  });

  describe("resolved", () => {
    it.todo("is final state", () => {});
    it.todo("output type: 'MAY_I_RESOLVED'", () => {});
    it.todo("winnerId: player who won", () => {});
    it.todo("winnerReceived: [discardedCard, penaltyCard]", () => {});
    it.todo("current player's turn continues (they drew from stock)", () => {});
  });

  describe("closedNoClaim", () => {
    it.todo("is final state", () => {});
    it.todo("output type: 'NO_CLAIMS'", () => {});
    it.todo("discard remains on pile", () => {});
    it.todo("current player's turn continues (they drew from stock)", () => {});
  });
});
