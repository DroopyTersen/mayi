import { describe, expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import { findBestLayoffPlan } from "./mayIAgent.layoff-candidates";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

describe("AI layoff candidates", () => {
  it("finds the natural-first sequence that plays every layoff before the Joker", () => {
    const hand = [
      card("3s", "3", "spades"),
      card("4s", "4", "spades"),
      card("joker", "Joker", null),
      card("kc", "K", "clubs"),
      card("9s", "9", "spades"),
    ];
    const table: Meld[] = [{
      id: "spade-run",
      ownerId: "opponent",
      type: "run",
      cards: [
        card("5s", "5", "spades"),
        card("6s", "6", "spades"),
        card("7s", "7", "spades"),
        card("8s", "8", "spades"),
      ],
    }];

    expect(findBestLayoffPlan(hand, table)).toEqual({
      steps: [
        { cardId: "4s", meldId: "spade-run", position: "start" },
        { cardId: "3s", meldId: "spade-run", position: "start" },
        { cardId: "9s", meldId: "spade-run", position: "end" },
        { cardId: "joker", meldId: "spade-run", position: "end" },
      ],
      remainingCardIds: ["kc"],
    });
  });

  it("returns no sequence when fewer than two cards can be laid off", () => {
    const hand = [card("4s", "4", "spades"), card("kc", "K", "clubs")];
    const table: Meld[] = [{
      id: "spade-run",
      ownerId: "opponent",
      type: "run",
      cards: [
        card("5s", "5", "spades"),
        card("6s", "6", "spades"),
        card("7s", "7", "spades"),
      ],
    }];

    expect(findBestLayoffPlan(hand, table)).toBeNull();
  });
});
