/**
 * Round Summary Capture
 *
 * Pure function to capture round summary state BEFORE round transition.
 * This ensures we capture hands and table state at the moment the round ends,
 * avoiding race conditions where state could change during UI transitions.
 */

import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { PlayerMapping } from "./party-game-adapter";
import type { RoundSummaryPayload } from "./round-summary.types";

/**
 * Capture a snapshot of the round state for display in the round summary dialog.
 *
 * IMPORTANT: This must be called BEFORE the round transition to avoid race conditions.
 * The snapshot should be taken when a player goes out (hand becomes empty) but before
 * the engine starts the next round.
 *
 * @param snapshot - The game snapshot at the moment the round ends
 * @param playerMappings - Player mappings for ID translation
 * @returns RoundSummaryPayload with all display information
 */
export function captureRoundSummary(
  snapshot: GameSnapshot,
  playerMappings: PlayerMapping[]
): RoundSummaryPayload {
  // Find the winner (player with empty hand who went out)
  const winnerEnginePlayer = snapshot.players.find((p) => p.hand.length === 0);
  const winnerMapping = playerMappings.find(
    (m) => m.engineId === winnerEnginePlayer?.id
  );
  const winnerId = winnerMapping?.lobbyId ?? "";

  // Capture table melds as-is (they already have ownerIds)
  const tableMelds = [...snapshot.table];

  // Build player hands map (lobbyId -> cards)
  const playerHands: Record<string, typeof snapshot.players[0]["hand"]> = {};
  for (const mapping of playerMappings) {
    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    playerHands[mapping.lobbyId] = player?.hand ?? [];
  }

  // Build scores map (lobbyId -> totalScore)
  const scores: Record<string, number> = {};
  for (const mapping of playerMappings) {
    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    scores[mapping.lobbyId] = player?.totalScore ?? 0;
  }

  // Build player names map (lobbyId -> name)
  const playerNames: Record<string, string> = {};
  for (const mapping of playerMappings) {
    playerNames[mapping.lobbyId] = mapping.name;
  }

  // Build player avatars map (lobbyId -> avatarId)
  const playerAvatars: Record<string, string | undefined> = {};
  for (const mapping of playerMappings) {
    playerAvatars[mapping.lobbyId] = mapping.avatarId;
  }

  return {
    winnerId,
    tableMelds,
    playerHands,
    scores,
    playerNames,
    playerAvatars,
  };
}
