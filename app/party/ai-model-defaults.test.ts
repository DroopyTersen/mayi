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

describe("Spark Contributor AI defaults", () => {
  it("uses Spark Contributor for new players", () => {
    expect(DEFAULT_AI_MODEL_ID).toBe("default:meta");
    expect(DEFAULT_AI_PLAYER_NAME_PREFIX).toBe("Spark");
    expect(AI_MODEL_CATALOG[DEFAULT_AI_MODEL_ID].model).toBe("meta/muse-spark-1.3-contributor");
  });

  it("puts Spark first in the retained model picker", () => {
    expect(AI_MODEL_IDS[0]).toBe(DEFAULT_AI_MODEL_ID);
    expect(AI_MODEL_DISPLAY_NAMES[DEFAULT_AI_MODEL_ID]).toBe("Muse Spark 1.3 Contributor");
    expect(AI_MODEL_OPTIONS[0]?.id).toBe(DEFAULT_AI_MODEL_ID);
    expect(AI_MODEL_IDS).toContain("default:grok");
  });

  it("accepts explicit saved Grok player choices", () => {
    expect(AI_MODEL_IDS).toContain("default:grok");
  });

  it("retains explicit model choices alongside Spark", () => {
    expect(AI_MODEL_CATALOG["default:openai"].model).toBe("gpt-5.6-luna");
    expect(AI_MODEL_IDS).toContain("default:meta");
    expect(AI_MODEL_DISPLAY_NAMES["default:meta"]).toBe("Muse Spark 1.3 Contributor");
    expect(AI_MODEL_CATALOG["default:meta"]).toMatchObject({
      model: "meta/muse-spark-1.3-contributor",
      provider: "openrouter",
    });
  });

  it("defines the quick-start protocol in terms of the canonical Spark alias", () => {
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
