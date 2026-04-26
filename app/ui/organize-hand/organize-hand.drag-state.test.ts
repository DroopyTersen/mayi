import { describe, expect, it } from "bun:test";
import type { Card } from "core/card/card.types";
import { reorderCardsAfterDrag } from "./organize-hand.drag-state";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

describe("reorderCardsAfterDrag", () => {
  it("moves the dragged card from its initial index to the target index", () => {
    const first = card("first", "3", "hearts");
    const second = card("second", "5", "clubs");
    const third = card("third", "9", "spades");

    const reordered = reorderCardsAfterDrag([first, second, third], {
      initialIndex: 0,
      targetIndex: 2,
    });

    expect(reordered).toEqual([second, third, first]);
  });

  it("preserves duplicate visual card identity by card id", () => {
    const firstSeven = card("seven-a", "7", "diamonds");
    const secondSeven = card("seven-b", "7", "diamonds");
    const king = card("king", "K", "spades");

    const reordered = reorderCardsAfterDrag([firstSeven, secondSeven, king], {
      initialIndex: 1,
      targetIndex: 0,
    });

    expect(reordered[0]).toBe(secondSeven);
    expect(reordered[1]).toBe(firstSeven);
    expect(reordered.map((c) => c.id)).toEqual(["seven-b", "seven-a", "king"]);
  });

  it("keeps the draft order unchanged when drag is canceled", () => {
    const cards = [
      card("first", "3", "hearts"),
      card("second", "5", "clubs"),
      card("third", "9", "spades"),
    ];

    const reordered = reorderCardsAfterDrag(cards, {
      initialIndex: 0,
      targetIndex: 2,
      canceled: true,
    });

    expect(reordered).toBe(cards);
  });

  it("keeps the draft order unchanged when dropped on the same index", () => {
    const cards = [
      card("first", "3", "hearts"),
      card("second", "5", "clubs"),
    ];

    const reordered = reorderCardsAfterDrag(cards, {
      initialIndex: 1,
      targetIndex: 1,
    });

    expect(reordered).toBe(cards);
  });
});
