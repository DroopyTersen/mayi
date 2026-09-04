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
  for (const roundNumber of [1, 2, 3, 4, 5] as const) {
    for (const type of ["set", "run"] as const) {
      it(`does not extend a completed ${type} in Hand ${roundNumber}`, () => {
        const cards = type === "set"
          ? [
              card("jc", "J", "clubs"),
              card("jd", "J", "diamonds"),
              card("jh", "J", "hearts"),
            ]
          : [
              card("3s", "3", "spades"),
              card("4s", "4", "spades"),
              card("5s", "5", "spades"),
              card("6s", "6", "spades"),
            ];
        const stagedMelds: StagedMeld[] = [{ type, cards }];
        const extra = card("extra", "Joker", null);
        const result = stageCardInMelds({
          stagedMelds,
          card: extra,
          activeMeldIndex: 0,
          roundNumber,
        });
        expect(result.stagedMelds).toEqual(stagedMelds);

        const html = renderToStaticMarkup(
          createElement(LayDownView, {
            hand: [...cards, extra],
            contract: {
              roundNumber,
              sets: type === "set" ? 1 : 0,
              runs: type === "run" ? 1 : 0,
            },
            initialStagedMelds: [{ type, cards: [...cards, extra] }],
            onLayDown: () => undefined,
            onCancel: () => undefined,
          })
        );
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Lay Down<\/button>/);
      });
    }
  }

  it("starts the next set instead of extending a completed matching set in Hand 1", () => {
    const stagedMelds: StagedMeld[] = [
      {
        type: "set",
        cards: [
          card("jc", "J", "clubs"),
          card("jd", "J", "diamonds"),
          card("jh", "J", "hearts"),
        ],
      },
      { type: "set", cards: [] },
    ];
    const extra = card("js", "J", "spades");
    const result = stageCardInMelds({
      stagedMelds,
      card: extra,
      activeMeldIndex: 0,
      roundNumber: 1,
    });
    expect(result.stagedMelds[0]?.cards).toHaveLength(3);
    expect(result.stagedMelds[1]?.cards).toEqual([extra]);
  });

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
      roundNumber: 1,
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
      roundNumber: 1,
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
        contract: { roundNumber: 3, sets: 0, runs: 1 },
        initialStagedMelds: [{ type: "run", cards: runCards }],
        onLayDown: () => undefined,
        onCancel: () => undefined,
      })
    );

    expect(html).toContain(">Lay Down</button>");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("stages a Round 6 extra card onto the completed run it extends", () => {
    const stagedMelds: StagedMeld[] = [
      {
        type: "set",
        cards: [
          card("three-spades", "3", "spades"),
          card("three-hearts", "3", "hearts"),
          card("three-clubs", "3", "clubs"),
        ],
      },
      {
        type: "run",
        cards: [
          card("four-diamonds", "4", "diamonds"),
          card("joker-diamonds-run", "Joker", null),
          card("six-diamonds", "6", "diamonds"),
          card("seven-diamonds", "7", "diamonds"),
        ],
      },
      {
        type: "run",
        cards: [
          card("seven-clubs", "7", "clubs"),
          card("eight-clubs", "8", "clubs"),
          card("nine-clubs", "9", "clubs"),
          card("joker-clubs-run", "Joker", null),
        ],
      },
    ];

    const result = stageCardInMelds({
      stagedMelds,
      card: card("eight-diamonds", "8", "diamonds"),
      activeMeldIndex: 2,
      roundNumber: 6,
    });

    expect(result.stagedMelds[1]?.cards.map((c) => c.id)).toEqual([
      "four-diamonds",
      "joker-diamonds-run",
      "six-diamonds",
      "seven-diamonds",
      "eight-diamonds",
    ]);
    expect(result.stagedMelds[2]?.cards.map((c) => c.id)).toEqual([
      "seven-clubs",
      "eight-clubs",
      "nine-clubs",
      "joker-clubs-run",
    ]);
    expect(result.activeMeldIndex).toBe(1);
  });

  it("stages a fifth card onto the active completed run before every other meld is complete", () => {
    const stagedMelds: StagedMeld[] = [
      {
        type: "set",
        cards: [
          card("three-spades", "3", "spades"),
          card("three-hearts", "3", "hearts"),
          card("three-clubs", "3", "clubs"),
        ],
      },
      {
        type: "run",
        cards: [
          card("six-diamonds", "6", "diamonds"),
          card("seven-diamonds", "7", "diamonds"),
          card("eight-diamonds", "8", "diamonds"),
          card("nine-diamonds", "9", "diamonds"),
        ],
      },
      {
        type: "run",
        cards: [
          card("eight-clubs", "8", "clubs"),
          card("nine-clubs", "9", "clubs"),
          card("ten-clubs", "10", "clubs"),
        ],
      },
    ];

    const result = stageCardInMelds({
      stagedMelds,
      card: card("ten-diamonds", "10", "diamonds"),
      activeMeldIndex: 1,
      roundNumber: 6,
    });

    expect(result.stagedMelds[1]?.cards.map((c) => c.id)).toEqual([
      "six-diamonds",
      "seven-diamonds",
      "eight-diamonds",
      "nine-diamonds",
      "ten-diamonds",
    ]);
    expect(result.stagedMelds[2]?.cards.map((c) => c.id)).toEqual([
      "eight-clubs",
      "nine-clubs",
      "ten-clubs",
    ]);
    expect(result.activeMeldIndex).toBe(2);
  });
});
