/**
 * Card text formatting utilities
 *
 * Shared utilities for rendering cards as text strings (e.g., "Q♠", "10♥", "Joker")
 * Used by both CLI renderer and UI components
 */

import type { Card, Suit } from "./card.types";

/**
 * Unicode suit symbols for display
 */
const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

/**
 * Formats a card as a readable text string
 *
 * Examples:
 * - { suit: "hearts", rank: "Q" } → "Q♥"
 * - { suit: "spades", rank: "10" } → "10♠"
 * - { suit: null, rank: "Joker" } → "Joker"
 *
 * @param card - The card to format
 * @returns The formatted card string
 */
export function formatCardText(card: Card): string {
  // Jokers have no suit
  if (card.rank === "Joker") {
    return "Joker";
  }

  // Handle edge case where suit is null (shouldn't happen for non-Jokers but be safe)
  if (!card.suit) {
    return card.rank;
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  return `${card.rank}${suitSymbol}`;
}
