import { describe, expect, it } from "bun:test";
import type { Card } from "core/card/card.types";
import { stageCardInMelds, type StagedMeld } from "./LayDownView";

const card = (id: string, rank: Card["rank"], suit: Card["suit"]): Card => ({
  id,
  rank,
  suit,
});

describe("LayDownView staging", () => {
  it("advances to the next incomplete meld after filling the active meld", () => {
    const stagedMelds: StagedMeld[] = [
      {
        type: "set",
        cards: [
          card("a-spades", "A", "spades"),
          card("a-diamonds", "A", "diamonds"),
          card("a-hearts", "A", "hearts"),
        ],
      },
      { type: "set", cards: [] },
    ];

    const result = stageCardInMelds({
      stagedMelds,
      card: card("q-spades", "Q", "spades"),
      activeMeldIndex: 0,
    });

    expect(result.stagedMelds[0]?.cards.map((c) => c.id)).toEqual([
      "a-spades",
      "a-diamonds",
      "a-hearts",
    ]);
    expect(result.stagedMelds[1]?.cards.map((c) => c.id)).toEqual([
      "q-spades",
    ]);
    expect(result.activeMeldIndex).toBe(1);
  });

  it("moves focus to the next incomplete meld when a card completes the active meld", () => {
    const stagedMelds: StagedMeld[] = [
      {
        type: "set",
        cards: [
          card("a-spades", "A", "spades"),
          card("a-diamonds", "A", "diamonds"),
        ],
      },
      { type: "set", cards: [] },
    ];

    const result = stageCardInMelds({
      stagedMelds,
      card: card("a-hearts", "A", "hearts"),
      activeMeldIndex: 0,
    });

    expect(result.stagedMelds[0]?.cards.map((c) => c.id)).toEqual([
      "a-spades",
      "a-diamonds",
      "a-hearts",
    ]);
    expect(result.activeMeldIndex).toBe(1);
  });
});
