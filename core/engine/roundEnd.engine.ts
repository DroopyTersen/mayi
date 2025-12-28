import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber, RoundRecord } from "./engine.types";
import { calculateRoundScores, updateTotalScores, type Scores } from "./scoring.engine";
import { createDeck, shuffle, deal } from "../card/card.deck";

/**
 * Player data needed for round end processing
 */
export interface PlayerForRoundEnd {
  id: string;
  hand: Card[];
}

/**
 * Input for processing round end
 */
export interface RoundEndInput {
  roundNumber: RoundNumber;
  winnerId: string;
  players: PlayerForRoundEnd[];
  previousRoundHistory: RoundRecord[];
  previousTotalScores: Scores;
}

/**
 * Result of processing round end
 */
export interface RoundEndResult {
  roundRecord: RoundRecord;
  updatedTotalScores: Scores;
  updatedRoundHistory: RoundRecord[];
  nextAction: "nextRound" | "gameEnd";
}

/**
 * Process the end of a round.
 *
 * This function:
 * 1. Identifies the winner (player who went out)
 * 2. Calculates each player's hand score
 * 3. Creates a RoundRecord
 * 4. Updates total scores
 * 5. Adds record to roundHistory
 * 6. Determines next action (next round or game end)
 */
export function processRoundEnd(input: RoundEndInput): RoundEndResult {
  const { roundNumber, winnerId, players, previousRoundHistory, previousTotalScores } = input;

  // Calculate round scores for all players
  const roundScores = calculateRoundScores(players, winnerId);

  // Create the round record
  const roundRecord: RoundRecord = {
    roundNumber,
    winnerId,
    scores: roundScores,
  };

  // Update total scores
  const updatedTotalScores = updateTotalScores(previousTotalScores, roundScores);

  // Add record to history
  const updatedRoundHistory = [...previousRoundHistory, roundRecord];

  // Determine next action
  const nextAction = roundNumber >= 6 ? "gameEnd" : "nextRound";

  return {
    roundRecord,
    updatedTotalScores,
    updatedRoundHistory,
    nextAction,
  };
}

/**
 * Player state for a new round
 */
export interface PlayerRoundState {
  hand: Card[];
  isDown: boolean;
  laidDownThisTurn: boolean;
}

/**
 * Input for setting up the next round
 */
export interface NextRoundInput {
  previousRound: RoundNumber;
  playerIds: string[];
  previousDealerIndex: number;
}

/**
 * Result of setting up the next round
 */
export interface NextRoundState {
  currentRound: RoundNumber;
  dealerIndex: number;
  currentPlayerIndex: number;
  playerStates: Record<string, PlayerRoundState>;
  stock: Card[];
  discard: Card[];
  table: Meld[];
}

/**
 * Set up the game state for the next round.
 *
 * This function:
 * - Increments the round number
 * - Rotates the dealer
 * - Sets the first player (left of dealer)
 * - Creates and shuffles a new deck
 * - Deals 11 cards to each player
 * - Sets up the discard pile with one card
 * - Resets player states (isDown, laidDownThisTurn)
 * - Clears the table
 */
export function setupNextRound(input: NextRoundInput): NextRoundState {
  const { previousRound, playerIds, previousDealerIndex } = input;

  // Increment round
  const currentRound = (previousRound + 1) as RoundNumber;

  // Rotate dealer
  const dealerIndex = (previousDealerIndex + 1) % playerIds.length;

  // First player is left of dealer
  const currentPlayerIndex = (dealerIndex + 1) % playerIds.length;

  // Determine deck size based on player count
  // 2-4 players: 2 decks + 4 jokers = 108 cards
  // 5-6 players: 3 decks + 6 jokers = 162 cards
  const deckCount = playerIds.length >= 5 ? 3 : 2;
  const jokerCount = playerIds.length >= 5 ? 6 : 4;

  // Create, shuffle, and deal
  const deck = createDeck({ deckCount, jokerCount });
  const shuffledDeck = shuffle(deck);
  const dealResult = deal(shuffledDeck, playerIds.length);

  // Build player states
  const playerStates: Record<string, PlayerRoundState> = {};
  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    if (playerId !== undefined) {
      playerStates[playerId] = {
        hand: dealResult.hands[i] ?? [],
        isDown: false,
        laidDownThisTurn: false,
      };
    }
  }

  return {
    currentRound,
    dealerIndex,
    currentPlayerIndex,
    playerStates,
    stock: dealResult.stock,
    discard: dealResult.discard,
    table: [],
  };
}
