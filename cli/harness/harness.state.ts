/**
 * State management utilities for the May I? CLI harness
 *
 * Helper functions for accessing game state
 */

import type { PersistedGameState } from "../shared/cli.types";

/**
 * Get the current player from state
 */
export function getCurrentPlayer(state: PersistedGameState) {
  return state.players[state.currentPlayerIndex]!;
}

/**
 * Get a player by ID
 */
export function getPlayerById(state: PersistedGameState, playerId: string) {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Get the player whose decision we're waiting for
 */
export function getAwaitingPlayer(state: PersistedGameState) {
  return getPlayerById(state, state.harness.awaitingPlayerId);
}
