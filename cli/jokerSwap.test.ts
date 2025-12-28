/**
 * CLI Joker Swap tests - Phase 7
 *
 * Tests for CLI parsing and display of Joker swap commands
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  parseSwapCommand,
  renderSwapSuccess,
  renderSwapError,
  renderAvailableSwaps,
} from "./jokerSwap";
import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import type { WildPosition } from "../core/meld/meld.joker";

// Test helpers
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
