import type { Card } from "../card/card.types";
import { getPointValue } from "../card/card.utils";

/**
 * Calculate the score for a hand of cards.
 *
 * Point values:
 * - 3-10: face value
 * - J, Q, K: 10 points
 * - Ace: 15 points
 * - 2 (wild): 20 points
 * - Joker: 50 points
 */
export function calculateHandScore(hand: Card[]): number {
  let total = 0;
  for (const card of hand) {
    total += getPointValue(card);
  }
  return total;
}
