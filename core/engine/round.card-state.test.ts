import { describe, expect, it } from "bun:test";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player } from "./engine.types";
import {
  applyRoundDiscard,
  applyRoundDrawFromDiscard,
  applyRoundDrawFromStock,
  applyRoundLayDown,
  applyRoundLayOff,
  applyRoundReorderHand,
  applyRoundSwapJoker,
} from "./round.card-state";

function card(id: string, rank: Card["rank"] = "7", suit: Card["suit"] = "clubs"): Card {
  return { id, rank, suit };
}

function player(id: string, hand: Card[], isDown = false): Player {
  return {
    id,
    name: id,
    hand,
    isDown,
    totalScore: 0,
  };
}

function meld(id: string, cards: Card[]): Meld {
  return {
    id,
    ownerId: "player-1",
    type: "set",
    cards,
  };
}

describe("round card-state helpers", () => {
  it("draws exactly the top stock card into the current player's hand", () => {
    const topStock = card("stock-top", "9", "hearts");
    const remainingStock = card("stock-next", "10", "hearts");
    const state = {
      players: [player("player-0", []), player("player-1", [card("hand-card")])],
      currentPlayerIndex: 1,
      stock: [topStock, remainingStock],
      discard: [card("discard-top")],
      table: [meld("table-meld", [card("table-card")])],
    };

    const result = applyRoundDrawFromStock(state, (cards) => cards);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const updatedPlayer = result.patch.players?.[1];
    expect(updatedPlayer?.hand.map((handCard) => handCard.id)).toEqual([
      "hand-card",
      topStock.id,
    ]);
    expect(result.patch.stock?.map((stockCard) => stockCard.id)).toEqual([
      remainingStock.id,
    ]);
    expect(result.patch.discard?.map((discardCard) => discardCard.id)).toEqual([
      "discard-top",
    ]);
    expect(result.patch.table).toBeUndefined();
  });

  it("replenishes stock from discard after drawing the last stock card", () => {
    const drawnCard = card("stock-last");
    const exposedDiscard = card("discard-exposed");
    const recycleOne = card("discard-recycle-1");
    const recycleTwo = card("discard-recycle-2");
    const state = {
      players: [player("player-0", [])],
      currentPlayerIndex: 0,
      stock: [drawnCard],
      discard: [exposedDiscard, recycleOne, recycleTwo],
      table: [],
    };

    const result = applyRoundDrawFromStock(state, (cards) => cards);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.stock?.map((stockCard) => stockCard.id)).toEqual([
      recycleOne.id,
      recycleTwo.id,
    ]);
    expect(result.patch.discard?.map((discardCard) => discardCard.id)).toEqual([
      exposedDiscard.id,
    ]);
    expect(result.patch.endRoundDueToStockExhaustion).toBe(false);
  });

  it("reports stock exhaustion when no penalty stock can be rebuilt", () => {
    const state = {
      players: [player("player-0", [])],
      currentPlayerIndex: 0,
      stock: [card("stock-last")],
      discard: [card("discard-exposed")],
      table: [],
    };

    const result = applyRoundDrawFromStock(state, (cards) => cards);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.stock).toEqual([]);
    expect(result.patch.discard?.map((discardCard) => discardCard.id)).toEqual([
      "discard-exposed",
    ]);
    expect(result.patch.endRoundDueToStockExhaustion).toBe(true);
  });

  it("draws exactly the top discard card into the current player's hand", () => {
    const topDiscard = card("discard-top", "Q", "spades");
    const nextDiscard = card("discard-next", "J", "spades");
    const state = {
      players: [player("player-0", [card("hand-card")])],
      currentPlayerIndex: 0,
      stock: [card("stock-card")],
      discard: [topDiscard, nextDiscard],
      table: [],
    };

    const result = applyRoundDrawFromDiscard(state);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      "hand-card",
      topDiscard.id,
    ]);
    expect(result.patch.discard?.map((discardCard) => discardCard.id)).toEqual([
      nextDiscard.id,
    ]);
    expect(result.patch.stock).toBeUndefined();
  });

  it("does not draw from discard for a player who is already down", () => {
    const state = {
      players: [player("player-0", [card("hand-card")], true)],
      currentPlayerIndex: 0,
      stock: [card("stock-card")],
      discard: [card("discard-top")],
      table: [],
    };

    const result = applyRoundDrawFromDiscard(state);

    expect(result.success).toBe(false);
  });

  it("discards only one matching physical card from the current player's hand", () => {
    const firstCopy = card("duplicate-id", "7", "hearts");
    const secondCopy = { ...firstCopy };
    const keepCard = card("keep-card", "8", "hearts");
    const state = {
      players: [player("player-0", [firstCopy, keepCard, secondCopy])],
      currentPlayerIndex: 0,
      stock: [],
      discard: [card("discard-old")],
      table: [],
    };

    const result = applyRoundDiscard(state, "duplicate-id");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      keepCard.id,
      secondCopy.id,
    ]);
    expect(result.patch.discard?.map((discardCard) => discardCard.id)).toEqual([
      firstCopy.id,
      "discard-old",
    ]);
  });

  it("reorders one player's hand without changing piles or table", () => {
    const table = [meld("table-meld", [card("table-card")])];
    const state = {
      players: [
        player("player-0", [card("a"), card("b"), card("c")]),
        player("player-1", [card("other")]),
      ],
      currentPlayerIndex: 1,
      stock: [card("stock-card")],
      discard: [card("discard-card")],
      table,
    };
    const before = structuredClone(state);

    const result = applyRoundReorderHand(state, "player-0", ["c", "a", "b"]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(result.patch.stock).toBeUndefined();
    expect(result.patch.discard).toBeUndefined();
    expect(result.patch.table).toBeUndefined();
    expect(state).toEqual(before);
  });

  it("lays down melds by removing their cards from the current hand and appending table melds", () => {
    const setCards = [
      card("set-7-hearts", "7", "hearts"),
      card("set-7-diamonds", "7", "diamonds"),
      card("set-7-clubs", "7", "clubs"),
    ];
    const keepCard = card("keep-card", "9", "spades");
    const newMelds = [meld("new-set", setCards)];
    const state = {
      players: [player("player-0", [...setCards, keepCard])],
      currentPlayerIndex: 0,
      stock: [card("stock-card")],
      discard: [card("discard-card")],
      table: [meld("existing-meld", [card("existing-table-card")])],
    };
    const before = structuredClone(state);

    const result = applyRoundLayDown(
      state,
      setCards.map((setCard) => setCard.id),
      newMelds
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      keepCard.id,
    ]);
    expect(result.patch.players?.[0]?.isDown).toBe(true);
    expect(result.patch.table?.map((tableMeld) => tableMeld.id)).toEqual([
      "existing-meld",
      "new-set",
    ]);
    expect(result.patch.stock).toBeUndefined();
    expect(result.patch.discard).toBeUndefined();
    expect(state).toEqual(before);
  });

  it("lays off a card by removing it from hand and replacing the target meld", () => {
    const layoffCard = card("layoff-card", "7", "spades");
    const keepCard = card("keep-card", "9", "spades");
    const originalMeld = meld("target-meld", [
      card("set-7-hearts", "7", "hearts"),
      card("set-7-diamonds", "7", "diamonds"),
      card("set-7-clubs", "7", "clubs"),
    ]);
    const updatedMeld = { ...originalMeld, cards: [...originalMeld.cards, layoffCard] };
    const state = {
      players: [player("player-0", [layoffCard, keepCard], true)],
      currentPlayerIndex: 0,
      stock: [],
      discard: [],
      table: [originalMeld],
    };

    const result = applyRoundLayOff(state, layoffCard.id, updatedMeld);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      keepCard.id,
    ]);
    expect(result.patch.table?.[0]?.cards.map((tableCard) => tableCard.id)).toEqual([
      "set-7-hearts",
      "set-7-diamonds",
      "set-7-clubs",
      layoffCard.id,
    ]);
  });

  it("swaps a joker by moving the real card to the table and the joker to hand", () => {
    const joker = card("run-joker", "Joker", null);
    const swapCard = card("swap-5-hearts", "5", "hearts");
    const keepCard = card("keep-card", "9", "spades");
    const runMeld: Meld = {
      id: "run-meld",
      ownerId: "player-1",
      type: "run",
      cards: [
        card("run-3-hearts", "3", "hearts"),
        card("run-4-hearts", "4", "hearts"),
        joker,
      ],
    };
    const state = {
      players: [player("player-0", [swapCard, keepCard])],
      currentPlayerIndex: 0,
      stock: [],
      discard: [],
      table: [runMeld],
    };

    const result = applyRoundSwapJoker(state, runMeld.id, joker.id, swapCard.id);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.patch.players?.[0]?.hand.map((handCard) => handCard.id)).toEqual([
      keepCard.id,
      joker.id,
    ]);
    expect(result.patch.table?.[0]?.cards.map((tableCard) => tableCard.id)).toEqual([
      "run-3-hearts",
      "run-4-hearts",
      swapCard.id,
    ]);
  });
});
