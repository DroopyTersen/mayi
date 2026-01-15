import type { Card, Suit } from "../card/card.types";
import type { Meld } from "./meld.types";
import { isWild, getRankValue } from "../card/card.utils";

/**
 * Check if a card can extend a run at either end.
 *
 * Rules:
 * - Card must be same suit as run (or wild)
 * - Card must connect to low or high end
 * - Cannot extend below 3 or above Ace
 * - Card cannot duplicate a rank already in run
 */
export function canExtendRun(meld: Meld, card: Card): boolean {
  if (meld.type !== "run") {
    return false;
  }

  const cards = meld.cards;

  // Find suit and bounds of the run
  let suit: Suit | null = null;
  let minValue: number | null = null;
  let maxValue: number | null = null;

  // Find first natural to get suit and anchor
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (c === undefined) {
      continue;
    }
    if (!isWild(c)) {
      const value = getRankValue(c.rank);
      if (value !== null && c.suit !== null) {
        suit = c.suit;
        // Calculate run start based on position
        const startValue = value - i;
        minValue = startValue;
        maxValue = startValue + cards.length - 1;
        break;
      }
    }
  }

  if (suit === null || minValue === null || maxValue === null) {
    return false;
  }

  // Check if adding card is valid
  if (isWild(card)) {
    // Wild can extend at low end only if minValue > 3 (room below)
    const canExtendLow = minValue > 3;
    // Wild can extend at high end only if maxValue < 14 (room above)
    const canExtendHigh = maxValue < 14;
    return canExtendLow || canExtendHigh;
  }

  // Natural card
  const cardValue = getRankValue(card.rank);
  if (cardValue === null) {
    return false;
  }

  // Must be same suit
  if (card.suit !== suit) {
    return false;
  }

  // Must connect at low or high end
  const extendsLow = cardValue === minValue - 1 && cardValue >= 3;
  const extendsHigh = cardValue === maxValue + 1 && cardValue <= 14;

  return extendsLow || extendsHigh;
}

/**
 * Check if a card can extend a set.
 *
 * Rules:
 * - Card must be same rank (or wild)
 * - Duplicate suits are allowed (multi-deck)
 */
export function canExtendSet(meld: Meld, card: Card): boolean {
  if (meld.type !== "set") {
    return false;
  }

  const cards = meld.cards;

  // Find the rank of the set
  let setRank: Card["rank"] | null = null;
  for (const c of cards) {
    if (!isWild(c)) {
      setRank = c.rank;
      break;
    }
  }

  if (setRank === null) {
    return false;
  }

  if (isWild(card)) {
    return true;
  }

  // Natural card must match rank
  return card.rank === setRank;
}
