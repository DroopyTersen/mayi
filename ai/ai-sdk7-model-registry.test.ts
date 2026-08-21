import { describe, expect, it } from "bun:test";
import type { LanguageModel } from "ai";
import { createWorkerAIModel } from "../app/party/ai-model-factory";
import {
  AI_MODEL_CATALOG,
  DEFAULT_AI_MODEL_ID,
  type AIModelId,
} from "./ai-model-catalog";
import { modelRegistry } from "./modelRegistry";

function getProviderId(model: LanguageModel): string {
  if (typeof model === "string") {
    throw new Error(`Expected a provider model, received global model ID: ${model}`);
  }
  return model.provider;
}

describe("AI SDK 7 model registry", () => {
  it("defines every supported picker model once with its resolved provider model", () => {
    const expected: AIModelId[] = [
      "default:openai",
      "default:grok",
      "default:claude",
      "default:gemini",
    ];

    expect(Object.keys(AI_MODEL_CATALOG)).toEqual(expected);
    expect(DEFAULT_AI_MODEL_ID).toBe("default:openai");
    expect(AI_MODEL_CATALOG[DEFAULT_AI_MODEL_ID]).toMatchObject({
      model: "gpt-5.6-luna",
      provider: "openai",
      name: "GPT-5.6 Luna",
    });
  });

  it("keeps Grok on the Chat transport in CLI and Worker model factories", () => {
    expect(getProviderId(modelRegistry.languageModel("default:grok"))).toBe("xai.chat");
    expect(getProviderId(createWorkerAIModel("default:grok", {}))).toBe("xai.chat");
  });

  it("rejects IDs outside the picker catalog instead of silently substituting Luna", () => {
    expect(() => createWorkerAIModel("xai:grok-4-1-fast-reasoning", {})).toThrow(
      'Unsupported AI model ID: xai:grok-4-1-fast-reasoning',
    );
  });

  it("uses the Google provider for Gemini in CLI and Worker factories", () => {
    expect(getProviderId(modelRegistry.languageModel("default:gemini"))).toBe(
      "google.generative-ai",
    );
    expect(getProviderId(createWorkerAIModel("default:gemini", {}))).toBe(
      "google.generative-ai",
    );
  });

  it("does not pass a generic temperature to Luna", async () => {
    expect(AI_MODEL_CATALOG["default:openai"].settings).toEqual({ maxOutputTokens: 4096 });
    expect(AI_MODEL_CATALOG["default:grok"].settings.temperature).toBe(0.7);
  });
});
