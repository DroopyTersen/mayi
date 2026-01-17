import { describe, it, expect } from "bun:test";

import { executeAITurn, isAIPlayerTurn } from "./ai-turn-handler";
import { PartyGameAdapter } from "./party-game-adapter";
import { convertAgentTestStateToStoredState } from "./agent-state.converter";
import type { AgentTestState } from "./agent-state.types";
import { createTestCard, createTestHand } from "../../core/engine/test.fixtures";

function createAdapterFromState(state: AgentTestState): PartyGameAdapter {
  const stored = convertAgentTestStateToStoredState(state, "test-room");
  return PartyGameAdapter.fromStoredState(stored);
}

function createAIOnlyState(): AgentTestState {
  return {
    players: [
      {
        id: "ai-0",
        name: "AI-0",
        isAI: true,
        aiModelId: "default:grok",
        hand: createTestHand([
          { rank: "3", suit: "hearts" },
          { rank: "4", suit: "hearts" },
          { rank: "5", suit: "hearts" },
          { rank: "6", suit: "hearts" },
          { rank: "7", suit: "hearts" },
          { rank: "8", suit: "hearts" },
          { rank: "9", suit: "hearts" },
          { rank: "10", suit: "hearts" },
          { rank: "J", suit: "hearts" },
          { rank: "Q", suit: "hearts" },
          { rank: "K", suit: "hearts" },
        ]),
        isDown: false,
      },
      {
        id: "ai-1",
        name: "AI-1",
        isAI: true,
        aiModelId: "default:grok",
        hand: createTestHand([
          { rank: "3", suit: "spades" },
          { rank: "4", suit: "spades" },
          { rank: "5", suit: "spades" },
          { rank: "6", suit: "spades" },
          { rank: "7", suit: "spades" },
          { rank: "8", suit: "spades" },
          { rank: "9", suit: "spades" },
          { rank: "10", suit: "spades" },
          { rank: "J", suit: "spades" },
          { rank: "Q", suit: "spades" },
          { rank: "K", suit: "spades" },
        ]),
        isDown: false,
      },
      {
        id: "ai-2",
        name: "AI-2",
        isAI: true,
        aiModelId: "default:grok",
        hand: createTestHand([
          { rank: "3", suit: "clubs" },
          { rank: "4", suit: "clubs" },
          { rank: "5", suit: "clubs" },
          { rank: "6", suit: "clubs" },
          { rank: "7", suit: "clubs" },
          { rank: "8", suit: "clubs" },
          { rank: "9", suit: "clubs" },
          { rank: "10", suit: "clubs" },
          { rank: "J", suit: "clubs" },
          { rank: "Q", suit: "clubs" },
          { rank: "K", suit: "clubs" },
        ]),
        isDown: false,
      },
    ],
    roundNumber: 1,
    stock: [createTestCard("A", "spades", "stock-1")],
    discard: [createTestCard("2", "clubs", "discard-1")],
    table: [],
    turn: {
      currentPlayerIndex: 0,
      hasDrawn: false,
      phase: "awaitingDraw",
    },
  };
}

describe("executeAITurn", () => {
  it("returns early when it is not the AI's turn", async () => {
    const adapter = createAdapterFromState(createAIOnlyState());

    const result = await executeAITurn({
      adapter,
      aiPlayerId: "ai-1",
      modelId: "default:grok",
      env: {},
    });

    expect(result.success).toBe(false);
    expect(result.usedFallback).toBe(false);
    expect(result.error).toContain("Not this player's turn");
  });
});

describe("isAIPlayerTurn", () => {
  it("returns AI mapping when AI is up", () => {
    const adapter = createAdapterFromState(createAIOnlyState());
    const mapping = isAIPlayerTurn(adapter);

    expect(mapping?.lobbyId).toBe("ai-0");
  });

  it("returns null when a human is up", () => {
    const state = createAIOnlyState();
    const originalPlayer = state.players[0]!;
    state.players[0] = {
      id: "human-0",
      name: "Human",
      isAI: false,
      hand: originalPlayer.hand,
      isDown: false,
    };

    const adapter = createAdapterFromState(state);
    const mapping = isAIPlayerTurn(adapter);

    expect(mapping).toBeNull();
  });
});
