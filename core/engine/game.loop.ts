/**
 * Game loop utilities for May I? card game
 *
 * Handles turn advancement and game state transitions
 */

import type { GameState } from "./engine.types";

/**
 * Advances to the next player's turn
 * Returns a new GameState with updated currentPlayerIndex
 */
export function advanceTurn(state: GameState): GameState {
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    turnState: {
      hasDrawn: false,
      hasLaidDown: false,
      laidDownThisTurn: false,
    },
    updatedAt: new Date().toISOString(),
  };
}
