/**
 * Unavailability hint derivation logic.
 *
 * Delegates to shared action availability evaluation so hints and availability
 * stay in lockstep with the same house-rule checks.
 */

import type { GameSnapshot, UnavailabilityHint } from "./game-engine.types";
import { getActionAvailabilityDetails } from "./game-engine.availability";

/**
 * Get hints explaining why certain actions are unavailable.
 *
 * Returns hints for actions that are:
 * 1. Temporarily blocked (e.g., "lay off available next turn" after laying down)
 * 2. Blocked by a prerequisite the player can work toward (e.g., "lay down first" for lay off)
 *
 * Does NOT return hints:
 * - When it's not the player's turn
 * - During non-active phases (ROUND_END, GAME_END, RESOLVING_MAY_I)
 * - When there's nothing relevant to hint about (e.g., no melds to lay off to)
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to get hints for
 * @returns Array of unavailability hints (empty if no hints apply)
 */
export function getUnavailabilityHints(
  snapshot: GameSnapshot,
  playerId: string
): UnavailabilityHint[] {
  return getActionAvailabilityDetails(snapshot, playerId).unavailabilityHints;
}
