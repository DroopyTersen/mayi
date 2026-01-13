/**
 * Types for Agent Testing State Injection
 *
 * Defines a simplified state format for web E2E testing that can be
 * converted to the full XState snapshot format server-side.
 */

import type { Card, Suit, Rank } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";
import type { RoundNumber } from "../../core/engine/engine.types";

/**
 * Simplified player definition for state injection
 */
export interface AgentTestPlayer {
  /** Player ID (used for lobby mapping) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is an AI player */
  isAI: boolean;
  /** AI model ID if isAI is true (e.g., "default:grok") */
  aiModelId?: string;
  /** Cards in player's hand */
  hand: Card[];
  /** Whether player has laid down contract this round */
  isDown: boolean;
  /** Cumulative score across rounds (defaults to 0) */
  totalScore?: number;
}

/**
 * Turn phase within a round
 */
export type AgentTestTurnPhase =
  | "awaitingDraw"
  | "awaitingAction"
  | "awaitingDiscard";

/**
 * Turn state within the injected state
 */
export interface AgentTestTurnState {
  /** Index of the current player (0-based) */
  currentPlayerIndex: number;
  /** Whether the current player has drawn */
  hasDrawn: boolean;
  /** Current turn phase */
  phase: AgentTestTurnPhase;
}

/**
 * Simplified state format for agent test injection
 *
 * This format is easier to construct than full XState snapshots.
 * It gets converted to StoredGameState on the server.
 */
export interface AgentTestState {
  /**
   * Players in turn order (first player is the agent/human being tested)
   * Minimum 3 players, maximum 8
   */
  players: AgentTestPlayer[];

  /**
   * Current round number (1-6)
   */
  roundNumber: RoundNumber;

  /**
   * Cards in the stock (draw) pile
   * Should have enough cards for gameplay
   */
  stock: Card[];

  /**
   * Cards in the discard pile (top card is last in array)
   */
  discard: Card[];

  /**
   * Melds on the table
   * Each meld has an ownerId matching a player's id
   */
  table: Meld[];

  /**
   * Current turn state
   */
  turn: AgentTestTurnState;
}

/**
 * Card definition for constructing test states
 * Re-export for convenience
 */
export type { Card, Suit, Rank } from "../../core/card/card.types";
export type { Meld } from "../../core/meld/meld.types";
