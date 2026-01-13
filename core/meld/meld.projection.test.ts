/**
 * Tests for meld.projection.ts - computing effective melds with staged lay-offs
 *
 * TDD: These tests are written FIRST, before implementation.
 */

import { describe, it, expect } from "bun:test";
import type { Card } from "../card/card.types";
import type { Meld } from "./meld.types";
import { applyLayOffToMeld, getEffectiveMeld } from "./meld.projection";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"], id?: string): Card {
  return { id: id ?? `${rank}-${suit}`, rank, suit };
}

// Helper to create a run meld
function runMeld(id: string, ownerId: string, cards: Card[]): Meld {
  return { id, type: "run", cards, ownerId };
}

// Helper to create a set meld
function setMeld(id: string, ownerId: string, cards: Card[]): Meld {
  return { id, type: "set", cards, ownerId };
}

describe("applyLayOffToMeld", () => {
  describe("applying to runs", () => {
    it("should prepend card when position is 'start'", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const layOffCard = card("6", "hearts");

      const result = applyLayOffToMeld(meld, layOffCard, "start");

      expect(result.cards).toHaveLength(4);
      expect(result.cards[0]?.rank).toBe("6");
      expect(result.cards[1]?.rank).toBe("7");
      expect(result.cards[2]?.rank).toBe("8");
      expect(result.cards[3]?.rank).toBe("9");
    });

    it("should append card when position is 'end'", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const layOffCard = card("10", "hearts");

      const result = applyLayOffToMeld(meld, layOffCard, "end");

      expect(result.cards).toHaveLength(4);
      expect(result.cards[0]?.rank).toBe("7");
      expect(result.cards[1]?.rank).toBe("8");
      expect(result.cards[2]?.rank).toBe("9");
      expect(result.cards[3]?.rank).toBe("10");
    });

    it("should append card when position is undefined", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const layOffCard = card("10", "hearts");

      const result = applyLayOffToMeld(meld, layOffCard, undefined);

      expect(result.cards).toHaveLength(4);
      expect(result.cards[3]?.rank).toBe("10");
    });

    it("should prepend wild card when position is 'start'", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const wild = card("2", "spades", "wild-1");

      const result = applyLayOffToMeld(meld, wild, "start");

      expect(result.cards).toHaveLength(4);
      expect(result.cards[0]?.id).toBe("wild-1");
      expect(result.cards[1]?.rank).toBe("7");
    });

    it("should append wild card when position is 'end'", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const wild = card("2", "spades", "wild-1");

      const result = applyLayOffToMeld(meld, wild, "end");

      expect(result.cards).toHaveLength(4);
      expect(result.cards[3]?.id).toBe("wild-1");
    });

    it("should append joker when position is 'end'", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const joker: Card = { id: "joker-1", rank: "Joker", suit: null };

      const result = applyLayOffToMeld(meld, joker, "end");

      expect(result.cards).toHaveLength(4);
      expect(result.cards[3]?.rank).toBe("Joker");
    });
  });

  describe("applying to sets", () => {
    it("should add card to set (position ignored)", () => {
      const meld = setMeld("m1", "p1", [
        card("7", "hearts"),
        card("7", "diamonds"),
        card("7", "clubs"),
      ]);
      const layOffCard = card("7", "spades");

      const result = applyLayOffToMeld(meld, layOffCard, "start");

      expect(result.cards).toHaveLength(4);
      // For sets, cards are just appended (position doesn't matter)
      expect(result.cards.some((c) => c.id === layOffCard.id)).toBe(true);
    });

    it("should add wild to set", () => {
      const meld = setMeld("m1", "p1", [
        card("7", "hearts"),
        card("7", "diamonds"),
        card("7", "clubs"),
      ]);
      const wild = card("2", "spades", "wild-1");

      const result = applyLayOffToMeld(meld, wild, undefined);

      expect(result.cards).toHaveLength(4);
      expect(result.cards.some((c) => c.id === "wild-1")).toBe(true);
    });
  });

  describe("preserving meld properties", () => {
    it("should preserve meld id, type, and ownerId", () => {
      const meld = runMeld("original-id", "player-123", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const layOffCard = card("6", "hearts");

      const result = applyLayOffToMeld(meld, layOffCard, "start");

      expect(result.id).toBe("original-id");
      expect(result.type).toBe("run");
      expect(result.ownerId).toBe("player-123");
    });

    it("should not mutate the original meld", () => {
      const originalCards = [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ];
      const meld = runMeld("m1", "p1", originalCards);
      const layOffCard = card("6", "hearts");

      applyLayOffToMeld(meld, layOffCard, "start");

      expect(meld.cards).toHaveLength(3);
      expect(meld.cards[0]?.rank).toBe("7");
    });
  });
});

describe("getEffectiveMeld", () => {
  describe("with no staged lay-offs", () => {
    it("should return the original meld unchanged", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const stagedLayOffs: Array<{
        cardId: string;
        meldId: string;
        position?: "start" | "end";
      }> = [];
      const hand: Card[] = [];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(3);
      expect(result.cards[0]?.rank).toBe("7");
      expect(result.cards[1]?.rank).toBe("8");
      expect(result.cards[2]?.rank).toBe("9");
    });
  });

  describe("with single staged lay-off", () => {
    it("should apply one staged card at start", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const sixOfHearts = card("6", "hearts", "card-6");
      const hand = [sixOfHearts];
      const stagedLayOffs = [{ cardId: "card-6", meldId: "m1", position: "start" as const }];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(4);
      expect(result.cards[0]?.rank).toBe("6");
      expect(result.cards[1]?.rank).toBe("7");
    });

    it("should apply one staged card at end", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const tenOfHearts = card("10", "hearts", "card-10");
      const hand = [tenOfHearts];
      const stagedLayOffs = [{ cardId: "card-10", meldId: "m1", position: "end" as const }];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(4);
      expect(result.cards[3]?.rank).toBe("10");
    });
  });

  describe("with multiple staged lay-offs to same meld", () => {
    it("should apply two cards at start in correct order", () => {
      // This is the core bug scenario:
      // Run: [7,8,9,10] of hearts
      // Stage 6 at start -> [6,7,8,9,10]
      // Stage 5 at start -> [5,6,7,8,9,10]
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
        card("10", "hearts"),
      ]);
      const sixOfHearts = card("6", "hearts", "card-6");
      const fiveOfHearts = card("5", "hearts", "card-5");
      const hand = [sixOfHearts, fiveOfHearts];
      const stagedLayOffs = [
        { cardId: "card-6", meldId: "m1", position: "start" as const },
        { cardId: "card-5", meldId: "m1", position: "start" as const },
      ];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(6);
      // Cards staged at start should prepend in order staged
      // First staged (6) prepends to get [6,7,8,9,10]
      // Second staged (5) prepends to get [5,6,7,8,9,10]
      expect(result.cards[0]?.rank).toBe("5");
      expect(result.cards[1]?.rank).toBe("6");
      expect(result.cards[2]?.rank).toBe("7");
    });

    it("should apply two cards at end in correct order", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const tenOfHearts = card("10", "hearts", "card-10");
      const jackOfHearts = card("J", "hearts", "card-J");
      const hand = [tenOfHearts, jackOfHearts];
      const stagedLayOffs = [
        { cardId: "card-10", meldId: "m1", position: "end" as const },
        { cardId: "card-J", meldId: "m1", position: "end" as const },
      ];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(5);
      expect(result.cards[3]?.rank).toBe("10");
      expect(result.cards[4]?.rank).toBe("J");
    });

    it("should apply cards at both start and end", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const sixOfHearts = card("6", "hearts", "card-6");
      const tenOfHearts = card("10", "hearts", "card-10");
      const hand = [sixOfHearts, tenOfHearts];
      const stagedLayOffs = [
        { cardId: "card-6", meldId: "m1", position: "start" as const },
        { cardId: "card-10", meldId: "m1", position: "end" as const },
      ];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(5);
      expect(result.cards[0]?.rank).toBe("6");
      expect(result.cards[4]?.rank).toBe("10");
    });
  });

  describe("with staged lay-offs to different melds", () => {
    it("should only apply staged cards for the target meld", () => {
      const meld1 = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const sixOfHearts = card("6", "hearts", "card-6");
      const tenOfClubs = card("10", "clubs", "card-10");
      const hand = [sixOfHearts, tenOfClubs];
      const stagedLayOffs = [
        { cardId: "card-6", meldId: "m1", position: "start" as const },
        { cardId: "card-10", meldId: "m2", position: "end" as const }, // Different meld
      ];

      const result = getEffectiveMeld(meld1, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(4); // Only the 6 is applied
      expect(result.cards[0]?.rank).toBe("6");
    });
  });

  describe("with wild cards", () => {
    it("should apply wild card at start", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const wild = card("2", "spades", "wild-1");
      const hand = [wild];
      const stagedLayOffs = [{ cardId: "wild-1", meldId: "m1", position: "start" as const }];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(4);
      expect(result.cards[0]?.id).toBe("wild-1");
    });

    it("should apply multiple wilds correctly", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const wild1 = card("2", "spades", "wild-1");
      const wild2: Card = { id: "joker-1", rank: "Joker", suit: null };
      const hand = [wild1, wild2];
      const stagedLayOffs = [
        { cardId: "wild-1", meldId: "m1", position: "start" as const },
        { cardId: "joker-1", meldId: "m1", position: "end" as const },
      ];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(5);
      expect(result.cards[0]?.id).toBe("wild-1");
      expect(result.cards[4]?.id).toBe("joker-1");
    });
  });

  describe("edge cases", () => {
    it("should handle card not found in hand gracefully", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const hand: Card[] = []; // Empty hand - card not found
      const stagedLayOffs = [{ cardId: "missing-card", meldId: "m1", position: "start" as const }];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      // Should skip the missing card and return original meld
      expect(result.cards).toHaveLength(3);
    });

    it("should handle empty staged lay-offs array", () => {
      const meld = runMeld("m1", "p1", [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ]);
      const hand: Card[] = [];
      const stagedLayOffs: Array<{
        cardId: string;
        meldId: string;
        position?: "start" | "end";
      }> = [];

      const result = getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(result.cards).toHaveLength(3);
    });

    it("should not mutate the original meld when applying multiple lay-offs", () => {
      const originalCards = [
        card("7", "hearts"),
        card("8", "hearts"),
        card("9", "hearts"),
      ];
      const meld = runMeld("m1", "p1", originalCards);
      const sixOfHearts = card("6", "hearts", "card-6");
      const fiveOfHearts = card("5", "hearts", "card-5");
      const hand = [sixOfHearts, fiveOfHearts];
      const stagedLayOffs = [
        { cardId: "card-6", meldId: "m1", position: "start" as const },
        { cardId: "card-5", meldId: "m1", position: "start" as const },
      ];

      getEffectiveMeld(meld, stagedLayOffs, hand);

      expect(meld.cards).toHaveLength(3);
      expect(meld.cards[0]?.rank).toBe("7");
    });
  });
});
