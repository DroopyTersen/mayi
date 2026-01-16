/**
 * Unavailability hint derivation logic.
 *
 * Computes hints explaining why certain actions are temporarily unavailable.
 * These hints help users understand the house rules and when actions will become available.
 *
 * Key house rules encoded here:
 * - Lay Off: Cannot lay off on same turn as laying down
 * - Lay Off: Cannot lay off until you've laid down your contract
 * - Swap Joker: Can only swap jokers BEFORE laying down, not after
 * - Draw Discard: Once down, can only draw from stock
 */

import type { GameSnapshot } from "./game-engine.types";

/**
 * A hint explaining why an action is unavailable.
 */
export interface UnavailabilityHint {
  /** Human-readable action name (e.g., "Lay Off", "Swap Joker") */
  action: string;
  /** Short explanation of why it's unavailable */
  reason: string;
}

/**
 * Get hints explaining why certain actions are unavailable.
 *
 * Only returns hints for actions that:
 * 1. The player has "unlocked" (e.g., they're down, so lay off is in their toolkit)
 * 2. But are currently blocked by a temporary condition
 *
 * Does NOT return hints for:
 * - Actions the player hasn't unlocked yet (e.g., lay off when not down)
 * - When it's not the player's turn
 * - During non-active phases (ROUND_END, GAME_END, RESOLVING_MAY_I)
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to get hints for
 * @returns Array of unavailability hints (empty if no hints apply)
 */
export function getUnavailabilityHints(
  snapshot: GameSnapshot,
  playerId: string
): UnavailabilityHint[] {
  const hints: UnavailabilityHint[] = [];

  // No hints during non-active phases
  if (snapshot.phase !== "ROUND_ACTIVE") {
    return hints;
  }

  // No hints if not your turn
  if (snapshot.awaitingPlayerId !== playerId) {
    return hints;
  }

  const player = snapshot.players.find((p) => p.id === playerId);
  if (!player) {
    return hints;
  }

  const isDown = player.isDown;
  const isRound6 = snapshot.currentRound === 6;
  const hasDrawn = snapshot.hasDrawn;
  const laidDownThisTurn = snapshot.laidDownThisTurn;
  const hasMeldsOnTable = snapshot.table.length > 0;

  // Check for runs with jokers (for swap joker hint)
  const hasRunWithJoker = snapshot.table.some(
    (meld) =>
      meld.type === "run" && meld.cards.some((c) => c.rank === "Joker")
  );

  // Lay Off hints
  // Only show hints when the action is "in scope" but blocked
  if (!isRound6 && hasMeldsOnTable) {
    if (isDown && laidDownThisTurn) {
      // Player is down, can normally lay off, but blocked because they just laid down
      hints.push({
        action: "Lay Off",
        reason: "Available next turn",
      });
    } else if (!isDown && hasDrawn) {
      // Player has drawn but isn't down yet - they need to lay down first
      hints.push({
        action: "Lay Off",
        reason: "Lay down your contract first",
      });
    }
  }

  // Swap Joker hints
  // Per house rules: "You may only swap Jokers if you have not laid down yet this hand"
  if (!isRound6 && hasRunWithJoker && isDown) {
    // Player is down, so they can no longer swap jokers
    hints.push({
      action: "Swap Joker",
      reason: "Only before laying down",
    });
  }

  // Draw Discard hints
  // Per house rules: "Once you have laid down ('down'), you may only draw from the stock pile"
  if (
    isDown &&
    snapshot.turnPhase === "AWAITING_DRAW" &&
    snapshot.discard.length > 0
  ) {
    hints.push({
      action: "Pick Up Discard",
      reason: "Must draw from stock when down",
    });
  }

  return hints;
}
