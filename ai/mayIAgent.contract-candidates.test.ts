import { describe, expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import { findLayDownCandidates } from "./mayIAgent.contract-candidates";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

describe("AI exact contract candidates", () => {
  it("only offers three-card sets for Hand 1 even when larger sets are available", () => {
    const hand = [
      card("jc", "J", "clubs"), card("jd", "J", "diamonds"),
      card("jh", "J", "hearts"), card("js", "J", "spades"),
      card("10c", "10", "clubs"), card("10d", "10", "diamonds"),
      card("10h", "10", "hearts"), card("10s", "10", "spades"),
      card("joker", "Joker", null),
    ];
    const candidates = findLayDownCandidates({
      hand, contract: { roundNumber: 1, sets: 2, runs: 0 }, playerId: "p1",
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.positionGroups.map((group) => group.length)).toEqual([3, 3]);
      expect(candidate.usedCardCount).toBe(6);
      expect(candidate.remainingCardIds).toHaveLength(3);
    }
  });

  it("only offers a three-card set and four-card run for Hand 2", () => {
    const hand = [
      card("jc", "J", "clubs"), card("jd", "J", "diamonds"),
      card("jh", "J", "hearts"), card("js", "J", "spades"),
      card("3s", "3", "spades"), card("4s", "4", "spades"),
      card("5s", "5", "spades"), card("6s", "6", "spades"),
      card("7s", "7", "spades"),
    ];
    const candidates = findLayDownCandidates({
      hand, contract: { roundNumber: 2, sets: 1, runs: 1 }, playerId: "p1",
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.positionGroups.map((group) => group.length)).toEqual([3, 4]);
      expect(candidate.usedCardCount).toBe(7);
    }
  });

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
