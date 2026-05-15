import { describe, expect, it } from "bun:test";
import {
  createMayIMobileReproPlayerView,
  parseMayIMobileReproSurface,
} from "./debug-mayi-mobile-repro.state";

describe("parseMayIMobileReproSurface", () => {
  it("defaults to drawer mode", () => {
    expect(parseMayIMobileReproSurface(null)).toBe("drawer");
    expect(parseMayIMobileReproSurface("unknown")).toBe("drawer");
  });

  it("accepts dialog and stacked modes", () => {
    expect(parseMayIMobileReproSurface("dialog")).toBe("dialog");
    expect(parseMayIMobileReproSurface("stacked")).toBe("stacked");
  });
});

describe("createMayIMobileReproPlayerView", () => {
  it("creates the Robin May-I prompt state from the reported hand", () => {
    const view = createMayIMobileReproPlayerView("prompt");

    expect(view.yourName).toBe("Robin");
    expect(view.currentRound).toBe(4);
    expect(view.contract).toEqual({ roundNumber: 4, sets: 3, runs: 0 });
    expect(view.phase).toBe("RESOLVING_MAY_I");
    expect(view.turnPhase).toBe("AWAITING_DRAW");
    expect(view.availableActions.canAllowMayI).toBe(true);
    expect(view.availableActions.canClaimMayI).toBe(true);
    expect(view.mayIContext?.cardBeingClaimed).toEqual({
      id: "discard-4-D",
      rank: "4",
      suit: "diamonds",
    });
    expect(view.opponents.map((opponent) => opponent.name)).toEqual([
      "Curt",
      "Kate",
    ]);
  });

  it("shows stock draw but not discard draw after allowing Curt's May-I", () => {
    const view = createMayIMobileReproPlayerView("allowed");

    expect(view.phase).toBe("ROUND_ACTIVE");
    expect(view.availableActions.canDrawFromStock).toBe(true);
    expect(view.availableActions.canDrawFromDiscard).toBe(false);
    expect(view.mayIContext).toBeNull();
  });

  it("shows Robin has drawn the discard after claiming it", () => {
    const view = createMayIMobileReproPlayerView("claimed");

    expect(view.phase).toBe("ROUND_ACTIVE");
    expect(view.turnPhase).toBe("AWAITING_ACTION");
    expect(view.yourHand.map((card) => card.id)).toContain("discard-4-D");
    expect(view.availableActions.canAllowMayI).toBe(false);
    expect(view.availableActions.canClaimMayI).toBe(false);
  });
});
