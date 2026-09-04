import { MAYI_AI_PROMPT_VERSION } from "../mayIAgent.prompt-version";
import type { OpenRouterMuseReasoningEffort } from "../openrouter-muse-profile";
import type {
  AIPlayerEvalCandidateIdentity,
  AIPlayerEvalTokenPricing,
} from "./ai-player-eval-score";
import {
  createAIPlayerEvalModelConfigurationSnapshot,
  type AIPlayerEvalModelConfiguration,
} from "./ai-player-model-configuration";

export const LUNA_BASELINE_CANDIDATE_ID = "luna-xhigh-baseline" as const;

export const SPARK_HILL_CLIMB_CANDIDATE_IDS = [
  "spark-minimal",
  "spark-low",
  "spark-medium",
  "spark-high",
  "spark-xhigh",
] as const;

export type SparkHillClimbCandidateId =
  (typeof SPARK_HILL_CLIMB_CANDIDATE_IDS)[number];
export type AIPlayerEvalCandidateId =
  | typeof LUNA_BASELINE_CANDIDATE_ID
  | SparkHillClimbCandidateId;

export interface AIPlayerEvalCandidateDefinition
  extends AIPlayerEvalCandidateIdentity {
  role: "baseline" | "hill-climb";
  pricing: AIPlayerEvalTokenPricing;
  modelConfiguration: AIPlayerEvalModelConfiguration;
  modelConfigurationSha256: string;
}

const LUNA_PRICING: AIPlayerEvalTokenPricing = {
  noCacheInputPerMillionUsd: 0.2,
  cacheReadInputPerMillionUsd: 0.02,
  cacheWriteInputPerMillionUsd: 0.25,
  outputPerMillionUsd: 1.2,
};

const SPARK_PRICING: AIPlayerEvalTokenPricing = {
  noCacheInputPerMillionUsd: 0.1,
  cacheReadInputPerMillionUsd: 0.002,
  cacheWriteInputPerMillionUsd: 0.1,
  outputPerMillionUsd: 0.2,
};

function sparkCandidate(
  id: SparkHillClimbCandidateId,
  reasoningEffort: OpenRouterMuseReasoningEffort,
): AIPlayerEvalCandidateDefinition {
  const modelConfiguration = createAIPlayerEvalModelConfigurationSnapshot(
    "default:meta",
    reasoningEffort,
  );
  return {
    id,
    role: "hill-climb",
    modelId: "default:meta",
    provider: "openrouter",
    reasoningEffort,
    promptVersion: MAYI_AI_PROMPT_VERSION,
    pricing: SPARK_PRICING,
    modelConfiguration: modelConfiguration.configuration,
    modelConfigurationSha256: modelConfiguration.sha256,
  };
}

function lunaBaselineCandidate(): AIPlayerEvalCandidateDefinition {
  const modelConfiguration = createAIPlayerEvalModelConfigurationSnapshot(
    "default:openai",
    "xhigh",
  );
  return {
    id: LUNA_BASELINE_CANDIDATE_ID,
    role: "baseline",
    modelId: "default:openai",
    provider: "openai",
    reasoningEffort: "xhigh",
    promptVersion: MAYI_AI_PROMPT_VERSION,
    pricing: LUNA_PRICING,
    modelConfiguration: modelConfiguration.configuration,
    modelConfigurationSha256: modelConfiguration.sha256,
  };
}

export const AI_PLAYER_EVAL_CANDIDATES: Record<
  AIPlayerEvalCandidateId,
  AIPlayerEvalCandidateDefinition
> = {
  [LUNA_BASELINE_CANDIDATE_ID]: lunaBaselineCandidate(),
  "spark-minimal": sparkCandidate("spark-minimal", "minimal"),
  "spark-low": sparkCandidate("spark-low", "low"),
  "spark-medium": sparkCandidate("spark-medium", "medium"),
  "spark-high": sparkCandidate("spark-high", "high"),
  "spark-xhigh": sparkCandidate("spark-xhigh", "xhigh"),
};
