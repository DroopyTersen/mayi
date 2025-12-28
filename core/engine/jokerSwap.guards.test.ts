/**
 * Joker Swap Guards tests - Phase 7
 *
 * Tests for guards that control when Joker swapping is allowed
 */

import { describe, it, expect } from "bun:test";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player } from "./engine.types";
import { canSwapJokerWithCard } from "../meld/meld.joker";

/**
 * Guard: Player has not laid down yet this hand
 * Joker swapping is only allowed BEFORE laying down your contract
 */
function notDownForJokerSwap(player: Player): boolean {
  return !player.isDown;
}

/**
 * Guard: The meld is a run (not a set)
 * Joker swapping only works on runs per house rules
 */
function isRunMeld(meld: Meld): boolean {
  return meld.type === "run";
}

/**
 * Guard: The card in the meld is a Joker (not a 2)
 * Only Jokers can be swapped out, not 2s (which are also wild)
 */
function isJokerCard(card: Card): boolean {
  return card.rank === "Joker";
}

/**
 * Guard: Player has the swap card in their hand
 */
function playerHasCard(player: Player, card: Card): boolean {
  return player.hand.some((c) => c.id === card.id);
}

/**
 * Composite guard for validating a Joker swap
 */
function canPerformJokerSwap(
  player: Player,
  meld: Meld,
  jokerCard: Card,
  swapCard: Card
): { valid: boolean; reason?: string } {
  // Must not be down yet
  if (!notDownForJokerSwap(player)) {
    return { valid: false, reason: "Cannot swap Joker after laying down" };
  }

  // Must be a run
  if (!isRunMeld(meld)) {
    return { valid: false, reason: "Can only swap Jokers from runs, not sets" };
  }

  // Must be a Joker (not a 2)
  if (!isJokerCard(jokerCard)) {
    return { valid: false, reason: "Can only swap Jokers, not 2s" };
  }

  // Must have the swap card in hand
  if (!playerHasCard(player, swapCard)) {
    return { valid: false, reason: "Swap card not in hand" };
  }

  // Card must fit the Joker's position
  if (!canSwapJokerWithCard(meld, jokerCard, swapCard)) {
    return { valid: false, reason: "Card does not fit Joker's position in run" };
  }

  return { valid: true };
}

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

function makeSet(cards: Card[], ownerId = "player1"): Meld {
  return { id: `meld-${cardId++}`, type: "set", cards, ownerId };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Alice",
    hand: [],
    isDown: false,
    totalScore: 0,
    ...overrides,
  };
}

describe("notDownForJokerSwap guard", () => {
  it("returns true when player has not laid down", () => {
    const player = makePlayer({ isDown: false });
    expect(notDownForJokerSwap(player)).toBe(true);
  });

  it("returns false when player has laid down", () => {
    const player = makePlayer({ isDown: true });
    expect(notDownForJokerSwap(player)).toBe(false);
  });

  it("allows swap for player who hasn't laid down this hand", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(true);
  });
});

describe("validJokerSwap guard - run only", () => {
  it("returns true for runs", () => {
    const meld = makeRun([card("5"), card("6"), card("7")]);
    expect(isRunMeld(meld)).toBe(true);
  });

  it("returns false for sets", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(isRunMeld(meld)).toBe(false);
  });

  it("rejects swap from set with appropriate reason", () => {
    const j = joker();
    const swapCard = card("9", "hearts");
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), j]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Can only swap Jokers from runs, not sets");
  });
});

describe("validJokerSwap guard - card fits position", () => {
  it("accepts card that matches Joker's acting position", () => {
    const j = joker();
    const swapCard = card("6"); // Joker is acting as 6♠
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(true);
  });

  it("rejects card with wrong rank", () => {
    const j = joker();
    const swapCard = card("8"); // Wrong rank, Joker is 6♠
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Card does not fit Joker's position in run");
  });

  it("rejects card with wrong suit", () => {
    const j = joker();
    const swapCard = card("6", "hearts"); // Wrong suit, run is spades
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Card does not fit Joker's position in run");
  });
});

describe("validJokerSwap guard - player has card in hand", () => {
  it("returns true when card is in player's hand", () => {
    const swapCard = card("6");
    const player = makePlayer({ hand: [swapCard, card("K"), card("3")] });
    expect(playerHasCard(player, swapCard)).toBe(true);
  });

  it("returns false when card is not in player's hand", () => {
    const swapCard = card("6");
    const player = makePlayer({ hand: [card("K"), card("3")] });
    expect(playerHasCard(player, swapCard)).toBe(false);
  });

  it("rejects swap when player doesn't have the card", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [] }); // No cards in hand

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Swap card not in hand");
  });
});

describe("validJokerSwap guard - Joker only (not 2s)", () => {
  it("returns true for Joker cards", () => {
    const j = joker();
    expect(isJokerCard(j)).toBe(true);
  });

  it("returns false for 2s (which are wild but not swappable)", () => {
    const two = card("2", "clubs");
    expect(isJokerCard(two)).toBe(false);
  });

  it("rejects swap of 2 with appropriate reason", () => {
    const two = card("2", "clubs"); // Wild but not a Joker
    const swapCard = card("6");
    const meld = makeRun([card("5"), two, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, two, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Can only swap Jokers, not 2s");
  });
});

describe("canPerformJokerSwap - composite guard", () => {
  it("validates all conditions for a successful swap", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: false, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects when player is already down", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const player = makePlayer({ isDown: true, hand: [swapCard] });

    const result = canPerformJokerSwap(player, meld, j, swapCard);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Cannot swap Joker after laying down");
  });
});
