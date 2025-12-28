/**
 * Turn Advancement tests - Phase 5
 *
 * Tests for turn rotation, first player calculation, and dealer rotation
 */

import { describe, it, expect } from "bun:test";

describe("turn advancement", () => {
  describe("clockwise rotation", () => {
    it.todo("given: 4 players, currentPlayerIndex = 0, then: next is 1", () => {});
    it.todo("given: 4 players, currentPlayerIndex = 1, then: next is 2", () => {});
    it.todo("given: 4 players, currentPlayerIndex = 2, then: next is 3", () => {});
    it.todo("given: 4 players, currentPlayerIndex = 3, then: next is 0 (wrapped)", () => {});
  });

  describe("wrap-around", () => {
    it.todo("given: 4 players, currentPlayerIndex = 3, when: turn completes, then: currentPlayerIndex = 0", () => {});
    it.todo("given: 5 players, currentPlayerIndex = 4, when: turn completes, then: currentPlayerIndex = 0", () => {});
  });

  describe("formula", () => {
    it.todo("nextPlayer = (currentPlayerIndex + 1) % playerCount", () => {});
    it.todo("always produces valid index", () => {});
  });

  describe("full rotation", () => {
    it.todo("given: 4 players, one full rotation = 4 turns", () => {});
    it.todo("each player gets exactly one turn per rotation", () => {});
  });
});

describe("first player each round", () => {
  describe("left of dealer", () => {
    it.todo("given: dealerIndex = 0, 4 players, then: first player = 1", () => {});
    it.todo("given: dealerIndex = 3, 4 players, then: first player = 0 (wraps)", () => {});
    it.todo("given: dealerIndex = 2, 5 players, then: first player = 3", () => {});
  });

  describe("formula", () => {
    it.todo("firstPlayer = (dealerIndex + 1) % playerCount", () => {});
    it.todo("same formula as turn advancement", () => {});
  });
});

describe("dealer rotation between rounds", () => {
  describe("advancement", () => {
    it.todo("given: 4 players, dealer = 0 in round 1, when: round 1 ends, then: dealer = 1 for round 2", () => {});
    it.todo("given: 4 players, dealer = 1 in round 2, when: round 2 ends, then: dealer = 2 for round 3", () => {});
    it.todo("continues through round 6", () => {});
  });

  describe("wrap-around", () => {
    it.todo("given: 4 players, dealer = 3 in round 4, when: round 4 ends, then: dealer = 0 for round 5", () => {});
  });

  describe("full game dealer rotation", () => {
    it.todo("round 1: dealer = 0, round 2: dealer = 1, ... round 6: dealer = 1", () => {});
  });
});
