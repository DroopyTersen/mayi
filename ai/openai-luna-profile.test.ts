import { describe, expect, it } from "bun:test";
import {
  MAYI_AI_PROMPT_VERSION,
  OPENAI_LUNA_MODEL_ID,
  createOpenAILunaInstructions,
  createOpenAILunaProviderOptions,
  isOpenAILunaModel,
} from "./openai-luna-profile";

describe("GPT-5.6 Luna profile", () => {
  it("uses the auditable medium-reasoning Responses defaults", () => {
    expect(OPENAI_LUNA_MODEL_ID).toBe("gpt-5.6-luna");
    expect(MAYI_AI_PROMPT_VERSION).toBe("house-rules-v3");

    expect(createOpenAILunaProviderOptions({})).toEqual({
      store: true,
      reasoningEffort: "medium",
      reasoningContext: "all_turns",
      reasoningSummary: null,
      textVerbosity: "low",
      parallelToolCalls: false,
      promptCacheKey: "mayi:gpt-5.6-luna:house-rules-v3",
      promptCacheOptions: {
        mode: "implicit",
        ttl: "30m",
      },
      contextManagement: [
        {
          type: "compaction",
          compactThreshold: 200_000,
        },
      ],
    });
  });

  it("adds prior response continuity and honors a compaction override", () => {
    expect(
      createOpenAILunaProviderOptions({
        previousResponseId: "resp_previous",
        compactThreshold: 4_096,
      }),
    ).toEqual({
      store: true,
      reasoningEffort: "medium",
      reasoningContext: "all_turns",
      reasoningSummary: null,
      textVerbosity: "low",
      parallelToolCalls: false,
      promptCacheKey: "mayi:gpt-5.6-luna:house-rules-v3",
      promptCacheOptions: {
        mode: "implicit",
        ttl: "30m",
      },
      previousResponseId: "resp_previous",
      contextManagement: [
        {
          type: "compaction",
          compactThreshold: 4_096,
        },
      ],
    });
  });

  it("keeps house rules in the explicitly cacheable stable instruction prefix", () => {
    expect(createOpenAILunaInstructions("authoritative house rules")).toEqual({
      role: "system",
      content: "authoritative house rules",
      providerOptions: {
        openai: {
          promptCacheBreakpoint: { mode: "explicit" },
        },
      },
    });
  });

  it("restricts each phase without changing the stable tool definitions", () => {
    expect(
      createOpenAILunaProviderOptions({
        allowedToolNames: ["draw_from_stock", "draw_from_discard"],
      }).allowedTools,
    ).toEqual({
      toolNames: ["draw_from_stock", "draw_from_discard"],
      mode: "required",
    });
  });

  it("selects the Luna profile only through the canonical model catalog", () => {
    expect(isOpenAILunaModel("default:openai")).toBe(true);
    expect(isOpenAILunaModel("openai:gpt-5.6-luna")).toBe(false);
    expect(isOpenAILunaModel(undefined)).toBe(false);
    expect(isOpenAILunaModel("default:grok")).toBe(false);
  });
});
