import { describe, expect, it } from "bun:test";
import {
  createAIPlayerEvalModelConfigurationSnapshot,
  fingerprintAIPlayerEvalModelConfiguration,
} from "./ai-player-model-configuration";

describe("AI player evaluation model configuration", () => {
  it("records static Luna provider settings without a special player path", () => {
    const snapshot = createAIPlayerEvalModelConfigurationSnapshot(
      "default:openai",
      "xhigh",
    );

    expect(snapshot.configuration).toEqual({
      schemaVersion: 1,
      configuredModelId: "default:openai",
      resolvedModelId: "gpt-5.6-luna",
      provider: "openai",
      profile: "standard",
      transport: "responses",
      modelSettings: { maxOutputTokens: 4096 },
      requestProviderOptions: {
        openai: {
          store: false,
          reasoningEffort: "xhigh",
          textVerbosity: "low",
          parallelToolCalls: false,
        },
      },
      dynamicTurnPolicy: {
        allowedTools: "current available tool names",
      },
    });
    expect(snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      fingerprintAIPlayerEvalModelConfiguration(snapshot.configuration),
    ).toBe(snapshot.sha256);
  });

  it("makes Spark reasoning effort part of the OpenRouter Chat fingerprint", () => {
    const minimal = createAIPlayerEvalModelConfigurationSnapshot(
      "default:meta",
      "minimal",
    );
    const high = createAIPlayerEvalModelConfigurationSnapshot(
      "default:meta",
      "high",
    );

    expect(minimal.configuration).toEqual({
      schemaVersion: 1,
      configuredModelId: "default:meta",
      resolvedModelId: "meta/muse-spark-1.3-contributor",
      provider: "openrouter",
      profile: "standard",
      transport: "chat",
      modelSettings: { maxOutputTokens: 4096, temperature: 0.7 },
      requestProviderOptions: {
        openrouter: {
          reasoning: { effort: "minimal", exclude: true },
          usage: { include: true },
        },
      },
      dynamicTurnPolicy: {
        allowedTools: "current available tool names",
      },
    });
    expect(high.configuration.requestProviderOptions).toEqual({
      openrouter: {
        reasoning: { effort: "high", exclude: true },
        usage: { include: true },
      },
    });
    expect(high.sha256).not.toBe(minimal.sha256);
  });

  it("rejects an effort that does not match the selected provider profile", () => {
    expect(() =>
      createAIPlayerEvalModelConfigurationSnapshot(
        "default:openai",
        "medium",
      ),
    ).toThrow("Luna evaluation configuration requires xhigh reasoning effort");
    expect(() =>
      createAIPlayerEvalModelConfigurationSnapshot(
        "default:meta",
        "ultra",
      ),
    ).toThrow("Unsupported Spark reasoning effort: ultra");
  });
});
