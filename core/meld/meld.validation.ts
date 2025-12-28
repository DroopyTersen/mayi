import type { Card } from "../card/card.types";
import { isWild } from "../card/card.utils";

export interface WildNaturalCount {
  wilds: number;
  naturals: number;
}

/**
 * Count the number of wild cards and natural cards in a set of cards.
 * Wild cards are 2s and Jokers.
 */
export function countWildsAndNaturals(cards: Card[]): WildNaturalCount {
  let wilds = 0;
  let naturals = 0;

  for (const card of cards) {
    if (isWild(card)) {
      wilds++;
    } else {
      naturals++;
    }
  }

  return { wilds, naturals };
}

/**
 * Check if wild cards outnumber natural cards.
 * In May I?, wilds cannot outnumber naturals in any meld.
 * Equal counts are allowed.
 */
export function wildsOutnumberNaturals(cards: Card[]): boolean {
  const { wilds, naturals } = countWildsAndNaturals(cards);
  return wilds > naturals;
}
