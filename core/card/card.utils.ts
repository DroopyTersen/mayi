import type { Card, Rank } from "./card.types";

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

/**
 * Get the numeric value of a rank for run ordering.
 *
 * Run order: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
 * - 3 is lowest (value 3)
 * - Ace is highest (value 14)
 * - 2 and Joker are wild and return null (not part of natural sequence)
 */
export function getRankValue(rank: Rank): number | null {
  if (rank === "2" || rank === "Joker") {
    return null; // Wild cards don't have a position in the sequence
  }

  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;

  return parseInt(rank, 10);
}
