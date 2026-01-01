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

// Skip LLM tests by default - run with: RUN_INTEGRATION_TESTS=1 bun test ai/mayIAgent.llm.test.ts
const skipLLM = !process.env.RUN_INTEGRATION_TESTS;

function cleanupGame(gameId: string): void {
  const dir = `.data/${gameId}`;
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

class TrackedGame extends CliGameAdapter {
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

  override callMayI(callerId: string) {
    this.calls.push({ method: "callMayI", args: [callerId] });
    return super.callMayI(callerId);
  }

  override allowMayI(playerId?: string) {
    this.calls.push({ method: "allowMayI", args: [playerId] });
    return super.allowMayI(playerId);
  }

  override claimMayI(playerId?: string) {
    this.calls.push({ method: "claimMayI", args: [playerId] });
    return super.claimMayI(playerId);
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
    const model = modelRegistry.languageModel("default:grok");

    const result = await executeTurn({
      model,
      game,
      playerId: wrongPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Not this player's turn");
    expect(game.calls.length).toBe(0);
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
    const model = modelRegistry.languageModel("default:grok");

    const result = await executeTurn({
      model,
      game,
      playerId: aiPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(true);
    expect(game.calls.some((c) => c.method === "drawFromStock" || c.method === "drawFromDiscard")).toBe(true);
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

    const model = modelRegistry.languageModel("default:grok");

    const result = await executeTurn({
      model,
      game,
      playerId: promptedPlayerId,
      debug: false,
      telemetry: false,
    });

    expect(result.success).toBe(true);
    expect(game.calls.some((c) => c.method === "allowMayI" || c.method === "claimMayI")).toBe(true);
  }, 30000);
});

