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
    expect(output).toContain("Alice (you): 2 cards (12 pts)");
    expect(output).toContain("Bob: 2 cards (50 pts)");
    expect(output).not.toContain("Bob's hand");
  });

  it("renders only a bounded current-round public action history", () => {
    const output = outputGameStateForLLM(
      createSnapshot(),
      "p1",
      {
        actionLog: [
          ...Array.from({ length: 12 }, (_, index) => ({
            roundNumber: 1,
            playerId: index % 2 === 0 ? "p1" : "p2",
            playerName: index % 2 === 0 ? "Alice" : "Bob",
            action: `action-${index}`,
          })),
          {
            roundNumber: 2,
            playerId: "p2",
            playerName: "Bob",
            action: "future-round-private-context",
          },
        ],
      }
    );

    expect(output).toContain("RECENT ACTIONS:");
    expect(output).toContain("action-11");
    expect(output).not.toContain("action-0");
    expect(output).not.toContain("future-round-private-context");
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
    expect(output).not.toContain("swap_joker");
    expect(output).toContain("discard");
  });

  it("reminds Hand 6 players to test the full all-card contract before discarding", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        currentRound: 6,
        contract: { roundNumber: 6, sets: 1, runs: 2 },
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: Array.from({ length: 12 }, (_, index) =>
              card(`card-${index}`, "9", "clubs"),
            ),
            isDown: false,
            totalScore: 12,
          },
          createSnapshot().players[1]!,
        ],
      }),
      "p1",
    );

    expect(output).toContain(
      "HAND 6 CHECK: Before discarding, partition all 12 numbered cards into exactly 1 set and 2 runs",
    );
    expect(output).toContain("Use every card exactly once");
    expect(output).toContain("Melds may exceed their minimum size");
  });

  it("renders exact legal Joker swap positions from public table state and the AI hand", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: [card("a-6h", "6", "hearts"), card("a-9c", "9", "clubs")],
            isDown: false,
            totalScore: 12,
          },
          {
            id: "p2",
            name: "Bob",
            hand: [card("private-k", "K", "spades")],
            isDown: false,
            totalScore: 50,
          },
        ],
        table: [{
          id: "joker-run",
          ownerId: "p2",
          type: "run",
          cards: [
            card("run-3h", "3", "hearts"),
            card("run-4h", "4", "hearts"),
            card("run-5h", "5", "hearts"),
            card("run-joker", "Joker", null),
            card("run-7h", "7", "hearts"),
          ],
        }],
      }),
      "p1",
    );

    expect(output).toContain("TACTICAL OPPORTUNITIES");
    expect(output).toContain(
      "CALL swap_joker before discarding: meld 1, Joker position 4, hand position 1 (6♥)",
    );
    expect(output).toContain(
      "The Joker enters your hand; immediately re-check lay_down",
    );
    expect(output).not.toContain("K♠");
  });

});
