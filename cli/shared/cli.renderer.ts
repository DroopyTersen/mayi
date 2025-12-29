/**
 * CLI rendering utilities for May I? card game
 *
 * Renders cards, hands, and game state for terminal display
 */

import type { Card } from "../../core/card/card.types";
import type { GameState } from "../../core/engine/engine.types";

/**
 * Unicode suit symbols
 */
const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

/**
 * Renders a single card as a string
 * Examples: "9♥", "10♦", "J♠", "Q♣", "Joker"
 */
export function renderCard(card: Card): string {
  if (card.rank === "Joker") {
    return "Joker";
  }

  const suit = card.suit;
  if (!suit) {
    return card.rank;
  }

  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit;
  return `${card.rank}${suitSymbol}`;
}

/**
 * Renders a hand of cards as a string with visual separation
 * Example: "3♥  5♦  9♣  J♠  Joker"
 */
export function renderHand(hand: Card[]): string {
  return hand.map(renderCard).join("  ");
}

/**
 * Renders a hand with position numbers for card selection
 * Example: "1:3♥ | 2:5♦ | 3:9♣ | 4:J♠ | 5:Joker"
 * Positions are 1-indexed for human readability
 */
export function renderNumberedHand(hand: Card[]): string {
  return hand.map((card, index) => `${index + 1}:${renderCard(card)}`).join(" | ");
}

/**
 * Renders the full game state for display
 */
export function renderGameState(state: GameState): string {
  const lines: string[] = [];

  // Round header
  lines.push(`Round ${state.currentRound} of 6`);
  lines.push("");

  // Players section
  lines.push("PLAYERS");
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i]!;
    const indicator = i === state.currentPlayerIndex ? "→ " : "  ";
    const cardCount = player.hand.length;
    lines.push(`${indicator}${player.name}: ${cardCount} cards`);
  }
  lines.push("");

  // Discard and stock
  const topDiscard = state.discard[0];
  const discardDisplay = topDiscard ? renderCard(topDiscard) : "(empty)";
  lines.push(`DISCARD: ${discardDisplay} | STOCK: ${state.stock.length} cards`);
  lines.push("");

  // Current player's hand
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer) {
    lines.push(`Your hand: ${renderHand(currentPlayer.hand)}`);
  }

  return lines.join("\n");
}
