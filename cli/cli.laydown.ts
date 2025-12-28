/**
 * CLI lay down input parsing utilities for May I? card game
 *
 * Parses user input for laying down melds
 */

import type { Card } from "../core/card/card.types";
import { isValidSet, isValidRun } from "../core/meld/meld.validation";

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
 * @param renderCard - Function to render a card as a string
 * @returns Formatted string like "Set: 9♣ 9♥ 9♠"
 */
export function formatMeldPreview(
  meld: InferredMeld,
  renderCard: (card: Card) => string
): string {
  const typeLabel = meld.type === "set" ? "Set" : "Run";
  const cardsStr = meld.cards.map(renderCard).join(" ");
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
