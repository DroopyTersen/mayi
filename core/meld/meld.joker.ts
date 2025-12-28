import type { Card, Rank, Suit } from "../card/card.types";
import type { Meld } from "./meld.types";
import { isWild, getRankValue } from "../card/card.utils";

const RANK_ORDER: Rank[] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function valueToRank(value: number): Rank {
  const rank = RANK_ORDER[value - 3];
  if (rank === undefined) {
    throw new Error(`Invalid rank value: ${value}`);
  }
  return rank;
}

export interface WildPosition {
  wildCard: Card;
  actingAsRank: Rank;
  actingAsSuit: Suit;
  isJoker: boolean; // Only Jokers can be swapped, not 2s
  positionIndex: number;
}

/**
 * Identify what positions wild cards are acting as in a run.
 * Returns empty array for sets (joker swapping only works on runs).
 */
export function identifyJokerPositions(meld: Meld): WildPosition[] {
  // Joker swapping only works on runs
  if (meld.type !== "run") {
    return [];
  }

  const cards = meld.cards;
  const positions: WildPosition[] = [];

  // Find the first natural card to determine the suit and anchor value
  let suit: Suit | null = null;
  let anchorValue: number | null = null;
  let anchorPosition: number | null = null;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card === undefined) {
      continue;
    }
    if (!isWild(card)) {
      const value = getRankValue(card.rank);
      if (value !== null && card.suit !== null) {
        suit = card.suit;
        anchorValue = value;
        anchorPosition = i;
        break;
      }
    }
  }

  // If no natural found, can't determine positions
  if (suit === null || anchorValue === null || anchorPosition === null) {
    return [];
  }

  // Calculate the starting value of the run
  const startValue = anchorValue - anchorPosition;

  // Identify each wild card's position
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card === undefined) {
      continue;
    }
    if (isWild(card)) {
      const value = startValue + i;
      positions.push({
        wildCard: card,
        actingAsRank: valueToRank(value),
        actingAsSuit: suit,
        isJoker: card.rank === "Joker",
        positionIndex: i,
      });
    }
  }

  return positions;
}

/**
 * Check if a natural card can swap for a Joker in a meld.
 *
 * Rules:
 * - Only Jokers can be swapped (not 2s)
 * - Only from runs (not sets)
 * - The natural card must match the Joker's acting rank and suit
 * - The swap card cannot be wild
 */
export function canSwapJokerWithCard(
  meld: Meld,
  jokerCard: Card,
  swapCard: Card
): boolean {
  // Only runs allow joker swapping
  if (meld.type !== "run") {
    return false;
  }

  // The joker must actually be a Joker (not a 2)
  if (jokerCard.rank !== "Joker") {
    return false;
  }

  // The swap card cannot be wild
  if (isWild(swapCard)) {
    return false;
  }

  // Find the joker in the meld
  const jokerIndex = meld.cards.findIndex((c) => c.id === jokerCard.id);
  if (jokerIndex === -1) {
    return false;
  }

  // Get the positions to find what this joker is acting as
  const positions = identifyJokerPositions(meld);
  const jokerPosition = positions.find((p) => p.wildCard.id === jokerCard.id);

  if (!jokerPosition) {
    return false;
  }

  // Check if swap card matches
  return (
    swapCard.rank === jokerPosition.actingAsRank &&
    swapCard.suit === jokerPosition.actingAsSuit
  );
}
