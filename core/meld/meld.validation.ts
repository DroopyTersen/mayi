import type { Card, Suit } from "../card/card.types";
import { isWild, getRankValue } from "../card/card.utils";

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

/**
 * Validate a run (sequence) of cards.
 *
 * A valid run requires:
 * - At least 4 cards
 * - All natural cards must be the same suit
 * - Cards form a consecutive sequence (3-4-5-6... up to ...Q-K-A)
 * - Wilds can fill gaps but cannot extend below 3 or above A
 * - Wilds cannot outnumber naturals
 * - Cards must be in sequence order (position matters)
 *
 * Run sequence: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
 * (2 is wild, not part of sequence; A is high only)
 */
export function isValidRun(cards: Card[]): boolean {
  // Must have at least 4 cards
  if (cards.length < 4) {
    return false;
  }

  // Check wild ratio
  if (wildsOutnumberNaturals(cards)) {
    return false;
  }

  // Get all natural cards with their positions
  const naturalsWithPositions: { card: Card; position: number; value: number }[] = [];
  let suit: Suit | null = null;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!isWild(card)) {
      const value = getRankValue(card.rank);
      if (value === null) {
        return false;
      }
      if (suit === null) {
        suit = card.suit;
      } else if (card.suit !== suit) {
        return false; // Mixed suits
      }
      naturalsWithPositions.push({ card, position: i, value });
    }
  }

  // Must have at least one natural
  if (naturalsWithPositions.length === 0) {
    return false;
  }

  // Check naturals are in increasing order by value (no duplicates, properly ordered)
  for (let i = 1; i < naturalsWithPositions.length; i++) {
    if (naturalsWithPositions[i].value <= naturalsWithPositions[i - 1].value) {
      return false; // Not increasing or duplicate
    }
  }

  // Calculate the value at each position
  // First natural determines the anchor point
  const firstNatural = naturalsWithPositions[0];
  const startValue = firstNatural.value - firstNatural.position;

  // Check start is valid (>= 3)
  if (startValue < 3) {
    return false;
  }

  // Check end is valid (<= 14, which is Ace)
  const endValue = startValue + cards.length - 1;
  if (endValue > 14) {
    return false;
  }

  // Verify each natural is at the correct position for its value
  for (const { value, position } of naturalsWithPositions) {
    const expectedValue = startValue + position;
    if (value !== expectedValue) {
      return false;
    }
  }

  return true;
}
