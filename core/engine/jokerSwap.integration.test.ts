/**
 * Joker Swap Integration tests - Phase 7
 *
 * Tests for complete Joker swap flows and edge cases
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { TurnInput, MeldProposal } from "./turn.machine";
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

describe("swap then lay down flow", () => {
  it("allows player to swap joker and then use joker in their lay down", () => {
    // Player has a 6♠ and needs to form a contract
    // There's a run with a joker on the table (not owned by this player)
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    // Player has cards for a potential set plus the swap card
    const nine1 = card("9", "clubs");
    const nine2 = card("9", "diamonds");
    // After swap, player will have joker which can complete a set

    const input = createTurnInput({
      hand: [swapCard, nine1, nine2, card("K"), card("Q")],
      table: [opponentRun],
      isDown: false,
      roundNumber: 1 as RoundNumber, // Round 1 needs 2 sets
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    // Draw
    actor.send({ type: "DRAW_FROM_STOCK" });
    expect(actor.getSnapshot().value).toBe("drawn");

    // Swap the joker
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Verify joker is now in hand
    const handAfterSwap = actor.getSnapshot().context.hand;
    expect(handAfterSwap.some(c => c.id === j.id)).toBe(true);
    expect(handAfterSwap.some(c => c.id === swapCard.id)).toBe(false);
  });

  it("swapped joker can be used in contract melds", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    // Player needs 2 sets for round 1
    // Set 1: K K K
    // Set 2: 9 9 Joker (using swapped joker)
    const k1 = card("K", "clubs");
    const k2 = card("K", "diamonds");
    const k3 = card("K", "hearts");
    const nine1 = card("9", "clubs");
    const nine2 = card("9", "diamonds");

    const input = createTurnInput({
      hand: [swapCard, k1, k2, k3, nine1, nine2],
      table: [opponentRun],
      isDown: false,
      roundNumber: 1 as RoundNumber,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // Swap to get the joker
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    const handAfterSwap = actor.getSnapshot().context.hand;
    const jokerInHand = handAfterSwap.find(c => c.id === j.id);
    expect(jokerInHand).toBeDefined();

    // Now lay down using the joker
    const melds: MeldProposal[] = [
      { type: "set", cardIds: [k1.id, k2.id, k3.id] },
      { type: "set", cardIds: [nine1.id, nine2.id, j.id] },
    ];

    actor.send({ type: "LAY_DOWN", melds });

    // Should transition to awaitingDiscard (contract met)
    expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    expect(actor.getSnapshot().context.isDown).toBe(true);
  });

  it("swap updates table correctly before lay down", () => {
    const j = joker();
    const swapCard = card("6");
    const five = card("5");
    const seven = card("7");
    const eight = card("8");
    const opponentRun = makeRun([five, j, seven, eight], "player2");

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [opponentRun],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Table meld should now have swap card in place of joker
    const table = actor.getSnapshot().context.table;
    const updatedMeld = table.find(m => m.id === opponentRun.id)!;

    expect(updatedMeld.cards[0]!.id).toBe(five.id);
    expect(updatedMeld.cards[1]!.id).toBe(swapCard.id);
    expect(updatedMeld.cards[2]!.id).toBe(seven.id);
    expect(updatedMeld.cards[3]!.id).toBe(eight.id);
  });

  it("player can swap, then skip lay down and discard", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    const discardCard = card("K");
    const input = createTurnInput({
      hand: [swapCard, discardCard, card("Q")],
      table: [opponentRun],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Skip lay down
    actor.send({ type: "SKIP_LAY_DOWN" });
    expect(actor.getSnapshot().value).toBe("awaitingDiscard");

    // Discard
    actor.send({ type: "DISCARD", cardId: discardCard.id });
    expect(actor.getSnapshot().value).toBe("turnComplete");

    // Joker should still be in hand at turn end
    const finalHand = actor.getSnapshot().context.hand;
    expect(finalHand.some(c => c.id === j.id)).toBe(true);
  });
});

describe("multiple swaps in one turn", () => {
  it("allows multiple joker swaps in one turn", () => {
    const j1 = joker();
    const j2 = joker();
    const swapCard1 = card("6");
    const swapCard2 = card("9", "hearts");

    const run1 = makeRun([card("5"), j1, card("7"), card("8")], "player2");
    const run2 = makeRun([card("8", "hearts"), j2, card("10", "hearts"), card("J", "hearts")], "player2");

    const input = createTurnInput({
      hand: [swapCard1, swapCard2, card("K")],
      table: [run1, run2],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // First swap
    actor.send({ type: "SWAP_JOKER", jokerCardId: j1.id, meldId: run1.id, swapCardId: swapCard1.id });

    let hand = actor.getSnapshot().context.hand;
    expect(hand.some(c => c.id === j1.id)).toBe(true);
    expect(hand.some(c => c.id === swapCard1.id)).toBe(false);

    // Second swap
    actor.send({ type: "SWAP_JOKER", jokerCardId: j2.id, meldId: run2.id, swapCardId: swapCard2.id });

    hand = actor.getSnapshot().context.hand;
    expect(hand.some(c => c.id === j2.id)).toBe(true);
    expect(hand.some(c => c.id === swapCard2.id)).toBe(false);

    // Both jokers now in hand
    expect(hand.filter(c => c.rank === "Joker").length).toBe(2);
  });

  it("hand size remains same after multiple swaps", () => {
    const j1 = joker();
    const j2 = joker();
    const swapCard1 = card("6");
    const swapCard2 = card("9", "hearts");

    const run1 = makeRun([card("5"), j1, card("7"), card("8")], "player2");
    const run2 = makeRun([card("8", "hearts"), j2, card("10", "hearts"), card("J", "hearts")], "player2");

    const input = createTurnInput({
      hand: [swapCard1, swapCard2, card("K")],
      table: [run1, run2],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const handSizeAfterDraw = actor.getSnapshot().context.hand.length;

    actor.send({ type: "SWAP_JOKER", jokerCardId: j1.id, meldId: run1.id, swapCardId: swapCard1.id });
    expect(actor.getSnapshot().context.hand.length).toBe(handSizeAfterDraw);

    actor.send({ type: "SWAP_JOKER", jokerCardId: j2.id, meldId: run2.id, swapCardId: swapCard2.id });
    expect(actor.getSnapshot().context.hand.length).toBe(handSizeAfterDraw);
  });

  it("table melds are correctly updated after multiple swaps", () => {
    const j1 = joker();
    const j2 = joker();
    const swapCard1 = card("6");
    const swapCard2 = card("9", "hearts");

    const run1 = makeRun([card("5"), j1, card("7"), card("8")], "player2");
    const run2 = makeRun([card("8", "hearts"), j2, card("10", "hearts"), card("J", "hearts")], "player2");

    const input = createTurnInput({
      hand: [swapCard1, swapCard2, card("K")],
      table: [run1, run2],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j1.id, meldId: run1.id, swapCardId: swapCard1.id });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j2.id, meldId: run2.id, swapCardId: swapCard2.id });

    const table = actor.getSnapshot().context.table;

    // First run should have swapCard1
    const updatedRun1 = table.find(m => m.id === run1.id)!;
    expect(updatedRun1.cards.some(c => c.id === swapCard1.id)).toBe(true);
    expect(updatedRun1.cards.some(c => c.id === j1.id)).toBe(false);

    // Second run should have swapCard2
    const updatedRun2 = table.find(m => m.id === run2.id)!;
    expect(updatedRun2.cards.some(c => c.id === swapCard2.id)).toBe(true);
    expect(updatedRun2.cards.some(c => c.id === j2.id)).toBe(false);
  });
});

describe("cannot swap after laying down", () => {
  it("rejects swap when player has already laid down this round", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q")],
      table: [opponentRun],
      isDown: true, // Already down
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    const tableBefore = actor.getSnapshot().context.table.map(m => ({ ...m }));
    const handBefore = [...actor.getSnapshot().context.hand];

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Nothing should change
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    expect(actor.getSnapshot().context.table.map(m => m.id)).toEqual(tableBefore.map(m => m.id));
  });

  it("rejects swap after laying down in the same turn", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    // Player has cards for 2 sets (round 1 contract)
    const k1 = card("K", "clubs");
    const k2 = card("K", "diamonds");
    const k3 = card("K", "hearts");
    const nine1 = card("9", "clubs");
    const nine2 = card("9", "diamonds");
    const nine3 = card("9", "hearts");

    const input = createTurnInput({
      hand: [swapCard, k1, k2, k3, nine1, nine2, nine3],
      table: [opponentRun],
      isDown: false,
      roundNumber: 1 as RoundNumber,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // Lay down first
    const melds: MeldProposal[] = [
      { type: "set", cardIds: [k1.id, k2.id, k3.id] },
      { type: "set", cardIds: [nine1.id, nine2.id, nine3.id] },
    ];
    actor.send({ type: "LAY_DOWN", melds });

    expect(actor.getSnapshot().context.isDown).toBe(true);
    expect(actor.getSnapshot().value).toBe("awaitingDiscard");

    // Now try to swap - should be rejected (we're in awaitingDiscard state,
    // and SWAP_JOKER is only available in drawn state)
    const handBefore = [...actor.getSnapshot().context.hand];

    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Nothing should change
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
  });

  it("cannot swap in future turns after laying down", () => {
    // This test simulates a player who laid down in a previous turn
    // (isDown is true from the start of this turn)
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "player2");

    const input = createTurnInput({
      hand: [swapCard, card("K"), card("Q"), card("J")],
      table: [opponentRun],
      isDown: true, // Laid down in a previous turn
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    expect(actor.getSnapshot().value).toBe("drawn");

    const handBefore = [...actor.getSnapshot().context.hand];

    // Try to swap - should fail because isDown is true
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Hand should be unchanged
    expect(actor.getSnapshot().context.hand).toEqual(handBefore);
  });
});

describe("swap from opponent's run", () => {
  it("allows swapping joker from opponent's run", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "opponent-player");

    const input = createTurnInput({
      playerId: "current-player",
      hand: [swapCard, card("K")],
      table: [opponentRun],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    // Swap should succeed
    expect(actor.getSnapshot().context.hand.some(c => c.id === j.id)).toBe(true);

    // Table should be updated
    const updatedMeld = actor.getSnapshot().context.table.find(m => m.id === opponentRun.id)!;
    expect(updatedMeld.cards.some(c => c.id === swapCard.id)).toBe(true);
    expect(updatedMeld.cards.some(c => c.id === j.id)).toBe(false);
  });

  it("opponent's meld ownership is preserved after swap", () => {
    const j = joker();
    const swapCard = card("6");
    const opponentRun = makeRun([card("5"), j, card("7"), card("8")], "opponent-player");

    const input = createTurnInput({
      playerId: "current-player",
      hand: [swapCard, card("K")],
      table: [opponentRun],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: opponentRun.id, swapCardId: swapCard.id });

    const updatedMeld = actor.getSnapshot().context.table.find(m => m.id === opponentRun.id)!;
    expect(updatedMeld.ownerId).toBe("opponent-player");
  });

  it("allows swapping from any player's run, not just your own", () => {
    const j1 = joker();
    const j2 = joker();
    const swapCard1 = card("6");
    const swapCard2 = card("9", "hearts");

    const player1Run = makeRun([card("5"), j1, card("7"), card("8")], "player-1");
    const player3Run = makeRun([card("8", "hearts"), j2, card("10", "hearts"), card("J", "hearts")], "player-3");

    const input = createTurnInput({
      playerId: "player-2", // Current player is player-2
      hand: [swapCard1, swapCard2, card("K")],
      table: [player1Run, player3Run],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });

    // Swap from player-1's run
    actor.send({ type: "SWAP_JOKER", jokerCardId: j1.id, meldId: player1Run.id, swapCardId: swapCard1.id });

    // Swap from player-3's run
    actor.send({ type: "SWAP_JOKER", jokerCardId: j2.id, meldId: player3Run.id, swapCardId: swapCard2.id });

    // Both swaps should succeed
    const hand = actor.getSnapshot().context.hand;
    expect(hand.some(c => c.id === j1.id)).toBe(true);
    expect(hand.some(c => c.id === j2.id)).toBe(true);
  });
});

describe("edge cases - run boundaries", () => {
  it("allows swap of joker at beginning of run", () => {
    const j = joker();
    const swapCard = card("5"); // Joker is at position 0, acting as 5♠
    const run = makeRun([j, card("6"), card("7"), card("8")], "player2");

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [run],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: run.id, swapCardId: swapCard.id });

    // Swap should succeed
    expect(actor.getSnapshot().context.hand.some(c => c.id === j.id)).toBe(true);

    // Run should have swap card at beginning
    const updatedRun = actor.getSnapshot().context.table.find(m => m.id === run.id)!;
    expect(updatedRun.cards[0]!.id).toBe(swapCard.id);
  });

  it("allows swap of joker at end of run", () => {
    const j = joker();
    const swapCard = card("8"); // Joker is at position 3, acting as 8♠
    const run = makeRun([card("5"), card("6"), card("7"), j], "player2");

    const input = createTurnInput({
      hand: [swapCard, card("K")],
      table: [run],
      isDown: false,
    });

    const actor = createActor(turnMachine, { input });
    actor.start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SWAP_JOKER", jokerCardId: j.id, meldId: run.id, swapCardId: swapCard.id });

    // Swap should succeed
    expect(actor.getSnapshot().context.hand.some(c => c.id === j.id)).toBe(true);

    // Run should have swap card at end
    const updatedRun = actor.getSnapshot().context.table.find(m => m.id === run.id)!;
    expect(updatedRun.cards[3]!.id).toBe(swapCard.id);
  });
});
