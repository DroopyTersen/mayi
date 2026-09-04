import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import { createCliAIActionRuntime } from "../cli/shared/cli-ai-action-runtime";
import { CliGameAdapter } from "../cli/shared/cli-game-adapter";
import type { GameAction } from "./ai-action-runtime.types";
import { executePlayerTurn } from "./mayIAgent";
import { createAINotebookStore, readActionLog } from "../cli/shared/cli.persistence";
import { DEFAULT_AI_MODEL_ID } from "./ai-model-catalog";
import { modelRegistry } from "./modelRegistry";

const hasOpenRouterKey =
  typeof process.env.OPENROUTER_API_KEY === "string" &&
  process.env.OPENROUTER_API_KEY.length > 0;
const runLiveTests = process.env.RUN_INTEGRATION_TESTS === "1" && hasOpenRouterKey;

class TrackedGame extends CliGameAdapter {
  public actions: GameAction[] = [];

  override executeGameAction(action: GameAction) {
    this.actions.push(action);
    return super.executeGameAction(action);
  }
}

describe.skipIf(!runLiveTests)("Muse Spark live OpenRouter verification", () => {
  let gameId: string | null = null;

  afterEach(() => {
    if (gameId) {
      fs.rmSync(`.data/${gameId}`, { recursive: true, force: true });
    }
    gameId = null;
  });

  it("uses the default player profile and carries a private notebook across real turns", async () => {
    gameId = `test-muse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const game = new TrackedGame();
    const snapshot = game.newGame({
      gameId,
      playerNames: ["Muse Bot", "Human", "Carol"],
    });
    const playerId = snapshot.awaitingPlayerId;
    const runtime = createCliAIActionRuntime(game);
    const result = await executePlayerTurn({
      model: modelRegistry.languageModel(DEFAULT_AI_MODEL_ID),
      modelId: DEFAULT_AI_MODEL_ID,
      runtime,
      playerId,
      telemetry: false,
      notebookStore: createAINotebookStore(gameId),
      abortSignal: AbortSignal.timeout(55_000),
    });

    expect(result.success).toBe(true);
    expect(
      game.actions.some(
        (action) =>
          action.type === "DRAW_FROM_STOCK" || action.type === "DRAW_FROM_DISCARD",
      ),
    ).toBe(true);
    expect(game.getSnapshot().awaitingPlayerId).not.toBe(playerId);
    expect(result.scratchpadTrace?.outcome).toBe("committed");
    const note = result.scratchpadTrace?.after;
    expect(note).toBeString();
    expect(JSON.stringify(readActionLog(gameId))).not.toContain(note!);
    expect(fs.readFileSync(`.data/${gameId}/game-state.json`, "utf8")).not.toContain(note!);

    // Other players take ordinary legal turns; no model/engine mocks.
    for (let i = 0; i < 2; i++) {
      expect((await runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
      const next = await runtime.getSnapshot();
      const player = next.players.find(p => p.id === next.awaitingPlayerId)!;
      expect((await runtime.executeAction({ type: "DISCARD", cardId: player.hand.at(-1)!.id })).ok).toBe(true);
    }
    expect(game.getSnapshot().awaitingPlayerId).toBe(playerId);
    const second = await executePlayerTurn({
      model: modelRegistry.languageModel(DEFAULT_AI_MODEL_ID), modelId: DEFAULT_AI_MODEL_ID,
      runtime, playerId, telemetry: false,
      notebookStore: createAINotebookStore(gameId), // Simulate a new caller/store.
      abortSignal: AbortSignal.timeout(55_000),
    });
    expect(second.success).toBe(true);
    expect(second.scratchpadTrace?.before).toBe(note);
    console.log("[Spark notebook smoke]", JSON.stringify({
      completedTurns: 2,
      first: result.metrics,
      second: second.metrics,
      noteCarried: second.scratchpadTrace?.before === note,
    }));
  }, 120_000);
});
