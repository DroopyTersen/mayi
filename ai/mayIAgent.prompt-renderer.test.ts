import { describe, expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";

function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

function createSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    version: "3.0",
    gameId: "ai-prompt-renderer-test",
    lastError: null,
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_DRAW",
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [
      {
        id: "p1",
        name: "Alice",
        hand: [card("a-7h", "7", "hearts"), card("a-8h", "8", "hearts")],
        isDown: false,
        totalScore: 12,
      },
      {
        id: "p2",
        name: "Bob",
        hand: [card("b-ks", "K", "spades"), card("b-kc", "K", "clubs")],
        isDown: false,
        totalScore: 50,
      },
    ],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    awaitingPlayerId: "p1",
    stock: [card("stock-1", "A", "clubs")],
    discard: [card("discard-q", "Q", "diamonds")],
    table: [],
    hasDrawn: false,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AI prompt renderer", () => {
  it("shows the viewing player hand but keeps opponent cards private", () => {
    const output = outputGameStateForLLM(createSnapshot(), "p1");

    expect(output).toContain("1:7");
    expect(output).toContain("2:8");
    expect(output).toContain("Bob: 2 cards");
    expect(output).not.toContain("K♠");
    expect(output).not.toContain("(50 pts)");
  });

  it("renders numbered table melds with owner names", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        table: [
          {
            id: "meld-1",
            ownerId: "p1",
            type: "set",
            cards: [
              card("m-7h", "7", "hearts"),
              card("m-7d", "7", "diamonds"),
              card("m-7c", "7", "clubs"),
            ],
          },
        ],
      }),
      "p1"
    );

    expect(output).toContain("[1] Alice");
    expect(output).toContain("Set:");
  });

  it("renders May-I prompt text and response actions", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        phase: "RESOLVING_MAY_I",
        awaitingPlayerId: "p1",
        mayIContext: {
          originalCaller: "p2",
          cardBeingClaimed: card("discard-q", "Q", "diamonds"),
          playersToCheck: ["p1"],
          currentPromptIndex: 0,
          playerBeingPrompted: "p1",
          playersWhoAllowed: [],
          winner: null,
          outcome: null,
        },
      }),
      "p1"
    );

    expect(output).toContain("MAY I?");
    expect(output).toContain("Caller: Bob");
    expect(output).toContain("allow_may_i");
    expect(output).toContain("claim_may_i");
  });

  it("renders available action text for an active turn", () => {
    const output = outputGameStateForLLM(
      createSnapshot({ turnPhase: "AWAITING_ACTION" }),
      "p1"
    );

    expect(output).toContain("AVAILABLE ACTIONS");
    expect(output).toContain("lay_down");
    expect(output).toContain("swap_joker");
    expect(output).toContain("discard");
  });
});
