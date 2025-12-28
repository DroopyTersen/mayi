/**
 * Type definitions for the May I? CLI harness
 *
 * Used by Claude to play and test the game via command line
 */

import type { Card } from "../core/card/card.types";
import type { Meld } from "../core/meld/meld.types";
import type { Player, RoundNumber, RoundRecord } from "../core/engine/engine.types";
import type { Contract } from "../core/engine/contracts";

/**
 * Decision phases - what the harness is waiting for
 */
export type DecisionPhase =
  | "AWAITING_DRAW" // Current player needs to draw
  | "AWAITING_ACTION" // Current player has drawn, can lay down/layoff/swap or proceed to discard
  | "AWAITING_DISCARD" // Current player must discard
  | "MAY_I_WINDOW" // Waiting for a specific player's May I decision
  | "ROUND_END" // Round finished, waiting for continue
  | "GAME_END"; // Game over

/**
 * Context for May I window - who needs to respond
 */
export interface MayIContext {
  discardedCard: Card;
  discardedByPlayerId: string;
  currentPlayerId: string; // Whose turn it actually is
  currentPlayerIndex: number;
  /** Players who still need to respond, in priority order */
  awaitingResponseFrom: string[];
  /** Players who have called May I */
  claimants: string[];
  /** Has the current player already passed (drew from stock)? */
  currentPlayerPassed: boolean;
}

/**
 * Harness-specific state tracking
 */
export interface HarnessState {
  phase: DecisionPhase;
  /** Which player the harness is waiting on */
  awaitingPlayerId: string;
  /** May I window context when phase is MAY_I_WINDOW */
  mayIContext: MayIContext | null;
  /** Turn counter for logging */
  turnNumber: number;
}

/**
 * Complete persisted game state
 */
export interface PersistedGameState {
  version: "1.0";
  gameId: string;
  seed: string | null;
  createdAt: string;
  updatedAt: string;

  // Core game state
  currentRound: RoundNumber;
  contract: Contract;
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundHistory: RoundRecord[];

  // Harness tracking
  harness: HarnessState;
}

/**
 * Action log entry for the game log file
 */
export interface ActionLogEntry {
  timestamp: string;
  turnNumber: number;
  roundNumber: RoundNumber;
  playerId: string;
  playerName: string;
  action: string;
  details?: string;
}

/**
 * Result of executing a command
 */
export interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Available commands based on current phase
 */
export interface AvailableCommands {
  phase: DecisionPhase;
  commands: string[];
  description: string;
}
