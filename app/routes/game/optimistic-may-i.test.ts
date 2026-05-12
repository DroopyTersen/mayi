import { describe, expect, it } from "bun:test";
import type { PlayerView } from "core/engine/game-engine.types";
import { applyOptimisticMayIPending } from "./optimistic-may-i";

const baseView = {
  availableActions: {
    canDrawFromStock: false,
    canDrawFromDiscard: false,
    canLayDown: false,
    canLayOff: false,
    canSwapJoker: false,
    canDiscard: false,
    canMayI: true,
    canAllowMayI: false,
    canClaimMayI: false,
    canReorderHand: true,
    hasPendingMayIRequest: false,
    shouldNudgeDiscard: false,
  },
  actionStates: [
    { id: "mayI", label: "May I?", status: "available" },
    { id: "reorderHand", label: "Organize", status: "available" },
  ],
} as PlayerView;

describe("applyOptimisticMayIPending", () => {
  it("disables May I and shows pending while waiting for the server", () => {
    const result = applyOptimisticMayIPending(baseView, true);

    expect(result.availableActions.canMayI).toBe(false);
    expect(result.availableActions.hasPendingMayIRequest).toBe(true);
    expect(result.actionStates.find((state) => state.id === "mayI")?.status).toBe(
      "hidden"
    );
    expect(result.actionStates.find((state) => state.id === "reorderHand")?.status).toBe(
      "available"
    );
  });

  it("returns the original view when there is no optimistic pending request", () => {
    expect(applyOptimisticMayIPending(baseView, false)).toBe(baseView);
  });
});
