/**
 * Quick test script for AI SDK devtools
 *
 * Usage:
 *   1. Start devtools: bun run devtools
 *   2. Run this: bun ai/devtools-test.ts
 *   3. View at http://localhost:4983
 */

import { executeTurn } from "./mayIAgent";
import { modelRegistry, withDevTools } from "./modelRegistry";
import { CliGameAdapter } from "../cli/shared/cli-game-adapter";

async function main() {
  console.log("🔧 Running AI turn with devtools middleware...\n");

  const game = new CliGameAdapter();
  const snapshot = game.newGame({
    gameId: "devtools-test",
    playerNames: ["Human", "AI Bot", "Carol"],
  });

  const model = withDevTools(modelRegistry.languageModel("xai:grok-4-1-fast-reasoning"));

  const playerId = snapshot.players.find((p) => p.name === "AI Bot")?.id ?? snapshot.awaitingPlayerId;

  const result = await executeTurn({
    model,
    game,
    playerId,
    playerName: "AI Bot",
    debug: true,
  });

  console.log("\n✅ Result:", result.success ? "SUCCESS" : "FAILED");
  console.log("📋 Actions:", result.actions);
  console.log("\n👀 Check http://localhost:4983 to see the captured data!");
}

main().catch(console.error);
