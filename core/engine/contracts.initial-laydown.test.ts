import { describe, expect, it } from "bun:test";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import { CONTRACTS, validateContractMelds } from "./contracts";
import type { RoundNumber } from "./engine.types";

function contractMelds(round: RoundNumber): Meld[] {
  const contract = CONTRACTS[round];
  const setRanks: Card["rank"][] = ["J", "10", "Q"];
  const runSuits: Card["suit"][] = ["spades", "hearts"];
  return [
    ...Array.from({ length: contract.sets }, (_, index): Meld => ({
      id: `set-${index}`,
      ownerId: "player-1",
      type: "set",
      cards: (["clubs", "diamonds", "hearts"] as const).map((suit) => ({
        id: `set-${index}-${suit}`,
        rank: setRanks[index]!,
        suit,
      })),
    })),
    ...Array.from({ length: contract.runs }, (_, index): Meld => ({
      id: `run-${index}`,
      ownerId: "player-1",
      type: "run",
      cards: (["3", "4", "5", "6"] as const).map((rank) => ({
        id: `run-${index}-${rank}`,
        rank,
        suit: runSuits[index]!,
      })),
    })),
  ];
}

describe("initial laydown sizes", () => {
  for (const round of [1, 2, 3, 4, 5] as const) {
    it(`accepts the exact contract in Hand ${round}`, () => {
      expect(validateContractMelds(CONTRACTS[round], contractMelds(round)).valid).toBe(true);
    });

    for (const type of ["set", "run"] as const) {
      const meldCount = type === "set" ? CONTRACTS[round].sets : CONTRACTS[round].runs;
      if (meldCount === 0) continue;
      for (const useWild of [false, true]) {
        it(`rejects an extra ${useWild ? "wild" : "natural"} in a Hand ${round} ${type}`, () => {
          const melds = contractMelds(round);
          const meld = melds.find((meld) => meld.type === type)!;
          meld.cards.push(
            useWild
              ? { id: "extra-wild", rank: "Joker", suit: null }
              : {
                  id: "extra-natural",
                  rank: type === "set" ? meld.cards[0]!.rank : "7",
                  suit: type === "set" ? "spades" : meld.cards[0]!.suit,
                }
          );

          expect(validateContractMelds(CONTRACTS[round], melds)).toEqual({
            valid: false,
            error: `Hand ${round} initial ${type}s must contain exactly ${type === "set" ? 3 : 4} cards`,
          });
        });
      }
    }
  }

  for (const type of ["set", "run"] as const) {
    it(`allows an extended ${type} in Hand 6`, () => {
      const melds = contractMelds(6);
      melds.find((meld) => meld.type === type)!.cards.push({
        id: "extra-wild",
        rank: "Joker",
        suit: null,
      });
      expect(validateContractMelds(CONTRACTS[6], melds).valid).toBe(true);
    });
  }
});
