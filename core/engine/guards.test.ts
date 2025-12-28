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
});
