/**
 * Simple connectivity tests for each AI provider
 *
 * These tests verify that we can successfully call each model provider
 * and see how each model identifies itself.
 */

import { describe, it, expect } from "bun:test";
import { generateText } from "ai";
import { modelRegistry } from "./modelRegistry";

/**
 * Models to test for basic connectivity
 */
const MODELS_TO_TEST = [
  { name: "OpenAI GPT-5 Mini", id: "openai:gpt-5-mini" },
  { name: "Anthropic Claude Haiku 4.5", id: "anthropic:claude-haiku-4-5" },
  { name: "Google Gemini 3 Flash", id: "gemini:gemini-3-flash-preview" },
  { name: "xAI Grok 4.1 Fast", id: "xai:grok-4-1-fast-reasoning" },
] as const;

describe("Model Connectivity", () => {
  for (const { name, id } of MODELS_TO_TEST) {
    it(`${name} identifies itself`, async () => {
      const model = modelRegistry.languageModel(id);

      const result = await generateText({
        model,
        prompt: "Which model are you? Which model lab made you? Please answer briefly in one sentence.",
        maxOutputTokens: 500,
      });

      // Verify we got some text back
      console.log(`\n[${name}] Says: "${result.text}"`);
      console.log(`[${name}] Finish reason: ${result.finishReason}`);
      expect(result.text.length).toBeGreaterThan(0);
    }, 30000); // 30s timeout
  }
});
