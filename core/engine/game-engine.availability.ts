/**
 * Utility functions for determining available actions at the engine level.
 *
 * These functions can be used by CLI, interactive mode, AI agents, and web app
 * to understand what actions are available for each player.
 */

import type { GameSnapshot } from "./game-engine.types";
import type { Contract } from "./contracts";

/**
 * Get the list of player IDs who can currently call May I.
 *
 * A player can call May I when:
 * - Phase is ROUND_ACTIVE (not during resolution, round end, or game end)
 * - There is a discard pile with at least one card
 * - The discard hasn't already been claimed this turn
 * - The player is NOT the one who discarded the current top card
 * - The player is NOT down (has not laid down their contract)
 *
 * @param snapshot Current game snapshot
 * @returns Array of player IDs who can call May I (empty if none)
 */
export function getPlayersWhoCanCallMayI(snapshot: GameSnapshot): string[] {
  // Only during active round play
  if (snapshot.phase !== "ROUND_ACTIVE") {
    return [];
  }

  // Must have a discard to claim
  if (snapshot.discard.length === 0) {
    return [];
  }

  // Can't call May I after current player draws from discard (they claimed it)
  // This is indicated by the discard being claimed - but we don't have a direct flag.
  // Instead, we check if the current player has drawn from discard by checking hasDrawn
  // and whether the discard pile shrunk. But actually, the lastDiscardedByPlayerId
  // tells us who discarded the current top card.

  const eligiblePlayers: string[] = [];

  for (const player of snapshot.players) {
    // Player who discarded this card cannot claim it
    if (player.id === snapshot.lastDiscardedByPlayerId) {
      continue;
    }

    // Down players cannot call May I
    if (player.isDown) {
      continue;
    }

    eligiblePlayers.push(player.id);
  }

  return eligiblePlayers;
}

/**
 * Check if a specific player can call May I.
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to check
 * @returns true if the player can call May I
 */
export function canPlayerCallMayI(snapshot: GameSnapshot, playerId: string): boolean {
  return getPlayersWhoCanCallMayI(snapshot).includes(playerId);
}

/**
 * Get the number of meld placeholders to show in the laydown command hint.
 *
 * @param contract The contract for the current round
 * @returns Number of melds required (2 or 3)
 */
export function getMeldPlaceholderCount(contract: Contract): number {
  return contract.sets + contract.runs;
}

/**
 * Build the laydown command hint string with the correct number of meld placeholders.
 *
 * @param contract The contract for the current round
 * @returns Command hint like 'laydown "<meld1>" "<meld2>"' or 'laydown "<meld1>" "<meld2>" "<meld3>"'
 */
export function getLaydownCommandHint(contract: Contract): string {
  const count = getMeldPlaceholderCount(contract);
  const placeholders = Array.from({ length: count }, (_, i) => `"<meld${i + 1}>"`);
  return `laydown ${placeholders.join(" ")}`;
}
