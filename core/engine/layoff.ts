/**
 * Lay off functions for May I? card game
 *
 * Laying off means adding cards from your hand to existing melds on the table.
 * You can only lay off if you are already "down" (have laid down your contract)
 * and you cannot lay off on the same turn you laid down.
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import { isWild } from "../card/card.utils";
import { countWildsAndNaturals } from "../meld/meld.validation";

/**
 * Context needed for lay off guard evaluation
 */
export interface LayOffContext {
  isDown: boolean;
  laidDownThisTurn: boolean;
  hasDrawn: boolean;
}

/**
 * Checks if a player can lay off cards based on their current state.
 *
 * Preconditions for laying off:
 * 1. Player must be down (isDown: true) - have laid down their contract
 * 2. Player must NOT have laid down this turn (laidDownThisTurn: false)
 * 3. Player must have drawn a card (hasDrawn: true)
 *
 * @param context - The player's current state
 * @returns true if the player can lay off, false otherwise
 */
export function canLayOffCard(context: LayOffContext): boolean {
  // Must be down from a previous turn
  if (!context.isDown) {
    return false;
  }

  // Cannot lay off on the same turn as laying down
  if (context.laidDownThisTurn) {
    return false;
  }

  // Must have drawn a card this turn
  if (!context.hasDrawn) {
    return false;
  }

  return true;
}

/**
 * Gets the rank of a set from its cards.
 * Returns the rank of the first natural card, or null if all cards are wild.
 */
function getSetRank(cards: Card[]): Card["rank"] | null {
  for (const card of cards) {
    if (!isWild(card)) {
      return card.rank;
    }
  }
  return null;
}

/**
 * Checks if a card can be laid off to a set.
 *
 * Rules for laying off to a set:
 * 1. Card must match the set's rank OR be wild (2 or Joker)
 * 2. After adding, wilds must not outnumber naturals
 *
 * @param card - The card to lay off
 * @param meld - The set meld to add to (must be type: 'set')
 * @returns true if the card can be laid off, false otherwise
 */
export function canLayOffToSet(card: Card, meld: Meld): boolean {
  if (meld.type !== "set") {
    return false;
  }

  const setRank = getSetRank(meld.cards);

  // If not wild, card must match the set's rank
  if (!isWild(card)) {
    if (setRank !== null && card.rank !== setRank) {
      return false;
    }
  }

  // Check if adding this card would make wilds outnumber naturals
  const newCards = [...meld.cards, card];
  const { wilds, naturals } = countWildsAndNaturals(newCards);

  if (wilds > naturals) {
    return false;
  }

  return true;
}
