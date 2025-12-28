/**
 * CLI May I Prompts tests - Phase 6
 *
 * Tests for May I CLI display and interaction
 */

import { describe, it, expect } from "bun:test";

describe("CLI - May I prompts", () => {
  describe("current player decision", () => {
    it.todo("display: 'Alice discarded K♠.' 'Bob, it's your turn. Do you want the K♠?'", () => {});
    it.todo("options: '1. Yes, take it' '2. No, draw from stock'", () => {});
  });

  describe("current player decision with pending May I", () => {
    it.todo("display: 'Alice discarded K♠.' 'Carol calls May I? for the K♠.'", () => {});
    it.todo("display: 'Bob, it's your turn. Carol wants the K♠.'", () => {});
    it.todo("options: '1. Take the K♠ yourself (no penalty)' '2. Let Carol have it, draw from stock'", () => {});
  });

  describe("May I prompt for other players", () => {
    it.todo("given: Bob drew from stock (passed), display: 'Bob passed on the K♠.'", () => {});
    it.todo("prompt Carol: 'Carol, May I? (K♠ + penalty card)' '1. Yes, May I!' '2. No thanks'", () => {});
    it.todo("then prompt Dave: 'Dave, May I? (K♠ + penalty card)' '1. Yes, May I!' '2. No thanks'", () => {});
  });

  describe("May I resolution display - single winner", () => {
    it.todo("display: 'Carol calls May I! and takes the K♠.'", () => {});
    it.todo("display: 'Carol draws a penalty card from the stock.'", () => {});
    it.todo("display: 'Carol now has 13 cards.'", () => {});
  });

  describe("May I resolution display - priority winner", () => {
    it.todo("display: 'Carol and Dave both want the K♠.'", () => {});
    it.todo("display: 'Carol is closer in turn order.'", () => {});
    it.todo("display: 'Carol takes the K♠ and draws a penalty card.'", () => {});
    it.todo("display: 'Carol now has 13 cards.'", () => {});
  });

  describe("May I veto display - current player", () => {
    it.todo("display: 'Carol calls May I? for the K♠.'", () => {});
    it.todo("display: 'Bob takes the K♠ instead. Carol's May I is denied.'", () => {});
    it.todo("display: 'Bob, continue your turn...'", () => {});
  });

  describe("May I veto display - non-current player", () => {
    it.todo("display: 'Dave calls May I? for the K♠.'", () => {});
    it.todo("display: 'Carol says No, I want it! and takes the K♠.'", () => {});
    it.todo("display: 'Carol draws a penalty card.'", () => {});
    it.todo("display: 'Carol now has 13 cards.'", () => {});
    it.todo("display: 'Dave's May I is denied.'", () => {});
  });

  describe("no May I claims", () => {
    it.todo("display: 'Bob passed on the 3♣.'", () => {});
    it.todo("display: 'No one wanted the 3♣.'", () => {});
    it.todo("display: 'Bob, continue your turn...'", () => {});
  });
});

describe("CLI - AI May I decisions", () => {
  describe("AI May I summary", () => {
    it.todo("display: 'Alice discarded Q♠.'", () => {});
    it.todo("display: 'Bob draws from stock.'", () => {});
    it.todo("display: 'Carol calls May I! — takes Q♠ + penalty (now 13 cards).'", () => {});
    it.todo("display: 'Bob's turn continues...'", () => {});
  });

  describe("AI veto summary", () => {
    it.todo("display: 'Alice discarded K♠.'", () => {});
    it.todo("display: 'Dave calls May I? for the K♠.'", () => {});
    it.todo("display: 'Bob takes the K♠ instead.'", () => {});
    it.todo("display: 'Bob's turn continues...'", () => {});
  });
});
