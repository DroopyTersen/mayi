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
import { Orchestrator } from "../cli/harness/orchestrator";
import type { Card, Rank, Suit } from "../core/card/card.types";

function card(rank: Rank, suit: Suit): Card {
  return {
    id: `${rank}-${suit}-${Math.random().toString(36).slice(2, 6)}`,
    rank,
    suit,
  };
}

const state = {
  version: "2.0" as const,
  gameId: "devtools-test",
  phase: "ROUND_ACTIVE" as const,
  harnessPhase: "AWAITING_DRAW" as const,
  turnNumber: 1,
  players: [
    { id: "player-0", name: "Human", hand: Array.from({ length: 11 }, () => card("3", "hearts")), isDown: false, totalScore: 0 },
    { id: "player-1", name: "AI Bot", hand: Array.from({ length: 11 }, () => card("4", "clubs")), isDown: false, totalScore: 0 },
    { id: "player-2", name: "Carol", hand: Array.from({ length: 11 }, () => card("5", "diamonds")), isDown: false, totalScore: 0 },
  ],
  currentRound: 1 as const,
  dealerIndex: 0,
  currentPlayerIndex: 1,
  stock: Array.from({ length: 50 }, () => card("A", "spades")),
  discard: [card("5", "hearts")],
  table: [],
  roundHistory: [],
  awaitingPlayerId: "player-1",
  mayIContext: null,
  hasDrawn: false,
  laidDownThisTurn: false,
  lastDiscardedByPlayerId: null,
};

class TestOrchestrator extends Orchestrator {
  static fromState(s: typeof state): TestOrchestrator {
    const o = new TestOrchestrator();
    // @ts-expect-error - accessing private method
    o.restoreFromState(s);
    return o;
  }
}

async function main() {
  console.log("🔧 Running AI turn with devtools middleware...\n");

  const orchestrator = TestOrchestrator.fromState(state);
  const model = withDevTools(modelRegistry.languageModel("xai:grok-4-1-fast-reasoning"));

  const result = await executeTurn({
    model,
    orchestrator,
    playerId: "player-1",
    debug: true,
  });

  console.log("\n✅ Result:", result.success ? "SUCCESS" : "FAILED");
  console.log("📋 Actions:", result.actions);
  console.log("\n👀 Check http://localhost:4983 to see the captured data!");
}

main().catch(console.error);
