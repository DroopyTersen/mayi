/**
 * Run bounds calculation utilities for May I? card game
 *
 * Provides a shared utility for calculating the low and high rank values
 * of a run, accounting for wild cards. Used by both contract validation
 * (gap rule) and layoff validation.
 */

import type { Card } from "../card/card.types";
import { isWild, getRankValue } from "../card/card.utils";

/**
 * Represents the bounds of a run meld
 */
export interface RunBounds {
  /** Lowest rank value in the run (3-14, where A=14) */
  lowValue: number;
  /** Highest rank value in the run */
  highValue: number;
  /** The suit of the run (from natural cards) */
  suit: Card["suit"];
}

/**
 * Gets the run's low and high rank values and suit.
 * Accounts for wilds by inferring their positions from natural cards.
 *
 * @param cards - The cards in the run (ordered low to high)
 * @returns RunBounds if the run has natural cards, null if all cards are wild
 *
 * @example
 * // Natural cards only: 5♠ 6♠ 7♠ 8♠
 * getRunBounds([...]) // → { lowValue: 5, highValue: 8, suit: "spades" }
 *
 * @example
 * // Wild at start: Wild 6♠ 7♠ 8♠ → wild represents 5♠
 * getRunBounds([...]) // → { lowValue: 5, highValue: 8, suit: "spades" }
 *
 * @example
 * // All wilds: Wild Wild Wild Wild
 * getRunBounds([...]) // → null
 */
export function getRunBounds(cards: Card[]): RunBounds | null {
  const naturalsWithValues: { value: number; position: number; suit: Card["suit"] }[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    if (!isWild(card)) {
      const value = getRankValue(card.rank);
      if (value !== null) {
        naturalsWithValues.push({ value, position: i, suit: card.suit });
      }
    }
  }

  if (naturalsWithValues.length === 0) {
    return null;
  }

  // Calculate the start value based on first natural's position
  const firstNatural = naturalsWithValues[0]!;
  const startValue = firstNatural.value - firstNatural.position;
  const endValue = startValue + cards.length - 1;

  return {
    lowValue: startValue,
    highValue: endValue,
    suit: firstNatural.suit,
  };
}
