/**
 * Tests for AI Model Factory
 */

import { describe, it, expect } from "bun:test";

// We can't easily test the actual model creation without API keys,
// but we can verify the parsing logic by checking console.warn calls

describe("ai-model-factory", () => {
  describe("default provider parsing", () => {
    it("should not warn for default:grok model ID", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        // Import dynamically to get fresh module
        const { createWorkerAIModel } = await import("./ai-model-factory");

        // This should NOT produce "Unknown provider: default" warning
        // It will fail to create the model due to missing API key, but that's fine
        try {
          createWorkerAIModel("default:grok", {});
        } catch {
          // Expected - no API key
        }

        // Check that we didn't get the "Unknown provider" warning
        const unknownProviderWarning = warnings.find(w =>
          w.includes("Unknown provider: default")
        );
        expect(unknownProviderWarning).toBeUndefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should not warn for default:gemini model ID", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("default:gemini", {});
        } catch {
          // Expected - no API key
        }

        const unknownProviderWarning = warnings.find(w =>
          w.includes("Unknown provider: default")
        );
        expect(unknownProviderWarning).toBeUndefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should not warn for default:openai model ID", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("default:openai", {});
        } catch {
          // Expected - no API key
        }

        const unknownDefaultWarning = warnings.find((warning) =>
          warning.includes("Unknown default model")
        );
        expect(unknownDefaultWarning).toBeUndefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should not warn for default:claude model ID", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("default:claude", {});
        } catch {
          // Expected - no API key
        }

        const unknownDefaultWarning = warnings.find((warning) =>
          warning.includes("Unknown default model")
        );
        expect(unknownDefaultWarning).toBeUndefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should warn for truly unknown provider", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("fakeProvider:someModel", {});
        } catch {
          // Expected - no API key
        }

        const unknownProviderWarning = warnings.find(w =>
          w.includes("Unknown provider: fakeProvider")
        );
        expect(unknownProviderWarning).toBeDefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should warn for invalid model ID format", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("invalidModelId", {});
        } catch {
          // Expected - no API key
        }

        const invalidFormatWarning = warnings.find((warning) =>
          warning.includes("Invalid model ID format")
        );
        expect(invalidFormatWarning).toBeDefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should not warn for explicit providers", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("xai:grok-4-1-fast-reasoning", {});
          createWorkerAIModel("openai:gpt-5-mini", {});
          createWorkerAIModel("anthropic:claude-haiku-4-5-latest", {});
          createWorkerAIModel("gemini:gemini-3-flash-preview-20241219", {});
        } catch {
          // Expected - no API keys
        }

        const unknownProviderWarning = warnings.find((warning) =>
          warning.includes("Unknown provider")
        );
        expect(unknownProviderWarning).toBeUndefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("should warn for unknown default model IDs", async () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };

      try {
        const { createWorkerAIModel } = await import("./ai-model-factory");

        try {
          createWorkerAIModel("default:unknown-model", {});
        } catch {
          // Expected - no API key
        }

        const unknownDefaultWarning = warnings.find((warning) =>
          warning.includes("Unknown default model")
        );
        expect(unknownDefaultWarning).toBeDefined();
      } finally {
        console.warn = originalWarn;
      }
    });
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
