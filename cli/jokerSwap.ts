/**
 * CLI Joker Swap utilities for May I? card game
 *
 * Parsing and display functions for Joker swap commands
 */

import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import type { WildPosition } from "../core/meld/meld.joker";
import { renderCard } from "./cli.renderer";

/**
 * Result of parsing a swap command
 */
export type SwapCommandResult =
  | {
      type: "SWAP_JOKER";
      meldIndex: number;
      jokerPositionInMeld: number;
      cardPositionInHand: number;
    }
  | { type: "error"; message: string };

/**
 * Parses user input for swap command
 * Valid input: 'swap <meld-index> <joker-position> <hand-position>'
 * All positions are 1-indexed
 */
export function parseSwapCommand(
  input: string,
  meldCount: number,
  handSize: number
): SwapCommandResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed.startsWith("swap ")) {
    return { type: "error", message: "Invalid command. Use 'swap <meld> <joker-pos> <card-pos>'." };
  }

  const parts = trimmed.slice(5).trim().split(/\s+/);

  if (parts.length !== 3) {
    return { type: "error", message: "Invalid swap command. Use 'swap <meld> <joker-pos> <card-pos>'." };
  }

  const meldIndex = parseInt(parts[0]!, 10);
  const jokerPos = parseInt(parts[1]!, 10);
  const cardPos = parseInt(parts[2]!, 10);

  if (isNaN(meldIndex) || isNaN(jokerPos) || isNaN(cardPos)) {
    return { type: "error", message: "Invalid positions. Use numbers." };
  }

  if (meldIndex < 1 || meldIndex > meldCount) {
    return {
      type: "error",
      message: `Invalid meld index. Enter a number between 1 and ${meldCount}.`,
    };
  }

  if (cardPos < 1 || cardPos > handSize) {
    return {
      type: "error",
      message: `Invalid hand position. Enter a number between 1 and ${handSize}.`,
    };
  }

  return {
    type: "SWAP_JOKER",
    meldIndex,
    jokerPositionInMeld: jokerPos,
    cardPositionInHand: cardPos,
  };
}

/**
 * Renders a success message for a completed swap
 */
export function renderSwapSuccess(
  swapCard: Card,
  jokerCard: Card,
  meldDescription: string
): string {
  return `✓ Swapped ${renderCard(swapCard)} for ${renderCard(jokerCard)} in ${meldDescription}`;
}

/**
 * Renders an error message for a failed swap
 */
export function renderSwapError(message: string): string {
  return `Error: ${message}`;
}

/**
 * Renders available Joker swaps for the player
 */
export function renderAvailableSwaps(
  swaps: Array<{ meld: Meld; position: WildPosition; meldIndex: number }>
): string {
  if (swaps.length === 0) {
    return "No Joker swaps available.";
  }

  const lines: string[] = ["Available Joker swaps:"];

  for (const swap of swaps) {
    const suitSymbol = getSuitSymbol(swap.position.actingAsSuit);
    const cardNeeded = `${swap.position.actingAsRank}${suitSymbol}`;
    lines.push(`  meld ${swap.meldIndex}: needs ${cardNeeded} (position ${swap.position.positionIndex + 1})`);
  }

  lines.push("");
  lines.push("Use 'swap <meld> <position> <card>' to swap");

  return lines.join("\n");
}

/**
 * Get suit symbol for display
 */
function getSuitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return symbols[suit] ?? suit;
}
