import { describe, expect, it } from "bun:test";
import { AI_MODEL_CATALOG } from "../../ai/ai-model-catalog";
import {
  AI_MODEL_DISPLAY_NAMES,
  AI_MODEL_IDS,
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  DEFAULT_AI_PLAYER_NAME_PREFIX,
} from "./ai-models";
import { agentSetupMessageSchema } from "./agent-harness.types";

describe("GPT-5.6 Luna AI defaults", () => {
  it("resolves the stable OpenAI alias to GPT-5.6 Luna", () => {
    expect(AI_MODEL_CATALOG[DEFAULT_AI_MODEL_ID].model).toBe("gpt-5.6-luna");
  });

  it("puts Luna first in the retained model picker", () => {
    expect(AI_MODEL_IDS[0]).toBe(DEFAULT_AI_MODEL_ID);
    expect(AI_MODEL_DISPLAY_NAMES[DEFAULT_AI_MODEL_ID]).toBe("GPT-5.6 Luna");
    expect(AI_MODEL_OPTIONS[0]?.id).toBe(DEFAULT_AI_MODEL_ID);
    expect(AI_MODEL_IDS).toContain("default:grok");
  });

  it("accepts explicit saved Grok player choices", () => {
    expect(AI_MODEL_IDS).toContain("default:grok");
  });

  it("defines the quick-start protocol in terms of the canonical Luna alias", () => {
    const result = agentSetupMessageSchema.safeParse({
      type: "AGENT_SETUP",
      requestId: "test-request",
      mode: "quickStart",
      human: { playerId: "human", name: "Human" },
      ai: {
        modelId: DEFAULT_AI_MODEL_ID,
        count: 2,
        namePrefix: DEFAULT_AI_PLAYER_NAME_PREFIX,
      },
    });

    expect(result.success).toBe(true);
  });
});
