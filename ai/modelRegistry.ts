/**
 * Model Registry for May I? AI Player
 *
 * Centralized provider configuration following DoTadda Knowledge patterns.
 * Supports OpenAI, Anthropic, Google Gemini, and XAI providers.
 *
 * Usage:
 *   // Use named defaults (RECOMMENDED - these are the only models we test)
 *   const model = modelRegistry.languageModel("default:openai");  // GPT-5.6 Luna
 *   const model = modelRegistry.languageModel("default:meta");    // Muse Spark 1.3 Contributor
 *   const model = modelRegistry.languageModel("default:claude");  // Claude Haiku 4.5
 *   const model = modelRegistry.languageModel("default:gemini");  // Gemini 3.1 Flash Lite Preview
 *   const model = modelRegistry.languageModel("default:grok");    // Grok 4.1 Fast
 *
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  createProviderRegistry,
  customProvider,
  defaultSettingsMiddleware,
  type LanguageModel,
  wrapLanguageModel,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import {
  AI_MODEL_CATALOG,
  type AIModelDefinition,
  type AIModelId,
} from "./ai-model-catalog";
import { OPENROUTER_MUSE_CHAT_SETTINGS } from "./openrouter-muse-profile";

/**
 * Model Providers - centralized provider configuration
 *
 * These construct the five catalogued player models.
 *
 * API keys are loaded from environment variables:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_GENERATIVE_AI_API_KEY
 * - XAI_API_KEY
 * - OPENROUTER_API_KEY
 */
export const modelProviders = {
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
  anthropic: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  }),
  gemini: createGoogle({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  }),
  xai: createXai({
    apiKey: process.env.XAI_API_KEY,
  }),
  openrouter: createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  }),
};
/**
 * Valid model ID patterns for the registry
 */
export type ModelId = AIModelId;

/**
 * Wrap a model with devtools middleware for debugging
 *
 * Usage:
 *   const model = withDevTools(modelRegistry.languageModel("default:grok"));
 */
export function withDevTools(model: LanguageModel): LanguageModel {
  if (typeof model === "string") {
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: devToolsMiddleware(),
  });
}

/**
 * Default settings for AI player models
 */
function createCatalogModel(definition: AIModelDefinition): LanguageModel {
  const model = (() => {
    switch (definition.provider) {
      case "openai":
        return modelProviders.openai(definition.model);
      case "openrouter":
        return modelProviders.openrouter.chat(
          definition.model,
          OPENROUTER_MUSE_CHAT_SETTINGS,
        );
      case "anthropic":
        return modelProviders.anthropic(definition.model);
      case "gemini":
        return modelProviders.gemini(definition.model);
      case "xai":
        return modelProviders.xai.chat(definition.model);
    }
  })();

  return wrapLanguageModel({
    model,
    middleware: defaultSettingsMiddleware({ settings: definition.settings }),
  });
}

export const modelRegistry = createProviderRegistry(
  {
    default: customProvider({
      languageModels: {
        openai: createCatalogModel(AI_MODEL_CATALOG["default:openai"]),
        meta: createCatalogModel(AI_MODEL_CATALOG["default:meta"]),
        grok: createCatalogModel(AI_MODEL_CATALOG["default:grok"]),
        claude: createCatalogModel(AI_MODEL_CATALOG["default:claude"]),
        gemini: createCatalogModel(AI_MODEL_CATALOG["default:gemini"]),
      },
    }),
  },
  { separator: ":" },
);
