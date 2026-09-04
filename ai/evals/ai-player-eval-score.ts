import type { AIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";

export type AIPlayerEvalSplit = "development" | "holdout";

export type AIPlayerEvalFailureMode =
  | "none"
  | "provider"
  | "turn-incomplete"
  | "illegal-action"
  | "strategy"
  | "harness-artifact";

export interface AIPlayerEvalCandidateIdentity {
  id: string;
  modelId: string;
  provider: string;
  reasoningEffort: string;
  promptVersion: string;
  /** Fingerprint of the resolved provider and inference configuration. */
  modelConfigurationSha256?: string;
  /** Full resolved configuration; manifests include it, case rows retain the hash. */
  modelConfiguration?: AIPlayerEvalModelConfiguration;
}

export interface AIPlayerEvalScenarioIdentity {
  id: string;
  split: AIPlayerEvalSplit;
  category: string;
  description: string;
}

export interface AIPlayerEvalCriterionResult {
  id: string;
  description: string;
  weight: number;
  passed: boolean;
  evidence: string;
  /** Optional evaluator-only measurements; distinguish opportunity from outcome. */
  measurements?: Readonly<Record<string, number | boolean | string | null>>;
}

export interface AIPlayerEvalTiming {
  /** Model loop only; intentionally excludes presentation pacing. */
  turnDurationMs: number | undefined;
  providerDurationMs: number | undefined;
  toolExecutionDurationMs: number | undefined;
  orchestrationDurationMs: number | undefined;
  pacingDelayMs: number;
}

export interface AIPlayerEvalUsage {
  inputTokens: number | undefined;
  noCacheInputTokens: number | undefined;
  cacheReadInputTokens: number | undefined;
  cacheWriteInputTokens: number | undefined;
  outputTokens: number | undefined;
  reasoningOutputTokens: number | undefined;
  totalTokens: number | undefined;
}

export interface AIPlayerEvalCaseResult {
  schemaVersion: 1;
  runId: string;
  candidate: AIPlayerEvalCandidateIdentity;
  scenario: AIPlayerEvalScenarioIdentity;
  repetition: number;
  completed: boolean;
  legal: boolean;
  criteria: AIPlayerEvalCriterionResult[];
  failureMode: AIPlayerEvalFailureMode;
  retries: number;
  timing: AIPlayerEvalTiming;
  usage: AIPlayerEvalUsage;
  providerReportedCostUsd: number | undefined;
  reconstructedCostUsd: number | undefined;
  /** Exact public/evaluated-player state text presented to the model. */
  inputState: string;
  outcome: {
    phase: string;
    turnPhase: string | null;
    awaitingPlayerId: string | null;
    evaluatedPlayerHandCardIds: string[];
    tableMeldCount: number;
    topDiscardCardId: string | null;
    lastError: string | null;
  };
  actions: string[];
  warnings: string[];
}

export interface AIPlayerEvalTokenPricing {
  noCacheInputPerMillionUsd: number;
  cacheReadInputPerMillionUsd: number;
  cacheWriteInputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface AIPlayerEvalCaseScore {
  earnedWeight: number;
  possibleWeight: number;
  qualityPercent: number;
}

export interface AIPlayerEvalLatencySummary {
  p50: number | undefined;
  p95: number | undefined;
}

export interface AIPlayerEvalConfidenceInterval {
  lower: number;
  upper: number;
}

export interface AIPlayerEvalAggregate {
  caseCount: number;
  completionRate: number;
  legalRate: number;
  qualityPercent: number;
  qualityConfidence95: AIPlayerEvalConfidenceInterval;
  developmentQualityPercent: number | undefined;
  holdoutQualityPercent: number | undefined;
  turnLatencyMs: AIPlayerEvalLatencySummary;
  providerLatencyMs: AIPlayerEvalLatencySummary;
  pacingDelayMs: AIPlayerEvalLatencySummary;
  totalCostUsd: number;
  costPerCompletedTurnUsd: number | undefined;
  retryCount: number;
  failureModes: Record<string, number>;
}

function finiteOrZero(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

export function reconstructAIPlayerEvalCostUsd(
  usage: AIPlayerEvalUsage,
  pricing: AIPlayerEvalTokenPricing,
): number | undefined {
  const hasUsage = [
    usage.inputTokens,
    usage.noCacheInputTokens,
    usage.cacheReadInputTokens,
    usage.cacheWriteInputTokens,
    usage.outputTokens,
  ].some((value) => value !== undefined);
  if (!hasUsage) return undefined;

  const cacheRead = finiteOrZero(usage.cacheReadInputTokens);
  const cacheWrite = finiteOrZero(usage.cacheWriteInputTokens);
  const noCache =
    usage.noCacheInputTokens === undefined
      ? Math.max(0, finiteOrZero(usage.inputTokens) - cacheRead - cacheWrite)
      : finiteOrZero(usage.noCacheInputTokens);
  const output = finiteOrZero(usage.outputTokens);

  return (
    noCache * pricing.noCacheInputPerMillionUsd +
    cacheRead * pricing.cacheReadInputPerMillionUsd +
    cacheWrite * pricing.cacheWriteInputPerMillionUsd +
    output * pricing.outputPerMillionUsd
  ) / 1_000_000;
}

export function scoreAIPlayerEvalCase(
  result: AIPlayerEvalCaseResult,
): AIPlayerEvalCaseScore {
  const possibleWeight = result.criteria.reduce(
    (total, criterion) => total + Math.max(0, criterion.weight),
    0,
  );
  const earnedWeight =
    result.completed && result.legal
      ? result.criteria.reduce(
          (total, criterion) =>
            total + (criterion.passed ? Math.max(0, criterion.weight) : 0),
          0,
        )
      : 0;

  return {
    earnedWeight,
    possibleWeight,
    qualityPercent:
      possibleWeight === 0 ? 0 : (earnedWeight / possibleWeight) * 100,
  };
}

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(
  values: readonly (number | undefined)[],
  requestedPercentile: number,
): number | undefined {
  const sorted = values
    .filter((value): value is number => value !== undefined && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return undefined;

  const rank = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil((requestedPercentile / 100) * sorted.length) - 1,
    ),
  );
  return sorted[rank];
}

function summarizeLatency(
  values: readonly (number | undefined)[],
): AIPlayerEvalLatencySummary {
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function averageQuality(
  results: readonly AIPlayerEvalCaseResult[],
): number | undefined {
  return mean(results.map((result) => scoreAIPlayerEvalCase(result).qualityPercent));
}

function qualityConfidence95(
  results: readonly AIPlayerEvalCaseResult[],
): AIPlayerEvalConfidenceInterval {
  const values = results.map(
    (result) => scoreAIPlayerEvalCase(result).qualityPercent,
  );
  const average = mean(values) ?? 0;
  if (values.length < 2) return { lower: average, upper: average };

  const squaredDeviationTotal = values.reduce(
    (total, value) => total + (value - average) ** 2,
    0,
  );
  const sampleVariance = squaredDeviationTotal / (values.length - 1);
  const standardError = Math.sqrt(sampleVariance / values.length);
  const margin = 1.96 * standardError;
  return {
    lower: Math.max(0, average - margin),
    upper: Math.min(100, average + margin),
  };
}

function resultCost(result: AIPlayerEvalCaseResult): number {
  return (
    result.providerReportedCostUsd ?? result.reconstructedCostUsd ?? 0
  );
}

export function aggregateAIPlayerEvalResults(
  results: readonly AIPlayerEvalCaseResult[],
): AIPlayerEvalAggregate {
  const caseCount = results.length;
  const completedCount = results.filter((result) => result.completed).length;
  const development = results.filter(
    (result) => result.scenario.split === "development",
  );
  const holdout = results.filter(
    (result) => result.scenario.split === "holdout",
  );
  const totalCostUsd = results.reduce(
    (total, result) => total + resultCost(result),
    0,
  );
  const failureModes: Record<string, number> = {};
  for (const result of results) {
    failureModes[result.failureMode] =
      (failureModes[result.failureMode] ?? 0) + 1;
  }

  return {
    caseCount,
    completionRate: caseCount === 0 ? 0 : completedCount / caseCount,
    legalRate:
      caseCount === 0
        ? 0
        : results.filter((result) => result.legal).length / caseCount,
    qualityPercent: averageQuality(results) ?? 0,
    qualityConfidence95: qualityConfidence95(results),
    developmentQualityPercent: averageQuality(development),
    holdoutQualityPercent: averageQuality(holdout),
    turnLatencyMs: summarizeLatency(
      results.map((result) => result.timing.turnDurationMs),
    ),
    providerLatencyMs: summarizeLatency(
      results.map((result) => result.timing.providerDurationMs),
    ),
    pacingDelayMs: summarizeLatency(
      results.map((result) => result.timing.pacingDelayMs),
    ),
    totalCostUsd,
    costPerCompletedTurnUsd:
      completedCount === 0 ? undefined : totalCostUsd / completedCount,
    retryCount: results.reduce((total, result) => total + result.retries, 0),
    failureModes,
  };
}
