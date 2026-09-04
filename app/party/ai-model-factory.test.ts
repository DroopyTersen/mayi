/**
 * Tests for AI Model Factory
 */

import { describe, it, expect } from "bun:test";

describe("ai-model-factory", () => {
  it("creates each supported picker model", async () => {
    const { createWorkerAIModel } = await import("./ai-model-factory");
    for (const id of [
      "default:openai",
      "default:meta",
      "default:grok",
      "default:claude",
      "default:gemini",
    ] as const) {
      expect(createWorkerAIModel(id, {})).toBeDefined();
    }
  });

  it("uses OpenRouter for Meta Muse Spark", async () => {
    const { createWorkerAIModel } = await import("./ai-model-factory");
    const model = createWorkerAIModel("default:meta", { OPENROUTER_API_KEY: "test" });

    expect(model).not.toBeString();
    if (typeof model !== "string") {
      expect(model.provider).toBe("openrouter");
      expect(model.modelId).toBe("meta/muse-spark-1.3-contributor");
    }
  });

  it("rejects unsupported model IDs", async () => {
    const { createWorkerAIModel } = await import("./ai-model-factory");
    expect(() => createWorkerAIModel("default:unknown-model", {})).toThrow(
      "Unsupported AI model ID: default:unknown-model",
    );
  });

  describe("createWorkerAIModel", () => {
    it("returns base model when node environment is unavailable", async () => {
      const originalNodeVersion = process.versions.node;
      process.versions.node = "";

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");
        const model = createWorkerAIModel("default:grok", { XAI_API_KEY: "test" });
        expect(model).toBeDefined();
      } finally {
        process.versions.node = originalNodeVersion;
      }
    });
  });

  describe("createWorkerAIModelAsync", () => {
    it("returns a model without throwing in test env", async () => {
      const { createWorkerAIModelAsync } = await import("./ai-model-factory");
      await expect(createWorkerAIModelAsync("default:grok", {})).resolves.toBeDefined();
    });

    it("returns base model when node environment is unavailable", async () => {
      const originalNodeVersion = process.versions.node;
      process.versions.node = "";

      try {
        const { createWorkerAIModelAsync } = await import("./ai-model-factory");
        await expect(createWorkerAIModelAsync("default:grok", {})).resolves.toBeDefined();
      } finally {
        process.versions.node = originalNodeVersion;
      }
    });
  });
});
