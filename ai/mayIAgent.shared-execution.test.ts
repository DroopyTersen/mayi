import { expect, test } from "bun:test";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { GameEngine } from "../core/engine/game-engine";
import { createAIPlayerGameEngineRuntime } from "./evals/ai-player-game-engine-runtime";
import { executeTurn } from "./mayIAgent";
import { getAvailableToolNames } from "./mayIAgent.tool-availability";

test("all models use the same instructions and phase-filtered tools, without stored Responses branches", async () => {
  const engine = GameEngine.createGame({ gameId: "shared-player-path", playerNames: ["A", "B", "C"], seed: "shared-player-path" });
  try {
    const snapshot = engine.getSnapshot();
    const playerId = snapshot.awaitingPlayerId!;
    const { runtime, attempts } = createAIPlayerGameEngineRuntime(engine, playerId);
    const models = [
      { modelId: "default:openai", model: createOpenAI({ apiKey: "local-test", baseURL: "http://127.0.0.1:0/v1" })("gpt-5.6-luna") },
      { modelId: "default:meta", model: createOpenRouter({ apiKey: "local-test", baseURL: "http://127.0.0.1:0/api/v1" }).chat("meta/muse-spark-1.3-contributor") },
    ];
    for (const entry of models) {
      const requests: LanguageModelV4CallOptions[] = [];
      const model = wrapLanguageModel({ model: entry.model, middleware: {
        specificationVersion: "v4",
        transformParams: async ({ params }) => { requests.push(params); return params; },
      } });
      const result = await executeTurn({ model, modelId: entry.modelId, runtime, playerId, systemPrompt: "Shared player instructions.", maxRetries: 0, telemetry: false });
      // Observe real SDK requests to a closed local endpoint; no provider mock.
      expect(result.success).toBe(false);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.prompt[0]).toEqual({ role: "system", content: "Shared player instructions." });
      expect(requests[0]?.providerOptions).not.toHaveProperty("openai");
      expect(requests[0]?.tools?.map(tool => tool.name).sort()).toEqual(getAvailableToolNames(snapshot, playerId).sort());
    }
    expect(attempts).toHaveLength(0);
  } finally { engine.stop(); }
});
