/**
 * SWAP_JOKER Command tests - Phase 7
 *
 * Tests for the SWAP_JOKER command in the TurnMachine
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { TurnInput, TurnContext } from "./turn.machine";
import type { RoundNumber } from "./engine.types";

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

function createTurnInput(overrides: Partial<TurnInput> = {}): TurnInput {
  return {
    playerId: "player1",
    hand: overrides.hand ?? [card("K"), card("Q"), card("J")],
    stock: overrides.stock ?? [card("A"), card("2"), card("3")],
    discard: overrides.discard ?? [card("4")],
    roundNumber: overrides.roundNumber ?? (1 as RoundNumber),
    isDown: overrides.isDown ?? false,
    table: overrides.table ?? [],
  };
}

beforeEach(() => {
  cardId = 0;
});

describe("SWAP_JOKER in TurnMachine drawn state", () => {
  it("allows SWAP_JOKER in drawn state", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Draw first to get to drawn state
    actor.send({ type: "DRAW_FROM_STOCK" });
    expect(actor.getSnapshot().value).toBe("drawn");

    // Now swap the joker
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // Should still be in drawn state after swap
    expect(actor.getSnapshot().value).toBe("drawn");
  });

  it("is not available in awaitingDraw state", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Still in awaitingDraw state
    expect(actor.getSnapshot().value).toBe("awaitingDraw");

    // Try to swap - should not change state
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });
    expect(actor.getSnapshot().value).toBe("awaitingDraw");
  });

  it("is not available in awaitingDiscard state", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Go to drawn then skip to awaitingDiscard
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    expect(actor.getSnapshot().value).toBe("awaitingDiscard");

    // Try to swap - should not change state
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });
    expect(actor.getSnapshot().value).toBe("awaitingDiscard");
  });

  it("requires player to not be down yet", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [meld],
      isDown: true, // Already down
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    expect(actor.getSnapshot().value).toBe("drawn");

    // Hand before swap attempt
    const handBefore = actor.getSnapshot().context.hand;

    // Try to swap - should be rejected
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // Should still be in drawn state, hand unchanged
    expect(actor.getSnapshot().value).toBe("drawn");
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
  });
});

describe("swapJoker action - updates table meld", () => {
  it("replaces Joker with swap card in the meld", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    const table = actor.getSnapshot().context.table;
    const updatedMeld = table.find(m => m.id === meld.id);

    // Meld should contain the swap card, not the joker
    expect(updatedMeld?.cards.some(c => c.id === swapCard.id)).toBe(true);
    expect(updatedMeld?.cards.some(c => c.id === j.id)).toBe(false);
  });

  it("preserves card order in the run", () => {
    const j = joker();
    const five = card("5");
    const seven = card("7");
    const eight = card("8");
    const swapCard = card("6");
    const meld = makeRun([five, j, seven, eight]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    const table = actor.getSnapshot().context.table;
    const updatedMeld = table.find(m => m.id === meld.id)!;

    // The swap card should be in position 1 (where the joker was)
    expect(updatedMeld.cards[0]!.id).toBe(five.id);
    expect(updatedMeld.cards[1]!.id).toBe(swapCard.id);
    expect(updatedMeld.cards[2]!.id).toBe(seven.id);
    expect(updatedMeld.cards[3]!.id).toBe(eight.id);
  });

  it("does not affect other melds on the table", () => {
    const j = joker();
    const swapCard = card("6");
    const targetMeld = makeRun([card("5"), j, card("7"), card("8")]);
    const otherMeld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [targetMeld, otherMeld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const otherMeldBefore = actor.getSnapshot().context.table.find(m => m.id === otherMeld.id);

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: targetMeld.id, swapCardId: swapCard.id });

    const otherMeldAfter = actor.getSnapshot().context.table.find(m => m.id === otherMeld.id);
    expect(otherMeldAfter).toEqual(otherMeldBefore);
  });

  it("meld remains valid after swap", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    const table = actor.getSnapshot().context.table;
    const updatedMeld = table.find(m => m.id === meld.id)!;

    // Check meld still has 4 cards
    expect(updatedMeld.cards.length).toBe(4);
    // Check meld type is still run
    expect(updatedMeld.type).toBe("run");
  });
});

describe("swapJoker action - adds Joker to player hand", () => {
  it("adds the Joker to player's hand", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // Before swap, joker not in hand
    expect(actor.getSnapshot().context.hand.some(c => c.id === j.id)).toBe(false);

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // After swap, joker should be in hand
    expect(actor.getSnapshot().context.hand.some(c => c.id === j.id)).toBe(true);
  });

  it("hand size stays same (swap card removed, joker added)", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // After draw, hand has 3 cards (2 + 1 drawn)
    const handSizeBefore = actor.getSnapshot().context.hand.length;

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // After swap, hand should still have same size
    const handSizeAfter = actor.getSnapshot().context.hand.length;
    expect(handSizeAfter).toBe(handSizeBefore);
  });

  it("Joker is now a wild card that can be used in future melds", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // The joker in hand should have rank "Joker"
    const jokerInHand = actor.getSnapshot().context.hand.find(c => c.id === j.id);
    expect(jokerInHand?.rank).toBe("Joker");
  });
});

describe("swapJoker action - removes swapped card from hand", () => {
  it("removes the swap card from player's hand", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // Before swap, swap card is in hand
    expect(actor.getSnapshot().context.hand.some(c => c.id === swapCard.id)).toBe(true);

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // After swap, swap card should not be in hand
    expect(actor.getSnapshot().context.hand.some(c => c.id === swapCard.id)).toBe(false);
  });

  it("only removes the specific swap card, not all matching rank/suit", () => {
    const j = joker();
    const swapCard = card("6");
    const anotherSix = card("6"); // Same rank/suit, different id
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, anotherSix, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // The other six should still be in hand
    expect(actor.getSnapshot().context.hand.some(c => c.id === anotherSix.id)).toBe(true);
  });

  it("swap card not in hand is rejected", () => {
    const j = joker();
    const swapCard = card("6"); // Not in hand
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [card("K"), card("Q")], // No 6 in hand
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const handBefore = [...actor.getSnapshot().context.hand];

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // Hand should be unchanged (swap rejected)
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
  });
});

describe("SWAP_JOKER rejection scenarios", () => {
  it("rejects swap from a set (not a run)", () => {
    const j = joker();
    const swapCard = card("9", "hearts");
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), j]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const tableBefore = [...actor.getSnapshot().context.table];

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // Table should be unchanged
    expect(actor.getSnapshot().context.table).toEqual(tableBefore);
  });

  it("rejects swap of a 2 (only Jokers can be swapped)", () => {
    const two = card("2", "clubs"); // Wild but not a Joker
    const swapCard = card("6");
    const meld = makeRun([card("5"), two, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const tableBefore = [...actor.getSnapshot().context.table];

    actor.send({ type: "SWAP_JOKER", jokerCardId: two.id, meldId: meld.id, swapCardId: swapCard.id });

    // Table should be unchanged
    expect(actor.getSnapshot().context.table).toEqual(tableBefore);
  });

  it("rejects swap when card doesn't fit Joker's position", () => {
    const j = joker();
    const swapCard = card("8"); // Wrong rank - Joker is acting as 6
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const handBefore = [...actor.getSnapshot().context.hand];
    const tableBefore = [...actor.getSnapshot().context.table];

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: meld.id, swapCardId: swapCard.id });

    // Nothing should change
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    expect(actor.getSnapshot().context.table).toEqual(tableBefore);
  });

  it("rejects swap when meld doesn't exist", () => {
    const j = joker();
    const swapCard = card("6");
    const meld = makeRun([card("5"), j, card("7"), card("8")]);

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [meld],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const handBefore = [...actor.getSnapshot().context.hand];

    // Use a non-existent meld id
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: "non-existent-meld", swapCardId: swapCard.id });

    // Hand should be unchanged
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
  });
});
