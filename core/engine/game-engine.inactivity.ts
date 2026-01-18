import type { PlayerView } from "./game-engine.types";

/**
 * Derive the inactivity hint message for a player's current view.
 * Returns null when no hint should be shown.
 */
export function getInactivityHintMessage(view: PlayerView): string | null {
  if (!view.isYourTurn || view.phase !== "ROUND_ACTIVE") {
    return null;
  }

  switch (view.turnPhase) {
    case "AWAITING_DRAW":
      return "Draw a card to start your turn.";
    case "AWAITING_DISCARD":
      return "Discard to end your turn.";
    case "AWAITING_ACTION": {
      if (!view.youAreDown) {
        return "Lay down or discard.";
      }
      if (view.availableActions.canLayOff) {
        return "Please layoff or discard.";
      }
      return "Discard to end your turn.";
    }
    default:
      return null;
  }
}
