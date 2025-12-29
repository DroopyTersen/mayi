/**
 * Tests for CLI interactive input parsing utilities
 *
 * Consolidated tests for draw, discard, lay down, reorder, and swap commands.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  parseDrawCommand,
  parseDiscardCommand,
  parseReorderCommand,
  parseLayDownInput,
  inferMeldType,
  inferMeldTypes,
  formatMeldPreview,
  validateLayDown,
  parseSwapCommand,
  renderSwapSuccess,
  renderSwapError,
  renderAvailableSwaps,
} from "./interactive.input";
import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { WildPosition } from "../../core/meld/meld.joker";
import { renderCard } from "../shared/cli.renderer";

// =============================================================================
// Test helpers
// =============================================================================

let cardId = 0;

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

function makeRun(cards: Card[], ownerId = "player1"): Meld {
  return { id: `meld-${cardId++}`, type: "run", cards, ownerId };
}

beforeEach(() => {
  cardId = 0;
});

// =============================================================================
// Draw Command Tests
// =============================================================================

describe("parseDrawCommand", () => {
  it("'d' or '1' returns DRAW_FROM_STOCK", () => {
    expect(parseDrawCommand("d")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand("1")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand("D")).toEqual({ type: "DRAW_FROM_STOCK" });
    expect(parseDrawCommand(" d ")).toEqual({ type: "DRAW_FROM_STOCK" });
  });

  it("'t' or '2' returns DRAW_FROM_DISCARD", () => {
    expect(parseDrawCommand("t")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand("2")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand("T")).toEqual({ type: "DRAW_FROM_DISCARD" });
    expect(parseDrawCommand(" t ")).toEqual({ type: "DRAW_FROM_DISCARD" });
  });

  it("invalid input returns error", () => {
    const result = parseDrawCommand("x");
    expect(result.type).toBe("error");

    const result2 = parseDrawCommand("3");
    expect(result2.type).toBe("error");

    const result3 = parseDrawCommand("");
    expect(result3.type).toBe("error");
  });
});

// =============================================================================
// Discard Command Tests
// =============================================================================

describe("parseDiscardCommand", () => {
  it("'x 3' or '3' returns DISCARD with card at position 3", () => {
    expect(parseDiscardCommand("3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand("x 3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand("X 3", 5)).toEqual({ type: "DISCARD", position: 3 });
    expect(parseDiscardCommand(" 3 ", 5)).toEqual({ type: "DISCARD", position: 3 });
  });

  it("position is 1-indexed", () => {
    // Position 1 is valid (first card)
    expect(parseDiscardCommand("1", 5)).toEqual({ type: "DISCARD", position: 1 });
    // Position 5 is valid (last card in hand of 5)
    expect(parseDiscardCommand("5", 5)).toEqual({ type: "DISCARD", position: 5 });
  });

  it("validates position is within hand size", () => {
    // Position 0 is invalid
    const result0 = parseDiscardCommand("0", 5);
    expect(result0.type).toBe("error");

    // Position 6 is invalid for hand of 5
    const result6 = parseDiscardCommand("6", 5);
    expect(result6.type).toBe("error");

    // Position -1 is invalid
    const resultNeg = parseDiscardCommand("-1", 5);
    expect(resultNeg.type).toBe("error");
  });

  it("invalid input returns error", () => {
    const resultText = parseDiscardCommand("abc", 5);
    expect(resultText.type).toBe("error");

    const resultEmpty = parseDiscardCommand("", 5);
    expect(resultEmpty.type).toBe("error");
  });
});

// =============================================================================
// Reorder Command Tests
// =============================================================================

describe("parseReorderCommand", () => {
  it("'sort rank' returns sort by rank action", () => {
    expect(parseReorderCommand("sort rank", 5)).toEqual({ type: "SORT_BY_RANK" });
    expect(parseReorderCommand("Sort Rank", 5)).toEqual({ type: "SORT_BY_RANK" });
    expect(parseReorderCommand(" sort rank ", 5)).toEqual({ type: "SORT_BY_RANK" });
  });

  it("'sort suit' returns sort by suit action", () => {
    expect(parseReorderCommand("sort suit", 5)).toEqual({ type: "SORT_BY_SUIT" });
    expect(parseReorderCommand("Sort Suit", 5)).toEqual({ type: "SORT_BY_SUIT" });
  });

  it("'move 5 1' returns move card from pos 5 to pos 1", () => {
    expect(parseReorderCommand("move 5 1", 5)).toEqual({ type: "MOVE", fromPosition: 5, toPosition: 1 });
    expect(parseReorderCommand("Move 3 2", 5)).toEqual({ type: "MOVE", fromPosition: 3, toPosition: 2 });
    expect(parseReorderCommand("move  5  1", 5)).toEqual({ type: "MOVE", fromPosition: 5, toPosition: 1 });
  });

  it("validates positions are within hand size", () => {
    // Position 0 is invalid
    const result0 = parseReorderCommand("move 0 1", 5);
    expect(result0.type).toBe("error");

    // Position 6 is invalid for hand of 5
    const result6 = parseReorderCommand("move 1 6", 5);
    expect(result6.type).toBe("error");

    // Both positions invalid
    const resultBoth = parseReorderCommand("move 7 8", 5);
    expect(resultBoth.type).toBe("error");
  });
});

// =============================================================================
// Lay Down Command Tests
// =============================================================================

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

// =============================================================================
// Swap Command Tests
// =============================================================================

describe("swap command syntax", () => {
  it("'swap 1 2 3' returns SWAP_JOKER with positions", () => {
    // swap <meld-index> <joker-position-in-meld> <card-position-in-hand>
    const result = parseSwapCommand("swap 1 2 3", 3, 5);
    expect(result.type).toBe("SWAP_JOKER");
    if (result.type === "SWAP_JOKER") {
      expect(result.meldIndex).toBe(1);
      expect(result.jokerPositionInMeld).toBe(2);
      expect(result.cardPositionInHand).toBe(3);
    }
  });

  it("handles case insensitivity and extra spaces", () => {
    const result1 = parseSwapCommand("SWAP 1 2 3", 3, 5);
    expect(result1.type).toBe("SWAP_JOKER");

    const result2 = parseSwapCommand("  swap   1   2   3  ", 3, 5);
    expect(result2.type).toBe("SWAP_JOKER");

    const result3 = parseSwapCommand("Swap 1 2 3", 3, 5);
    expect(result3.type).toBe("SWAP_JOKER");
  });
});

describe("swap display", () => {
  it("renderSwapSuccess shows what was swapped", () => {
    const swapCard = card("6");
    const j = joker();

    const result = renderSwapSuccess(swapCard, j, "Alice's run");
    expect(result).toContain("6♠");
    expect(result).toContain("Joker");
    expect(result).toContain("Alice's run");
  });

  it("renderSwapError shows the error message", () => {
    const result = renderSwapError("Card does not fit Joker's position");
    expect(result).toContain("Card does not fit Joker's position");
    expect(result.toLowerCase()).toContain("error");
  });

  it("renderAvailableSwaps shows available swaps for player", () => {
    const j1 = joker();
    const j2 = joker();

    const run1 = makeRun([card("5"), j1, card("7"), card("8")], "player1");
    const run2 = makeRun([card("8", "hearts"), j2, card("10", "hearts"), card("J", "hearts")], "player2");

    const swaps: Array<{ meld: Meld; position: WildPosition; meldIndex: number }> = [
      {
        meld: run1,
        position: { wildCard: j1, actingAsRank: "6", actingAsSuit: "spades", isJoker: true, positionIndex: 1 },
        meldIndex: 1,
      },
      {
        meld: run2,
        position: { wildCard: j2, actingAsRank: "9", actingAsSuit: "hearts", isJoker: true, positionIndex: 1 },
        meldIndex: 2,
      },
    ];

    const result = renderAvailableSwaps(swaps);
    expect(result).toContain("6♠");
    expect(result).toContain("9♥");
    expect(result).toContain("meld 1");
    expect(result).toContain("meld 2");
  });
});

describe("swap error messages", () => {
  it("rejects swap with invalid meld index", () => {
    const result = parseSwapCommand("swap 0 1 1", 3, 5);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("meld");
    }
  });

  it("rejects swap with meld index out of range", () => {
    const result = parseSwapCommand("swap 4 1 1", 3, 5); // Only 3 melds
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("meld");
    }
  });

  it("rejects swap with hand position out of range", () => {
    const result = parseSwapCommand("swap 1 1 6", 3, 5); // Only 5 cards in hand
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("hand");
    }
  });
});
