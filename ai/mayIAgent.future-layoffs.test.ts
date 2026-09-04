import { describe, expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import { findProtectedFutureLayoffs } from "./mayIAgent.future-layoffs";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

describe("AI future layoff protection", () => {
  it("protects only unused contract cards that already fit public melds", () => {
    const hand = [
      card("9c", "9", "clubs"),
      card("9d", "9", "diamonds"),
      card("9h", "9", "hearts"),
      card("kc", "K", "clubs"),
      card("3h", "3", "hearts"),
      card("qh", "Q", "hearts"),
    ];
    const table: Meld[] = [
      {
        id: "kings",
        ownerId: "opponent-1",
        type: "set",
        cards: [
          card("kh", "K", "hearts"),
          card("kd", "K", "diamonds"),
          card("ks", "K", "spades"),
        ],
      },
      {
        id: "threes",
        ownerId: "opponent-2",
        type: "set",
        cards: [
          card("3s", "3", "spades"),
          card("3d", "3", "diamonds"),
          card("3c", "3", "clubs"),
        ],
      },
      {
        id: "nines",
        ownerId: "opponent-2",
        type: "set",
        cards: [
          card("9s", "9", "spades"),
          card("9x", "9", "diamonds"),
          card("9y", "9", "clubs"),
        ],
      },
    ];

    expect(
      findProtectedFutureLayoffs({
        hand,
        table,
        remainingCardIds: ["kc", "3h", "qh"],
      }),
    ).toEqual({
      protectedCards: [
        { cardId: "kc", meldId: "kings" },
        { cardId: "3h", meldId: "threes" },
      ],
      discardCandidateId: "qh",
    });
  });
});
