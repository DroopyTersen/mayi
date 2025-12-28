import { describe, it, expect } from "bun:test";
import { CONTRACTS, getContractForRound, getMinimumCardsForContract } from "./contracts";

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
    it.todo("returns correct contract for rounds 1-6", () => {});
    it.todo("throws or returns null for invalid round numbers (0, 7, -1)", () => {});
  });

  describe("minimum cards required per contract", () => {
    it.todo("round 1 (2 sets): minimum 6 cards (3 + 3)", () => {});
    it.todo("round 2 (1 set + 1 run): minimum 7 cards (3 + 4)", () => {});
    it.todo("round 3 (2 runs): minimum 8 cards (4 + 4)", () => {});
    it.todo("round 4 (3 sets): minimum 9 cards (3 + 3 + 3)", () => {});
    it.todo("round 5 (2 sets + 1 run): minimum 10 cards (3 + 3 + 4)", () => {});
    it.todo("round 6 (1 set + 2 runs): minimum 11 cards (3 + 4 + 4)", () => {});
  });
});

describe("validateContract", () => {
  describe("correct number of melds", () => {
    it.todo("round 1: valid with exactly 2 sets, 0 runs", () => {});
    it.todo("round 1: invalid with 1 set (too few)", () => {});
    it.todo("round 1: invalid with 3 sets (too many)", () => {});
    it.todo("round 1: invalid with 2 sets + 1 run (extra run)", () => {});
    it.todo("round 2: valid with exactly 1 set, 1 run", () => {});
    it.todo("round 2: invalid with 2 sets, 0 runs (wrong types)", () => {});
    it.todo("round 2: invalid with 0 sets, 2 runs (wrong types)", () => {});
    it.todo("round 3: valid with exactly 0 sets, 2 runs", () => {});
    it.todo("round 3: invalid with 1 set, 1 run", () => {});
    it.todo("round 4: valid with exactly 3 sets, 0 runs", () => {});
    it.todo("round 5: valid with exactly 2 sets, 1 run", () => {});
    it.todo("round 6: valid with exactly 1 set, 2 runs", () => {});
  });

  describe("meld type verification", () => {
    it.todo("correctly identifies melds as sets vs runs", () => {});
    it.todo("rejects if meld type does not match what player claims", () => {});
    it.todo("a meld of (9C 9D 9H) must be declared as set, not run", () => {});
    it.todo("a meld of (5S 6S 7S 8S) must be declared as run, not set", () => {});
  });

  describe("each meld must be independently valid", () => {
    it.todo("rejects if any set is invalid (see Phase 1 set validation)", () => {});
    it.todo("rejects if any run is invalid (see Phase 1 run validation)", () => {});
    it.todo("rejects if any meld has wilds outnumbering naturals", () => {});
    it.todo("all melds checked, not just first one", () => {});
  });

  describe("card usage", () => {
    it.todo("each card can only appear in one meld", () => {});
    it.todo("rejects if same cardId appears in multiple melds", () => {});
    it.todo("validates by cardId, not by rank/suit (multi-deck has duplicates)", () => {});
  });
});
