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

  it("retains the entire supplied current-round public history in order", () => {
    const output = outputGameStateForLLM(
      createSnapshot(),
      "p1",
      {
        actionLog: [
          ...Array.from({ length: 60 }, (_, index) => ({
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
    expect(output).toContain("action-59");
    expect(output).toContain("action-0");
    expect(output.indexOf("action-0")).toBeLessThan(output.indexOf("action-59"));
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

  it("previews a known Joker swap before the draw without presenting it as currently callable", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        turnPhase: "AWAITING_DRAW",
        hasDrawn: false,
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
            card("run-4h", "4", "hearts"),
            card("run-5h", "5", "hearts"),
            card("run-joker", "Joker", null),
            card("run-7h", "7", "hearts"),
          ],
        }],
      }),
      "p1",
    );

    expect(output).toContain("PLANNED TACTICAL OPPORTUNITIES");
    expect(output).toContain(
      "After drawing, you can swap meld 1, Joker position 3, with hand position 1 (6♥)",
    );
    expect(output).not.toContain("CALL swap_joker before drawing");
    expect(output).not.toContain("K♠");
  });

  it("renders one engine-valid exact contract candidate with current positions", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        currentRound: 2,
        contract: { roundNumber: 2, sets: 1, runs: 1 },
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: [
              card("9c", "9", "clubs"),
              card("9d", "9", "diamonds"),
              card("8s", "8", "spades"),
              card("9s", "9", "spades"),
              card("10s", "10", "spades"),
              card("kc", "K", "clubs"),
              card("9h", "9", "hearts"),
              card("joker", "Joker", null),
            ],
            isDown: false,
            totalScore: 12,
          },
          createSnapshot().players[1]!,
        ],
      }),
      "p1",
    );

    expect(output).toContain("EXACT CONTRACT AVAILABLE");
    expect(output).toContain("CALL lay_down with melds [[1,2,7],[3,4,5,8]]");
    expect(output).toContain("leaves 1 card: K♣");
  });

  it("renders an exact dynamic-position layoff sequence that leaves one discard", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: [
              card("3s", "3", "spades"),
              card("4s", "4", "spades"),
              card("joker", "Joker", null),
              card("kc", "K", "clubs"),
              card("9s", "9", "spades"),
            ],
            isDown: true,
            totalScore: 12,
          },
          createSnapshot().players[1]!,
        ],
        table: [{
          id: "spade-run",
          ownerId: "p2",
          type: "run",
          cards: [
            card("5s", "5", "spades"),
            card("6s", "6", "spades"),
            card("7s", "7", "spades"),
            card("8s", "8", "spades"),
          ],
        }],
      }),
      "p1",
    );

    expect(output).toContain("ALL-CARDS-OUT LAYOFF SEQUENCE");
    expect(output).toContain(
      "1. CALL lay_off with cardPosition 2, meldNumber 1, position start (4♠)",
    );
    expect(output).toContain(
      "2. CALL lay_off with cardPosition 1, meldNumber 1, position start (3♠)",
    );
    expect(output).toContain(
      "3. CALL lay_off with cardPosition 3, meldNumber 1, position end (9♠)",
    );
    expect(output).toContain(
      "4. CALL lay_off with cardPosition 1, meldNumber 1, position end (Joker)",
    );
    expect(output).toContain("Then discard the only remaining card, K♣");
  });

  it("protects public layoffs left outside an exact contract without weakening it", () => {
    const output = outputGameStateForLLM(
      createSnapshot({
        currentRound: 2,
        contract: { roundNumber: 2, sets: 1, runs: 1 },
        turnPhase: "AWAITING_ACTION",
        hasDrawn: true,
        players: [
          {
            id: "p1",
            name: "Alice",
            hand: [
              card("9c", "9", "clubs"),
              card("9d", "9", "diamonds"),
              card("9h", "9", "hearts"),
              card("4s", "4", "spades"),
              card("5s", "5", "spades"),
              card("6s", "6", "spades"),
              card("7s", "7", "spades"),
              card("kc", "K", "clubs"),
              card("3h", "3", "hearts"),
              card("qh", "Q", "hearts"),
            ],
            isDown: false,
            totalScore: 12,
          },
          createSnapshot().players[1]!,
        ],
        table: [
          {
            id: "kings",
            ownerId: "p2",
            type: "set",
            cards: [
              card("kh", "K", "hearts"),
              card("kd", "K", "diamonds"),
              card("ks", "K", "spades"),
            ],
          },
          {
            id: "threes",
            ownerId: "p2",
            type: "set",
            cards: [
              card("3s-table", "3", "spades"),
              card("3d", "3", "diamonds"),
              card("3c", "3", "clubs"),
            ],
          },
        ],
      }),
      "p1",
    );

    expect(output).toContain("PROTECT FOR FUTURE LAYOFFS");
    expect(output).toContain("K♣ → meld 1");
    expect(output).toContain("3♥ → meld 2");
    expect(output).toContain(
      "These cards are outside the exact contract above, so keeping them does not weaken lay_down",
    );
    expect(output).toContain("Discard Q♥ instead");
  });

});
