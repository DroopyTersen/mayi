import { describe, it, expect } from "bun:test";
import {
  parseLayDownInput,
  inferMeldType,
  inferMeldTypes,
  formatMeldPreview,
  validateLayDown,
} from "./cli.laydown";
import type { Card } from "../core/card/card.types";
import { renderCard } from "./cli.renderer";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

describe("parseLayDownInput", () => {
  describe("card selection syntax", () => {
    it("parses 'l 1,2,3 4,5,6,7' as LAY_DOWN with two melds", () => {
      const result = parseLayDownInput("l 1,2,3 4,5,6,7", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds.length).toBe(2);
      }
    });

    it("first group '1,2,3' is first meld (card positions)", () => {
      const result = parseLayDownInput("l 1,2,3 4,5,6,7", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds[0]!.positions).toEqual([1, 2, 3]);
      }
    });

    it("second group '4,5,6,7' is second meld", () => {
      const result = parseLayDownInput("l 1,2,3 4,5,6,7", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds[1]!.positions).toEqual([4, 5, 6, 7]);
      }
    });

    it("positions are 1-indexed", () => {
      const result = parseLayDownInput("l 1,2,3", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        // Position 1 refers to the first card (index 0)
        expect(result.melds[0]!.positions[0]).toBe(1);
      }
    });

    it("spaces separate melds", () => {
      const result = parseLayDownInput("l 1,2,3 4,5,6 7,8,9", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds.length).toBe(3);
      }
    });

    it("commas separate cards within meld", () => {
      const result = parseLayDownInput("l 1,2,3,4,5", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds[0]!.positions).toEqual([1, 2, 3, 4, 5]);
      }
    });
  });

  describe("meld type inference", () => {
    it("determines if each group is set or run based on cards", () => {
      // 3 cards same rank -> set
      const setCards = [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")];
      expect(inferMeldType(setCards)).toBe("set");

      // Cards different ranks -> run
      const runCards = [card("5", "hearts"), card("6", "hearts"), card("7", "hearts"), card("8", "hearts")];
      expect(inferMeldType(runCards)).toBe("run");
    });

    it("3 cards same rank -> set", () => {
      const cards = [card("K", "clubs"), card("K", "diamonds"), card("K", "spades")];
      expect(inferMeldType(cards)).toBe("set");
    });

    it("4+ cards same suit consecutive -> run", () => {
      const cards = [
        card("5", "diamonds"),
        card("6", "diamonds"),
        card("7", "diamonds"),
        card("8", "diamonds"),
      ];
      expect(inferMeldType(cards)).toBe("run");
    });
  });

  describe("validation", () => {
    it("rejects positions outside hand range", () => {
      const result = parseLayDownInput("l 1,2,15", 12);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("outside hand range");
      }
    });

    it("rejects duplicate positions across melds", () => {
      const result = parseLayDownInput("l 1,2,3 3,4,5", 12);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("position 3");
        expect(result.message).toContain("multiple melds");
      }
    });

    it("rejects empty meld groups", () => {
      const result = parseLayDownInput("l", 12);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("No cards");
      }
    });

    it("provides helpful error messages", () => {
      const result = parseLayDownInput("l abc", 12);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("Invalid");
      }
    });
  });

  describe("alternative syntaxes", () => {
    it("'l 1 2 3 / 4 5 6 7' with slash separator", () => {
      const result = parseLayDownInput("l 1 2 3 / 4 5 6 7", 12);
      expect(result.type).toBe("LAY_DOWN");
      if (result.type === "LAY_DOWN") {
        expect(result.melds.length).toBe(2);
        expect(result.melds[0]!.positions).toEqual([1, 2, 3]);
        expect(result.melds[1]!.positions).toEqual([4, 5, 6, 7]);
      }
    });
  });
});

describe("lay down confirmation flow", () => {
  it("shows proposed melds before confirming", () => {
    const meld = {
      type: "set" as const,
      positions: [1, 2, 3],
      cards: [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")],
    };
    const preview = formatMeldPreview(meld, renderCard);
    expect(preview).toContain("Set:");
    expect(preview).toContain("9");
  });

  it("allows player to cancel and re-enter", () => {
    // This is a UI flow test - the validation function allows re-entry
    const result = validateLayDown([]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("No melds");
    }
  });

  it("validates melds before sending command", () => {
    // Test that inferMeldTypes validates melds
    const hand = [
      card("9", "clubs"),
      card("K", "diamonds"),
      card("Q", "hearts"),
    ];
    const result = inferMeldTypes([{ positions: [1, 2, 3] }], hand);

    // These don't form a valid set or run
    expect(result.type).toBe("error");
  });

  it("provides preview: 'Set: 9C 9D 9H'", () => {
    const meld = {
      type: "set" as const,
      positions: [1, 2, 3],
      cards: [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")],
    };
    const preview = formatMeldPreview(meld, renderCard);
    expect(preview).toMatch(/Set:/);
    expect(preview).toContain("9♣");
    expect(preview).toContain("9♦");
    expect(preview).toContain("9♥");
  });

  it("shows rejection reason if invalid", () => {
    const hand = [
      card("9", "clubs"),
      card("K", "diamonds"),
      card("Q", "hearts"),
    ];
    const result = inferMeldTypes([{ positions: [1, 2, 3] }], hand);

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("valid");
    }
  });
});
