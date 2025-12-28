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

/**
 * Validate a set (group) of cards.
 *
 * A valid set requires:
 * - At least 3 cards
 * - All natural cards must be the same rank
 * - Wilds cannot outnumber naturals
 *
 * Note: Duplicate suits are allowed (multi-deck game)
 */
export function isValidSet(cards: Card[]): boolean {
  // Must have at least 3 cards
  if (cards.length < 3) {
    return false;
  }

  // Check wild ratio
  if (wildsOutnumberNaturals(cards)) {
    return false;
  }

  // Get all natural cards
  const naturals = cards.filter((c) => !isWild(c));

  // Must have at least one natural
  if (naturals.length === 0) {
    return false;
  }

  // All naturals must be the same rank
  const rank = naturals[0].rank;
  for (const natural of naturals) {
    if (natural.rank !== rank) {
      return false;
    }
  }

  return true;
}
