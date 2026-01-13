import { describe, it, expect } from "bun:test";
import {
  notDownYet,
  meetsContract,
  validMelds,
  wildsNotOutnumbered,
  canLayDown,
  buildMeldsFromProposals,
} from "./guards";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber } from "./engine.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function joker(): Card {
  return { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
}

function createMeld(ownerId: string, cards: Card[], type: "set" | "run"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

describe("notDownYet guard", () => {
  it("returns true when player.isDown is false", () => {
    expect(notDownYet(false)).toBe(true);
  });

  it("returns false when player.isDown is true", () => {
    expect(notDownYet(true)).toBe(false);
  });

  it("uses current player's state, not other players", () => {
    // This test verifies the guard only uses the isDown parameter
    // In the actual game, this would be the current player's isDown
    expect(notDownYet(false)).toBe(true);
    expect(notDownYet(true)).toBe(false);
  });
});

describe("meetsContract guard", () => {
  describe("round 1 - 2 sets", () => {
    it("returns true for exactly 2 valid sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      expect(meetsContract(1, [meld1, meld2])).toBe(true);
    });

    it("returns false for 1 set", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      expect(meetsContract(1, [meld1])).toBe(false);
    });

    it("returns false for 3 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], "set");
      expect(meetsContract(1, [meld1, meld2, meld3])).toBe(false);
    });

    it("returns false for 1 set + 1 run", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(1, [meld1, meld2])).toBe(false);
    });

    it("returns false for 2 runs", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld2 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      expect(meetsContract(1, [meld1, meld2])).toBe(false);
    });
  });

  describe("round 2 - 1 set + 1 run", () => {
    it("returns true for exactly 1 valid set + 1 valid run", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(2, [meld1, meld2])).toBe(true);
    });

    it("returns false for 2 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      expect(meetsContract(2, [meld1, meld2])).toBe(false);
    });

    it("returns false for 2 runs", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld2 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      expect(meetsContract(2, [meld1, meld2])).toBe(false);
    });

    it("returns false for 1 set only", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      expect(meetsContract(2, [meld1])).toBe(false);
    });

    it("returns false for 1 run only", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(2, [meld1])).toBe(false);
    });
  });

  describe("round 3 - 2 runs", () => {
    it("returns true for exactly 2 valid runs", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld2 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      expect(meetsContract(3, [meld1, meld2])).toBe(true);
    });

    it("returns false for 1 run", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(3, [meld1])).toBe(false);
    });

    it("returns false for 2 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      expect(meetsContract(3, [meld1, meld2])).toBe(false);
    });
  });

  describe("round 4 - 3 sets", () => {
    it("returns true for exactly 3 valid sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], "set");
      expect(meetsContract(4, [meld1, meld2, meld3])).toBe(true);
    });

    it("returns false for 2 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      expect(meetsContract(4, [meld1, meld2])).toBe(false);
    });

    it("returns false for 4 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], "set");
      const meld4 = createMeld("p1", [card("J", "clubs"), card("J", "diamonds"), card("J", "hearts")], "set");
      expect(meetsContract(4, [meld1, meld2, meld3, meld4])).toBe(false);
    });
  });

  describe("round 5 - 2 sets + 1 run", () => {
    it("returns true for exactly 2 valid sets + 1 valid run", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(5, [meld1, meld2, meld3])).toBe(true);
    });

    it("returns false for 3 sets", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], "set");
      expect(meetsContract(5, [meld1, meld2, meld3])).toBe(false);
    });

    it("returns false for 1 set + 2 runs", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld3 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      expect(meetsContract(5, [meld1, meld2, meld3])).toBe(false);
    });
  });

  describe("round 6 - 1 set + 2 runs", () => {
    it("returns true for exactly 1 valid set + 2 valid runs", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld3 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      expect(meetsContract(6, [meld1, meld2, meld3])).toBe(true);
    });

    it("returns false for 2 sets + 1 run", () => {
      const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
      const meld2 = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
      const meld3 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      expect(meetsContract(6, [meld1, meld2, meld3])).toBe(false);
    });

    it("returns false for 3 runs", () => {
      const meld1 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
      const meld2 = createMeld("p1", [card("7", "clubs"), card("8", "clubs"), card("9", "clubs"), card("10", "clubs")], "run");
      const meld3 = createMeld("p1", [card("A", "spades"), card("2", "spades"), card("3", "spades"), card("4", "spades")], "run");
      expect(meetsContract(6, [meld1, meld2, meld3])).toBe(false);
    });
  });
});

describe("validMelds guard", () => {
  it("returns true if all proposed melds are valid", () => {
    const meld1 = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
    const meld2 = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
    expect(validMelds([meld1, meld2])).toBe(true);
  });

  it("returns false if any meld is invalid", () => {
    const validSet = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
    const invalidRun = createMeld("p1", [card("3", "hearts"), card("5", "hearts"), card("6", "hearts"), card("7", "hearts")], "run"); // gap
    expect(validMelds([validSet, invalidRun])).toBe(false);
  });

  it("checks set validity rules (same rank, 3+ cards)", () => {
    // Valid set
    const validSet = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
    expect(validMelds([validSet])).toBe(true);

    // Invalid set - different ranks
    const invalidSet = createMeld("p1", [card("9", "clubs"), card("K", "diamonds"), card("9", "hearts")], "set");
    expect(validMelds([invalidSet])).toBe(false);

    // Invalid set - only 2 cards
    const tooSmall = createMeld("p1", [card("9", "clubs"), card("9", "diamonds")], "set");
    expect(validMelds([tooSmall])).toBe(false);
  });

  it("checks run validity rules (same suit, consecutive, 4+ cards)", () => {
    // Valid run
    const validRun = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")], "run");
    expect(validMelds([validRun])).toBe(true);

    // Invalid run - different suits
    const mixedSuits = createMeld("p1", [card("3", "hearts"), card("4", "clubs"), card("5", "hearts"), card("6", "hearts")], "run");
    expect(validMelds([mixedSuits])).toBe(false);

    // Invalid run - only 3 cards
    const tooSmall = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts")], "run");
    expect(validMelds([tooSmall])).toBe(false);
  });

  it("validates each meld independently", () => {
    const validSet = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
    const anotherValidSet = createMeld("p1", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "set");
    expect(validMelds([validSet, anotherValidSet])).toBe(true);

    // Mixing one valid and one invalid should fail
    const invalidRun = createMeld("p1", [card("3", "hearts"), card("4", "hearts"), card("5", "hearts")], "run");
    expect(validMelds([validSet, invalidRun])).toBe(false);
  });
});

describe("wildsNotOutnumbered guard", () => {
  it("returns true if all melds have valid wild ratio", () => {
    // 2 naturals, 1 wild - valid
    const meld = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("2", "hearts")], "set");
    expect(wildsNotOutnumbered([meld])).toBe(true);
  });

  it("returns false if any meld has wilds > naturals", () => {
    // 1 natural, 2 wilds - invalid
    const meld = createMeld("p1", [card("9", "clubs"), card("2", "diamonds"), card("2", "hearts")], "set");
    expect(wildsNotOutnumbered([meld])).toBe(false);
  });

  it("checks each meld independently", () => {
    const validMeld = createMeld("p1", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], "set");
    const invalidMeld = createMeld("p1", [card("K", "clubs"), card("2", "diamonds"), card("2", "hearts")], "set"); // 1 natural, 2 wilds

    expect(wildsNotOutnumbered([validMeld])).toBe(true);
    expect(wildsNotOutnumbered([invalidMeld])).toBe(false);
    expect(wildsNotOutnumbered([validMeld, invalidMeld])).toBe(false);
  });

  it("equal wilds to naturals is acceptable", () => {
    // 2 naturals, 2 wilds - valid (equal is ok)
    const meld = createMeld("p1", [
      card("9", "clubs"),
      card("9", "diamonds"),
      card("2", "hearts"),
      card("2", "spades"),
    ], "set");
    expect(wildsNotOutnumbered([meld])).toBe(true);
  });
});

describe("canLayDown composite guard", () => {
  it("combines: notDownYet AND meetsContract AND validMelds AND wildsNotOutnumbered", () => {
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");
    const nineH = card("9", "hearts");
    const kingC = card("K", "clubs");
    const kingD = card("K", "diamonds");
    const kingH = card("K", "hearts");
    const extra = card("5", "spades");

    const context = {
      isDown: false,
      hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      roundNumber: 1 as RoundNumber,
      playerId: "player-1",
    };

    const proposals = [
      { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
      { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
    ];

    expect(canLayDown(context, proposals)).toBe(true);
  });

  it("all must be true for lay down to proceed", () => {
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");
    const nineH = card("9", "hearts");
    const kingC = card("K", "clubs");
    const kingD = card("K", "diamonds");
    const kingH = card("K", "hearts");

    // Test: already down -> fails
    const alreadyDownContext = {
      isDown: true,
      hand: [nineC, nineD, nineH, kingC, kingD, kingH],
      roundNumber: 1 as RoundNumber,
      playerId: "player-1",
    };
    const validProposals = [
      { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
      { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
    ];
    expect(canLayDown(alreadyDownContext, validProposals)).toBe(false);

    // Test: wrong contract -> fails
    const wrongContractContext = {
      isDown: false,
      hand: [nineC, nineD, nineH, kingC, kingD, kingH],
      roundNumber: 1 as RoundNumber,
      playerId: "player-1",
    };
    const wrongProposals = [
      { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
      // Only 1 set, need 2 for round 1
    ];
    expect(canLayDown(wrongContractContext, wrongProposals)).toBe(false);

    // Test: card not in hand -> fails
    const missingCardContext = {
      isDown: false,
      hand: [nineC, nineD, nineH], // Missing kings
      roundNumber: 1 as RoundNumber,
      playerId: "player-1",
    };
    expect(canLayDown(missingCardContext, validProposals)).toBe(false);
  });

  it("short-circuits on first failure (optional optimization)", () => {
    // This test verifies that if isDown is true, we don't need to check other guards
    const context = {
      isDown: true,
      hand: [],
      roundNumber: 1 as RoundNumber,
      playerId: "player-1",
    };

    // Even with empty proposals, should fail due to isDown
    expect(canLayDown(context, [])).toBe(false);
  });
});

describe("buildMeldsFromProposals", () => {
  it("returns melds when all cards are in hand", () => {
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");
    const nineH = card("9", "hearts");

    const hand = [nineC, nineD, nineH];
    const proposals = [{ type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] }];

    const result = buildMeldsFromProposals(proposals, hand, "player-1");
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0]!.cards.length).toBe(3);
    expect(result![0]!.ownerId).toBe("player-1");
  });

  it("returns null when a card is not in hand", () => {
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");

    const hand = [nineC, nineD]; // Missing nineH
    const proposals = [{ type: "set" as const, cardIds: [nineC.id, nineD.id, "missing-card-id"] }];

    const result = buildMeldsFromProposals(proposals, hand, "player-1");
    expect(result).toBeNull();
  });

  describe("run auto-sorting", () => {
    it("auto-sorts run cards given in descending order", () => {
      // Cards selected in descending order: K, Q, J, 10
      const tenH = card("10", "hearts");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");
      const kingH = card("K", "hearts");

      const hand = [kingH, queenH, jackH, tenH];
      const proposals = [
        { type: "run" as const, cardIds: [kingH.id, queenH.id, jackH.id, tenH.id] },
      ];

      const result = buildMeldsFromProposals(proposals, hand, "player-1");
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);

      // Cards should be normalized to ascending order: 10, J, Q, K
      const ranks = result![0]!.cards.map((c) => c.rank);
      expect(ranks).toEqual(["10", "J", "Q", "K"]);
    });

    it("auto-sorts run cards given in random order", () => {
      // Cards selected in random order: Q, 10, K, J
      const tenH = card("10", "hearts");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");
      const kingH = card("K", "hearts");

      const hand = [queenH, tenH, kingH, jackH];
      const proposals = [
        { type: "run" as const, cardIds: [queenH.id, tenH.id, kingH.id, jackH.id] },
      ];

      const result = buildMeldsFromProposals(proposals, hand, "player-1");
      expect(result).not.toBeNull();

      const ranks = result![0]!.cards.map((c) => c.rank);
      expect(ranks).toEqual(["10", "J", "Q", "K"]);
    });

    it("auto-sorts run cards with wilds filling gaps", () => {
      // 5, Joker, 7, 8 - Joker fills the 6 position
      const fiveS = card("5", "spades");
      const wildJoker = joker();
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");

      const hand = [eightS, wildJoker, fiveS, sevenS];
      const proposals = [
        { type: "run" as const, cardIds: [eightS.id, wildJoker.id, fiveS.id, sevenS.id] },
      ];

      const result = buildMeldsFromProposals(proposals, hand, "player-1");
      expect(result).not.toBeNull();

      // Should be normalized to: 5, Joker, 7, 8
      const resultCards = result![0]!.cards;
      expect(resultCards[0]!.rank).toBe("5");
      expect(resultCards[1]!.rank).toBe("Joker");
      expect(resultCards[2]!.rank).toBe("7");
      expect(resultCards[3]!.rank).toBe("8");
    });

    it("does not modify set proposals", () => {
      // Sets should not be auto-sorted
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");

      const hand = [nineH, nineC, nineD];
      const proposals = [
        { type: "set" as const, cardIds: [nineH.id, nineC.id, nineD.id] },
      ];

      const result = buildMeldsFromProposals(proposals, hand, "player-1");
      expect(result).not.toBeNull();

      // Set order should be preserved as given
      expect(result![0]!.cards[0]).toBe(nineH);
      expect(result![0]!.cards[1]).toBe(nineC);
      expect(result![0]!.cards[2]).toBe(nineD);
    });

    it("preserves original order for invalid runs (lets validation catch it)", () => {
      // Mixed suits can't form a valid run - normalizer should fail, original order preserved
      const fiveS = card("5", "spades");
      const sixH = card("6", "hearts"); // Different suit!
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");

      const hand = [fiveS, sixH, sevenS, eightS];
      const proposals = [
        { type: "run" as const, cardIds: [fiveS.id, sixH.id, sevenS.id, eightS.id] },
      ];

      const result = buildMeldsFromProposals(proposals, hand, "player-1");
      expect(result).not.toBeNull();

      // Original order preserved since normalization fails on mixed suits
      expect(result![0]!.cards[0]).toBe(fiveS);
      expect(result![0]!.cards[1]).toBe(sixH);
      expect(result![0]!.cards[2]).toBe(sevenS);
      expect(result![0]!.cards[3]).toBe(eightS);
    });
  });
});

describe("canLayDown with auto-sorted runs", () => {
  it("accepts a run proposal with cards in descending order (round 2)", () => {
    // Round 2 requires 1 set + 1 run
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");
    const nineH = card("9", "hearts");
    // Run cards in descending order
    const tenH = card("10", "hearts");
    const jackH = card("J", "hearts");
    const queenH = card("Q", "hearts");
    const kingH = card("K", "hearts");
    const extra = card("5", "spades");

    const context = {
      isDown: false,
      hand: [nineC, nineD, nineH, kingH, queenH, jackH, tenH, extra],
      roundNumber: 2 as RoundNumber,
      playerId: "player-1",
    };

    const proposals = [
      { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
      // Run specified in descending order - should still be accepted due to auto-sort
      { type: "run" as const, cardIds: [kingH.id, queenH.id, jackH.id, tenH.id] },
    ];

    expect(canLayDown(context, proposals)).toBe(true);
  });

  it("accepts a run proposal with cards in random order (round 3)", () => {
    // Round 3 requires 2 runs
    const threeH = card("3", "hearts");
    const fourH = card("4", "hearts");
    const fiveH = card("5", "hearts");
    const sixH = card("6", "hearts");
    const sevenC = card("7", "clubs");
    const eightC = card("8", "clubs");
    const nineC = card("9", "clubs");
    const tenC = card("10", "clubs");
    const extra = card("K", "spades");

    const context = {
      isDown: false,
      hand: [sixH, threeH, fiveH, fourH, tenC, sevenC, nineC, eightC, extra],
      roundNumber: 3 as RoundNumber,
      playerId: "player-1",
    };

    const proposals = [
      // Both runs in random order
      { type: "run" as const, cardIds: [sixH.id, threeH.id, fiveH.id, fourH.id] },
      { type: "run" as const, cardIds: [tenC.id, sevenC.id, nineC.id, eightC.id] },
    ];

    expect(canLayDown(context, proposals)).toBe(true);
  });
});
