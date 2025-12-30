/**
 * LLM-based tests for May I? AI Agent
 *
 * These tests verify that LLMs make appropriate tool calls
 * given various game scenarios. They require API keys and
 * make real LLM calls, so they're slow and should be run selectively.
 *
 * Run specific scenarios:
 *   bun test ai/mayIAgent.llm.test.ts --test-name-pattern "AWAITING_DRAW"
 *   bun test ai/mayIAgent.llm.test.ts --test-name-pattern "Multi-Model"
 *
 * Run multi-model tests in parallel (faster):
 *   bun test ai/mayIAgent.llm.test.ts --test-name-pattern "Multi-Model" --concurrent
 */

import { describe, it, expect, test } from "bun:test";
import { executeTurn, executeAITurn } from "./mayIAgent";
import { AIPlayerRegistry } from "./aiPlayer.registry";
import { modelRegistry } from "./modelRegistry";
import { Orchestrator, type SerializableGameState } from "../cli/harness/orchestrator";
import type { Card, Rank, Suit } from "../core/card/card.types";
import type { RoundNumber } from "../core/engine/engine.types";
import type { DecisionPhase, MayIContext } from "../cli/shared/cli.types";

// ============================================================================
// Test Helpers
// ============================================================================

function card(rank: Rank, suit: Suit): Card {
  return {
    id: `${rank}-${suit}-${Math.random().toString(36).slice(2, 6)}`,
    rank,
    suit,
  };
}

function createTestState(config: {
  phase: DecisionPhase;
  currentRound?: RoundNumber;
  awaitingPlayerId: string;
  currentPlayerIndex?: number;
  players: Array<{
    id: string;
    name: string;
    hand: Card[];
    isDown?: boolean;
    totalScore?: number;
  }>;
  discard?: Card[];
  stock?: Card[];
  table?: SerializableGameState["table"];
  mayIContext?: MayIContext | null;
}): SerializableGameState {
  const {
    phase,
    currentRound = 1,
    awaitingPlayerId,
    currentPlayerIndex = 0,
    players,
    discard = [card("5", "hearts")],
    stock = Array.from({ length: 50 }, () => card("A", "spades")),
    table = [],
    mayIContext = null,
  } = config;

  return {
    version: "2.0",
    gameId: "test-game",
    phase: phase === "MAY_I_WINDOW" ? "MAY_I_WINDOW" : "ROUND_ACTIVE",
    harnessPhase: phase,
    turnNumber: 1,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      hand: p.hand,
      isDown: p.isDown ?? false,
      totalScore: p.totalScore ?? 0,
    })),
    currentRound,
    dealerIndex: 0,
    currentPlayerIndex,
    stock,
    discard,
    table,
    roundHistory: [],
    awaitingPlayerId,
    mayIContext,
    hasDrawn: phase !== "AWAITING_DRAW",
    laidDownThisTurn: false,
    lastDiscardedByPlayerId: null,
  };
}

/**
 * Tracking wrapper for Orchestrator that records method calls
 */
class TrackedOrchestrator extends Orchestrator {
  public calls: Array<{ method: string; args: unknown[] }> = [];

  override drawFromStock() {
    this.calls.push({ method: "drawFromStock", args: [] });
    return super.drawFromStock();
  }

  override drawFromDiscard() {
    this.calls.push({ method: "drawFromDiscard", args: [] });
    return super.drawFromDiscard();
  }

  override layDown(meldGroups: number[][]) {
    this.calls.push({ method: "layDown", args: [meldGroups] });
    return super.layDown(meldGroups);
  }

  override skip() {
    this.calls.push({ method: "skip", args: [] });
    return super.skip();
  }

  override discardCard(position: number) {
    this.calls.push({ method: "discardCard", args: [position] });
    return super.discardCard(position);
  }

  override layOff(cardPos: number, meldNum: number) {
    this.calls.push({ method: "layOff", args: [cardPos, meldNum] });
    return super.layOff(cardPos, meldNum);
  }

  override callMayI() {
    this.calls.push({ method: "callMayI", args: [] });
    return super.callMayI();
  }

  override pass() {
    this.calls.push({ method: "pass", args: [] });
    return super.pass();
  }

  override swap(meldNum: number, jokerPos: number, cardPos: number) {
    this.calls.push({ method: "swap", args: [meldNum, jokerPos, cardPos] });
    return super.swap(meldNum, jokerPos, cardPos);
  }

  static fromTestState(state: SerializableGameState): TrackedOrchestrator {
    const orchestrator = new TrackedOrchestrator();
    // @ts-expect-error - accessing private method for testing
    orchestrator.restoreFromState(state);
    return orchestrator;
  }
}

// ============================================================================
// Error Handling Tests (fast, no LLM calls needed)
// ============================================================================

describe("AI Agent Error Handling", () => {
  it("should return error when not this player's turn", async () => {
    const state = createTestState({
      phase: "AWAITING_DRAW",
      awaitingPlayerId: "player-0", // Not player-1
      currentPlayerIndex: 0,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand: Array.from({ length: 11 }, () => card("4", "clubs")) },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({
      model,
      orchestrator,
      playerId: "player-1", // Trying to act when it's not their turn
      debug: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Not this player's turn");
    expect(orchestrator.calls.length).toBe(0);
  });
});

// ============================================================================
// Phase-Specific Scenario Tests
// ============================================================================

describe("AWAITING_DRAW phase", () => {
  it("should draw when it's the AI's turn", async () => {
    const state = createTestState({
      phase: "AWAITING_DRAW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand: Array.from({ length: 11 }, () => card("4", "clubs")) },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({
      model,
      orchestrator,
      playerId: "player-1",
      debug: false,
    });

    expect(result.success).toBe(true);
    const drawCalls = orchestrator.calls.filter(
      (c) => c.method === "drawFromStock" || c.method === "drawFromDiscard"
    );
    expect(drawCalls.length).toBeGreaterThan(0);
  }, 30000);
});

describe("AWAITING_ACTION phase", () => {
  it("should skip when hand has no valid melds", async () => {
    const hand = [
      card("3", "hearts"), card("5", "diamonds"), card("7", "clubs"),
      card("9", "spades"), card("J", "hearts"), card("K", "diamonds"),
      card("2", "clubs"), card("4", "spades"), card("6", "hearts"),
      card("8", "diamonds"), card("10", "clubs"), card("Q", "spades"),
    ];

    const state = createTestState({
      phase: "AWAITING_ACTION",
      currentRound: 1,
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({ model, orchestrator, playerId: "player-1", debug: false });

    expect(result.success).toBe(true);
    expect(orchestrator.calls.some((c) => c.method === "skip")).toBe(true);
  }, 30000);

  it("should lay down when hand has valid contract melds", async () => {
    const hand = [
      card("7", "hearts"), card("7", "diamonds"), card("7", "clubs"),
      card("9", "hearts"), card("9", "diamonds"), card("9", "clubs"),
      card("K", "spades"), card("2", "hearts"), card("4", "diamonds"),
      card("6", "clubs"), card("8", "spades"), card("J", "hearts"),
    ];

    const state = createTestState({
      phase: "AWAITING_ACTION",
      currentRound: 1,
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({ model, orchestrator, playerId: "player-1", debug: false });

    expect(result.success).toBe(true);
    expect(orchestrator.calls.some((c) => c.method === "layDown")).toBe(true);
  }, 30000);
});

describe("AWAITING_DISCARD phase", () => {
  it("should discard a card", async () => {
    const hand = [
      card("3", "hearts"), card("5", "diamonds"), card("7", "clubs"),
      card("9", "spades"), card("J", "hearts"), card("K", "diamonds"),
    ];

    const state = createTestState({
      phase: "AWAITING_DISCARD",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand, isDown: true },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({ model, orchestrator, playerId: "player-1", debug: false });

    expect(result.success).toBe(true);
    const discardCalls = orchestrator.calls.filter((c) => c.method === "discardCard");
    expect(discardCalls.length).toBe(1);
    const position = discardCalls[0]!.args[0] as number;
    expect(position).toBeGreaterThanOrEqual(1);
    expect(position).toBeLessThanOrEqual(6);
  }, 30000);
});

describe("MAY_I_WINDOW phase", () => {
  it("should pass when discard doesn't help", async () => {
    const hand = [
      card("3", "hearts"), card("5", "diamonds"), card("7", "clubs"),
      card("9", "spades"), card("J", "hearts"), card("K", "diamonds"),
      card("2", "clubs"), card("4", "spades"), card("6", "hearts"),
      card("8", "diamonds"), card("10", "clubs"),
    ];

    const state = createTestState({
      phase: "MAY_I_WINDOW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 2,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
      discard: [card("A", "spades")],
      mayIContext: {
        discardedCard: card("A", "spades"),
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        awaitingResponseFrom: ["player-1"],
        claimants: [],
        currentPlayerPassed: true,
      },
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({ model, orchestrator, playerId: "player-1", debug: false });

    expect(result.success).toBe(true);
    expect(orchestrator.calls.some((c) => c.method === "pass")).toBe(true);
  }, 30000);

  it("should call May I when discard completes a set", async () => {
    const hand = [
      card("7", "hearts"), card("7", "diamonds"),
      card("9", "hearts"), card("9", "diamonds"), card("9", "clubs"),
      card("K", "spades"), card("2", "hearts"), card("4", "diamonds"),
      card("6", "clubs"), card("8", "spades"), card("J", "hearts"),
    ];
    const sevenOfClubs = card("7", "clubs");

    const state = createTestState({
      phase: "MAY_I_WINDOW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 2,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
      discard: [sevenOfClubs],
      mayIContext: {
        discardedCard: sevenOfClubs,
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        awaitingResponseFrom: ["player-1"],
        claimants: [],
        currentPlayerPassed: true,
      },
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);
    const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");

    const result = await executeTurn({ model, orchestrator, playerId: "player-1", debug: false });

    expect(result.success).toBe(true);
    expect(orchestrator.calls.some((c) => c.method === "callMayI")).toBe(true);
  }, 30000);
});

// ============================================================================
// Multi-Model Compatibility Tests
// ============================================================================

describe("Multi-Model Compatibility", () => {
  const models = [
    { name: "OpenAI GPT-5 Mini", id: "openai:gpt-5-mini" },
    { name: "Anthropic Claude Haiku 4.5", id: "anthropic:claude-haiku-4-5" },
    { name: "Google Gemini 3 Flash", id: "gemini:gemini-3-flash-preview" },
    { name: "xAI Grok 4.1 Fast", id: "xai:grok-4-1-fast-reasoning" },
  ] as const;

  const createDrawScenario = () =>
    createTestState({
      phase: "AWAITING_DRAW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "AI Bot", hand: Array.from({ length: 11 }, () => card("4", "clubs")) },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

  for (const { name, id } of models) {
    test.concurrent(`${name} should draw from stock`, async () => {
      const state = createDrawScenario();
      const orchestrator = TrackedOrchestrator.fromTestState(state);
      const model = modelRegistry.languageModel(id);

      const result = await executeTurn({
        model,
        orchestrator,
        playerId: "player-1",
        debug: false,
      });

      expect(result.success).toBe(true);
      const drawCalls = orchestrator.calls.filter(
        (c) => c.method === "drawFromStock" || c.method === "drawFromDiscard"
      );
      expect(drawCalls.length).toBeGreaterThan(0);
    }, 60000);
  }
});

// ============================================================================
// executeAITurn Integration Tests
// ============================================================================

describe("executeAITurn with Registry", () => {
  it("should execute turn for registered AI player", async () => {
    const registry = new AIPlayerRegistry();
    registry.register("player-1", { name: "GPT 5 Mini", modelId: "openai:gpt-5-mini" });

    const state = createTestState({
      phase: "AWAITING_DRAW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "GPT 5 Mini", hand: Array.from({ length: 11 }, () => card("4", "clubs")) },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);

    const result = await executeAITurn({
      orchestrator,
      playerId: "player-1",
      registry,
      debug: false,
    });

    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  }, 30000);

  it("should fail for non-registered player", async () => {
    const registry = new AIPlayerRegistry();
    // player-1 is NOT registered

    const state = createTestState({
      phase: "AWAITING_DRAW",
      awaitingPlayerId: "player-1",
      currentPlayerIndex: 1,
      players: [
        { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")) },
        { id: "player-1", name: "Unknown", hand: Array.from({ length: 11 }, () => card("4", "clubs")) },
        { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")) },
      ],
    });

    const orchestrator = TrackedOrchestrator.fromTestState(state);

    const result = await executeAITurn({
      orchestrator,
      playerId: "player-1",
      registry,
      debug: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not registered as an AI player");
  });
});
