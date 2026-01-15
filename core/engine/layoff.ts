/**
 * Lay off functions for May I? card game
 *
 * Laying off means adding cards from your hand to existing melds on the table.
 * You can only lay off if you are already "down" (have laid down your contract)
 * and you cannot lay off on the same turn you laid down.
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import { isWild, getRankValue } from "../card/card.utils";

/**
 * Result of validating card ownership for lay off.
 */
export type CardOwnershipResult =
  | { valid: true }
  | { valid: false; reason: "card_not_in_hand" | "card_id_required" };

/**
 * Validates that a card is in the player's hand and can be laid off.
 *
 * @param cardId - The ID of the card to lay off
 * @param hand - The player's current hand
 * @returns Object with valid: true if card is in hand, or valid: false with reason
 */
export function validateCardOwnership(
  cardId: string,
  hand: Card[]
): CardOwnershipResult {
  if (!cardId) {
    return { valid: false, reason: "card_id_required" };
  }

  const cardInHand = hand.find((c) => c.id === cardId);
  if (!cardInHand) {
    return { valid: false, reason: "card_not_in_hand" };
  }

  return { valid: true };
}

/**
 * Gets a card from the player's hand by ID.
 *
 * @param cardId - The ID of the card to find
 * @param hand - The player's current hand
 * @returns The card if found, undefined otherwise
 */
export function getCardFromHand(cardId: string, hand: Card[]): Card | undefined {
  return hand.find((c) => c.id === cardId);
}

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

  // Note: Wild ratio is NOT enforced during layoff (only during initial laydown)
  // Per house rules, you can add wilds freely to existing melds even if wilds outnumber naturals

  return true;
}

/**
 * Gets the run's low and high rank values and suit.
 * Returns null if the run has no natural cards.
 */
function getRunBounds(cards: Card[]): { lowValue: number; highValue: number; suit: Card["suit"] } | null {
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

/**
 * Checks if a card can be laid off to a run.
 *
 * Rules for laying off to a run:
 * 1. Card must extend the run at either the low or high end
 * 2. Card must be the same suit (unless wild)
 * 3. Wilds can extend at either end if there's a valid rank to represent
 * 4. Cannot extend below 3 or above Ace
 *
 * @param card - The card to lay off
 * @param meld - The run meld to add to (must be type: 'run')
 * @returns true if the card can be laid off, false otherwise
 */
export function canLayOffToRun(card: Card, meld: Meld): boolean {
  if (meld.type !== "run") {
    return false;
  }

  const bounds = getRunBounds(meld.cards);
  if (!bounds) {
    return false;
  }

  const { lowValue, highValue, suit } = bounds;

  // Check if card can extend at low end
  const canExtendLow = lowValue > 3; // Can only extend low if there's room (3 is minimum)
  const lowExtensionValue = lowValue - 1;

  // Check if card can extend at high end
  const canExtendHigh = highValue < 14; // Can only extend high if there's room (14=Ace is maximum)
  const highExtensionValue = highValue + 1;

  let fitsLow = false;
  let fitsHigh = false;

  if (isWild(card)) {
    // Wild can extend at either end if there's a valid position
    fitsLow = canExtendLow;
    fitsHigh = canExtendHigh;
  } else {
    // Natural card must match suit and connect at one end
    if (card.suit !== suit) {
      return false;
    }

    const cardValue = getRankValue(card.rank);
    if (cardValue === null) {
      return false;
    }

    // Check if card value is already in the run (duplicate rank)
    if (cardValue >= lowValue && cardValue <= highValue) {
      return false;
    }

    fitsLow = canExtendLow && cardValue === lowExtensionValue;
    fitsHigh = canExtendHigh && cardValue === highExtensionValue;
  }

  if (!fitsLow && !fitsHigh) {
    return false;
  }

  // Note: Wild ratio is NOT enforced during layoff (only during initial laydown)
  // Per house rules, you can add wilds freely to existing melds even if wilds outnumber naturals

  return true;
}

/**
 * Determines where to insert a card when laying off to a run.
 * Returns "low" if the card should be prepended, "high" if appended.
 * Returns null if the card cannot be laid off.
 *
 * @param card - The card to lay off
 * @param meld - The run meld to add to (must be type: 'run')
 * @returns "low" | "high" | null
 */
export function getRunInsertPosition(card: Card, meld: Meld): "low" | "high" | null {
  if (meld.type !== "run") {
    return null;
  }

  const bounds = getRunBounds(meld.cards);
  if (!bounds) {
    return null;
  }

  const { lowValue, highValue, suit } = bounds;

  const canExtendLow = lowValue > 3;
  const lowExtensionValue = lowValue - 1;
  const canExtendHigh = highValue < 14;
  const highExtensionValue = highValue + 1;

  let fitsLow = false;
  let fitsHigh = false;

  if (isWild(card)) {
    // Wild can extend at either end
    fitsLow = canExtendLow;
    fitsHigh = canExtendHigh;
  } else {
    if (card.suit !== suit) {
      return null;
    }

    const cardValue = getRankValue(card.rank);
    if (cardValue === null) {
      return null;
    }

    // Check if card value is already in the run
    if (cardValue >= lowValue && cardValue <= highValue) {
      return null;
    }

    fitsLow = canExtendLow && cardValue === lowExtensionValue;
    fitsHigh = canExtendHigh && cardValue === highExtensionValue;
  }

  // Note: Wild ratio is NOT enforced during layoff (only during initial laydown)

  // For natural cards, return whichever end they fit
  if (fitsLow && !fitsHigh) {
    return "low";
  }
  if (fitsHigh && !fitsLow) {
    return "high";
  }
  // Wild cards that could fit either end: prefer high (append is more natural)
  if (fitsLow && fitsHigh) {
    return "high";
  }

  return null;
}

/**
 * Checks if a wild card can be laid off at both ends of a run,
 * meaning the user should be prompted to choose a position.
 *
 * Returns true only when:
 * - Card is wild (2 or Joker)
 * - Meld is a run (not a set)
 * - Run can extend at BOTH low and high ends
 *
 * @param card - The card to check
 * @param meld - The meld to check against
 * @returns true if position choice is needed, false otherwise
 */
export function needsPositionChoice(card: Card, meld: Meld): boolean {
  if (!isWild(card)) return false;
  if (meld.type !== "run") return false;

  const bounds = getRunBounds(meld.cards);
  if (!bounds) return false;

  const canExtendStart = bounds.lowValue > 3;
  const canExtendEnd = bounds.highValue < 14;

  return canExtendStart && canExtendEnd;
}

/**
 * Resolves the insert position for a card being laid off to a run.
 *
 * Position semantics:
 * - "start" = prepend to run (low end, smaller rank)
 * - "end" = append to run (high end, larger rank)
 *
 * Logic:
 * - Natural cards: auto-determined (can only fit one end), ignores requestedPosition
 * - Wilds with requested position: validates and uses requested if valid, returns null if invalid
 * - Wilds without requested position: default to "end" for backward compatibility
 *
 * @param card - The card being laid off
 * @param meld - The target run
 * @param requestedPosition - User's requested position (optional)
 * @returns "start" | "end" | null (null if card doesn't fit or invalid position requested)
 */
export function resolveRunInsertPosition(
  card: Card,
  meld: Meld,
  requestedPosition?: "start" | "end"
): "start" | "end" | null {
  if (meld.type !== "run") {
    return null;
  }

  const bounds = getRunBounds(meld.cards);
  if (!bounds) {
    return null;
  }

  const { lowValue, highValue, suit } = bounds;
  const canExtendLow = lowValue > 3;
  const canExtendHigh = highValue < 14;

  let fitsLow = false;
  let fitsHigh = false;

  if (isWild(card)) {
    fitsLow = canExtendLow;
    fitsHigh = canExtendHigh;
  } else {
    // Natural card - auto-determine position
    if (card.suit !== suit) {
      return null;
    }

    const cardValue = getRankValue(card.rank);
    if (cardValue === null) {
      return null;
    }

    // Check if card value is already in the run
    if (cardValue >= lowValue && cardValue <= highValue) {
      return null;
    }

    const lowExtensionValue = lowValue - 1;
    const highExtensionValue = highValue + 1;

    fitsLow = canExtendLow && cardValue === lowExtensionValue;
    fitsHigh = canExtendHigh && cardValue === highExtensionValue;
  }

  // If card doesn't fit either end, return null
  if (!fitsLow && !fitsHigh) {
    return null;
  }

  // For natural cards, auto-determine (ignore requested position)
  if (!isWild(card)) {
    if (fitsLow) return "start";
    if (fitsHigh) return "end";
    return null;
  }

  // Wild card with requested position - validate the request
  if (requestedPosition !== undefined) {
    if (requestedPosition === "start" && fitsLow) {
      return "start";
    }
    if (requestedPosition === "end" && fitsHigh) {
      return "end";
    }
    // Requested position is invalid for this run
    return null;
  }

  // Wild card without requested position - default behavior
  // If fits only one end, use that end
  if (fitsLow && !fitsHigh) {
    return "start";
  }
  if (fitsHigh && !fitsLow) {
    return "end";
  }
  // Fits both ends - default to "end" for backward compatibility
  return "end";
}
