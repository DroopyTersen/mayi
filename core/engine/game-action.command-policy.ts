import type { GameAction } from "./game-action.command";
import type { GameSnapshot } from "./game-engine.types";
import { getActionAvailabilityDetails } from "./game-engine.availability";

/** These round-level actions do not update the turn machine's lastError. */
export const ACTIONS_THAT_IGNORE_LAST_ERROR: ReadonlySet<GameAction["type"]> = new Set([
  "CALL_MAY_I", "ALLOW_MAY_I", "CLAIM_MAY_I", "REORDER_HAND",
]);

export type GameActionCommandError =
  | "ACTION_FAILED"
  | "CANNOT_CALL_MAY_I_ON_OWN_TURN"
  | "INVALID_PHASE"
  | "INVALID_PLAYER"
  | "MAY_I_UNAVAILABLE"
  | "MISSING_CARD_ID"
  | "MISSING_CARD_IDS"
  | "MISSING_CARD_OR_MELD_ID"
  | "MISSING_MELDS"
  | "MISSING_SWAP_PARAMS"
  | "NOT_MAY_I_RESPONDER"
  | "NOT_YOUR_TURN"
  | "UNKNOWN_ACTION";

export type GameActionCommandValidation =
  | { ok: true }
  | { ok: false; error: GameActionCommandError };

const ACTIONS_THAT_DONT_REQUIRE_TURN: ReadonlySet<GameAction["type"]> =
  new Set(["CALL_MAY_I", "ALLOW_MAY_I", "CLAIM_MAY_I", "REORDER_HAND"]);

export function validateGameActionCommand(
  snapshot: GameSnapshot,
  playerId: string,
  action: GameAction
): GameActionCommandValidation {
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return reject("INVALID_PLAYER");
  }

  const requiresPlayerTurn = !ACTIONS_THAT_DONT_REQUIRE_TURN.has(action.type);
  if (requiresPlayerTurn && snapshot.awaitingPlayerId !== playerId) {
    return reject("NOT_YOUR_TURN");
  }

  switch (action.type) {
    case "DRAW_FROM_STOCK":
      return snapshot.turnPhase === "AWAITING_DRAW"
        ? accept()
        : reject("INVALID_PHASE");

    case "DRAW_FROM_DISCARD":
      return snapshot.turnPhase === "AWAITING_DRAW"
        ? accept()
        : reject("INVALID_PHASE");

    case "DISCARD":
      if (
        snapshot.turnPhase !== "AWAITING_DISCARD" &&
        snapshot.turnPhase !== "AWAITING_ACTION"
      ) {
        return reject("INVALID_PHASE");
      }
      return action.cardId ? accept() : reject("MISSING_CARD_ID");

    case "SKIP":
      return snapshot.turnPhase === "AWAITING_ACTION"
        ? accept()
        : reject("INVALID_PHASE");

    case "LAY_DOWN":
      if (snapshot.turnPhase !== "AWAITING_ACTION") {
        return reject("INVALID_PHASE");
      }
      return action.melds && action.melds.length > 0
        ? accept()
        : reject("MISSING_MELDS");

    case "LAY_OFF":
      if (
        snapshot.turnPhase !== "AWAITING_ACTION" &&
        snapshot.turnPhase !== "AWAITING_DISCARD"
      ) {
        return reject("INVALID_PHASE");
      }
      return action.cardId && action.meldId
        ? accept()
        : reject("MISSING_CARD_OR_MELD_ID");

    case "SWAP_JOKER":
      if (
        snapshot.turnPhase !== "AWAITING_ACTION" &&
        snapshot.turnPhase !== "AWAITING_DISCARD"
      ) {
        return reject("INVALID_PHASE");
      }
      return action.meldId && action.jokerCardId && action.swapCardId
        ? accept()
        : reject("MISSING_SWAP_PARAMS");

    case "REORDER_HAND":
      if (snapshot.phase !== "ROUND_ACTIVE") {
        return reject("INVALID_PHASE");
      }
      return action.cardIds && action.cardIds.length > 0
        ? accept()
        : reject("MISSING_CARD_IDS");

    case "CALL_MAY_I": {
      if (snapshot.phase !== "ROUND_ACTIVE") {
        return reject("INVALID_PHASE");
      }
      if (snapshot.awaitingPlayerId === playerId) {
        return reject("CANNOT_CALL_MAY_I_ON_OWN_TURN");
      }
      const actions = getActionAvailabilityDetails(snapshot, playerId)
        .availableActions;
      return actions.canMayI ? accept() : reject("MAY_I_UNAVAILABLE");
    }

    case "ALLOW_MAY_I":
    case "CLAIM_MAY_I":
      if (snapshot.phase !== "RESOLVING_MAY_I") {
        return reject("INVALID_PHASE");
      }
      return snapshot.mayIContext?.playerBeingPrompted === playerId
        ? accept()
        : reject("NOT_MAY_I_RESPONDER");

    default:
      return reject("UNKNOWN_ACTION");
  }
}

function accept(): GameActionCommandValidation {
  return { ok: true };
}

function reject(error: GameActionCommandError): GameActionCommandValidation {
  return { ok: false, error };
}
