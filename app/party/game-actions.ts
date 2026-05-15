/**
 * Game Actions Handler for Phase 3.4
 *
 * This module handles game action validation and execution for human players.
 * It bridges between the wire protocol (ClientMessage) and the PartyGameAdapter.
 */

import type { GameAction } from "../../core/engine/game-action.command";
import type { PartyGameAdapter } from "./party-game-adapter";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { formatCardText } from "../../core/card/card-text.utils";
import { validateGameActionCommand } from "../../core/engine/game-action.command-policy";

// These actions are processed by the round machine and don't touch `lastError`,
// so checking `lastError` would incorrectly surface stale errors from previous
// failed turn actions.
const ACTIONS_THAT_IGNORE_LAST_ERROR: ReadonlySet<GameAction["type"]> = new Set([
  "CALL_MAY_I",
  "ALLOW_MAY_I",
  "CLAIM_MAY_I",
  "REORDER_HAND",
]);

export type ActionResult =
  | {
      status: "accepted";
      success: true;
      snapshot: GameSnapshot;
      error?: never;
    }
  | {
      status: "rejected";
      success: false;
      snapshot: GameSnapshot | null;
      error: string;
    };

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
  // Use snapshotBefore as our reference snapshot
  const snapshot = snapshotBefore;

  const enginePlayerId = adapter.lobbyIdToEngineId(lobbyPlayerId);
  if (!enginePlayerId) {
    return rejectedAction("ACTION_FAILED", null);
  }

  const validation = validateGameActionCommand(
    snapshot,
    enginePlayerId,
    action
  );
  if (!validation.ok) {
    return rejectedAction(validation.error, null);
  }

  // Execute the action based on type
  let result: GameSnapshot | null = null;

  switch (action.type) {
    case "DRAW_FROM_STOCK":
      result = adapter.drawFromStock(lobbyPlayerId);
      break;

    case "DRAW_FROM_DISCARD":
      result = adapter.drawFromDiscard(lobbyPlayerId);
      break;

    case "DISCARD":
      result = adapter.discard(lobbyPlayerId, action.cardId);
      break;

    case "SKIP":
      result = adapter.skip(lobbyPlayerId);
      break;

    case "LAY_DOWN":
      result = adapter.layDown(lobbyPlayerId, action.melds);
      break;

    case "LAY_OFF":
      result = adapter.layOff(
        lobbyPlayerId,
        action.cardId,
        action.meldId,
        action.position
      );
      break;

    case "SWAP_JOKER":
      result = adapter.swapJoker(
        lobbyPlayerId,
        action.meldId,
        action.jokerCardId,
        action.swapCardId
      );
      break;

    case "REORDER_HAND":
      result = adapter.reorderHand(lobbyPlayerId, action.cardIds);
      break;

    case "CALL_MAY_I":
      result = adapter.callMayI(lobbyPlayerId);
      break;

    case "ALLOW_MAY_I":
      result = adapter.allowMayI(lobbyPlayerId);
      break;

    case "CLAIM_MAY_I":
      result = adapter.claimMayI(lobbyPlayerId);
      break;

    default: {
      return rejectedAction("UNKNOWN_ACTION", null);
    }
  }

  // Check if the action succeeded
  if (!result) {
    return rejectedAction("ACTION_FAILED", null);
  }

  // Check if the engine recorded an error (skip for actions that ignore `lastError`)
  if (!ACTIONS_THAT_IGNORE_LAST_ERROR.has(action.type) && result.lastError) {
    return rejectedAction(result.lastError, result);
  }

  // Log successful action
  logSuccessfulAction(adapter, lobbyPlayerId, action, snapshotBefore, result);

  return acceptedAction(result);
}

function acceptedAction(snapshot: GameSnapshot): ActionResult {
  return {
    status: "accepted",
    success: true,
    snapshot,
  };
}

function rejectedAction(
  error: string,
  snapshot: GameSnapshot | null
): ActionResult {
  return {
    status: "rejected",
    success: false,
    snapshot,
    error,
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
      adapter.logLayOff(
        lobbyPlayerId,
        action.cardId,
        before,
        after,
        action.position
      );
      break;

    case "SWAP_JOKER":
      adapter.logSwapJoker(
        lobbyPlayerId,
        action.meldId,
        action.jokerCardId,
        action.swapCardId,
        before,
        after
      );
      break;

    case "CALL_MAY_I": {
      const cardId = before.discard[0]?.id;
      if (cardId) {
        adapter.logMayICall(lobbyPlayerId, cardId, before);
      }
      break;
    }

    case "ALLOW_MAY_I": {
      adapter.logMayIAllow(lobbyPlayerId);
      // If May-I just resolved (phase changed), log who got the card
      if (before.phase === "RESOLVING_MAY_I" && after.phase === "ROUND_ACTIVE") {
        const mayIContext = before.mayIContext;
        if (mayIContext) {
          const cardRendered = formatCardText(mayIContext.cardBeingClaimed);
          const winnerEngineId = mayIContext.originalCaller;
          const winnerMapping = adapter.getAllPlayerMappings().find(
            (m) => m.engineId === winnerEngineId
          );
          if (winnerMapping) {
            adapter.logMayIResolved(winnerMapping.lobbyId, cardRendered);
          }
        }
      }
      break;
    }

    case "CLAIM_MAY_I": {
      const mayIContext = before.mayIContext;
      if (mayIContext) {
        const cardRendered = formatCardText(mayIContext.cardBeingClaimed);
        adapter.logMayIClaim(lobbyPlayerId, cardRendered);
        // Claimer is this player, they took the card
        adapter.logMayIResolved(lobbyPlayerId, cardRendered);
      }
      break;
    }

    // SKIP and REORDER_HAND are not logged (too verbose)
  }
}
