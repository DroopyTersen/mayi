import { describe, expect, it } from "bun:test";
import type { Card } from "../../core/card/card.types";
import { card } from "./ai-player-short-rollout-scenario";
import { evaluateHand5DiscardCoverage } from "./ai-player-hand5-draw-coverage";

const hand = (edgeSpades = false): Card[] => [
  ...(["Q", "K"] as const).flatMap((rank) =>
    (["clubs", "diamonds", "hearts"] as const).map((suit) =>
      card(`${rank}-${suit}`, rank, suit),
    ),
  ),
  ...(["5", "6", "7"] as const).map((rank) =>
    card(`${rank}d`, rank, "diamonds"),
  ),
  ...(edgeSpades ? (["3", "4", "5"] as const) : (["5", "6", "7"] as const)).map(
    (rank) => card(`${rank}s`, rank, "spades"),
  ),
];

describe("Hand 5 public-information next-draw contract coverage", () => {
  it("returns exact house-rule-sized witnesses even when the engine permits oversized melds", () => {
    const cards = [
      ...hand().slice(0, 6),
      ...(["3", "4", "5", "6", "7", "8"] as const).map((rank) =>
        card(`long-${rank}`, rank, "spades"),
      ),
    ];
    const result = evaluateHand5DiscardCoverage({
      hand: cards,
      visibleOutsideHand: [],
    });
    expect(result.immediateContractAvailable).toBe(true);
    for (const candidate of result.candidates) {
      for (const draw of candidate.completingDraws)
        expect(draw.positionGroups.map((group) => group.length)).toEqual([
          3, 3, 4,
        ]);
    }
  });
  it("prefers the less depleted plan after accounting for known physical copies", () => {
    const result = evaluateHand5DiscardCoverage({
      hand: hand(),
      visibleOutsideHand: [
        card("seen4d", "4", "diamonds"),
        card("seen8d", "8", "diamonds"),
      ],
    });
    expect(result.immediateContractAvailable).toBe(false);
    expect(result.unseenCardCount).toBe(94);
    expect(result.bestDiscardCardIds).toEqual(["5d", "6d", "7d"]);
    expect(
      result.candidates.find((candidate) => candidate.discardCardId === "5d")
        ?.completingDrawCount,
    ).toBe(16);
    expect(
      result.candidates.find((candidate) => candidate.discardCardId === "5s")
        ?.completingDrawCount,
    ).toBe(14);
    expect(
      result.candidates.find(
        (candidate) => candidate.discardCardId === "Q-clubs",
      )?.completingDrawCount,
    ).toBe(0);
  });

  it("does not abandon the stronger plan merely because its suit is being collected", () => {
    const result = evaluateHand5DiscardCoverage({
      hand: hand(true),
      visibleOutsideHand: [
        card("seen4d", "4", "diamonds"),
        card("seen10d", "10", "diamonds"),
      ],
    });
    expect(result.bestDiscardCardIds).toEqual(["3s", "4s", "5s"]);
    expect(
      result.candidates.find((candidate) => candidate.discardCardId === "3s")
        ?.completingDrawCount,
    ).toBe(15);
    expect(
      result.candidates.find((candidate) => candidate.discardCardId === "5d")
        ?.completingDrawCount,
    ).toBe(14);
  });

  it("requires a coherent observable inventory and does not consume input", () => {
    const cards = hand();
    const original = structuredClone(cards);
    expect(() =>
      evaluateHand5DiscardCoverage({
        hand: cards,
        visibleOutsideHand: [cards[0]!],
      }),
    ).toThrow("duplicate");
    expect(() =>
      evaluateHand5DiscardCoverage({
        hand: cards,
        visibleOutsideHand: [
          card("q1", "Q", "clubs"),
          card("q2", "Q", "clubs"),
        ],
      }),
    ).toThrow("multiplicity");
    expect(() =>
      evaluateHand5DiscardCoverage({
        hand: cards.slice(1),
        visibleOutsideHand: [],
      }),
    ).toThrow("12");
    evaluateHand5DiscardCoverage({ hand: cards, visibleOutsideHand: [] });
    expect(cards).toEqual(original);
  });
});
