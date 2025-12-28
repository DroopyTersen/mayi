import type { Card } from "../card/card.types";
import type { RoundNumber, RoundRecord } from "./engine.types";
import { calculateRoundScores, updateTotalScores, type Scores } from "./scoring.engine";

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
