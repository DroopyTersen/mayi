/**
 * May I Actions tests - Phase 6
 *
 * Tests for May I claiming actions and state updates
 */

import { describe, it, expect } from "bun:test";

describe("current player claiming", () => {
  describe("claim via DRAW_FROM_DISCARD", () => {
    it.todo("current player receives discardedCard", () => {});
    it.todo("NO penalty card (it's their normal draw)", () => {});
    it.todo("discard pile top removed", () => {});
    it.todo("stock unchanged", () => {});
    it.todo("current player's hand += 1", () => {});
  });

  describe("claim voids other May I calls", () => {
    it.todo("given: P3 and P0 have called May I, when: current player (P2) issues DRAW_FROM_DISCARD, then: P2 gets the card", () => {});
    it.todo("P3's claim voided", () => {});
    it.todo("P0's claim voided", () => {});
    it.todo("no penalty cards drawn by anyone", () => {});
  });

  describe("counts as current player's draw", () => {
    it.todo("given: current player claims discard, then: they cannot also draw from stock", () => {});
    it.todo("turn continues from 'drawn' state", () => {});
    it.todo("they can lay down, lay off, etc.", () => {});
  });
});

describe("non-current player winning May I", () => {
  describe("receives discard + penalty", () => {
    it.todo("given: P3 wins May I, then: P3 receives discardedCard", () => {});
    it.todo("P3 receives penalty card (top of stock)", () => {});
    it.todo("P3's hand += 2", () => {});
  });

  describe("discard and stock updated", () => {
    it.todo("discard = [Q♥, ...] (K♠ removed)", () => {});
    it.todo("stock = [3♣, ...] (7♦ removed as penalty)", () => {});
    it.todo("P3's hand includes K♠ and 7♦", () => {});
  });

  describe("turn order unchanged", () => {
    it.todo("given: P2 is current player, drew from stock, P3 wins May I, then: it's still P2's turn", () => {});
    it.todo("P3 must wait for their normal turn", () => {});
    it.todo("turn order: P2 (current) → P3 → P0 → P1 → ...", () => {});
  });
});

describe("no claims scenario", () => {
  describe("discard stays on pile", () => {
    it.todo("given: current player drew from stock, no one called May I, then: discard pile unchanged", () => {});
    it.todo("discardedCard still on top", () => {});
    it.todo("stock unchanged", () => {});
    it.todo("no hands changed (from May I)", () => {});
  });
});
