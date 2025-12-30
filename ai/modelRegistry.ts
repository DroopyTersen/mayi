/**
 * Model Registry for May I? AI Player
 *
 * Centralized provider configuration following DoTadda Knowledge patterns.
 * Supports OpenAI, Anthropic, Google Gemini, and XAI providers.
 *
 * Usage:
 *   // Use default player model
 *   const model = modelRegistry.languageModel("default:player");
 *
 *   // Use specific provider/model for experimentation
 *   const model = modelRegistry.languageModel("openai:gpt-4o");
 *   const model = modelRegistry.languageModel("anthropic:claude-sonnet-4-20250514");
 *   const model = modelRegistry.languageModel("gemini:gemini-3-flash-preview");
 *   const model = modelRegistry.languageModel("xai:grok-4-1-fast-reasoning");
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import {
  createProviderRegistry,
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";

/**
 * Model Providers - centralized provider configuration
 *
 * These are the raw providers that can be used directly for experimentation
 * or accessed via the modelRegistry for consistent default settings.
 *
 * API keys are loaded from environment variables:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_GENERATIVE_AI_API_KEY
 * - XAI_API_KEY
 */
export const modelProviders = {
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
  anthropic: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  }),
  gemini: createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  }),
  xai: createXai({
    apiKey: process.env.XAI_API_KEY,
  }),
};
/**
 * Valid model ID patterns for the registry
 */
export type ModelId =
  | `default:${string}`
  | `openai:${string}`
  | `anthropic:${string}`
  | `gemini:${string}`
  | `xai:${string}`;

/**
 * May I? AI Player Model Registry
 *
 * Tier Usage Guidelines:
 * - default:player - Main AI player model for game decisions
 *
 * To use direct provider access for experimentation:
 * - modelRegistry.languageModel("openai:gpt-4o")
 * - modelRegistry.languageModel("anthropic:claude-sonnet-4-20250514")
 * - modelRegistry.languageModel("gemini:gemini-3-flash-preview")
 * - modelRegistry.languageModel("xai:grok-4-1-fast-reasoning")
 */
/**
 * Wrap a model with devtools middleware for debugging
 *
 * Usage:
 *   const model = withDevTools(modelRegistry.languageModel("xai:grok-4-1-fast-reasoning"));
 */
export function withDevTools<T extends ReturnType<typeof wrapLanguageModel>>(
  model: T
): T {
  return wrapLanguageModel({
    model,
    middleware: devToolsMiddleware(),
  }) as T;
}

export const modelRegistry = createProviderRegistry(
  {
    default: customProvider({
      languageModels: {
        // Default player model - balanced for game decisions
        player: wrapLanguageModel({
          model: modelProviders.openai("gpt-5-mini"),
          middleware: defaultSettingsMiddleware({
            settings: {
              maxOutputTokens: 4096,
              temperature: 0.7,
            },
          }),
        }),
      },
    }),

    // Direct provider access for testing/experimentation
    openai: modelProviders.openai,
    anthropic: modelProviders.anthropic,
    gemini: modelProviders.gemini,
    xai: modelProviders.xai,
  },
  { separator: ":" }
);
