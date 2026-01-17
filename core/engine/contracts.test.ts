import { describe, it, expect, beforeEach } from "bun:test";
import { CONTRACTS, getContractForRound, getMinimumCardsForContract, validateContractMelds } from "./contracts";
import type { Meld } from "../meld/meld.types";
import type { Card } from "../card/card.types";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

// Track suit rotation for mockMeld to avoid same-suit run gap violations
let mockMeldRunSuitIndex = 0;
const runSuits: Card["suit"][] = ["spades", "hearts", "diamonds", "clubs"];

// Helper to create a mock meld with valid cards
// Note: Runs use different suits to avoid triggering the same-suit gap rule
function mockMeld(type: "set" | "run"): Meld {
  // Create valid cards for the meld type
  let cards: Card[];
  if (type === "set") {
    cards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")];
  } else {
    // Rotate through suits to avoid same-suit runs that violate gap rule
    const suit = runSuits[mockMeldRunSuitIndex % runSuits.length]!;
    mockMeldRunSuitIndex++;
    cards = [card("5", suit), card("6", suit), card("7", suit), card("8", suit)];
  }

  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId: "player-1",
  };
}

// Helper to create a meld with specific cards
function meldWithCards(type: "set" | "run", cards: Card[]): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId: "player-1",
  };
}

// Reset mockMeld state before each test for isolation
beforeEach(() => {
  mockMeldRunSuitIndex = 0;
});

describe("Contract definitions", () => {
  describe("CONTRACTS constant", () => {
    it("contains exactly 6 contracts (rounds 1-6)", () => {
      const keys = Object.keys(CONTRACTS).map(Number);
      expect(keys).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("round 1: { sets: 2, runs: 0 }", () => {
      expect(CONTRACTS[1].sets).toBe(2);
      expect(CONTRACTS[1].runs).toBe(0);
    });

    it("round 2: { sets: 1, runs: 1 }", () => {
      expect(CONTRACTS[2].sets).toBe(1);
      expect(CONTRACTS[2].runs).toBe(1);
    });

    it("round 3: { sets: 0, runs: 2 }", () => {
      expect(CONTRACTS[3].sets).toBe(0);
      expect(CONTRACTS[3].runs).toBe(2);
    });

    it("round 4: { sets: 3, runs: 0 }", () => {
      expect(CONTRACTS[4].sets).toBe(3);
      expect(CONTRACTS[4].runs).toBe(0);
    });

    it("round 5: { sets: 2, runs: 1 }", () => {
      expect(CONTRACTS[5].sets).toBe(2);
      expect(CONTRACTS[5].runs).toBe(1);
    });

    it("round 6: { sets: 1, runs: 2 }", () => {
      expect(CONTRACTS[6].sets).toBe(1);
      expect(CONTRACTS[6].runs).toBe(2);
    });

    it("each contract has roundNumber matching its key", () => {
      for (const key of [1, 2, 3, 4, 5, 6] as const) {
        expect(CONTRACTS[key].roundNumber).toBe(key);
      }
    });
  });

  describe("getContractForRound", () => {
    it("returns correct contract for rounds 1-6", () => {
      for (const round of [1, 2, 3, 4, 5, 6] as const) {
        const contract = getContractForRound(round);
        expect(contract).not.toBeNull();
        expect(contract!.roundNumber).toBe(round);
        expect(contract).toEqual(CONTRACTS[round]);
      }
    });

    it("returns null for invalid round numbers (0, 7, -1)", () => {
      expect(getContractForRound(0)).toBeNull();
      expect(getContractForRound(7)).toBeNull();
      expect(getContractForRound(-1)).toBeNull();
      expect(getContractForRound(1.5)).toBeNull();
    });
  });

  describe("minimum cards required per contract", () => {
    it("round 1 (2 sets): minimum 6 cards (3 + 3)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[1])).toBe(6);
    });

    it("round 2 (1 set + 1 run): minimum 7 cards (3 + 4)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[2])).toBe(7);
    });

    it("round 3 (2 runs): minimum 8 cards (4 + 4)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[3])).toBe(8);
    });

    it("round 4 (3 sets): minimum 9 cards (3 + 3 + 3)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[4])).toBe(9);
    });

    it("round 5 (2 sets + 1 run): minimum 10 cards (3 + 3 + 4)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[5])).toBe(10);
    });

    it("round 6 (1 set + 2 runs): minimum 11 cards (3 + 4 + 4)", () => {
      expect(getMinimumCardsForContract(CONTRACTS[6])).toBe(11);
    });
  });
});

describe("validateContractMelds", () => {
  describe("correct number of melds", () => {
    it("round 1: valid with exactly 2 sets, 0 runs", () => {
      const melds = [mockMeld("set"), mockMeld("set")];
      const result = validateContractMelds(CONTRACTS[1], melds);
      expect(result.valid).toBe(true);
    });

    it("round 1: invalid with 1 set (too few)", () => {
      const melds = [mockMeld("set")];
      const result = validateContractMelds(CONTRACTS[1], melds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("2 set(s)");
    });

    it("round 1: invalid with 3 sets (too many)", () => {
      const melds = [mockMeld("set"), mockMeld("set"), mockMeld("set")];
      const result = validateContractMelds(CONTRACTS[1], melds);
      expect(result.valid).toBe(false);
    });

    it("round 1: invalid with 2 sets + 1 run (extra run)", () => {
      const melds = [mockMeld("set"), mockMeld("set"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[1], melds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("0 run(s)");
    });

    it("round 2: valid with exactly 1 set, 1 run", () => {
      const melds = [mockMeld("set"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[2], melds);
      expect(result.valid).toBe(true);
    });

    it("round 2: invalid with 2 sets, 0 runs (wrong types)", () => {
      const melds = [mockMeld("set"), mockMeld("set")];
      const result = validateContractMelds(CONTRACTS[2], melds);
      expect(result.valid).toBe(false);
    });

    it("round 2: invalid with 0 sets, 2 runs (wrong types)", () => {
      const melds = [mockMeld("run"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[2], melds);
      expect(result.valid).toBe(false);
    });

    it("round 3: valid with exactly 0 sets, 2 runs", () => {
      const melds = [mockMeld("run"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[3], melds);
      expect(result.valid).toBe(true);
    });

    it("round 3: invalid with 1 set, 1 run", () => {
      const melds = [mockMeld("set"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[3], melds);
      expect(result.valid).toBe(false);
    });

    it("round 4: valid with exactly 3 sets, 0 runs", () => {
      const melds = [mockMeld("set"), mockMeld("set"), mockMeld("set")];
      const result = validateContractMelds(CONTRACTS[4], melds);
      expect(result.valid).toBe(true);
    });

    it("round 5: valid with exactly 2 sets, 1 run", () => {
      const melds = [mockMeld("set"), mockMeld("set"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[5], melds);
      expect(result.valid).toBe(true);
    });

    it("round 6: valid with exactly 1 set, 2 runs", () => {
      const melds = [mockMeld("set"), mockMeld("run"), mockMeld("run")];
      const result = validateContractMelds(CONTRACTS[6], melds);
      expect(result.valid).toBe(true);
    });
  });

  describe("meld type verification", () => {
    it("correctly identifies melds as sets vs runs", () => {
      // Valid set declared as set - should pass
      const validSet = meldWithCards("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      // Valid run declared as run - should pass
      const validRun = meldWithCards("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      const result = validateContractMelds(CONTRACTS[2], [validSet, validRun]);
      expect(result.valid).toBe(true);
    });

    it("rejects if meld type does not match what player claims", () => {
      // Cards form a set (same rank) but declared as run
      const misdeclared = meldWithCards("run", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      const validRun = meldWithCards("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      const result = validateContractMelds(CONTRACTS[3], [misdeclared, validRun]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid");
    });

    it("a meld of (9C 9D 9H) must be declared as set, not run", () => {
      // 9C 9D 9H declared as run should fail
      const wrongType = meldWithCards("run", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"), // Need 4 for run minimum
      ]);
      const validRun = meldWithCards("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      const result = validateContractMelds(CONTRACTS[3], [wrongType, validRun]);
      expect(result.valid).toBe(false);
    });

    it("a meld of (5S 6S 7S 8S) must be declared as run, not set", () => {
      // 5S 6S 7S 8S declared as set should fail
      const wrongType = meldWithCards("set", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
      ]);
      const validSet = meldWithCards("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);
      const result = validateContractMelds(CONTRACTS[1], [wrongType, validSet]);
      expect(result.valid).toBe(false);
    });
  });

  describe("each meld must be independently valid", () => {
    it("rejects if any set is invalid (see Phase 1 set validation)", () => {
      // Invalid set: different ranks
      const invalidSet = meldWithCards("set", [
        card("9", "clubs"),
        card("10", "diamonds"), // Wrong rank
        card("J", "hearts"), // Wrong rank
      ]);
      const validSet = meldWithCards("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);

      // Round 1 contract: 2 sets
      const result = validateContractMelds(CONTRACTS[1], [invalidSet, validSet]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid");
    });

    it("rejects if any run is invalid (see Phase 1 run validation)", () => {
      // Invalid run: not consecutive
      const invalidRun = meldWithCards("run", [
        card("5", "hearts"),
        card("6", "hearts"),
        card("8", "hearts"), // Gap - should be 7
        card("9", "hearts"),
      ]);
      const validSet = meldWithCards("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);

      // Round 2 contract: 1 set + 1 run
      const result = validateContractMelds(CONTRACTS[2], [validSet, invalidRun]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid");
    });

    it("rejects if any meld has wilds outnumbering naturals", () => {
      // Invalid: 1 natural, 2 wilds (wilds outnumber naturals)
      const tooManyWilds = meldWithCards("set", [
        card("9", "clubs"),
        card("Joker", null), // Wild
        card("2", "hearts"), // Wild (2s are wild)
      ]);
      const validSet = meldWithCards("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);

      // Round 1 contract: 2 sets
      const result = validateContractMelds(CONTRACTS[1], [tooManyWilds, validSet]);
      expect(result.valid).toBe(false);
    });

    it("all melds checked, not just first one", () => {
      const validSet = meldWithCards("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);
      // Invalid set placed second
      const invalidSet = meldWithCards("set", [
        card("9", "clubs"),
        card("10", "diamonds"), // Wrong rank
        card("J", "hearts"), // Wrong rank
      ]);

      // Round 1 contract: 2 sets - valid first, invalid second
      const result = validateContractMelds(CONTRACTS[1], [validSet, invalidSet]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid");
    });
  });

  describe("card usage", () => {
    it("each card can only appear in one meld", () => {
      // Create a card that appears in both melds
      const sharedCard: Card = { id: "shared-card-id", rank: "9", suit: "clubs" };

      const set1 = meldWithCards("set", [
        sharedCard,
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const set2 = meldWithCards("set", [
        sharedCard, // Same card used again!
        card("9", "spades"),
        { id: "9C-other", rank: "9", suit: "clubs" }, // Different 9C
      ]);

      const result = validateContractMelds(CONTRACTS[1], [set1, set2]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("duplicate");
    });

    it("rejects if same cardId appears in multiple melds", () => {
      // Different card objects but same ID
      const card1: Card = { id: "card-123", rank: "9", suit: "clubs" };
      const card2: Card = { id: "card-123", rank: "9", suit: "clubs" }; // Same ID!

      const set1 = meldWithCards("set", [
        card1,
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const set2 = meldWithCards("set", [
        card2, // Same ID as card1
        card("9", "spades"),
        { id: "9C-other", rank: "9", suit: "clubs" },
      ]);

      const result = validateContractMelds(CONTRACTS[1], [set1, set2]);
      expect(result.valid).toBe(false);
    });

    it("validates by cardId, not by rank/suit (multi-deck has duplicates)", () => {
      // Two 9 of clubs from different decks (different IDs) - should be valid
      const nineClubsDeck1: Card = { id: "9C-deck1", rank: "9", suit: "clubs" };
      const nineClubsDeck2: Card = { id: "9C-deck2", rank: "9", suit: "clubs" };

      const set1 = meldWithCards("set", [
        nineClubsDeck1,
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const set2 = meldWithCards("set", [
        nineClubsDeck2, // Different card (different ID), same rank/suit
        card("9", "spades"),
        { id: "9C-deck3", rank: "9", suit: "clubs" },
      ]);

      const result = validateContractMelds(CONTRACTS[1], [set1, set2]);
      expect(result.valid).toBe(true);
    });
  });

  describe("same-suit run gap rule", () => {
    // Helper to create a run meld with specific cards
    function runMeld(cards: Card[]): Meld {
      return {
        id: `meld-${Math.random()}`,
        type: "run",
        cards,
        ownerId: "player-1",
      };
    }

    describe("valid same-suit runs (gap >= 2)", () => {
      it("accepts 2 same-suit runs with gap of exactly 2 cards", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (bounds: 3-6)
        // Run 2: 9♠ 10♠ J♠ Q♠ (bounds: 9-12)
        // Gap: 9 - 6 - 1 = 2 cards (7♠, 8♠)
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("9", "spades"), card("10", "spades"), card("J", "spades"), card("Q", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(true);
      });

      it("accepts 2 same-suit runs with gap of more than 2 cards", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (bounds: 3-6)
        // Run 2: 10♠ J♠ Q♠ K♠ (bounds: 10-13)
        // Gap: 10 - 6 - 1 = 3 cards (7♠, 8♠, 9♠)
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("10", "spades"), card("J", "spades"), card("Q", "spades"), card("K", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(true);
      });

      it("accepts same-suit runs with wilds when gap >= 2", () => {
        // Run 1: 3♠ 4♠ Wild 6♠ (bounds: 3-6, wild represents 5♠)
        // Run 2: 9♠ Wild J♠ Q♠ (bounds: 9-12, wild represents 10♠)
        // Gap: 9 - 6 - 1 = 2 cards
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("2", "hearts"), card("6", "spades")]);
        const run2 = runMeld([card("9", "spades"), card("Joker", null), card("J", "spades"), card("Q", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(true);
      });
    });

    describe("invalid same-suit runs (gap < 2)", () => {
      it("rejects 2 same-suit runs with gap of exactly 1 card", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (bounds: 3-6)
        // Run 2: 8♠ 9♠ 10♠ J♠ (bounds: 8-11)
        // Gap: 8 - 6 - 1 = 1 card (only 7♠) - INVALID
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("8", "spades"), card("9", "spades"), card("10", "spades"), card("J", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gap");
      });

      it("rejects 2 same-suit runs that are adjacent (gap = 0)", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (bounds: 3-6)
        // Run 2: 7♠ 8♠ 9♠ 10♠ (bounds: 7-10)
        // Gap: 7 - 6 - 1 = 0 (adjacent, could be combined) - INVALID
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("7", "spades"), card("8", "spades"), card("9", "spades"), card("10", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gap");
      });

      it("rejects 2 same-suit runs that overlap", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (bounds: 3-6)
        // Run 2: 5♠ 6♠ 7♠ 8♠ (bounds: 5-8)
        // Gap: 5 - 6 - 1 = -2 (overlapping) - INVALID
        // Note: These are different physical cards (different IDs) from different decks
        const run1 = runMeld([
          { id: "3s-1", rank: "3", suit: "spades" },
          { id: "4s-1", rank: "4", suit: "spades" },
          { id: "5s-1", rank: "5", suit: "spades" },
          { id: "6s-1", rank: "6", suit: "spades" },
        ]);
        const run2 = runMeld([
          { id: "5s-2", rank: "5", suit: "spades" },
          { id: "6s-2", rank: "6", suit: "spades" },
          { id: "7s-1", rank: "7", suit: "spades" },
          { id: "8s-1", rank: "8", suit: "spades" },
        ]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gap");
      });

      it("rejects same-suit runs with wilds when gap < 2", () => {
        // Run 1: 3♠ 4♠ Wild 6♠ (bounds: 3-6)
        // Run 2: 8♠ Wild 10♠ J♠ (bounds: 8-11)
        // Gap: 8 - 6 - 1 = 1 card - INVALID
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("Joker", null), card("6", "spades")]);
        const run2 = runMeld([card("8", "spades"), card("2", "hearts"), card("10", "spades"), card("J", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gap");
      });
    });

    describe("different-suit runs (no gap requirement)", () => {
      it("accepts 2 different-suit runs regardless of position (same ranks)", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (spades)
        // Run 2: 3♥ 4♥ 5♥ 6♥ (hearts - different suit)
        // No gap requirement - should be valid
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(true);
      });

      it("accepts 2 different-suit runs that would violate gap rule if same suit", () => {
        // Run 1: 3♠ 4♠ 5♠ 6♠ (spades)
        // Run 2: 7♥ 8♥ 9♥ 10♥ (hearts - different suit, adjacent ranks)
        // Would be invalid if same suit (gap=0), but different suits so OK
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("7", "hearts"), card("8", "hearts"), card("9", "hearts"), card("10", "hearts")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(true);
      });
    });

    describe("contracts with different run counts", () => {
      it("does not apply gap rule when contract has 0 runs", () => {
        // Round 1: 2 sets, 0 runs - gap rule should not apply
        const set1 = meldWithCards("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")]);
        const set2 = meldWithCards("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);

        const result = validateContractMelds(CONTRACTS[1], [set1, set2]);
        expect(result.valid).toBe(true);
      });

      it("does not apply gap rule when contract has only 1 run", () => {
        // Round 2: 1 set + 1 run - gap rule should not apply (only 1 run)
        const set1 = meldWithCards("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")]);
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);

        const result = validateContractMelds(CONTRACTS[2], [set1, run1]);
        expect(result.valid).toBe(true);
      });

      it("applies gap rule for round 6 (1 set + 2 runs)", () => {
        // Round 6: 1 set + 2 runs - gap rule applies to the 2 runs if same suit
        const set1 = meldWithCards("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")]);
        // Invalid: adjacent same-suit runs
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("7", "spades"), card("8", "spades"), card("9", "spades"), card("10", "spades")]);

        const result = validateContractMelds(CONTRACTS[6], [set1, run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gap");
      });

      it("round 6 valid with different-suit runs", () => {
        // Round 6: 1 set + 2 runs of different suits - valid
        const set1 = meldWithCards("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")]);
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")]);

        const result = validateContractMelds(CONTRACTS[6], [set1, run1, run2]);
        expect(result.valid).toBe(true);
      });
    });

    describe("error message quality", () => {
      it("error message mentions the affected suits", () => {
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("7", "spades"), card("8", "spades"), card("9", "spades"), card("10", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("spades");
      });

      it("error message describes the gap requirement", () => {
        const run1 = runMeld([card("3", "spades"), card("4", "spades"), card("5", "spades"), card("6", "spades")]);
        const run2 = runMeld([card("8", "spades"), card("9", "spades"), card("10", "spades"), card("J", "spades")]);

        const result = validateContractMelds(CONTRACTS[3], [run1, run2]);
        expect(result.valid).toBe(false);
        // Should mention that 2 cards gap is required
        expect(result.error?.toLowerCase()).toMatch(/gap|2|two|cards/);
      });
    });
  });
});
