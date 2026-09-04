import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { basename } from "node:path";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { createAINotebookStore } from "../cli/shared/cli.persistence";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { AIHandScratchpad } from "./mayIAgent.scratchpad";
import { createMayITools } from "./mayIAgent.tools";
import { executePlayerTurn } from "./mayIAgent";
import { MAYI_PLAYER_PROFILE } from "./mayIAgent.player-profile";

mkdirSync(".data", { recursive: true });
const directory = mkdtempSync(".data/notebook-persistence-test-");
const gameId = basename(directory);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("committed notebook survives storage recreation, stays private, and is supplied on the shared player path", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(entry => entry.identity.id === "contested-run-diamonds-natural")!;
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const playerId = scenario.evaluatedPlayerId;
    const { runtime } = history.createRuntime(playerId);
    await runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    const before = await runtime.getSnapshot();
    const memory = new AIHandScratchpad(before.gameId, playerId);
    const turn = memory.begin({ ...before, playerId });
    const tools = createMayITools(runtime, playerId, { scratchpadTurn: turn });
    const note = "Observed: opponent took diamonds. Suspected: competing run.\nPlan: retain spades. Reconsider: after the next draw.";
    const result = await tools.discard.execute!({ position: 1, strategy_note: note }, { toolCallId: "private-note", messages: [], context: {} });
    expect(result).toMatchObject({ success: true, turnComplete: true });
    const latest = await runtime.getSnapshot();
    turn.finish({ ...latest, playerId }, true);
    const store = createAINotebookStore(gameId);
    await store.set(playerId, memory.exportState({ ...latest, playerId }));
    const restoredStore = createAINotebookStore(gameId);
    expect(AIHandScratchpad.restore({ ...latest, playerId }, await restoredStore.get(playerId)).read({ ...latest, playerId })).toBe(note);
    expect(await restoredStore.get("another-player")).toBeUndefined();
    expect(JSON.stringify(latest)).not.toContain(note);
    expect(JSON.stringify(history.getActionLog())).not.toContain(note);
    expect(readFileSync(`${directory}/ai-notebooks.json`, "utf8")).toContain("opponent took diamonds");

    // Use a fresh real engine root with the same hand identity to inspect model
    // input through the actual SDK, without paying for or mocking a response.
    const nextHistory = await createAIPlayerRolloutHistory(scenario, 1);
    try {
      const nextRuntime = nextHistory.createRuntime(playerId).runtime;
      const requests: LanguageModelV4CallOptions[] = [];
      const provider = createOpenRouter({ apiKey: "local-test", baseURL: "http://127.0.0.1:0/api/v1" });
      const model = wrapLanguageModel({ model: provider.chat("meta/muse-spark-1.3-contributor"), middleware: {
        specificationVersion: "v4", transformParams: async ({ params }) => { requests.push(params); return params; },
      } });
      const failed = await executePlayerTurn({ model, modelId: "default:meta", runtime: nextRuntime, playerId, notebookStore: restoredStore, maxRetries: 0, telemetry: false });
      expect(failed.success).toBe(false);
      expect(failed.scratchpadTrace).toMatchObject({ before: note, after: note, outcome: "discarded" });
      expect(requests[0]?.prompt[0]).toEqual({ role: "system", content: MAYI_PLAYER_PROFILE.systemPrompt });
      expect(JSON.stringify(requests[0]?.prompt)).toContain("opponent took diamonds");
      expect(await restoredStore.get(playerId)).toEqual(memory.exportState({ ...latest, playerId }));
    } finally { nextHistory.actor.stop(); }

    await restoredStore.set("other-player", undefined);
    expect(await restoredStore.get(playerId)).toBeDefined();
    await restoredStore.set(playerId, undefined);
    expect(await restoredStore.get(playerId)).toBeUndefined();
  } finally { history.actor.stop(); }
});
