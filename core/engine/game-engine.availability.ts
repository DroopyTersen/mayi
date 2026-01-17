/**
 * Utility functions for determining available actions at the engine level.
 *
 * These functions can be used by CLI, interactive mode, AI agents, and web app
 * to understand what actions are available for each player.
 */

import type { GameSnapshot, UnavailabilityHint } from "./game-engine.types";
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

export type ActionAvailabilityStatus = "available" | "unavailable" | "hidden";

export type ActionId =
  | "drawStock"
  | "pickUpDiscard"
  | "layDown"
  | "layOff"
  | "swapJoker"
  | "discard"
  | "mayI"
  | "allowMayI"
  | "claimMayI"
  | "reorderHand";

export interface ActionAvailabilityState {
  id: ActionId;
  label: string;
  status: ActionAvailabilityStatus;
  reason?: string;
}

export interface ActionAvailabilityDetails {
  availableActions: AvailableActions;
  unavailabilityHints: UnavailabilityHint[];
  actionStates: ActionAvailabilityState[];
}

const ACTION_LABELS: Record<ActionId, string> = {
  drawStock: "Draw Card",
  pickUpDiscard: "Pick Up Discard",
  layDown: "Lay Down",
  layOff: "Lay Off",
  swapJoker: "Swap Joker",
  discard: "Discard",
  mayI: "May I?",
  allowMayI: "Allow",
  claimMayI: "Claim",
  reorderHand: "Organize",
};

const ACTION_ORDER: ActionId[] = [
  "drawStock",
  "pickUpDiscard",
  "layDown",
  "layOff",
  "swapJoker",
  "discard",
  "mayI",
  "allowMayI",
  "claimMayI",
  "reorderHand",
];

const HINT_ORDER: ActionId[] = ["layOff", "swapJoker", "pickUpDiscard"];

function createActionStateMap(): Record<ActionId, ActionAvailabilityState> {
  return {
    drawStock: {
      id: "drawStock",
      label: ACTION_LABELS.drawStock,
      status: "hidden",
    },
    pickUpDiscard: {
      id: "pickUpDiscard",
      label: ACTION_LABELS.pickUpDiscard,
      status: "hidden",
    },
    layDown: {
      id: "layDown",
      label: ACTION_LABELS.layDown,
      status: "hidden",
    },
    layOff: {
      id: "layOff",
      label: ACTION_LABELS.layOff,
      status: "hidden",
    },
    swapJoker: {
      id: "swapJoker",
      label: ACTION_LABELS.swapJoker,
      status: "hidden",
    },
    discard: {
      id: "discard",
      label: ACTION_LABELS.discard,
      status: "hidden",
    },
    mayI: {
      id: "mayI",
      label: ACTION_LABELS.mayI,
      status: "hidden",
    },
    allowMayI: {
      id: "allowMayI",
      label: ACTION_LABELS.allowMayI,
      status: "hidden",
    },
    claimMayI: {
      id: "claimMayI",
      label: ACTION_LABELS.claimMayI,
      status: "hidden",
    },
    reorderHand: {
      id: "reorderHand",
      label: ACTION_LABELS.reorderHand,
      status: "hidden",
    },
  };
}

function createEmptyAvailableActions(hasPendingMayIRequest: boolean): AvailableActions {
  return {
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
}

function buildUnavailabilityHints(
  actionStates: Record<ActionId, ActionAvailabilityState>
): UnavailabilityHint[] {
  return HINT_ORDER.flatMap((actionId) => {
    const state = actionStates[actionId];
    if (state.status !== "unavailable" || !state.reason) {
      return [];
    }
    return [{ action: state.label, reason: state.reason }];
  });
}

/**
 * Evaluate action availability and unavailability hints from shared rules.
 *
 * This is the single source of truth for both availableActions and hints.
 */
export function getActionAvailabilityDetails(
  snapshot: GameSnapshot,
  playerId: string
): ActionAvailabilityDetails {
  const actionStates = createActionStateMap();
  const player = snapshot.players.find((p) => p.id === playerId);
  const isDown = player?.isDown ?? false;
  const isYourTurn = snapshot.awaitingPlayerId === playerId;
  const isRound6 = snapshot.currentRound === 6;
  const hasDrawn = snapshot.hasDrawn;
  const hasMeldsOnTable = snapshot.table.length > 0;
  const hasRunWithJoker = snapshot.table.some(
    (meld) =>
      meld.type === "run" && meld.cards.some((c) => c.rank === "Joker")
  );
  const hasDiscard = snapshot.discard.length > 0;

  const hasPendingMayIRequest = snapshot.mayIContext?.originalCaller === playerId;
  const actions = createEmptyAvailableActions(hasPendingMayIRequest);

  const setActionState = (
    actionId: ActionId,
    status: ActionAvailabilityStatus,
    reason?: string
  ) => {
    const current = actionStates[actionId];
    actionStates[actionId] = {
      id: current.id,
      label: current.label,
      status,
      reason,
    };
  };

  const buildDetails = (): ActionAvailabilityDetails => ({
    availableActions: actions,
    unavailabilityHints: buildUnavailabilityHints(actionStates),
    actionStates: ACTION_ORDER.map((actionId) => actionStates[actionId]),
  });

  // Handle RESOLVING_MAY_I phase - only allow/claim available for prompted player
  if (snapshot.phase === "RESOLVING_MAY_I") {
    const isPrompted = snapshot.mayIContext?.playerBeingPrompted === playerId;
    if (isPrompted) {
      actions.canAllowMayI = true;
      actions.canClaimMayI = true;
      setActionState("allowMayI", "available");
      setActionState("claimMayI", "available");
    }
    return buildDetails();
  }

  // No actions during ROUND_END or GAME_END
  if (snapshot.phase === "ROUND_END" || snapshot.phase === "GAME_END") {
    return buildDetails();
  }

  // Hand reordering is available during active round for any player (free action)
  // Not available during May I resolution (handled above with early return)
  if (snapshot.phase === "ROUND_ACTIVE") {
    actions.canReorderHand = true;
    setActionState("reorderHand", "available");
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
      hasDiscard &&
      !snapshot.discardClaimed &&
      snapshot.mayIContext === null &&
      snapshot.lastDiscardedByPlayerId !== playerId;
    if (canCallMayI) {
      actions.canMayI = true;
      setActionState("mayI", "available");
    }
  }

  // If not your turn, May I is the only possible action
  if (!isYourTurn) {
    return buildDetails();
  }

  // Your turn actions based on turn phase
  switch (snapshot.turnPhase) {
    case "AWAITING_DRAW":
      actions.canDrawFromStock = true;
      setActionState("drawStock", "available");
      // Down players can only draw from stock (house rule)
      if (!isDown) {
        actions.canDrawFromDiscard = true;
        setActionState("pickUpDiscard", "available");
      }
      break;

    case "AWAITING_ACTION":
      if (isDown) {
        // Down player: can lay off (if melds exist) and discard
        // Lay off not available in round 6 (no melds until someone wins)
        // IMPORTANT: Cannot lay off on the same turn you laid down (house rule)
        if (!isRound6 && hasMeldsOnTable && !snapshot.laidDownThisTurn) {
          actions.canLayOff = true;
          setActionState("layOff", "available");
        }
        actions.canDiscard = true;
        setActionState("discard", "available");
      } else {
        // Not down: can lay down, swap joker (if applicable), discard
        actions.canLayDown = true;
        setActionState("layDown", "available");
        actions.canDiscard = true;
        setActionState("discard", "available");

        // Joker swapping: only from runs, only when not down, not in round 6
        // Per house rules: "Jokers can be swapped out of runs only, never out of sets"
        if (!isRound6 && hasRunWithJoker) {
          actions.canSwapJoker = true;
          setActionState("swapJoker", "available");
        }
      }
      break;

    case "AWAITING_DISCARD":
      actions.canDiscard = true;
      setActionState("discard", "available");
      break;
  }

  // Hints are only shown during the player's active turn.
  const canShowHints =
    snapshot.phase === "ROUND_ACTIVE" &&
    isYourTurn &&
    player !== undefined;

  if (canShowHints) {
    const canLayOffContext = !isRound6 && hasMeldsOnTable;
    if (canLayOffContext) {
      if (isDown && snapshot.laidDownThisTurn) {
        setActionState("layOff", "unavailable", "Available next turn");
      } else if (!isDown && hasDrawn) {
        setActionState("layOff", "unavailable", "Lay down your contract first");
      }
    }

    // Per house rules: "You may only swap Jokers if you have not laid down yet this hand"
    if (!isRound6 && hasRunWithJoker && isDown) {
      setActionState("swapJoker", "unavailable", "Only before laying down");
    }

    // Per house rules: "Once you have laid down ('down'), you may only draw from the stock pile"
    if (isDown && snapshot.turnPhase === "AWAITING_DRAW" && hasDiscard) {
      setActionState(
        "pickUpDiscard",
        "unavailable",
        "Must draw from stock when down"
      );
    }
  }

  // Nudge to discard when:
  // - It's your turn
  // - You can discard
  // - You took a meaningful action this turn (lay down, lay off, swap joker)
  actions.shouldNudgeDiscard =
    isYourTurn &&
    actions.canDiscard &&
    snapshot.tookActionThisTurn;

  return buildDetails();
}

/**
 * Get available actions for a player based on current game state.
 *
 * @param snapshot Current game snapshot
 * @param playerId Player to get actions for
 * @returns Object with boolean flags for each available action
 */
export function getAvailableActions(snapshot: GameSnapshot, playerId: string): AvailableActions {
  return getActionAvailabilityDetails(snapshot, playerId).availableActions;
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
