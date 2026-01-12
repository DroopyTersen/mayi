/**
 * Run Normalizer - Intelligent sorting of run cards for lay down
 *
 * This module handles the auto-sorting of cards intended for a run meld.
 * Users can select cards in any order (descending, random, etc.) and
 * this normalizer will attempt to arrange them into valid ascending run order.
 *
 * Key responsibilities:
 * - Sort natural cards by rank value (ascending)
 * - Position wild cards (2s and Jokers) into valid gap positions
 * - Validate that the resulting arrangement can form a valid run
 * - Respect run boundaries (3 is lowest, A is highest)
 * - Ensure wilds don't outnumber naturals
 */

import type { Card, Suit } from "../card/card.types";
import { isWild, getRankValue } from "../card/card.utils";

/**
 * Result of run normalization attempt
 */
export type RunNormalizationResult =
  | { success: true; cards: Card[] }
  | { success: false; cards: Card[]; reason: string };

/**
 * Internal representation for positioning cards
 */
interface PositionedNatural {
  card: Card;
  rankValue: number;
}

/**
 * Normalizes run cards into valid ascending order.
 *
 * Takes cards in any order and attempts to arrange them into a valid run.
 * Natural cards are sorted ascending by rank, and wilds are positioned
 * to fill gaps.
 *
 * @param cards - Cards to normalize (in any order)
 * @returns Result with normalized cards or failure reason
 */
export function normalizeRunCards(cards: Card[]): RunNormalizationResult {
  // Minimum run length is 4
  if (cards.length < 4) {
    return {
      success: false,
      cards,
      reason: "Run requires at least 4 cards",
    };
  }

  // Separate naturals and wilds
  const naturals: PositionedNatural[] = [];
  const wilds: Card[] = [];
  let suit: Suit | null = null;

  for (const card of cards) {
    if (isWild(card)) {
      wilds.push(card);
    } else {
      const rankValue = getRankValue(card.rank);
      if (rankValue === null) {
        return {
          success: false,
          cards,
          reason: `Invalid rank: ${card.rank}`,
        };
      }

      // Check suit consistency
      if (suit === null) {
        suit = card.suit;
      } else if (card.suit !== suit) {
        return {
          success: false,
          cards,
          reason: `Mixed suits in run: ${suit} and ${card.suit}`,
        };
      }

      naturals.push({ card, rankValue });
    }
  }

  // Must have at least one natural
  if (naturals.length === 0) {
    return {
      success: false,
      cards,
      reason: "Run must have at least one natural card",
    };
  }

  // Check wild ratio (wilds cannot outnumber naturals)
  if (wilds.length > naturals.length) {
    return {
      success: false,
      cards,
      reason: `Wilds (${wilds.length}) outnumber naturals (${naturals.length})`,
    };
  }

  // Sort naturals by rank value (ascending)
  naturals.sort((a, b) => a.rankValue - b.rankValue);

  // Check for duplicate ranks
  for (let i = 1; i < naturals.length; i++) {
    if (naturals[i]!.rankValue === naturals[i - 1]!.rankValue) {
      return {
        success: false,
        cards,
        reason: `Duplicate rank in run: ${naturals[i]!.card.rank}`,
      };
    }
  }

  // Calculate the range needed
  const lowestNatural = naturals[0]!.rankValue;
  const highestNatural = naturals[naturals.length - 1]!.rankValue;
  const naturalSpan = highestNatural - lowestNatural + 1;
  const gapsInNaturals = naturalSpan - naturals.length;

  // Total cards we'll place
  const totalCards = cards.length;

  // We need to place wilds in gaps and/or at ends
  // First fill gaps between naturals
  // Then place remaining wilds at ends (preferring end over start if valid)

  // Calculate how many slots we need vs have
  const slotsNeeded = totalCards;
  const wildsAvailable = wilds.length;

  // Internal gaps between naturals
  const internalGaps = gapsInNaturals;

  if (internalGaps > wildsAvailable) {
    return {
      success: false,
      cards,
      reason: `Cannot fill ${internalGaps} gaps with only ${wildsAvailable} wilds`,
    };
  }

  // Wilds remaining after filling internal gaps
  const wildsForEnds = wildsAvailable - internalGaps;

  // Calculate start and end positions
  // Run spans from startValue to startValue + totalCards - 1
  // We want to fit: some wilds at start, naturals (with gaps filled), some wilds at end

  // Try to find a valid placement
  // Strategy: anchor on the naturals, then place end wilds

  // The natural span starts at lowestNatural
  // We need wildsForEnds positions at the ends
  // Distribute: try end first (more common case), then start

  // Compute different configurations and pick one that works
  const result = findValidPlacement(
    naturals,
    wilds,
    lowestNatural,
    highestNatural,
    internalGaps,
    wildsForEnds
  );

  if (result === null) {
    return {
      success: false,
      cards,
      reason: "Cannot form valid run with given cards",
    };
  }

  return {
    success: true,
    cards: result,
  };
}

/**
 * Finds a valid placement for naturals and wilds to form a run.
 */
function findValidPlacement(
  naturals: PositionedNatural[],
  wilds: Card[],
  lowestNatural: number,
  highestNatural: number,
  internalGaps: number,
  wildsForEnds: number
): Card[] | null {
  const totalCards = naturals.length + wilds.length;

  // Try different distributions of end wilds (startWilds, endWilds)
  // startWilds + endWilds = wildsForEnds
  for (let startWilds = 0; startWilds <= wildsForEnds; startWilds++) {
    const endWilds = wildsForEnds - startWilds;

    const startValue = lowestNatural - startWilds;
    const endValue = highestNatural + endWilds;

    // Check boundaries: start >= 3, end <= 14 (Ace)
    if (startValue < 3) continue;
    if (endValue > 14) continue;

    // Verify the span matches our total cards
    const span = endValue - startValue + 1;
    if (span !== totalCards) continue;

    // Valid configuration found - build the result
    const result: Card[] = new Array(totalCards);
    let wildIndex = 0;

    // Place cards position by position
    for (let pos = 0; pos < totalCards; pos++) {
      const valueAtPos = startValue + pos;

      // Find if there's a natural at this value
      const natural = naturals.find((n) => n.rankValue === valueAtPos);

      if (natural) {
        result[pos] = natural.card;
      } else {
        // Place a wild here
        if (wildIndex >= wilds.length) {
          // Shouldn't happen if logic is correct
          return null;
        }
        result[pos] = wilds[wildIndex]!;
        wildIndex++;
      }
    }

    // All wilds should be placed
    if (wildIndex !== wilds.length) {
      continue;
    }

    return result;
  }

  return null;
}
