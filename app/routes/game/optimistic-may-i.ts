import type { PlayerView } from "core/engine/game-engine.types";

export function applyOptimisticMayIPending(
  view: PlayerView,
  isPending: boolean
): PlayerView {
  if (!isPending || view.availableActions.hasPendingMayIRequest) {
    return view;
  }

  return {
    ...view,
    availableActions: {
      ...view.availableActions,
      canMayI: false,
      hasPendingMayIRequest: true,
    },
    actionStates: view.actionStates.map((state) =>
      state.id === "mayI" ? { ...state, status: "hidden" } : state
    ),
  };
}
