/**
 * Activity log formatting for the May I? CLI
 *
 * Formats ActionLogEntry objects as concise one-liners for display
 */

import type { ActionLogEntry } from "./cli.types";

const HUMAN_PLAYER_ID = "player-0";

/**
 * Actions to skip in the activity display (too verbose or not interesting)
 */
const SKIP_ACTIONS = [
  "skipped laying down",
  "passed on May I",
  "May I window closed",
  "GAME_STARTED",
  "started round",
  "reshuffled stock",
];

/**
 * Check if an entry should be skipped in the activity display
 */
function shouldSkipEntry(entry: ActionLogEntry): boolean {
  if (entry.playerId === "system") return true;
  if (SKIP_ACTIONS.some((skip) => entry.action.includes(skip))) return true;
  return false;
}

/**
 * Format a single action log entry as a concise one-liner
 *
 * Examples:
 * - "Alice: drew from stock"
 * - "Bob: took 7♥ from discard"
 * - "Carol: discarded K♣"
 * - "Alice: laid down contract"
 * - "Bob: laid off 2♦ to meld 2"
 * - "Carol: won May I (7♥ + penalty card)"
 * - "Alice: went out!"
 */
export function formatActivityEntry(entry: ActionLogEntry): string | null {
  if (shouldSkipEntry(entry)) {
    return null;
  }

  const name = entry.playerId === HUMAN_PLAYER_ID ? "You" : entry.playerName;

  // Handle different action types with custom formatting
  switch (entry.action) {
    case "drew from stock":
      return `${name}: drew from stock`;

    case "drew from discard":
      return `${name}: took ${entry.details} from discard`;

    case "discarded":
      return `${name}: discarded ${entry.details}`;

    case "laid down contract":
      return `${name}: laid down contract`;

    case "laid off":
      return `${name}: laid off ${entry.details}`;

    case "called May I":
      return `${name}: called May I on ${entry.details}`;

    case "won May I":
      return `${name}: won May I (${entry.details})`;

    case "swapped Joker":
      return `${name}: swapped ${entry.details}`;

    case "went out!":
      return `${name}: went out!`;

    default:
      // Fallback for any other actions
      const details = entry.details ? `: ${entry.details}` : "";
      return `${name}: ${entry.action}${details}`;
  }
}

/**
 * Get the last N entries from the log, filtered to interesting actions
 */
export function getRecentEntries(entries: ActionLogEntry[], count: number): ActionLogEntry[] {
  const interesting = entries.filter((entry) => !shouldSkipEntry(entry));
  return interesting.slice(-count);
}

/**
 * Format the most recent N activity entries as an array of strings
 */
export function formatRecentActivity(entries: ActionLogEntry[], count: number = 6): string[] {
  const recent = getRecentEntries(entries, count);
  return recent.map(formatActivityEntry).filter((s): s is string => s !== null);
}
