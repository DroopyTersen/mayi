import { describe, expect, it } from "bun:test";
import type { Card } from "core/card/card.types";
import type { AvailableActions } from "core/engine/game-engine.availability";
import type { PlayerView } from "core/engine/game-engine.types";
import { getVisibleMayIPrompt } from "./may-i-prompt.state";

const claimedCard: Card = {
  id: "discard-4-D",
  rank: "4",
  suit: "diamonds",
};

const baseAvailableActions: AvailableActions = {
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
};

function createPromptedPlayerView(
  availableActions: AvailableActions = {
    ...baseAvailableActions,
    canAllowMayI: true,
    canClaimMayI: true,
  }
): PlayerView {
  return {
    gameId: "room-1",
    viewingPlayerId: "player-2",
    yourName: "Robin",
    yourHand: [],
    isYourTurn: true,
    youAreDown: false,
    yourTotalScore: 31,
    opponents: [
      {
        id: "player-0",
        name: "Curt",
        handCount: 11,
        isDown: false,
        totalScore: 34,
        isDealer: false,
        isCurrentPlayer: false,
      },
      {
        id: "player-1",
        name: "Kate",
        handCount: 2,
        isDown: true,
        totalScore: 14,
        isDealer: true,
        isCurrentPlayer: false,
      },
    ],
    currentRound: 4,
    contract: { roundNumber: 4, sets: 3, runs: 0 },
    phase: "RESOLVING_MAY_I",
    turnPhase: "AWAITING_DRAW",
    turnNumber: 1,
    awaitingPlayerId: "player-2",
    stockCount: 4,
    topDiscard: claimedCard,
    discardCount: 1,
    table: [],
    roundHistory: [],
    mayIContext: {
      originalCaller: "player-0",
      cardBeingClaimed: claimedCard,
      playersToCheck: ["player-2"],
      currentPromptIndex: 0,
      playerBeingPrompted: "player-2",
      playersWhoAllowed: [],
      winner: null,
      outcome: null,
    },
    availableActions,
    actionStates: [],
    unavailabilityHints: [],
    turnOrder: ["player-0", "player-1", "player-2"],
  };
}

describe("getVisibleMayIPrompt", () => {
  it("reconstructs the May-I prompt from durable PlayerView state after refresh", () => {
    expect(
      getVisibleMayIPrompt({
        explicitPrompt: null,
        gameState: createPromptedPlayerView(),
      })
    ).toEqual({
      callerId: "player-0",
      callerName: "Curt",
      card: claimedCard,
    });
  });

  it("prefers the transient WebSocket prompt when it is present", () => {
    expect(
      getVisibleMayIPrompt({
        explicitPrompt: {
          callerId: "curt",
          callerName: "Curt",
          card: claimedCard,
        },
        gameState: createPromptedPlayerView(),
      })
    ).toEqual({
      callerId: "curt",
      callerName: "Curt",
      card: claimedCard,
    });
  });

  it("does not show a prompt when this player is not allowed to respond", () => {
    expect(
      getVisibleMayIPrompt({
        explicitPrompt: null,
        gameState: createPromptedPlayerView(baseAvailableActions),
      })
    ).toBeNull();
  });
});
