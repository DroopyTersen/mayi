/**
 * Game loop utilities for May I? card game
 *
 * Handles turn advancement and game state transitions
 */

import type { GameState } from "./engine.types";
import type { TurnOutput } from "./turn.machine";

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

/**
 * Applies the output from a completed turn to update the game state
 * Updates the player's hand, stock, and discard piles
 */
export function applyTurnOutput(state: GameState, output: TurnOutput): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === output.playerId);
  if (playerIndex === -1) {
    throw new Error(`Player ${output.playerId} not found`);
  }

  const updatedPlayers = state.players.map((player, index) => {
    if (index === playerIndex) {
      return { ...player, hand: output.hand };
    }
    return player;
  });

  return {
    ...state,
    players: updatedPlayers,
    stock: output.stock,
    discard: output.discard,
    updatedAt: new Date().toISOString(),
  };
}
