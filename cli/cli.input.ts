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
