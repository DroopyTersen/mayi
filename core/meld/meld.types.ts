import type { Card } from "../card/card.types";

export interface Meld {
  id: string;
  type: "set" | "run";
  cards: Card[];
  ownerId: string;
}
