/**
 * State management utilities for the May I? CLI harness
 *
 * Helper functions for accessing game state
 */

import type { GameSnapshot } from "../../core/engine/game-engine.types";

/**
 * Get the current player from state
 */
export function getCurrentPlayer(state: GameSnapshot) {
  return state.players[state.currentPlayerIndex]!;
}

/**
 * Get a player by ID
 */
export function getPlayerById(state: GameSnapshot, playerId: string) {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Get the player whose decision we're waiting for
 */
export function getAwaitingPlayer(state: GameSnapshot) {
  return getPlayerById(state, state.awaitingPlayerId);
}
