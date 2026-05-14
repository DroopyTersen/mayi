import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import type { GameAction } from "../../core/engine/game-action.command";
import { createCliAIActionRuntime } from "./cli-ai-action-runtime";
import { CliGameAdapter } from "./cli-game-adapter";

let createdGameIds: string[] = [];

function cleanupGame(gameId: string): void {
  const dir = `.data/${gameId}`;
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

afterEach(() => {
  for (const gameId of createdGameIds) {
    cleanupGame(gameId);
  }
  createdGameIds = [];
});

describe("createCliAIActionRuntime", () => {
  it("executes shared game actions through the CLI adapter", async () => {
    const gameId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    createdGameIds.push(gameId);

    const adapter = new CliGameAdapter();
    const before = adapter.newGame({
      gameId,
      playerNames: ["Alice", "Bob", "Carol"],
    });
    const currentPlayerBefore = before.players.find(
      (player) => player.id === before.awaitingPlayerId
    );
    if (!currentPlayerBefore) {
      throw new Error("Expected current player before action");
    }

    const runtime = createCliAIActionRuntime(adapter);
    const action: GameAction = { type: "DRAW_FROM_STOCK" };
    const result = await runtime.executeAction(action);

    expect(result.ok).toBe(true);
    expect(result.snapshot.turnPhase).toBe("AWAITING_ACTION");
    expect(
      result.snapshot.players.find((player) => player.id === before.awaitingPlayerId)?.hand
        .length
    ).toBe(currentPlayerBefore.hand.length + 1);
  });
});
