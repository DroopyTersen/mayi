/**
 * Game Actions Handler for Phase 3.4
 *
 * This module handles game action validation and execution for human players.
 * It bridges between the wire protocol (ClientMessage) and the PartyGameAdapter.
 */

import type { GameAction } from "./protocol.types";
import type { PartyGameAdapter } from "./party-game-adapter";
import type { GameSnapshot } from "../../core/engine/game-engine.types";

export interface ActionResult {
  success: boolean;
  snapshot: GameSnapshot | null;
  error?: string;
}

/**
 * Execute a game action for a player
 *
 * Validates that the action is valid for the current game state
 * and executes it via the adapter. Logs successful actions to the activity log.
 */
export function executeGameAction(
  adapter: PartyGameAdapter,
  lobbyPlayerId: string,
  action: GameAction
): ActionResult {
  // Get the current state to validate the action and compare after
  const snapshotBefore = adapter.getSnapshot();
  const awaitingId = adapter.getAwaitingLobbyPlayerId();
  // Use snapshotBefore as our reference snapshot
  const snapshot = snapshotBefore;

  // Most actions require it to be the player's turn
  const requiresPlayerTurn = ![
    "CALL_MAY_I",
    "ALLOW_MAY_I",
    "CLAIM_MAY_I",
    "REORDER_HAND",
  ].includes(action.type);

  if (requiresPlayerTurn && awaitingId !== lobbyPlayerId) {
    return {
      success: false,
      snapshot: null,
      error: "NOT_YOUR_TURN",
    };
  }

  // Execute the action based on type
  let result: GameSnapshot | null = null;

  switch (action.type) {
    case "DRAW_FROM_STOCK": {
      if (snapshot.turnPhase !== "AWAITING_DRAW") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      result = adapter.drawFromStock(lobbyPlayerId);
      break;
    }

    case "DRAW_FROM_DISCARD": {
      if (snapshot.turnPhase !== "AWAITING_DRAW") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      result = adapter.drawFromDiscard(lobbyPlayerId);
      break;
    }

    case "DISCARD": {
      if (
        snapshot.turnPhase !== "AWAITING_DISCARD" &&
        snapshot.turnPhase !== "AWAITING_ACTION"
      ) {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      if (!action.cardId) {
        return {
          success: false,
          snapshot: null,
          error: "MISSING_CARD_ID",
        };
      }
      result = adapter.discard(lobbyPlayerId, action.cardId);
      break;
    }

    case "SKIP": {
      if (snapshot.turnPhase !== "AWAITING_ACTION") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      result = adapter.skip(lobbyPlayerId);
      break;
    }

    case "LAY_DOWN": {
      if (snapshot.turnPhase !== "AWAITING_ACTION") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      if (!action.melds || action.melds.length === 0) {
        return {
          success: false,
          snapshot: null,
          error: "MISSING_MELDS",
        };
      }
      result = adapter.layDown(lobbyPlayerId, action.melds);
      break;
    }

    case "LAY_OFF": {
      if (
        snapshot.turnPhase !== "AWAITING_ACTION" &&
        snapshot.turnPhase !== "AWAITING_DISCARD"
      ) {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      if (!action.cardId || !action.meldId) {
        return {
          success: false,
          snapshot: null,
          error: "MISSING_CARD_OR_MELD_ID",
        };
      }
      result = adapter.layOff(lobbyPlayerId, action.cardId, action.meldId, action.position);
      break;
    }

    case "SWAP_JOKER": {
      if (
        snapshot.turnPhase !== "AWAITING_ACTION" &&
        snapshot.turnPhase !== "AWAITING_DISCARD"
      ) {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      if (!action.meldId || !action.jokerCardId || !action.swapCardId) {
        return {
          success: false,
          snapshot: null,
          error: "MISSING_SWAP_PARAMS",
        };
      }
      result = adapter.swapJoker(
        lobbyPlayerId,
        action.meldId,
        action.jokerCardId,
        action.swapCardId
      );
      break;
    }

    case "REORDER_HAND": {
      if (!action.cardIds || action.cardIds.length === 0) {
        return {
          success: false,
          snapshot: null,
          error: "MISSING_CARD_IDS",
        };
      }
      result = adapter.reorderHand(lobbyPlayerId, action.cardIds);
      break;
    }

    case "CALL_MAY_I": {
      // Can call May I when it's NOT your turn and phase is ROUND_ACTIVE
      if (snapshot.phase !== "ROUND_ACTIVE") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      if (awaitingId === lobbyPlayerId) {
        return {
          success: false,
          snapshot: null,
          error: "CANNOT_CALL_MAY_I_ON_OWN_TURN",
        };
      }
      result = adapter.callMayI(lobbyPlayerId);
      break;
    }

    case "ALLOW_MAY_I": {
      if (snapshot.phase !== "RESOLVING_MAY_I") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      result = adapter.allowMayI(lobbyPlayerId);
      break;
    }

    case "CLAIM_MAY_I": {
      if (snapshot.phase !== "RESOLVING_MAY_I") {
        return {
          success: false,
          snapshot: null,
          error: "INVALID_PHASE",
        };
      }
      result = adapter.claimMayI(lobbyPlayerId);
      break;
    }

    default: {
      return {
        success: false,
        snapshot: null,
        error: "UNKNOWN_ACTION",
      };
    }
  }

  // Check if the action succeeded
  if (!result) {
    return {
      success: false,
      snapshot: null,
      error: "ACTION_FAILED",
    };
  }

  // Check if the engine recorded an error
  if (result.lastError) {
    return {
      success: false,
      snapshot: result,
      error: result.lastError,
    };
  }

  // Log successful action
  logSuccessfulAction(adapter, lobbyPlayerId, action, snapshotBefore, result);

  return {
    success: true,
    snapshot: result,
  };
}

/**
 * Log a successful action to the activity log
 */
function logSuccessfulAction(
  adapter: PartyGameAdapter,
  lobbyPlayerId: string,
  action: GameAction,
  before: GameSnapshot,
  after: GameSnapshot
): void {
  switch (action.type) {
    case "DRAW_FROM_STOCK":
      adapter.logDraw(lobbyPlayerId, before, after, "stock");
      break;

    case "DRAW_FROM_DISCARD":
      adapter.logDraw(lobbyPlayerId, before, after, "discard");
      break;

    case "DISCARD":
      adapter.logDiscard(lobbyPlayerId, before, after, action.cardId);
      break;

    case "LAY_DOWN":
      adapter.logLayDown(lobbyPlayerId, before, after);
      break;

    case "LAY_OFF":
      adapter.logLayOff(lobbyPlayerId, action.cardId, before, after, action.position);
      break;

    case "CALL_MAY_I": {
      const cardId = before.discard[0]?.id;
      if (cardId) {
        adapter.logMayICall(lobbyPlayerId, cardId, before);
      }
      break;
    }

    // SKIP, REORDER_HAND, ALLOW_MAY_I, CLAIM_MAY_I, SWAP_JOKER
    // are not logged (too verbose or handled elsewhere)
  }
}
