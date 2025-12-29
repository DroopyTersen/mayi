/**
 * Game engine type definitions for May I? card game
 */

import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

/**
 * Represents a player in the game
 */
export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isDown: boolean; // Has laid down contract this round
  totalScore: number; // Cumulative across rounds
}

/**
 * Round phase in the game lifecycle
 */
export type RoundPhase = "dealing" | "playing" | "roundEnd" | "gameEnd";

/**
 * Current state of a player's turn
 */
export interface TurnState {
  hasDrawn: boolean;
  hasLaidDown: boolean; // This turn specifically
  laidDownThisTurn: boolean; // Prevents lay-off on same turn
}

/**
 * May I window state when a player declines the discard
 */
export interface MayIWindow {
  discardedCard: Card;
  discardedBy: string; // Player ID
  claimants: string[]; // Player IDs who called May I
  nextPlayerDeclined: boolean;
}

/**
 * Record of a completed round
 */
export interface RoundRecord {
  roundNumber: number;
  scores: Record<string, number>; // playerId -> points
  winnerId: string; // Who went out
}

/**
 * Valid round numbers in May I?
 */
export type RoundNumber = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Complete game state
 */
export interface GameState {
  // Identity
  gameId: string;

  // Round tracking
  currentRound: RoundNumber;
  roundPhase: RoundPhase;

  // Players
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;

  // Card zones
  stock: Card[];
  discard: Card[];
  table: Meld[];

  // Turn state
  turnState: TurnState;

  // May I tracking
  mayIWindow: MayIWindow | null;

  // History
  roundHistory: RoundRecord[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Configuration for creating a new game
 */
export interface CreateGameConfig {
  playerNames: string[];
  dealerIndex?: number;
  /** Optional gameId for deterministic testing (defaults to crypto.randomUUID()) */
  gameId?: string;
}

/**
 * Creates an initial game state (before dealing)
 */
export function createInitialGameState(config: CreateGameConfig): GameState {
  const { playerNames, dealerIndex = 0, gameId } = config;

  if (playerNames.length < 3 || playerNames.length > 8) {
    throw new Error("Game requires 3-8 players");
  }

  const players: Player[] = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    hand: [],
    isDown: false,
    totalScore: 0,
  }));

  // First player is left of dealer
  const currentPlayerIndex = (dealerIndex + 1) % players.length;

  const now = new Date().toISOString();

  return {
    gameId: gameId ?? crypto.randomUUID(),
    currentRound: 1,
    roundPhase: "dealing",
    players,
    currentPlayerIndex,
    dealerIndex,
    stock: [],
    discard: [],
    table: [],
    turnState: {
      hasDrawn: false,
      hasLaidDown: false,
      laidDownThisTurn: false,
    },
    mayIWindow: null,
    roundHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}
