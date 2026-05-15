import { describe, expect, it } from "bun:test";
import type { Card } from "../card/card.types";
import type { Player, RoundNumber } from "./engine.types";
import { projectGameSnapshotFromXState } from "./game-engine.projection";

function card(id: string, rank: Card["rank"] = "7"): Card {
  return { id, rank, suit: "hearts" };
}

function player(id: string, hand: Card[] = []): Player {
  return {
    id,
    name: id,
    hand,
    isDown: false,
    totalScore: 0,
  };
}

const players = [
  player("player-0", [card("p0-card")]),
  player("player-1", [card("p1-card")]),
  player("player-2", [card("p2-card")]),
];

function project(
  overrides: {
    gameValue?: unknown;
    roundValue?: unknown;
    turnValue?: unknown;
    roundContext?: Record<string, unknown>;
    turnContext?: Record<string, unknown>;
    gameContext?: Record<string, unknown>;
    warn?: (message?: unknown, ...optionalParams: unknown[]) => void;
  } = {}
) {
  const roundContext = {
    players,
    currentPlayerIndex: 1,
    dealerIndex: 0,
    stock: [card("stock-card")],
    discard: [card("discard-card")],
    table: [],
    roundNumber: 1 as RoundNumber,
    turnNumber: 3,
    lastDiscardedByPlayerId: "player-0",
    mayIResolution: null,
    discardClaimed: false,
    ...overrides.roundContext,
  };

  return projectGameSnapshotFromXState({
    actorSnapshot: {
      value: overrides.gameValue ?? "playing",
      context: {
        players: [player("stale-player")],
        currentRound: 1,
        dealerIndex: 2,
        lastError: null,
        roundHistory: [],
        ...overrides.gameContext,
      },
    },
    persistedSnapshot: {
      children: {
        round: {
          snapshot: {
            value: overrides.roundValue ?? "active",
            context: roundContext,
            children: {
              turn: {
                snapshot: {
                  value: overrides.turnValue ?? "awaitingDraw",
                  context: {
                    playerId: "player-1",
                    hasDrawn: false,
                    laidDownThisTurn: false,
                    tookActionThisTurn: false,
                    lastError: null,
                    ...overrides.turnContext,
                  },
                },
              },
            },
          },
        },
      },
    },
    gameId: "projection-test",
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z",
    warn: overrides.warn,
  });
}

describe("projectGameSnapshotFromXState", () => {
  it("projects round-owned cards and turn workflow flags", () => {
    const snapshot = project({
      turnValue: "drawn",
      turnContext: {
        hasDrawn: true,
        tookActionThisTurn: true,
        lastError: "invalid meld",
      },
    });

    expect(snapshot.phase).toBe("ROUND_ACTIVE");
    expect(snapshot.turnPhase).toBe("AWAITING_ACTION");
    expect(snapshot.players.map((item) => item.id)).toEqual([
      "player-0",
      "player-1",
      "player-2",
    ]);
    expect(snapshot.stock.map((item) => item.id)).toEqual(["stock-card"]);
    expect(snapshot.discard.map((item) => item.id)).toEqual(["discard-card"]);
    expect(snapshot.hasDrawn).toBe(true);
    expect(snapshot.tookActionThisTurn).toBe(true);
    expect(snapshot.lastError).toBe("invalid meld");
  });

  it("projects May-I resolution state from the round owner", () => {
    const claimedCard = card("claimed-card", "Q");
    const snapshot = project({
      roundValue: { active: { resolvingMayI: "prompting" } },
      roundContext: {
        mayIResolution: {
          originalCaller: "player-2",
          cardBeingClaimed: claimedCard,
          playersToCheck: ["player-0"],
          currentPromptIndex: 0,
          playerBeingPrompted: "player-0",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      },
    });

    expect(snapshot.phase).toBe("RESOLVING_MAY_I");
    expect(snapshot.awaitingPlayerId).toBe("player-0");
    expect(snapshot.mayIContext?.originalCaller).toBe("player-2");
    expect(snapshot.mayIContext?.cardBeingClaimed).toEqual(claimedCard);
  });

  it("projects round-end and game-end top-level phases", () => {
    expect(project({ gameValue: "roundEnd" }).phase).toBe("ROUND_END");
    expect(project({ gameValue: "gameEnd" }).phase).toBe("GAME_END");
  });

  it("warns on card invariant violations without replacing lastError", () => {
    const warnings: unknown[][] = [];
    const duplicate = card("duplicate-card");
    const snapshot = project({
      roundContext: {
        players: [player("player-0", [duplicate]), player("player-1"), player("player-2")],
        discard: [duplicate],
      },
      warn: (message, ...optionalParams) => {
        warnings.push([message, ...optionalParams]);
      },
    });

    expect(warnings).toHaveLength(1);
    expect(snapshot.lastError).toBeNull();
  });
});
