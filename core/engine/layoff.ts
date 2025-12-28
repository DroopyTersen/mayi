/**
 * Lay off functions for May I? card game
 *
 * Laying off means adding cards from your hand to existing melds on the table.
 * You can only lay off if you are already "down" (have laid down your contract)
 * and you cannot lay off on the same turn you laid down.
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

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
