/**
 * Going Out functions for May I? card game
 *
 * "Going out" means ending your turn with 0 cards in hand.
 * The player who goes out scores 0 for the round.
 * Going out ends the round immediately.
 */

import type { Card } from "../card/card.types";
import type { RoundNumber } from "./engine.types";

/**
 * Context needed to check if a player can go out
 */
export interface GoingOutContext {
  hand: Card[];
  isDown: boolean;
  roundNumber: RoundNumber;
}

/**
 * Result of checking if a player has gone out
 */
export interface GoingOutResult {
  wentOut: boolean;
  handEmpty: boolean;
}

/**
 * Checks if a player has gone out (hand is empty).
 *
 * A player goes out when:
 * 1. Their hand is empty (0 cards)
 * 2. They are down (have laid down their contract)
 *
 * @param hand - The player's current hand
 * @returns Object indicating if player went out
 */
export function checkGoingOut(hand: Card[]): GoingOutResult {
  const handEmpty = hand.length === 0;
  return {
    wentOut: handEmpty,
    handEmpty,
  };
}

/**
 * Checks if a player CAN go out (is in a position where going out is possible).
 *
 * Requirements to go out:
 * 1. Must be down (have laid down contract)
 * 2. Hand must be empty or about to become empty
 *
 * @param context - The player's current context
 * @returns true if player can go out, false otherwise
 */
export function canGoOut(context: GoingOutContext): boolean {
  // Must be down to go out
  if (!context.isDown) {
    return false;
  }

  // Hand must be empty
  if (context.hand.length !== 0) {
    return false;
  }

  return true;
}

/**
 * In Round 6, players cannot discard their last card to go out.
 * They must lay off all remaining cards instead.
 *
 * @param roundNumber - The current round number
 * @param handSize - Number of cards in hand
 * @returns true if discarding last card is blocked in round 6
 */
export function isRound6LastCardBlock(
  roundNumber: RoundNumber,
  handSize: number
): boolean {
  return roundNumber === 6 && handSize === 1;
}

/**
 * Calculates score for a player who went out.
 * Player who goes out always scores 0 for the round.
 *
 * @returns 0 (player who went out scores 0)
 */
export function getGoingOutScore(): number {
  return 0;
}
