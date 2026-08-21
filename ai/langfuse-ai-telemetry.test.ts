import { describe, expect, it } from "bun:test";
import { buildLangfuseGenerationAttributes } from "./langfuse-ai-telemetry";

describe("Langfuse AI telemetry", () => {
  it("groups a production generation under its game session with v4 usage", () => {
    expect(
      buildLangfuseGenerationAttributes({
        context: {
          gameId: "VJPGCP",
          playerId: "player-2",
          playerName: "Maggie & Theo",
          round: 2,
          turnNumber: 7,
        },
        provider: "openai.responses",
        modelId: "gpt-5.6-luna",
        input: {
          instructions: "house rules",
          messages: [{ role: "user", content: "current game state" }],
          tools: [{ type: "function", name: "discard" }],
        },
        output: {
          content: [{ type: "tool-call", toolName: "discard" }],
          finishReason: "tool-calls",
        },
        usage: {
          inputTokens: {
            total: 100,
            noCache: 60,
            cacheRead: 30,
            cacheWrite: 10,
          },
          outputTokens: {
            total: 20,
            text: 5,
            reasoning: 15,
          },
        },
      }),
    ).toEqual({
      "langfuse.trace.name": "may-i-game",
      "session.id": "VJPGCP",
      "langfuse.environment": "production",
      "langfuse.observation.type": "generation",
      "langfuse.observation.model.name": "gpt-5.6-luna",
      "langfuse.observation.input": JSON.stringify({
        instructions: "house rules",
        messages: [{ role: "user", content: "current game state" }],
        tools: [{ type: "function", name: "discard" }],
      }),
      "langfuse.observation.output": JSON.stringify({
        content: [{ type: "tool-call", toolName: "discard" }],
        finishReason: "tool-calls",
      }),
      "langfuse.observation.usage_details": JSON.stringify({
        input: 60,
        cache_read_input_tokens: 30,
        cache_write_input_tokens: 10,
        output: 20,
        total: 120,
      }),
      "langfuse.observation.metadata.provider": "openai.responses",
      "langfuse.observation.metadata.player_id": "player-2",
      "langfuse.observation.metadata.player_name": "Maggie & Theo",
      "langfuse.observation.metadata.round": 2,
      "langfuse.observation.metadata.turn_number": 7,
    });
  });
});
