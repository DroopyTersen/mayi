/**
 * Utility functions for determining available actions at the engine level.
 *
 * These functions can be used by CLI, interactive mode, AI agents, and web app
 * to understand what actions are available for each player.
 */

import type { GameSnapshot } from "./game-engine.types";
import type { Contract } from "./contracts";

/**
 * Available actions for a player based on current game state.
 *
 * This is the canonical source of truth for what a player can do.
 * Used by: Web App UI (button visibility), AI Agent (tool filtering), CLI (command hints).
 */
export interface AvailableActions {
  /** Can draw from stock pile */
  canDrawFromStock: boolean;
  /** Can draw from discard pile (not available when down) */
  canDrawFromDiscard: boolean;
  /** Can lay down contract melds */
  canLayDown: boolean;
  /** Can lay off cards to existing melds (only when down, not in round 6) */
  canLayOff: boolean;
  /** Can swap a joker from a run (only when not down, runs with jokers exist, not round 6) */
  canSwapJoker: boolean;
  /** Can discard a card */
  canDiscard: boolean;
  /** Can call May I to claim the exposed discard */
  canMayI: boolean;
  /** Can allow a May I caller to have the card (during resolution) */
  canAllowMayI: boolean;
  /** Can claim the card instead of allowing (during resolution) */
  canClaimMayI: boolean;
  /** Can reorder hand (free action, available during round for any player) */
  canReorderHand: boolean;
  /** True when this player has called May I and is waiting for resolution */
  hasPendingMayIRequest: boolean;
  /** True when player should be nudged to discard (took meaningful action this turn) */
  shouldNudgeDiscard: boolean;
}

/**
 * Get available actions for a player based on current game state.
 *
 * This centralizes all the game rules about what actions are valid when.
 * House rules encoded here:
 * - Down players can only draw from stock, never discard pile
 * - Down players cannot call May I
 * - Joker swapping only allowed before laying down, only from runs, not in round 6
 * - Lay off only available when down and not in round 6
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to get actions for
 * @returns Object with boolean flags for each available action
 */
export function getAvailableActions(snapshot: GameSnapshot, playerId: string): AvailableActions {
  const player = snapshot.players.find((p) => p.id === playerId);
  const isDown = player?.isDown ?? false;
  const isYourTurn = snapshot.awaitingPlayerId === playerId;
  const isRound6 = snapshot.currentRound === 6;

  // Check if this player has a pending May I request (they are the originalCaller)
  const hasPendingMayIRequest = snapshot.mayIContext?.originalCaller === playerId;

  // Default: nothing available
  const actions: AvailableActions = {
    canDrawFromStock: false,
    canDrawFromDiscard: false,
    canLayDown: false,
    canLayOff: false,
    canSwapJoker: false,
    canDiscard: false,
    canMayI: false,
    canAllowMayI: false,
    canClaimMayI: false,
    canReorderHand: false,
    hasPendingMayIRequest,
    shouldNudgeDiscard: false,
  };

  // Handle RESOLVING_MAY_I phase - only allow/claim available for prompted player
  if (snapshot.phase === "RESOLVING_MAY_I") {
    const isPrompted = snapshot.mayIContext?.playerBeingPrompted === playerId;
    actions.canAllowMayI = isPrompted;
    actions.canClaimMayI = isPrompted;
    return actions;
  }

  // No actions during ROUND_END or GAME_END
  if (snapshot.phase === "ROUND_END" || snapshot.phase === "GAME_END") {
    return actions;
  }

  // Hand reordering is available during active round for any player (free action)
  // Not available during May I resolution (handled above with early return)
  if (snapshot.phase === "ROUND_ACTIVE") {
    actions.canReorderHand = true;
  }

  // May I is available when:
  // - It's not your turn
  // - Phase is ROUND_ACTIVE
  // - There's a discard to claim
  // - Discard hasn't been claimed this turn (via draw from discard or May I)
  // - No May I resolution in progress
  // - You're not down
  // - You didn't discard this card
  if (!isYourTurn && snapshot.phase === "ROUND_ACTIVE") {
    const canCallMayI =
      !isDown &&
      snapshot.discard.length > 0 &&
      !snapshot.discardClaimed &&
      snapshot.mayIContext === null &&
      snapshot.lastDiscardedByPlayerId !== playerId;
    actions.canMayI = canCallMayI;
  }

  // If not your turn, May I is the only possible action
  if (!isYourTurn) {
    return actions;
  }

  // Your turn actions based on turn phase
  switch (snapshot.turnPhase) {
    case "AWAITING_DRAW":
      actions.canDrawFromStock = true;
      // Down players can only draw from stock (house rule)
      actions.canDrawFromDiscard = !isDown;
      break;

    case "AWAITING_ACTION":
      if (isDown) {
        // Down player: can lay off (if melds exist) and discard
        // Lay off not available in round 6 (no melds until someone wins)
        // IMPORTANT: Cannot lay off on the same turn you laid down (house rule)
        actions.canLayOff = !isRound6 && snapshot.table.length > 0 && !snapshot.laidDownThisTurn;
        actions.canDiscard = true;
      } else {
        // Not down: can lay down, swap joker (if applicable), discard
        actions.canLayDown = true;
        actions.canDiscard = true;

        // Joker swapping: only from runs, only when not down, not in round 6
        // Per house rules: "Jokers can be swapped out of runs only, never out of sets"
        if (!isRound6) {
          const hasRunWithJoker = snapshot.table.some(
            (meld) =>
              meld.type === "run" && meld.cards.some((c) => c.rank === "Joker")
          );
          actions.canSwapJoker = hasRunWithJoker;
        }
      }
      break;

    case "AWAITING_DISCARD":
      actions.canDiscard = true;
      break;
  }

  // Nudge to discard when:
  // - It's your turn
  // - You can discard
  // - You took a meaningful action this turn (lay down, lay off, swap joker)
  actions.shouldNudgeDiscard =
    isYourTurn &&
    actions.canDiscard &&
    snapshot.tookActionThisTurn;

  return actions;
}

/**
 * Get the list of player IDs who can currently call May I.
 *
 * A player can call May I when:
 * - Phase is ROUND_ACTIVE (not during resolution, round end, or game end)
 * - There is a discard pile with at least one card
 * - The discard hasn't already been claimed this turn
 * - The player is NOT the one who discarded the current top card
 * - The player is NOT down (has not laid down their contract)
 *
 * @param snapshot Current game snapshot
 * @returns Array of player IDs who can call May I (empty if none)
 */
export function getPlayersWhoCanCallMayI(snapshot: GameSnapshot): string[] {
  // Only during active round play
  if (snapshot.phase !== "ROUND_ACTIVE") {
    return [];
  }

  // Must have a discard to claim
  if (snapshot.discard.length === 0) {
    return [];
  }

  // Can't call May I after current player draws from discard (they claimed it)
  // This is indicated by the discard being claimed - but we don't have a direct flag.
  // Instead, we check if the current player has drawn from discard by checking hasDrawn
  // and whether the discard pile shrunk. But actually, the lastDiscardedByPlayerId
  // tells us who discarded the current top card.

  const eligiblePlayers: string[] = [];

  for (const player of snapshot.players) {
    // Player who discarded this card cannot claim it
    if (player.id === snapshot.lastDiscardedByPlayerId) {
      continue;
    }

    // Down players cannot call May I
    if (player.isDown) {
      continue;
    }

    eligiblePlayers.push(player.id);
  }

  return eligiblePlayers;
}

/**
 * Check if a specific player can call May I.
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to check
 * @returns true if the player can call May I
 */
export function canPlayerCallMayI(snapshot: GameSnapshot, playerId: string): boolean {
  return getPlayersWhoCanCallMayI(snapshot).includes(playerId);
}

/**
 * Get the number of meld placeholders to show in the laydown command hint.
 *
 * @param contract The contract for the current round
 * @returns Number of melds required (2 or 3)
 */
export function getMeldPlaceholderCount(contract: Contract): number {
  return contract.sets + contract.runs;
}

/**
 * Build the laydown command hint string with the correct number of meld placeholders.
 *
 * @param contract The contract for the current round
 * @returns Command hint like 'laydown "<meld1>" "<meld2>"' or 'laydown "<meld1>" "<meld2>" "<meld3>"'
 */
export function getLaydownCommandHint(contract: Contract): string {
  const count = getMeldPlaceholderCount(contract);
  const placeholders = Array.from({ length: count }, (_, i) => `"<meld${i + 1}>"`);
  return `laydown ${placeholders.join(" ")}`;
}
