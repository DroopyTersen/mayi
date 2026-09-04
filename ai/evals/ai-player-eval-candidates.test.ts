import { describe, expect, it } from "bun:test";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  LUNA_BASELINE_CANDIDATE_ID,
  SPARK_HILL_CLIMB_CANDIDATE_IDS,
} from "./ai-player-eval-candidates";
import { fingerprintAIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";

describe("AI player evaluation candidates", () => {
  it("freezes Luna as a one-time baseline", () => {
    const baseline = AI_PLAYER_EVAL_CANDIDATES[LUNA_BASELINE_CANDIDATE_ID];

    expect(baseline).toMatchObject({
      role: "baseline",
      modelId: "default:openai",
      provider: "openai",
      reasoningEffort: "xhigh",
      promptVersion: "house-rules-v1+player-guidance-v1+tool-protocol-v1",
      modelConfiguration: {
        resolvedModelId: "gpt-5.6-luna",
        transport: "responses",
      },
    });
    expect(
      fingerprintAIPlayerEvalModelConfiguration(baseline.modelConfiguration),
    ).toBe(baseline.modelConfigurationSha256);
    expect(
      SPARK_HILL_CLIMB_CANDIDATE_IDS.some(
        (candidateId) => AI_PLAYER_EVAL_CANDIDATES[candidateId].provider === "openai",
      ),
    ).toBe(false);
  });

  it("uses Spark for the complete supported effort ladder", () => {
    expect(
      SPARK_HILL_CLIMB_CANDIDATE_IDS.map(
        (candidateId) => AI_PLAYER_EVAL_CANDIDATES[candidateId].reasoningEffort,
      ),
    ).toEqual(["minimal", "low", "medium", "high", "xhigh"]);

    for (const candidateId of SPARK_HILL_CLIMB_CANDIDATE_IDS) {
      expect(AI_PLAYER_EVAL_CANDIDATES[candidateId]).toMatchObject({
        role: "hill-climb",
        modelId: "default:meta",
        provider: "openrouter",
        promptVersion: "house-rules-v1+player-guidance-v1+tool-protocol-v1",
        pricing: {
          noCacheInputPerMillionUsd: 0.1,
          cacheReadInputPerMillionUsd: 0.002,
          cacheWriteInputPerMillionUsd: 0.1,
          outputPerMillionUsd: 0.2,
        },
        modelConfiguration: {
          resolvedModelId: "meta/muse-spark-1.3-contributor",
          transport: "chat",
        },
      });
      const candidate = AI_PLAYER_EVAL_CANDIDATES[candidateId];
      expect(
        fingerprintAIPlayerEvalModelConfiguration(
          candidate.modelConfiguration,
        ),
      ).toBe(candidate.modelConfigurationSha256);
    }
  });
});
