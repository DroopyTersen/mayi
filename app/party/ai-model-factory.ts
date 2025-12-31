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
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { wrapLanguageModel, type LanguageModel } from "ai";
import type { AIModelId } from "./protocol.types";

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

/** Supported model IDs */
export type WebAIModelId = AIModelId;

/**
 * Check if we're running in a Node.js environment (local dev)
 * vs Cloudflare Workers (production)
 */
function isNodeEnvironment(): boolean {
  // Cloudflare Workers don't have process.versions.node
  return typeof process !== "undefined" && !!process.versions?.node;
}

// Cache the middleware promise (typed as any to avoid complex middleware types)
let devToolsMiddlewarePromise: Promise<unknown> | null = null;

/**
 * Lazily load devtools middleware only in Node.js environment
 * This avoids import errors in Cloudflare Workers
 */
async function getDevToolsMiddleware(): Promise<unknown> {
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
function createBaseModel(modelId: string, env: AIEnv): LanguageModel {
  // Parse provider:model format
  const colonIndex = modelId.indexOf(":");
  if (colonIndex === -1) {
    console.warn(`Invalid model ID format: ${modelId}, expected "provider:model"`);
    return createXai({ apiKey: env.XAI_API_KEY })("grok-4-1-fast-reasoning");
  }

  const provider = modelId.slice(0, colonIndex);
  const model = modelId.slice(colonIndex + 1);

  switch (provider) {
    case "xai":
      return createXai({ apiKey: env.XAI_API_KEY })(model);

    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(model);

    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(model);

    case "gemini":
      return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(model);

    default:
      console.warn(`Unknown provider: ${provider}, falling back to xai`);
      return createXai({ apiKey: env.XAI_API_KEY })("grok-4-1-fast-reasoning");
  }
}

/**
 * Create a language model for use in web app
 *
 * Uses the same model IDs as the protocol: "provider:model-name"
 * Requires env parameter with API keys (process.env not available in Workers).
 */
export function createWorkerAIModel(modelId: string, env: AIEnv): LanguageModel {
  const baseModel = createBaseModel(modelId, env);

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
  const baseModel = createBaseModel(modelId, env);

  if (!isNodeEnvironment()) {
    return baseModel;
  }

  // Lazy load and cache devtools middleware
  if (!devToolsMiddlewarePromise) {
    devToolsMiddlewarePromise = getDevToolsMiddleware();
  }

  const middleware = await devToolsMiddlewarePromise;
  if (!middleware) {
    return baseModel;
  }

  console.log(`[AI] DevTools enabled for model: ${modelId}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wrapLanguageModel({
    model: baseModel as any,
    middleware: middleware as any,
  }) as LanguageModel;
}

/**
 * Get the default AI model for game play
 */
export function getDefaultWorkerAIModel(env: AIEnv): LanguageModel {
  return createWorkerAIModel("xai:grok-4-1-fast-reasoning", env);
}
