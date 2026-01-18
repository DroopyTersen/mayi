import { describe, it, expect } from "bun:test";
import type { PlayerView } from "./game-engine.types";
import { getInactivityHintMessage } from "./game-engine.inactivity";

function createTestView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    gameId: "game-1",
    viewingPlayerId: "player-1",
    yourName: "Test Player",
    yourHand: [],
    isYourTurn: true,
    youAreDown: false,
    yourTotalScore: 0,
    opponents: [],
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_ACTION",
    turnNumber: 1,
    awaitingPlayerId: "player-1",
    stockCount: 30,
    topDiscard: null,
    discardCount: 0,
    table: [],
    roundHistory: [],
    mayIContext: null,
    availableActions: {
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
      hasPendingMayIRequest: false,
      shouldNudgeDiscard: false,
    },
    actionStates: [],
    unavailabilityHints: [],
    turnOrder: ["player-1"],
    ...overrides,
  };
}

describe("getInactivityHintMessage", () => {
  it("returns null when it's not your turn", () => {
    const view = createTestView({ isYourTurn: false });

    expect(getInactivityHintMessage(view)).toBeNull();
  });

  it("returns draw prompt during AWAITING_DRAW", () => {
    const view = createTestView({ turnPhase: "AWAITING_DRAW" });

    expect(getInactivityHintMessage(view)).toBe("Draw a card to start your turn.");
  });

  it("returns lay down prompt when awaiting action and not down", () => {
    const view = createTestView({
      turnPhase: "AWAITING_ACTION",
      youAreDown: false,
    });

    expect(getInactivityHintMessage(view)).toBe("Lay down or discard.");
  });

  it("returns layoff prompt when down and layoff is available", () => {
    const view = createTestView({
      turnPhase: "AWAITING_ACTION",
      youAreDown: true,
      availableActions: {
        ...createTestView().availableActions,
        canLayOff: true,
      },
    });

    expect(getInactivityHintMessage(view)).toBe("Please layoff or discard.");
  });

  it("returns discard prompt when awaiting discard", () => {
    const view = createTestView({ turnPhase: "AWAITING_DISCARD" });

    expect(getInactivityHintMessage(view)).toBe("Discard to end your turn.");
  });
});
