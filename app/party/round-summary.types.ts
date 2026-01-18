/**
 * Round Summary Types
 *
 * Types for capturing and displaying round end summary information.
 * Used by RoundSummaryDialog to show winner, scores, table melds, and remaining cards.
 */

import type { Card } from "../../core/card/card.types";
import type { Meld } from "../../core/meld/meld.types";

/**
 * Payload containing all information needed to display round summary.
 * Captured BEFORE round transition to avoid race conditions.
 */
export interface RoundSummaryPayload {
  /** Lobby ID of the player who went out */
  winnerId: string;
  /** All melds on the table at round end */
  tableMelds: Meld[];
  /** Map of lobby player IDs to their remaining cards */
  playerHands: Record<string, Card[]>;
  /** Map of lobby player IDs to their current total scores */
  scores: Record<string, number>;
  /** Map of lobby player IDs to their display names */
  playerNames: Record<string, string>;
  /** Map of lobby player IDs to their avatar IDs */
  playerAvatars: Record<string, string | undefined>;
}
