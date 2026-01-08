import type { Rank, Suit } from "core/card/card.types";

export interface SwappableJoker {
  meldId: string;
  jokerCardId: string;
  jokerIndex: number;
  replacementRank: Rank;
  replacementSuit: Suit;
}
