/**
 * Worker-Compatible AI Model Factory
 *
 * Minimal model factory for Cloudflare Workers.
 * Unlike the full modelRegistry, this doesn't import devtools middleware
 * which requires Node.js modules.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";

/** Supported AI model IDs for the web app */
export type WebAIModelId =
  | "grok-3-mini"
  | "grok-3-fast"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "claude-haiku"
  | "claude-sonnet"
  | "gemini-flash"
  | "gemini-pro";

/**
 * Create a language model for use in Cloudflare Workers
 *
 * This is a simplified version of the model registry that
 * doesn't require Node.js-only dependencies like devtools.
 */
export function createWorkerAIModel(modelId: WebAIModelId): LanguageModel {
  switch (modelId) {
    // XAI models (default)
    case "grok-3-mini":
      return createXai()("grok-3-mini");
    case "grok-3-fast":
      return createXai()("grok-3-fast-latest");

    // OpenAI models
    case "gpt-4o-mini":
      return createOpenAI()("gpt-4o-mini");
    case "gpt-4o":
      return createOpenAI()("gpt-4o");

    // Anthropic models
    case "claude-haiku":
      return createAnthropic()("claude-3-5-haiku-latest");
    case "claude-sonnet":
      return createAnthropic()("claude-sonnet-4-20250514");

    // Google models
    case "gemini-flash":
      return createGoogleGenerativeAI()("gemini-2.0-flash");
    case "gemini-pro":
      return createGoogleGenerativeAI()("gemini-2.0-pro-exp");

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = modelId;
      throw new Error(`Unknown model ID: ${modelId}`);
  }
}

/**
 * Get the default AI model for game play
 */
export function getDefaultWorkerAIModel(): LanguageModel {
  return createWorkerAIModel("grok-3-mini");
}
