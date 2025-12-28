/**
 * May I Priority tests - Phase 6
 *
 * Tests for priority calculation and claim resolution
 */

import { describe, it, expect } from "bun:test";

describe("getClaimPriority", () => {
  describe("priority order after current player", () => {
    it.todo("given: 4 players [P0, P1, P2, P3], current = P2, then: priority order = [P3, P0, P1]", () => {});
    it.todo("P2 not in list (they're current, handle separately)", () => {});
    it.todo("discarder (whoever it was) excluded", () => {});
  });

  describe("wrap-around", () => {
    it.todo("given: 4 players, current = P3, then: priority order = [P0, P1, P2]", () => {});
    it.todo("given: 4 players, current = P0, then: priority order = [P1, P2, P3]", () => {});
  });

  describe("excluding discarder", () => {
    it.todo("given: 4 players, P1 discarded, P2 is current, then: priority order = [P3, P0]", () => {});
    it.todo("P1 excluded (discarded)", () => {});
    it.todo("P2 excluded (current, handled separately)", () => {});
  });
});

describe("resolveByPriority", () => {
  describe("single claimant", () => {
    it.todo("given: claimants = [P3], then: winner = P3", () => {});
  });

  describe("multiple claimants - first in priority wins", () => {
    it.todo("given: priority order = [P3, P0, P1], claimants = [P0, P1], then: winner = P0", () => {});
    it.todo("given: priority order = [P3, P0, P1], claimants = [P1, P3], then: winner = P3", () => {});
    it.todo("given: priority order = [P3, P0, P1], claimants = [P0, P3, P1], then: winner = P3", () => {});
  });

  describe("order of calling doesn't matter", () => {
    it.todo("given: P1 called May I first, then P3 called, priority order = [P3, P0, P1], then: winner = P3", () => {});
  });
});

describe("veto scenarios", () => {
  describe("closer player vetoes further player", () => {
    it.todo("given: P0 (3 turns away) calls May I, P3 (1 turn away) calls May I, then: P3 wins", () => {});
    it.todo("P3 'vetoed' P0 by having higher priority", () => {});
    it.todo("P3 gets discard + penalty", () => {});
    it.todo("P0 gets nothing", () => {});
  });

  describe("current player vetoes everyone", () => {
    it.todo("given: P3 called May I, P0 called May I, current player (P2) issues DRAW_FROM_DISCARD, then: P2 wins", () => {});
    it.todo("P2 gets discard, NO penalty", () => {});
    it.todo("P3 and P0 get nothing", () => {});
  });

  describe("current player cannot veto after passing", () => {
    it.todo("given: P3 called May I, current player (P2) drew from stock (passed), then: P2 cannot claim anymore", () => {});
    it.todo("P3 wins by default", () => {});
  });

  describe("chain of vetoes", () => {
    it.todo("given: P1 calls May I, P0 calls May I, P3 calls May I, priority = [P3, P0, P1], then: P3 wins", () => {});
    it.todo("all others' claims denied", () => {});
  });
});
