/**
 * AI Game Adapter Interface
 *
 * Defines the minimal interface needed by the AI agent to play the game.
 * This uses position-based methods (1-indexed from hand) which match how
 * the LLM thinks about card positions from the game state output.
 *
 * This interface lives in ai/ to avoid importing cli/ modules that use node:fs.
 */

import type { GameSnapshot } from "../core/engine/game-engine.types";

/**
 * Adapter interface for AI agent to interact with the game engine.
 *
 * Methods return GameSnapshot for consistency with engine behavior.
 * Position-based methods use 1-indexed positions from the player's hand.
 */
export interface AIGameAdapter {
  /** Get current game state */
  getSnapshot(): GameSnapshot;

  /** Draw from stock pile */
  drawFromStock(): GameSnapshot;

  /** Draw from discard pile (only allowed if not down) */
  drawFromDiscard(): GameSnapshot;

  /** Skip action phase (move to discard phase) */
  skip(): GameSnapshot;

  /**
   * Lay down melds to go down.
   * @param meldGroups - Array of position arrays, each representing a meld (1-indexed)
   * Example: [[1,2,3], [4,5,6]] for two melds
   */
  layDown(meldGroups: number[][]): GameSnapshot;

  /**
   * Lay off a card onto an existing meld.
   * @param cardPosition - Position in hand (1-indexed)
   * @param meldNumber - Meld number on table (1-indexed)
   */
  layOff(cardPosition: number, meldNumber: number): GameSnapshot;

  /**
   * Swap a joker from a meld with a card from hand.
   * @param meldNumber - Meld number on table (1-indexed)
   * @param jokerPosition - Position of joker in meld (1-indexed)
   * @param cardPosition - Position of card in hand (1-indexed)
   */
  swap(meldNumber: number, jokerPosition: number, cardPosition: number): GameSnapshot;

  /**
   * Discard a card to end turn.
   * @param position - Position in hand (1-indexed)
   */
  discardCard(position: number): GameSnapshot;

  /** Allow another player's May I (when prompted) */
  allowMayI(playerId: string): GameSnapshot;

  /** Claim May I for yourself (when prompted) */
  claimMayI(playerId: string): GameSnapshot;
}
