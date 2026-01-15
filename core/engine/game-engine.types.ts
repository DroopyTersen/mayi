/**
 * Type definitions for the server-safe GameEngine
 *
 * This file contains types for the immutable, ID-based game engine
 * that can run on Cloudflare Workers (no Node.js dependencies).
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player, RoundNumber, RoundRecord } from "./engine.types";
import type { Contract } from "./contracts";
import type { AvailableActions } from "./game-engine.availability";

// ═══════════════════════════════════════════════════════════════════════════
// Phase Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * High-level engine phase
 */
export type EnginePhase =
  | "ROUND_ACTIVE"
  | "RESOLVING_MAY_I"
  | "ROUND_END"
  | "GAME_END";

/**
 * Turn phase within ROUND_ACTIVE
 */
export type TurnPhase =
  | "AWAITING_DRAW"
  | "AWAITING_ACTION"
  | "AWAITING_DISCARD";

// ═══════════════════════════════════════════════════════════════════════════
// May I Context
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Context for May I resolution at round level
 *
 * When someone calls May I, resolution proceeds through players ahead of
 * the caller in priority order. Each player can ALLOW (let caller have it)
 * or CLAIM (take it themselves, blocking the caller).
 */
export interface MayIContext {
  /** Who called May I */
  originalCaller: string;
  /** The card being claimed */
  cardBeingClaimed: Card;
  /** Players to check in priority order */
  playersToCheck: string[];
  /** Current index in playersToCheck */
  currentPromptIndex: number;
  /** Who is currently being prompted (null if resolution complete) */
  playerBeingPrompted: string | null;
  /** Players who have allowed the caller to have the card */
  playersWhoAllowed: string[];
  /** Winner of the resolution (null if still in progress) */
  winner: string | null;
  /** Outcome: caller_won | blocked | current_player_claimed | null */
  outcome: "caller_won" | "blocked" | "current_player_claimed" | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GameSnapshot (v3.0)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Immutable snapshot of the complete game state
 *
 * This is the internal format used by GameEngine. All commands return
 * a new GameSnapshot rather than mutating state.
 */
export interface GameSnapshot {
  /** Schema version for future migrations */
  version: "3.0";

  /** Unique game identifier */
  gameId: string;

  /** Error message from the last failed operation (if any) */
  lastError: string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase Tracking
  // ─────────────────────────────────────────────────────────────────────────

  /** High-level game phase */
  phase: EnginePhase;

  /** Turn phase (only meaningful when phase is ROUND_ACTIVE) */
  turnPhase: TurnPhase;

  /** Turn counter within the round */
  turnNumber: number;

  /** Who discarded the top card of the discard pile (for May I eligibility) */
  lastDiscardedByPlayerId: string | null;

  /** Whether the exposed discard has been claimed this turn (via draw or May I) */
  discardClaimed: boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // Round State
  // ─────────────────────────────────────────────────────────────────────────

  /** Current round (1-6) */
  currentRound: RoundNumber;

  /** Contract for current round */
  contract: Contract;

  // ─────────────────────────────────────────────────────────────────────────
  // Players
  // ─────────────────────────────────────────────────────────────────────────

  /** All players in the game */
  players: Player[];

  /** Index of the dealer for this round */
  dealerIndex: number;

  /** Index of the current player */
  currentPlayerIndex: number;

  /** ID of player the engine is waiting on (may differ from current player in May I window) */
  awaitingPlayerId: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Card Zones
  // ─────────────────────────────────────────────────────────────────────────

  /** Draw pile (face down) */
  stock: Card[];

  /** Discard pile (top card visible) */
  discard: Card[];

  /** Melds on the table */
  table: Meld[];

  // ─────────────────────────────────────────────────────────────────────────
  // Turn State
  // ─────────────────────────────────────────────────────────────────────────

  /** Has the current player drawn this turn? */
  hasDrawn: boolean;

  /** Did the current player lay down this turn? (prevents lay-off same turn) */
  laidDownThisTurn: boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // May I Resolution
  // ─────────────────────────────────────────────────────────────────────────

  /** May I context when phase is RESOLVING_MAY_I, null otherwise */
  mayIContext: MayIContext | null;

  // ─────────────────────────────────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────────────────────────────────

  /** Records of completed rounds */
  roundHistory: RoundRecord[];

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────

  /** When the game was created */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PlayerView (Information Hiding)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Information about an opponent (hand hidden)
 */
export interface OpponentInfo {
  /** Player ID */
  id: string;

  /** Player name */
  name: string;

  /** Character avatar ID (e.g., "ethel", "curt") */
  avatarId?: string;

  /** Number of cards in hand (NOT the actual cards!) */
  handCount: number;

  /** Has this player laid down their contract? */
  isDown: boolean;

  /** Cumulative score across rounds */
  totalScore: number;

  /** Is this player the dealer? */
  isDealer: boolean;

  /** Is this the current player? */
  isCurrentPlayer: boolean;
}

/**
 * Per-player view of the game state
 *
 * This view hides other players' hands (only shows handCount).
 * Use this for client-facing state to prevent cheating.
 */
export interface PlayerView {
  /** Game identifier */
  gameId: string;

  /** Who this view is for */
  viewingPlayerId: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Your Data (Full Visibility)
  // ─────────────────────────────────────────────────────────────────────────

  /** Your hand (with stable card IDs) */
  yourHand: Card[];

  /** Is it your turn? */
  isYourTurn: boolean;

  /** Have you laid down this round? */
  youAreDown: boolean;

  /** Your total score */
  yourTotalScore: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Opponents (Hands Hidden)
  // ─────────────────────────────────────────────────────────────────────────

  /** Other players (only handCount, NOT cards!) */
  opponents: OpponentInfo[];

  // ─────────────────────────────────────────────────────────────────────────
  // Public Game State
  // ─────────────────────────────────────────────────────────────────────────

  /** Current round (1-6) */
  currentRound: RoundNumber;

  /** Contract for this round */
  contract: Contract;

  /** High-level game phase */
  phase: EnginePhase;

  /** Turn phase within round */
  turnPhase: TurnPhase;

  /** Current turn number */
  turnNumber: number;

  /** Which player the game is waiting on */
  awaitingPlayerId: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Card Zones (Public)
  // ─────────────────────────────────────────────────────────────────────────

  /** Number of cards in stock (not the actual cards) */
  stockCount: number;

  /** Top card of discard pile (null if empty) */
  topDiscard: Card | null;

  /** Number of cards in discard pile */
  discardCount: number;

  /** All melds on the table */
  table: Meld[];

  // ─────────────────────────────────────────────────────────────────────────
  // Scores and History
  // ─────────────────────────────────────────────────────────────────────────

  /** Completed round records */
  roundHistory: RoundRecord[];

  // ─────────────────────────────────────────────────────────────────────────
  // May I Context
  // ─────────────────────────────────────────────────────────────────────────

  /** May I window context (if active) */
  mayIContext: MayIContext | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Available Actions
  // ─────────────────────────────────────────────────────────────────────────

  /** What actions this player can currently take */
  availableActions: AvailableActions;

  // ─────────────────────────────────────────────────────────────────────────
  // Turn Order
  // ─────────────────────────────────────────────────────────────────────────

  /** All player IDs in turn order (for UI display) */
  turnOrder: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Command Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of executing a command - just the snapshot
 *
 * Commands always return the current state. The state tells the story:
 * - If you tried to lay down and player.isDown is false, it failed
 * - If you tried to discard and turnPhase is still AWAITING_DISCARD, it failed
 *
 * XState guards handle all validation. Events that don't match current state
 * are silently ignored. Compare before/after snapshots if you need to detect.
 */
export type CommandResult = GameSnapshot;

/**
 * Specification for a meld to lay down (ID-based)
 *
 * Used with the layDown command. Card IDs reference cards in the player's hand.
 */
export interface MeldSpec {
  /** Type of meld */
  type: "set" | "run";

  /** Card IDs from the player's hand */
  cardIds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for creating a new game
 */
export interface CreateGameOptions {
  /** Player names (3-8 players) */
  playerNames: string[];

  /** Starting round (1-6), defaults to 1 */
  startingRound?: RoundNumber;

  /** Explicit game ID (for testing), defaults to crypto.randomUUID() */
  gameId?: string;

  /** Explicit dealer index (for testing), defaults to 0 */
  dealerIndex?: number;

  /** Seed for deterministic shuffling (for testing) */
  seed?: string;
}
