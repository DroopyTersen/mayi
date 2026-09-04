import { describe, expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import { findLayDownCandidates } from "./mayIAgent.contract-candidates";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

describe("AI exact contract candidates", () => {
  it("finds the natural set plus recovered-Joker run after a swap", () => {
    const hand = [
      card("9c", "9", "clubs"),
      card("9d", "9", "diamonds"),
      card("8s", "8", "spades"),
      card("9s", "9", "spades"),
      card("10s", "10", "spades"),
      card("kc", "K", "clubs"),
      card("9h", "9", "hearts"),
      card("joker", "Joker", null),
    ];

    expect(
      findLayDownCandidates({
        hand,
        contract: { roundNumber: 2, sets: 1, runs: 1 },
        playerId: "p1",
      })[0],
    ).toMatchObject({
      positionGroups: [[1, 2, 7], [3, 4, 5, 8]],
      usedCardCount: 7,
      remainingCardIds: ["kc"],
    });
  });

  it("requires a Hand 6 candidate to consume every card", () => {
    const contract = { roundNumber: 6 as const, sets: 1, runs: 2 };
    const completeHand = [
      card("7s", "7", "spades"),
      card("7h", "7", "hearts"),
      card("7d", "7", "diamonds"),
      card("7c", "7", "clubs"),
      card("3s", "3", "spades"),
      card("4s", "4", "spades"),
      card("5s", "5", "spades"),
      card("6s", "6", "spades"),
      card("9h", "9", "hearts"),
      card("10h", "10", "hearts"),
      card("jh", "J", "hearts"),
      card("qh", "Q", "hearts"),
    ];

    expect(
      findLayDownCandidates({
        hand: completeHand,
        contract,
        playerId: "p1",
      })[0]?.remainingCardIds,
    ).toEqual([]);
    expect(
      findLayDownCandidates({
        hand: [...completeHand, card("extra-kd", "K", "diamonds")],
        contract,
        playerId: "p1",
      }),
    ).toEqual([]);
  });

  it("does not offer two same-suit runs separated by only one rank", () => {
    const hand = [
      card("3s", "3", "spades"),
      card("4s", "4", "spades"),
      card("5s", "5", "spades"),
      card("6s", "6", "spades"),
      card("8s", "8", "spades"),
      card("9s", "9", "spades"),
      card("10s", "10", "spades"),
      card("js", "J", "spades"),
    ];

    expect(
      findLayDownCandidates({
        hand,
        contract: { roundNumber: 3, sets: 0, runs: 2 },
        playerId: "p1",
      }),
    ).toEqual([]);
  });
});
