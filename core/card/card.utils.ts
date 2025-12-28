import type { Card } from "./card.types";

/**
 * Check if a card is wild (2s and Jokers are wild)
 */
export function isWild(card: Card): boolean {
  return card.rank === "2" || card.rank === "Joker";
}

/**
 * Check if a card is natural (not wild)
 */
export function isNatural(card: Card): boolean {
  return !isWild(card);
}

/**
 * Get the point value of a card for scoring
 *
 * Point values:
 * - 3-10: face value
 * - J, Q, K: 10 points
 * - Ace: 15 points
 * - 2 (wild): 2 points
 * - Joker: 50 points
 */
export function getPointValue(card: Card): number {
  if (card.rank === "Joker") return 50;
  if (card.rank === "A") return 15;
  if (card.rank === "K" || card.rank === "Q" || card.rank === "J") return 10;
  if (card.rank === "2") return 2;
  return parseInt(card.rank, 10);
}
