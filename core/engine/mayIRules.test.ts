/**
 * May I Rules tests - Phase 6
 *
 * Tests for May I eligibility and timing rules
 */

import { describe, it, expect } from "bun:test";

describe("May I eligibility rules", () => {
  describe("cannot May I your own discard", () => {
    it.todo("given: P1 just discarded K♠, when: P1 tries to call May I, then: rejected", () => {});
  });

  describe("current player CAN claim (not technically May I)", () => {
    it.todo("given: P2 is current player, when: P2 draws from discard, then: this is their normal draw, NOT a May I", () => {});
    it.todo("no penalty", () => {});
  });

  describe("all other players can May I", () => {
    it.todo("given: P1 discarded, P2 is current, then: P3 can call May I", () => {});
    it.todo("P0 can call May I", () => {});
    it.todo("anyone except P1 (discarder) can call", () => {});
  });
});

describe("May I timing rules", () => {
  describe("May I can be called before current player draws", () => {
    it.todo("given: P1 discards, P2's turn starts (awaitingDraw), when: P3 calls May I, then: valid, claim recorded", () => {});
    it.todo("window waits for P2 to decide", () => {});
    it.todo("P2 can still veto by taking discard", () => {});
  });

  describe("May I window closes when current player draws from discard", () => {
    it.todo("given: P3 has called May I, when: current player (P2) draws from discard, then: P2 gets the card", () => {});
    it.todo("P3's claim denied", () => {});
    it.todo("window closes", () => {});
  });

  describe("May I resolves when current player draws from stock", () => {
    it.todo("given: P3 has called May I, when: current player (P2) draws from stock, then: P2 has 'passed'", () => {});
    it.todo("window resolves May I claims", () => {});
    it.todo("P3 wins (only claimant)", () => {});
    it.todo("P3 gets card + penalty", () => {});
  });

  describe("current player loses veto after drawing from stock", () => {
    it.todo("given: P2 (current) draws from stock, then: P2 cannot claim the discard anymore", () => {});
    it.todo("May I resolves among other claimants", () => {});
    it.todo("P2's draw is from stock, not discard", () => {});
  });
});

describe("May I unlimited per round", () => {
  describe("no limit on calls per player", () => {
    it.todo("turn 1: P3 wins May I (+2 cards), turn 5: P3 wins May I (+2 cards), turn 9: P3 wins May I (+2 cards), all valid", () => {});
    it.todo("P3's hand has grown by 6 cards from May I", () => {});
  });

  describe("can May I multiple times in sequence", () => {
    it.todo("given: P3 just won a May I, when: next player discards, then: P3 can call May I again", () => {});
    it.todo("pays another penalty card if they win", () => {});
  });

  describe("strategic cost", () => {
    it.todo("each May I adds 2 cards to hand", () => {});
    it.todo("+1 wanted card, +1 random penalty", () => {});
    it.todo("larger hand = more points if caught at round end", () => {});
  });
});

describe("May I penalty card", () => {
  describe("always from stock", () => {
    it.todo("penalty card is top card of stock", () => {});
    it.todo("cannot choose which card", () => {});
    it.todo("blind draw (luck element)", () => {});
  });

  describe("only non-current players pay penalty", () => {
    it.todo("current player claiming: 1 card (their draw), no penalty", () => {});
    it.todo("anyone else winning May I: 2 cards (discard + penalty)", () => {});
  });

  describe("penalty card could be anything", () => {
    it.todo("might be helpful (card you need)", () => {});
    it.todo("might be harmful (Joker = 50 points if stuck)", () => {});
    it.todo("adds uncertainty to May I decision", () => {});
  });
});
