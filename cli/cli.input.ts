/**
 * CLI input parsing utilities for May I? card game
 *
 * Parses user input into game commands
 */

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
