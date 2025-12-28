import type { Card } from "../card/card.types";
import { calculateHandScore } from "../scoring/scoring";

/**
 * Scores map: playerId -> score
 */
export type Scores = Record<string, number>;

/**
 * Player data needed for scoring
 */
export interface PlayerForScoring {
  id: string;
  hand: Card[];
}

/**
 * Calculate round scores for all players.
 *
 * The player who went out gets 0 points.
 * All other players get points equal to the sum of card values in their hand.
 */
export function calculateRoundScores(
  players: PlayerForScoring[],
  winnerId: string
): Scores {
  const scores: Scores = {};
  for (const player of players) {
    if (player.id === winnerId) {
      scores[player.id] = 0;
    } else {
      scores[player.id] = calculateHandScore(player.hand);
    }
  }
  return scores;
}

/**
 * Update total scores by adding round scores.
 *
 * Returns a new scores object with the updated totals.
 */
export function updateTotalScores(
  totalScores: Scores,
  roundScores: Scores
): Scores {
  const updated: Scores = {};
  for (const playerId of Object.keys(totalScores)) {
    updated[playerId] = totalScores[playerId]! + (roundScores[playerId] ?? 0);
  }
  return updated;
}

/**
 * Determine the winner(s) based on final scores.
 *
 * The winner is the player(s) with the lowest score.
 * Returns an array of player IDs (multiple in case of tie).
 */
export function determineWinner(finalScores: Scores): string[] {
  const entries = Object.entries(finalScores);
  if (entries.length === 0) return [];

  // Find the minimum score
  const minScore = Math.min(...entries.map(([, score]) => score));

  // Return all players with the minimum score
  return entries
    .filter(([, score]) => score === minScore)
    .map(([playerId]) => playerId);
}
