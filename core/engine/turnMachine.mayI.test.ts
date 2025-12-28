/**
 * TurnMachine May I Awareness tests - Phase 6
 *
 * Tests for TurnMachine integration with May I window
 */

import { describe, it, expect } from "bun:test";

describe("TurnMachine - May I awareness", () => {
  describe("turn starts in awaitingDraw", () => {
    it.todo("given: May I window just opened (previous player discarded), then: turn machine in 'awaitingDraw' state", () => {});
    it.todo("May I window is active concurrently", () => {});
    it.todo("current player's draw command affects May I window", () => {});
  });

  describe("DRAW_FROM_DISCARD during May I window", () => {
    it.todo("when: current player issues DRAW_FROM_DISCARD, then: TurnMachine transitions to 'drawn'", () => {});
    it.todo("MayIWindow receives the claim", () => {});
    it.todo("May I window closes (CURRENT_PLAYER_CLAIMED)", () => {});
    it.todo("current player has the discard", () => {});
  });

  describe("DRAW_FROM_STOCK during May I window", () => {
    it.todo("when: current player issues DRAW_FROM_STOCK, then: TurnMachine transitions to 'drawn'", () => {});
    it.todo("current player has card from stock", () => {});
    it.todo("MayIWindow receives 'pass' signal", () => {});
    it.todo("May I window resolves claims", () => {});
  });

  describe("hand state after May I resolution", () => {
    it.todo("scenario A - current player claimed: hand includes discardedCard, hand.length = previous + 1", () => {});
    it.todo("scenario B - another player won May I: current player's hand includes stock card", () => {});
    it.todo("P3's hand includes discard + penalty, P3's hand.length = previous + 2", () => {});
  });
});

describe("TurnMachine - discard availability", () => {
  describe("discard available if no May I", () => {
    it.todo("given: previous turn ended, no one May I'd, then: discard pile has the discarded card on top", () => {});
    it.todo("current player can draw it", () => {});
  });

  describe("discard unavailable if May I won", () => {
    it.todo("given: P3 won May I for K♠, when: current player's turn continues, then: K♠ is NOT on discard pile", () => {});
    it.todo("discard top is whatever was under K♠", () => {});
    it.todo("current player already drew from stock", () => {});
  });
});
