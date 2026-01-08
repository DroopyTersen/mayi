/**
 * Tests for AI Model Factory
 */

import { describe, it, expect, mock } from "bun:test";

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
  });
});
