import type { AvailableActions } from "core/engine/game-engine.availability";

/**
 * Determines the interactive label for the discard pile based on available actions.
 */
export function getDiscardInteractiveLabel(
  availableActions: AvailableActions
): "pickup" | "may-i" | undefined {
  if (availableActions.canDrawFromDiscard) {
    return "pickup";
  }
  if (availableActions.canMayI) {
    return "may-i";
  }
  return undefined;
}

/**
 * Gets the turn phase text to display to the player.
 */
export function getTurnPhaseText(
  isYourTurn: boolean,
  turnPhase: string | undefined,
  awaitingPlayerName: string | undefined
): string {
  if (isYourTurn) {
    if (turnPhase === "AWAITING_DRAW") {
      return "Your turn - Draw a card";
    }
    if (turnPhase === "AWAITING_DISCARD") {
      return "Your turn - Discard a card";
    }
    return "Your turn";
  }
  return `Waiting for ${awaitingPlayerName ?? "other player"}`;
}
