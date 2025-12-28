import { describe, it, expect } from "bun:test";
import { countWildsAndNaturals, wildsOutnumberNaturals, isValidSet } from "./meld.validation";
import type { Card } from "../card/card.types";

// Helper to create cards for testing
let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

describe("isValidSet", () => {
  describe("valid sets - naturals only", () => {
    it("valid: exactly 3 cards of same rank (9♣ 9♦ 9♥)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 4 cards of same rank (K♣ K♦ K♥ K♠)", () => {
      const cards = [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"), card("K", "spades")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 5 cards of same rank — multi-deck allows this", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"), card("9", "spades"), card("9", "clubs")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 6+ cards of same rank (with multiple decks)", () => {
      const cards = [
        card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
        card("9", "spades"), card("9", "clubs"), card("9", "diamonds")
      ];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: duplicate suits allowed (9♣ 9♣ 9♦) — multi-deck scenario", () => {
      const cards = [card("9", "clubs"), card("9", "clubs"), card("9", "diamonds")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: all same suit allowed (9♣ 9♣ 9♣) — weird but legal with 3 decks", () => {
      const cards = [card("9", "clubs"), card("9", "clubs"), card("9", "clubs")];
      expect(isValidSet(cards)).toBe(true);
    });
  });

  describe("valid sets - with wilds", () => {
    it("valid: 2 naturals + 1 Joker (9♣ 9♦ Joker)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), joker()];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 2 naturals + 1 two (9♣ 9♦ 2♥)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("2", "hearts")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 3 naturals + 1 wild (9♣ 9♦ 9♥ Joker)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"), joker()];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 3 naturals + 2 wilds (9♣ 9♦ 9♥ 2♠ Joker)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"), card("2", "spades"), joker()];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 2 naturals + 2 wilds (9♣ 9♦ 2♥ Joker) — equal count is OK", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("2", "hearts"), joker()];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: 4 naturals + 4 wilds — equal count still OK", () => {
      const cards = [
        card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"), card("9", "spades"),
        joker(), joker(), card("2", "hearts"), card("2", "spades")
      ];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: mix of 2s and Jokers as wilds", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), card("2", "hearts"), joker()];
      expect(isValidSet(cards)).toBe(true);
    });
  });

  describe("invalid sets - structure", () => {
    it("invalid: fewer than 3 cards (9♣ 9♦)", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: only 1 card", () => {
      const cards = [card("9", "clubs")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: empty array", () => {
      expect(isValidSet([])).toBe(false);
    });

    it("invalid: different ranks without wilds (9♣ 10♦ J♥)", () => {
      const cards = [card("9", "clubs"), card("10", "diamonds"), card("J", "hearts")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: different ranks even with wild present (9♣ 10♦ Joker)", () => {
      const cards = [card("9", "clubs"), card("10", "diamonds"), joker()];
      expect(isValidSet(cards)).toBe(false);
    });
  });

  describe("invalid sets - wild ratio", () => {
    it("invalid: 1 natural + 2 wilds (9♣ Joker Joker)", () => {
      const cards = [card("9", "clubs"), joker(), joker()];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: 1 natural + 2 twos (9♣ 2♥ 2♦)", () => {
      const cards = [card("9", "clubs"), card("2", "hearts"), card("2", "diamonds")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: 1 natural + 1 Joker + 1 two (9♣ Joker 2♥)", () => {
      const cards = [card("9", "clubs"), joker(), card("2", "hearts")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: 2 naturals + 3 wilds", () => {
      const cards = [card("9", "clubs"), card("9", "diamonds"), joker(), joker(), card("2", "hearts")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: all wilds (Joker Joker 2♣)", () => {
      const cards = [joker(), joker(), card("2", "clubs")];
      expect(isValidSet(cards)).toBe(false);
    });

    it("invalid: 0 naturals + any wilds", () => {
      const cards = [joker(), card("2", "hearts")];
      expect(isValidSet(cards)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("valid: set of Aces (A♣ A♦ A♥)", () => {
      const cards = [card("A", "clubs"), card("A", "diamonds"), card("A", "hearts")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("valid: set of 3s — lowest non-wild rank (3♣ 3♦ 3♥)", () => {
      const cards = [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")];
      expect(isValidSet(cards)).toBe(true);
    });

    it("invalid: set of 2s (2♣ 2♦ 2♥) — 0 naturals, all wilds", () => {
      const cards = [card("2", "clubs"), card("2", "diamonds"), card("2", "hearts")];
      expect(isValidSet(cards)).toBe(false);
    });
  });
});

describe("isValidRun", () => {
  describe("valid runs - naturals only", () => {
    it.todo("valid: exactly 4 consecutive cards same suit (5♠ 6♠ 7♠ 8♠)");
    it.todo("valid: 5 consecutive cards same suit");
    it.todo("valid: 6+ consecutive cards");
    it.todo("valid: low run starting at 3 (3♦ 4♦ 5♦ 6♦)");
    it.todo("valid: high run ending at Ace (J♥ Q♥ K♥ A♥)");
    it.todo("valid: middle run (7♣ 8♣ 9♣ 10♣)");
    it.todo("valid: run through face cards (9♠ 10♠ J♠ Q♠)");
    it.todo("valid: longest possible run (3-A, 12 cards)");
  });

  describe("valid runs - with wilds", () => {
    it.todo("valid: wild filling internal gap (5♠ 6♠ Joker 8♠)");
    it.todo("valid: wild at start of run (Joker 6♠ 7♠ 8♠) — Joker acts as 5♠");
    it.todo("valid: wild at end of run (5♠ 6♠ 7♠ 2♣) — 2 acts as 8♠");
    it.todo("valid: multiple wilds filling gaps (5♠ Joker 7♠ 2♣)");
    it.todo("valid: 2 naturals + 2 wilds (5♠ Joker Joker 8♠) — equal count OK");
  });

  describe("invalid runs - structure", () => {
    it.todo("invalid: fewer than 4 cards (5♠ 6♠ 7♠)");
    it.todo("invalid: only 3 cards even with correct sequence");
    it.todo("invalid: 2 cards");
    it.todo("invalid: 1 card");
    it.todo("invalid: empty array");
    it.todo("invalid: mixed suits (5♠ 6♥ 7♠ 8♠)");
    it.todo("invalid: gap in sequence without wild (5♠ 6♠ 8♠ 9♠)");
    it.todo("invalid: duplicate rank in run (5♠ 6♠ 6♠ 7♠)");
    it.todo("invalid: non-consecutive cards (5♠ 7♠ 9♠ J♠)");
  });

  describe("invalid runs - ace positioning", () => {
    it.todo("invalid: Ace as low card (A♠ 3♠ 4♠ 5♠) — Ace is HIGH only");
    it.todo("invalid: Ace in middle of run (K♠ A♠ 3♠ 4♠)");
    it.todo("invalid: wraparound run (Q♠ K♠ A♠ 3♠)");
  });

  describe("invalid runs - wild ratio", () => {
    it.todo("invalid: 1 natural + 3 wilds (5♠ Joker Joker 2♣)");
    it.todo("invalid: 2 naturals + 3 wilds");
    it.todo("invalid: wilds outnumber naturals");
    it.todo("invalid: all wilds (Joker Joker 2♣ 2♦)");
  });

  describe("invalid runs - 2 as natural", () => {
    it.todo("invalid: treating 2 as natural rank (2♠ 3♠ 4♠ 5♠) — 2 is always wild");
  });

  describe("invalid runs - boundaries", () => {
    it.todo("invalid: wild before 3 (Joker 3♠ 4♠ 5♠) — nothing below 3");
    it.todo("invalid: wild after Ace (Q♥ K♥ A♥ Joker) — nothing above Ace");
  });
});

describe("countWildsAndNaturals", () => {
  it("returns {wilds: 0, naturals: 3} for (9♣ 9♦ 9♥)", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")];
    expect(countWildsAndNaturals(cards)).toEqual({ wilds: 0, naturals: 3 });
  });

  it("returns {wilds: 1, naturals: 2} for (9♣ 9♦ Joker)", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), joker()];
    expect(countWildsAndNaturals(cards)).toEqual({ wilds: 1, naturals: 2 });
  });

  it("returns {wilds: 2, naturals: 2} for (9♣ 9♦ 2♥ Joker)", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), card("2", "hearts"), joker()];
    expect(countWildsAndNaturals(cards)).toEqual({ wilds: 2, naturals: 2 });
  });

  it("returns {wilds: 2, naturals: 0} for (Joker 2♣)", () => {
    const cards = [joker(), card("2", "clubs")];
    expect(countWildsAndNaturals(cards)).toEqual({ wilds: 2, naturals: 0 });
  });

  it("returns {wilds: 0, naturals: 0} for empty array", () => {
    expect(countWildsAndNaturals([])).toEqual({ wilds: 0, naturals: 0 });
  });

  it("counts both 2s and Jokers as wilds", () => {
    const cards = [card("2", "hearts"), card("2", "spades"), joker()];
    expect(countWildsAndNaturals(cards)).toEqual({ wilds: 3, naturals: 0 });
  });
});

describe("wildsOutnumberNaturals", () => {
  it("returns false for 3 naturals, 0 wilds", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")];
    expect(wildsOutnumberNaturals(cards)).toBe(false);
  });

  it("returns false for 2 naturals, 1 wild", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), joker()];
    expect(wildsOutnumberNaturals(cards)).toBe(false);
  });

  it("returns false for 2 naturals, 2 wilds (equal is OK)", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), joker(), card("2", "hearts")];
    expect(wildsOutnumberNaturals(cards)).toBe(false);
  });

  it("returns false for 4 naturals, 4 wilds (equal is OK)", () => {
    const cards = [
      card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"), card("9", "spades"),
      joker(), joker(), card("2", "hearts"), card("2", "spades")
    ];
    expect(wildsOutnumberNaturals(cards)).toBe(false);
  });

  it("returns true for 1 natural, 2 wilds", () => {
    const cards = [card("9", "clubs"), joker(), card("2", "hearts")];
    expect(wildsOutnumberNaturals(cards)).toBe(true);
  });

  it("returns true for 2 naturals, 3 wilds", () => {
    const cards = [card("9", "clubs"), card("9", "diamonds"), joker(), joker(), card("2", "hearts")];
    expect(wildsOutnumberNaturals(cards)).toBe(true);
  });

  it("returns true for 0 naturals, any wilds", () => {
    const cards = [joker(), card("2", "clubs")];
    expect(wildsOutnumberNaturals(cards)).toBe(true);
  });
});
