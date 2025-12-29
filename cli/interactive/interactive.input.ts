/**
 * CLI input parsing utilities for May I? interactive mode
 *
 * Consolidated input parsing for draw, discard, lay down, reorder, and swap commands.
 * All position inputs are 1-indexed (user-facing).
 */

import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { WildPosition } from "../../core/meld/meld.joker";
import { isValidSet, isValidRun } from "../../core/meld/meld.validation";
import { renderCard } from "../shared/cli.renderer";

// =============================================================================
// Draw Command Parsing
// =============================================================================

/**
 * Result of parsing a draw command
 */
export type DrawCommandResult =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "error"; message: string };

/**
 * Parses user input for draw phase
 * Valid inputs: 'd', '1' for stock; 't', '2' for discard
 */
export function parseDrawCommand(input: string): DrawCommandResult {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "d" || trimmed === "1") {
    return { type: "DRAW_FROM_STOCK" };
  }

  if (trimmed === "t" || trimmed === "2") {
    return { type: "DRAW_FROM_DISCARD" };
  }

  return { type: "error", message: "Invalid input. Enter 'd' or '1' for stock, 't' or '2' for discard." };
}

// =============================================================================
// Discard Command Parsing
// =============================================================================

/**
 * Result of parsing a discard command
 */
export type DiscardCommandResult =
  | { type: "DISCARD"; position: number }
  | { type: "error"; message: string };

/**
 * Parses user input for discard phase
 * Valid inputs: 'x 3', '3' (position is 1-indexed)
 */
export function parseDiscardCommand(input: string, handSize: number): DiscardCommandResult {
  const trimmed = input.trim().toLowerCase();

  // Handle "x 3" or just "3" format
  let positionStr: string;
  if (trimmed.startsWith("x ")) {
    positionStr = trimmed.slice(2).trim();
  } else {
    positionStr = trimmed;
  }

  const position = parseInt(positionStr, 10);

  if (isNaN(position)) {
    return { type: "error", message: "Invalid input. Enter a card position number." };
  }

  if (position < 1 || position > handSize) {
    return { type: "error", message: `Invalid position. Enter a number between 1 and ${handSize}.` };
  }

  return { type: "DISCARD", position };
}

// =============================================================================
// Reorder Command Parsing
// =============================================================================

/**
 * Result of parsing a reorder command
 */
export type ReorderCommandResult =
  | { type: "SORT_BY_RANK" }
  | { type: "SORT_BY_SUIT" }
  | { type: "MOVE"; fromPosition: number; toPosition: number }
  | { type: "error"; message: string };

/**
 * Parses user input for hand reordering
 * Valid inputs: 'sort rank', 'sort suit', 'move 5 1'
 */
export function parseReorderCommand(input: string, handSize: number): ReorderCommandResult {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "sort rank") {
    return { type: "SORT_BY_RANK" };
  }

  if (trimmed === "sort suit") {
    return { type: "SORT_BY_SUIT" };
  }

  if (trimmed.startsWith("move ")) {
    const parts = trimmed.slice(5).trim().split(/\s+/);
    if (parts.length !== 2) {
      return { type: "error", message: "Invalid move command. Use 'move <from> <to>'." };
    }

    const fromPos = parseInt(parts[0]!, 10);
    const toPos = parseInt(parts[1]!, 10);

    if (isNaN(fromPos) || isNaN(toPos)) {
      return { type: "error", message: "Invalid positions. Use numbers." };
    }

    if (fromPos < 1 || fromPos > handSize || toPos < 1 || toPos > handSize) {
      return { type: "error", message: `Invalid position. Enter numbers between 1 and ${handSize}.` };
    }

    return { type: "MOVE", fromPosition: fromPos, toPosition: toPos };
  }

  return { type: "error", message: "Invalid command. Use 'sort rank', 'sort suit', or 'move <from> <to>'." };
}

// =============================================================================
// Lay Down Command Parsing
// =============================================================================

/**
 * Meld proposal from parsed input
 */
export interface MeldGroup {
  positions: number[];
}

/**
 * Inferred meld with type and cards
 */
export interface InferredMeld {
  type: "set" | "run";
  positions: number[];
  cards: Card[];
}

/**
 * Result of parsing a lay down command
 */
export type LayDownParseResult =
  | { type: "LAY_DOWN"; melds: MeldGroup[] }
  | { type: "error"; message: string };

/**
 * Result of inferring meld types
 */
export type MeldInferenceResult =
  | { type: "success"; melds: InferredMeld[] }
  | { type: "error"; message: string };

/**
 * Parses lay down input into meld groups
 *
 * Supported syntaxes:
 * - "l 1,2,3 4,5,6,7" - comma-separated cards, space-separated melds
 * - "l 1 2 3 / 4 5 6 7" - slash separator between melds
 *
 * @param input - The raw user input
 * @param handSize - The number of cards in the player's hand
 * @returns Parsed result or error
 */
export function parseLayDownInput(
  input: string,
  handSize: number
): LayDownParseResult {
  const trimmed = input.trim().toLowerCase();

  // Remove the 'l' prefix if present
  let content: string;
  if (trimmed === "l") {
    content = "";
  } else if (trimmed.startsWith("l ")) {
    content = trimmed.slice(2).trim();
  } else {
    content = trimmed;
  }

  if (content === "") {
    return { type: "error", message: "No cards specified for lay down." };
  }

  // Check if using slash separator syntax
  const usesSlashes = content.includes("/");

  let meldGroups: MeldGroup[];

  if (usesSlashes) {
    // Slash-separated melds: "1 2 3 / 4 5 6 7"
    const groups = content.split("/").map((g) => g.trim()).filter((g) => g !== "");

    meldGroups = [];
    for (const group of groups) {
      const result = parsePositionGroup(group, handSize, true);
      if (result.type === "error") {
        return result;
      }
      meldGroups.push(result.meld);
    }
  } else {
    // Comma-separated cards within melds, space-separated melds: "1,2,3 4,5,6,7"
    // Split by spaces but treat comma-groups as single melds
    const parts = content.split(/\s+/).filter((p) => p !== "");

    meldGroups = [];
    for (const part of parts) {
      const result = parsePositionGroup(part, handSize, false);
      if (result.type === "error") {
        return result;
      }
      meldGroups.push(result.meld);
    }
  }

  // Check for empty meld groups
  if (meldGroups.length === 0) {
    return { type: "error", message: "No cards specified for lay down." };
  }

  for (const group of meldGroups) {
    if (group.positions.length === 0) {
      return { type: "error", message: "Empty meld group is not allowed." };
    }
  }

  // Check for duplicate positions across melds
  const allPositions: number[] = [];
  for (const group of meldGroups) {
    for (const pos of group.positions) {
      if (allPositions.includes(pos)) {
        return {
          type: "error",
          message: `Card position ${pos} is used in multiple melds.`,
        };
      }
      allPositions.push(pos);
    }
  }

  return { type: "LAY_DOWN", melds: meldGroups };
}

/**
 * Parse a single position group
 */
function parsePositionGroup(
  group: string,
  handSize: number,
  spacesSeparateCards: boolean
): { type: "success"; meld: MeldGroup } | { type: "error"; message: string } {
  let posStrings: string[];

  if (spacesSeparateCards) {
    // In slash syntax, spaces separate cards: "1 2 3"
    posStrings = group.split(/\s+/).filter((p) => p !== "");
  } else {
    // In comma syntax, commas separate cards: "1,2,3"
    posStrings = group.split(",").map((p) => p.trim()).filter((p) => p !== "");
  }

  const positions: number[] = [];

  for (const posStr of posStrings) {
    const pos = parseInt(posStr, 10);

    if (isNaN(pos)) {
      return { type: "error", message: `Invalid card position: "${posStr}".` };
    }

    if (pos < 1 || pos > handSize) {
      return {
        type: "error",
        message: `Card position ${pos} is outside hand range (1-${handSize}).`,
      };
    }

    positions.push(pos);
  }

  return { type: "success", meld: { positions } };
}

/**
 * Infers the meld type (set or run) based on the cards
 *
 * @param cards - The cards in the meld
 * @returns "set" if all cards have the same rank, "run" otherwise
 */
export function inferMeldType(cards: Card[]): "set" | "run" {
  if (cards.length === 0) {
    return "set"; // Default to set for empty (will be invalid anyway)
  }

  // Check if all non-wild cards have the same rank
  const nonWildCards = cards.filter(
    (c) => c.rank !== "Joker" && c.rank !== "2"
  );

  if (nonWildCards.length === 0) {
    // All wilds, default to set
    return "set";
  }

  const firstRank = nonWildCards[0]!.rank;
  const allSameRank = nonWildCards.every((c) => c.rank === firstRank);

  return allSameRank ? "set" : "run";
}

/**
 * Infers meld types and validates the melds
 *
 * @param meldGroups - Parsed meld groups with positions
 * @param hand - The player's hand
 * @returns Inferred melds with types and cards
 */
export function inferMeldTypes(
  meldGroups: MeldGroup[],
  hand: Card[]
): MeldInferenceResult {
  const melds: InferredMeld[] = [];

  for (const group of meldGroups) {
    const cards: Card[] = [];

    for (const pos of group.positions) {
      const card = hand[pos - 1]; // Convert 1-indexed to 0-indexed
      if (!card) {
        return {
          type: "error",
          message: `Card position ${pos} is outside hand range.`,
        };
      }
      cards.push(card);
    }

    const meldType = inferMeldType(cards);

    // Validate the inferred meld
    if (meldType === "set" && !isValidSet(cards)) {
      return {
        type: "error",
        message: `Cards at positions ${group.positions.join(",")} do not form a valid set.`,
      };
    }

    if (meldType === "run" && !isValidRun(cards)) {
      return {
        type: "error",
        message: `Cards at positions ${group.positions.join(",")} do not form a valid run.`,
      };
    }

    melds.push({
      type: meldType,
      positions: group.positions,
      cards,
    });
  }

  return { type: "success", melds };
}

/**
 * Formats a meld for preview display
 *
 * @param meld - The inferred meld
 * @param cardRenderer - Function to render a card as a string
 * @returns Formatted string like "Set: 9♣ 9♥ 9♠"
 */
export function formatMeldPreview(
  meld: InferredMeld,
  cardRenderer: (card: Card) => string = renderCard
): string {
  const typeLabel = meld.type === "set" ? "Set" : "Run";
  const cardsStr = meld.cards.map(cardRenderer).join(" ");
  return `${typeLabel}: ${cardsStr}`;
}

/**
 * Validates a complete lay down operation
 *
 * @param melds - The inferred melds
 * @returns True if valid, error message if invalid
 */
export function validateLayDown(
  melds: InferredMeld[]
): { valid: true } | { valid: false; message: string } {
  // All individual meld validation is done in inferMeldTypes
  // This function can add additional cross-meld validation

  if (melds.length === 0) {
    return { valid: false, message: "No melds provided." };
  }

  return { valid: true };
}

// =============================================================================
// Swap Command Parsing
// =============================================================================

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
