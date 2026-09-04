import type { GameSnapshot } from "../core/engine/game-engine.types";
import { getAvailableActions } from "../core/engine/game-engine.availability";

export type MayIToolName =
  | "draw_from_stock"
  | "draw_from_discard"
  | "organize_hand"
  | "lay_down"
  | "swap_joker"
  | "lay_off"
  | "discard"
  | "allow_may_i"
  | "claim_may_i";

/** Map the engine's canonical action availability to AI SDK tool names. */
export function getAvailableToolNames(
  snapshot: GameSnapshot,
  playerId: string,
): MayIToolName[] {
  if (snapshot.awaitingPlayerId !== playerId) return [];

  const actions = getAvailableActions(snapshot, playerId);
  return [
    actions.canDrawFromStock && "draw_from_stock",
    actions.canDrawFromDiscard && "draw_from_discard",
    snapshot.phase === "ROUND_ACTIVE" &&
      snapshot.turnPhase === "AWAITING_ACTION" &&
      "organize_hand",
    actions.canLayDown && "lay_down",
    actions.canSwapJoker && "swap_joker",
    actions.canLayOff && "lay_off",
    actions.canDiscard && "discard",
    actions.canAllowMayI && "allow_may_i",
    actions.canClaimMayI && "claim_may_i",
  ].filter((name): name is MayIToolName => Boolean(name));
}
