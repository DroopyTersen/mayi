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
