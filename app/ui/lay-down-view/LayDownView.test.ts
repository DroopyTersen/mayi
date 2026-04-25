import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card } from "core/card/card.types";
import { LayDownView, stageCardInMelds, type StagedMeld } from "./LayDownView";

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

  it("enables lay down for a staged run that the engine can normalize", () => {
    const runCards = [
      card("six-hearts", "6", "hearts"),
      card("three-hearts", "3", "hearts"),
      card("five-hearts", "5", "hearts"),
      card("four-hearts", "4", "hearts"),
    ];

    const html = renderToStaticMarkup(
      createElement(LayDownView, {
        hand: runCards,
        contract: { sets: 0, runs: 1 },
        initialStagedMelds: [{ type: "run", cards: runCards }],
        onLayDown: () => undefined,
        onCancel: () => undefined,
      })
    );

    expect(html).toContain(">Lay Down</button>");
    expect(html).not.toContain("disabled=\"\"");
  });
});
