/**
 * LLM-based tests for May I? AI Agent
 *
 * These tests verify tool selection against a real GameEngine state.
 * They require API keys and make real LLM calls, so they're slow.
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 bun test ai/mayIAgent.llm.test.ts
 */

import { describe, it, expect, afterEach } from "bun:test";
import * as fs from "node:fs";

import { executeTurn } from "./mayIAgent";
import { modelRegistry } from "./modelRegistry";
import { CliGameAdapter } from "../cli/shared/cli-game-adapter";
import { createCliAIActionRuntime } from "../cli/shared/cli-ai-action-runtime";
import type { GameAction } from "./ai-action-runtime.types";
import { DEFAULT_AI_MODEL_ID } from "../app/party/ai-models";

// Skip LLM tests by default - run with: RUN_INTEGRATION_TESTS=1 bun test ai/mayIAgent.llm.test.ts
const skipLLM = !process.env.RUN_INTEGRATION_TESTS;

function cleanupGame(gameId: string): void {
  const dir = `.data/${gameId}`;
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

class TrackedGame extends CliGameAdapter {
  public actions: GameAction[] = [];

  override executeGameAction(action: GameAction) {
    this.actions.push(action);
    return super.executeGameAction(action);
  }
}

describe("AI Agent Error Handling", () => {
  let gameId: string | null = null;

  afterEach(() => {
    if (gameId) cleanupGame(gameId);
    gameId = null;
  });

  it("should return error when not this player's turn", async () => {
    gameId = `test-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const game = new TrackedGame();
    const snapshot = game.newGame({
      gameId,
      playerNames: ["Human", "AI Bot", "Carol"],
    });

    const wrongPlayerId = snapshot.players.find((p) => p.id !== snapshot.awaitingPlayerId)!.id;
    const model = modelRegistry.languageModel(DEFAULT_AI_MODEL_ID);

    const result = await executeTurn({
      model,
      modelId: DEFAULT_AI_MODEL_ID,
      runtime: createCliAIActionRuntime(game),
      playerId: wrongPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Not this player's turn");
    expect(game.actions.length).toBe(0);
  });
});

describe.skipIf(skipLLM)("AWAITING_DRAW phase", () => {
  let gameId: string | null = null;

  afterEach(() => {
    if (gameId) cleanupGame(gameId);
    gameId = null;
  });

  it("should draw when it's the AI's turn", async () => {
    gameId = `test-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const game = new TrackedGame();
    const snapshot = game.newGame({
      gameId,
      playerNames: ["Human", "AI Bot", "Carol"],
    });

    const aiPlayerId = snapshot.awaitingPlayerId;
    const model = modelRegistry.languageModel(DEFAULT_AI_MODEL_ID);

    const result = await executeTurn({
      model,
      modelId: DEFAULT_AI_MODEL_ID,
      runtime: createCliAIActionRuntime(game),
      playerId: aiPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(true);
    expect(
      game.actions.some(
        (action) => action.type === "DRAW_FROM_STOCK" || action.type === "DRAW_FROM_DISCARD"
      )
    ).toBe(true);
    expect("reasoningContext" in result).toBe(false);
    expect(result.continuation?.responseId).toBeString();
    expect(result.continuation?.pendingToolResult.toolCallId).toBeString();
    expect(result.metrics?.providerDurationMs).toBeGreaterThan(0);
  }, 30000);
});

describe.skipIf(skipLLM)("RESOLVING_MAY_I phase", () => {
  let gameId: string | null = null;

  afterEach(() => {
    if (gameId) cleanupGame(gameId);
    gameId = null;
  });

  it("should allow or claim when prompted", async () => {
    gameId = `test-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const game = new TrackedGame();
    const snapshot = game.newGame({
      gameId,
      playerNames: ["Human", "AI Bot", "Carol"],
    });

    const promptedPlayerId = snapshot.awaitingPlayerId;
    const callerId = snapshot.players[(snapshot.currentPlayerIndex + 1) % snapshot.players.length]!.id;

    // Trigger May I so the current player is prompted to respond
    game.callMayI(callerId);

    expect(game.getSnapshot().phase).toBe("RESOLVING_MAY_I");
    expect(game.getSnapshot().awaitingPlayerId).toBe(promptedPlayerId);

    const model = modelRegistry.languageModel(DEFAULT_AI_MODEL_ID);

    const result = await executeTurn({
      model,
      modelId: DEFAULT_AI_MODEL_ID,
      runtime: createCliAIActionRuntime(game),
      playerId: promptedPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(true);
    expect(
      game.actions.some(
        (action) => action.type === "ALLOW_MAY_I" || action.type === "CLAIM_MAY_I"
      )
    ).toBe(true);
    expect("reasoningContext" in result).toBe(false);
    expect(result.continuation?.responseId).toBeString();
    expect(result.continuation?.pendingToolResult.toolCallId).toBeString();
  }, 30000);
});
