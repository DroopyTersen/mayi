import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { SystemModelMessage } from "ai";
import {
  AI_MODEL_CATALOG,
  DEFAULT_AI_MODEL_ID,
  isAIModelId,
} from "./ai-model-catalog";

export const OPENAI_LUNA_MODEL_ID =
  AI_MODEL_CATALOG[DEFAULT_AI_MODEL_ID].model;
export const MAYI_AI_PROMPT_VERSION = "house-rules-v3";

const OPENAI_LUNA_PROMPT_CACHE_KEY =
  `mayi:${OPENAI_LUNA_MODEL_ID}:${MAYI_AI_PROMPT_VERSION}`;
const OPENAI_LUNA_COMPACT_THRESHOLD = 200_000;

export interface OpenAILunaProviderOptionsInput {
  previousResponseId?: string;
  compactThreshold?: number;
  allowedToolNames?: string[];
}

export function isOpenAILunaModel(
  configuredModelId: string | undefined,
): boolean {
  return (
    configuredModelId !== undefined &&
    isAIModelId(configuredModelId) &&
    AI_MODEL_CATALOG[configuredModelId].profile === "openai-luna"
  );
}

export function createOpenAILunaInstructions(
  systemPrompt: string,
): SystemModelMessage {
  return {
    role: "system",
    content: systemPrompt,
    providerOptions: {
      openai: {
        promptCacheBreakpoint: { mode: "explicit" },
      },
    },
  };
}

export function createOpenAILunaProviderOptions(
  input: OpenAILunaProviderOptionsInput,
): OpenAILanguageModelResponsesOptions {
  return {
    store: true,
    reasoningEffort: "medium",
    reasoningContext: "all_turns",
    reasoningSummary: null,
    textVerbosity: "low",
    parallelToolCalls: false,
    promptCacheKey: OPENAI_LUNA_PROMPT_CACHE_KEY,
    promptCacheOptions: {
      mode: "implicit",
      ttl: "30m",
    },
    contextManagement: [
      {
        type: "compaction",
        compactThreshold:
          input.compactThreshold ?? OPENAI_LUNA_COMPACT_THRESHOLD,
      },
    ],
    ...(input.previousResponseId === undefined
      ? {}
      : { previousResponseId: input.previousResponseId }),
    ...(input.allowedToolNames === undefined
      ? {}
      : {
          allowedTools: {
            toolNames: input.allowedToolNames,
            mode: "required" as const,
          },
        }),
  };
}
