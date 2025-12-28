/**
 * RoundMachine May I Integration tests - Phase 6
 *
 * Tests for May I window integration with RoundMachine
 */

import { describe, it, expect } from "bun:test";

describe("RoundMachine - May I window integration", () => {
  describe("window opens after discard", () => {
    it.todo("given: player completes turn (discards, wentOut: false), then: May I window opens", () => {});
    it.todo("MayIWindowMachine spawned", () => {});
    it.todo("current player's turn is 'paused' at awaitingDraw", () => {});
  });

  describe("window does NOT open if player went out", () => {
    it.todo("given: player goes out (wentOut: true), then: NO May I window", () => {});
    it.todo("round transitions to scoring", () => {});
    it.todo("no discard to claim anyway", () => {});
  });

  describe("MayIWindowMachine input", () => {
    it.todo("discardedCard: card just discarded", () => {});
    it.todo("discardedByPlayerId: player who discarded", () => {});
    it.todo("currentPlayerId: next player (whose turn it is)", () => {});
    it.todo("currentPlayerIndex: index of current player", () => {});
    it.todo("playerOrder: all player IDs", () => {});
    it.todo("stock: current stock pile", () => {});
  });
});

describe("RoundMachine - May I outcomes", () => {
  describe("CURRENT_PLAYER_CLAIMED outcome", () => {
    it.todo("given: MayIWindow outputs type: 'CURRENT_PLAYER_CLAIMED', then: current player has the discard in hand", () => {});
    it.todo("current player's turn continues from 'drawn' state", () => {});
    it.todo("no May I penalty applied", () => {});
    it.todo("discard removed from pile", () => {});
  });

  describe("MAY_I_RESOLVED outcome", () => {
    it.todo("given: MayIWindow outputs type: 'MAY_I_RESOLVED', winnerId = P3, then: P3's hand updated (+discard +penalty)", () => {});
    it.todo("stock updated (-1 penalty card)", () => {});
    it.todo("discard pile updated (-1 card)", () => {});
    it.todo("current player's turn continues", () => {});
    it.todo("current player must have drawn from stock already", () => {});
  });

  describe("NO_CLAIMS outcome", () => {
    it.todo("given: MayIWindow outputs type: 'NO_CLAIMS', then: discard pile unchanged", () => {});
    it.todo("stock unchanged", () => {});
    it.todo("current player's turn continues", () => {});
    it.todo("current player already drew from stock", () => {});
  });
});

describe("RoundMachine - turn flow with May I", () => {
  describe("current player claims - simple flow", () => {
    it.todo("1. P1 discards K♠, 2. May I window opens, 3. P2 issues DRAW_FROM_DISCARD", () => {});
    it.todo("4. Window outputs CURRENT_PLAYER_CLAIMED, 5. P2's hand has K♠", () => {});
    it.todo("6. P2's turn continues (drawn state), 7. P2 can lay down, lay off, etc.", () => {});
    it.todo("8. P2 discards, 9. New May I window opens", () => {});
  });

  describe("May I won - flow continues", () => {
    it.todo("1. P1 discards K♠, 2. May I window opens, 3. P3 calls May I", () => {});
    it.todo("4. P2 issues DRAW_FROM_STOCK, 5. Window resolves: P3 wins", () => {});
    it.todo("6. P3 gets K♠ + penalty card, 7. P2's turn continues (drew from stock)", () => {});
    it.todo("P3 doesn't get a turn now - must wait", () => {});
  });

  describe("no May I - simple flow", () => {
    it.todo("1. P1 discards 3♣, 2. May I window opens, 3. P2 issues DRAW_FROM_STOCK", () => {});
    it.todo("4. No one calls May I, 5. Window outputs NO_CLAIMS", () => {});
    it.todo("6. 3♣ stays on discard pile, 7. P2's turn continues", () => {});
  });

  describe("current player vetoes May I", () => {
    it.todo("1. P1 discards K♠, 2. May I window opens, 3. P3 calls May I, P0 calls May I", () => {});
    it.todo("4. P2 issues DRAW_FROM_DISCARD (veto), 5. Window outputs CURRENT_PLAYER_CLAIMED", () => {});
    it.todo("6. P2 has K♠, P3 and P0 get nothing, 7. P2's turn continues", () => {});
  });
});

describe("RoundMachine - multiple May I in a round", () => {
  describe("May I each discard", () => {
    it.todo("turn 1: P0 discards → May I window → P2 wins May I", () => {});
    it.todo("turn 2: P1 discards → May I window → no claims", () => {});
    it.todo("turn 3: P2 discards → May I window → P0 wins May I", () => {});
    it.todo("each discard gets its own May I window", () => {});
  });

  describe("same player winning multiple May I", () => {
    it.todo("turn 1: P3 wins May I (+2 cards), turn 2: P3 wins May I (+2 cards), turn 3: P3 wins May I (+2 cards)", () => {});
    it.todo("P3's hand has grown significantly", () => {});
    it.todo("all valid if P3 had priority each time", () => {});
  });
});
