/**
 * Model Registry for May I? AI Player
 *
 * Centralized provider configuration following DoTadda Knowledge patterns.
 * Supports OpenAI, Anthropic, Google Gemini, and XAI providers.
 *
 * Usage:
 *   // Use named defaults (RECOMMENDED - these are the only models we test)
 *   const model = modelRegistry.languageModel("default:openai");  // GPT-5 Mini
 *   const model = modelRegistry.languageModel("default:claude");  // Claude Haiku 4.5
 *   const model = modelRegistry.languageModel("default:gemini");  // Gemini 3 Flash Preview
 *   const model = modelRegistry.languageModel("default:grok");    // Grok 4.1 Fast
 *
 *   // Direct provider access (for experimentation only)
 *   const model = modelRegistry.languageModel("openai:gpt-5-mini");
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
 * Canonical model IDs - the only models we test and support
 *
 * Use these via default: prefix for stable references that won't break
 * when underlying model versions change.
 */
export const CANONICAL_MODELS = {
  openai: "gpt-5-mini",
  claude: "claude-haiku-4-5",
  gemini: "gemini-3-flash-preview",
  grok: "grok-4-1-fast-reasoning",
} as const;
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

/**
 * Default settings for AI player models
 */
const defaultPlayerSettings = defaultSettingsMiddleware({
  settings: {
    maxOutputTokens: 4096,
    temperature: 0.7,
  },
});

export const modelRegistry = createProviderRegistry(
  {
    default: customProvider({
      languageModels: {
        // Named defaults - ALWAYS use these instead of raw provider:model strings
        openai: wrapLanguageModel({
          model: modelProviders.openai(CANONICAL_MODELS.openai),
          middleware: defaultPlayerSettings,
        }),
        claude: wrapLanguageModel({
          model: modelProviders.anthropic(CANONICAL_MODELS.claude),
          middleware: defaultPlayerSettings,
        }),
        gemini: wrapLanguageModel({
          model: modelProviders.gemini(CANONICAL_MODELS.gemini),
          middleware: defaultPlayerSettings,
        }),
        grok: wrapLanguageModel({
          model: modelProviders.xai(CANONICAL_MODELS.grok),
          middleware: defaultPlayerSettings,
        }),
      },
    }),

    // Direct provider access for experimentation only
    openai: modelProviders.openai,
    anthropic: modelProviders.anthropic,
    gemini: modelProviders.gemini,
    xai: modelProviders.xai,
  },
  { separator: ":" }
);
