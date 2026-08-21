/**
 * Worker-Compatible AI Model Factory
 *
 * Creates AI models for both Cloudflare Workers and local development.
 * Automatically enables AI SDK DevTools in local dev (Node.js) environment.
 *
 * IMPORTANT: In Cloudflare Workers, process.env is not available.
 * API keys must be passed explicitly via the env parameter.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";
import type {
  LanguageModelV4,
  LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import {
  AI_MODEL_CATALOG,
  DEFAULT_AI_MODEL_ID,
  isAIModelId,
  type AIModelDefinition,
} from "../../ai/ai-model-catalog";

/**
 * Environment bindings containing API keys
 * These come from wrangler secrets or .env in local dev
 */
export interface AIEnv {
  XAI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
}

/**
 * Check if we're running in a Node.js environment (local dev)
 * vs Cloudflare Workers (production)
 */
function isNodeEnvironment(): boolean {
  // Cloudflare Workers don't have process.versions.node
  return typeof process !== "undefined" && !!process.versions?.node;
}

let devToolsMiddlewarePromise: Promise<LanguageModelV4Middleware | null> | null = null;

/**
 * Lazily load devtools middleware only in Node.js environment
 * This avoids import errors in Cloudflare Workers
 */
async function getDevToolsMiddleware(): Promise<LanguageModelV4Middleware | null> {
  if (!isNodeEnvironment()) {
    return null;
  }
  try {
    const { devToolsMiddleware } = await import("@ai-sdk/devtools");
    return devToolsMiddleware();
  } catch {
    // DevTools not available, skip
    return null;
  }
}

/**
 * Create a language model with explicit API keys from env
 */
function getModelDefinition(modelId: string): AIModelDefinition {
  if (!isAIModelId(modelId)) {
    throw new Error(`Unsupported AI model ID: ${modelId}`);
  }
  return AI_MODEL_CATALOG[modelId];
}

function createBaseModel(modelId: string, env: AIEnv): LanguageModelV4 {
  const definition = getModelDefinition(modelId);
  switch (definition.provider) {
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(definition.model);
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(definition.model);
    case "gemini":
      return createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(definition.model);
    case "xai":
      return createXai({ apiKey: env.XAI_API_KEY }).chat(definition.model);
  }
}

function withPlayerSettings(modelId: string, model: LanguageModelV4): LanguageModel {
  return wrapLanguageModel({
    model,
    middleware: defaultSettingsMiddleware({ settings: getModelDefinition(modelId).settings }),
  });
}

/**
 * Create a language model for use in web app
 *
 * Accepts only the four model IDs in the shared player-model catalog.
 * Requires env parameter with API keys (process.env not available in Workers).
 */
export function createWorkerAIModel(modelId: string, env: AIEnv): LanguageModel {
  const baseModel = withPlayerSettings(modelId, createBaseModel(modelId, env));

  // In Workers, just return the base model
  if (!isNodeEnvironment()) {
    return baseModel;
  }

  // In Node.js (local dev), wrap with devtools synchronously if possible
  // Note: This is a simplified approach - for full async support,
  // callers would need to await createWorkerAIModelAsync
  return baseModel;
}

/**
 * Create a language model with DevTools enabled (async version)
 *
 * Use this when you can await the result for full DevTools support.
 * Requires env parameter with API keys (process.env not available in Workers).
 */
export async function createWorkerAIModelAsync(modelId: string, env: AIEnv): Promise<LanguageModel> {
  const rawModel = createBaseModel(modelId, env);

  if (!isNodeEnvironment()) {
    return withPlayerSettings(modelId, rawModel);
  }

  // Lazy load and cache devtools middleware
  if (!devToolsMiddlewarePromise) {
    devToolsMiddlewarePromise = getDevToolsMiddleware();
  }

  const middleware = await devToolsMiddlewarePromise;
  if (!middleware) {
    return withPlayerSettings(modelId, rawModel);
  }

  console.log(`[AI] DevTools enabled for model: ${modelId}`);
  return wrapLanguageModel({
    model: rawModel,
    middleware: [
      defaultSettingsMiddleware({ settings: getModelDefinition(modelId).settings }),
      middleware,
    ],
  });
}

/**
 * Get the default AI model for game play
 */
export function getDefaultWorkerAIModel(env: AIEnv): LanguageModel {
  return createWorkerAIModel(DEFAULT_AI_MODEL_ID, env);
}
