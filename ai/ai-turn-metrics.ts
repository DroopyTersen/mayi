import type { LanguageModelUsage, ProviderMetadata } from "ai";

export interface AITurnStepPerformance {
  responseTimeMs: number;
  toolExecutionMs: Readonly<Record<string, number>>;
}

export interface AITurnMetrics {
  turnDurationMs: number;
  providerDurationMs: number;
  toolExecutionDurationMs: number;
  orchestrationDurationMs: number;
  stepCount: number;
  inputTokens: number | undefined;
  noCacheInputTokens: number | undefined;
  cacheReadInputTokens: number | undefined;
  cacheWriteInputTokens: number | undefined;
  outputTokens: number | undefined;
  textOutputTokens: number | undefined;
  reasoningOutputTokens: number | undefined;
  totalTokens: number | undefined;
  providerReportedCostUsd: number | undefined;
}

export interface SummarizeAITurnMetricsInput {
  turnDurationMs: number;
  stepPerformance: AITurnStepPerformance[];
  usage: LanguageModelUsage;
  stepProviderMetadata?: Array<ProviderMetadata | undefined>;
}

function getOpenRouterCostUsd(
  providerMetadata: ProviderMetadata | undefined,
): number | undefined {
  const usage = providerMetadata?.openrouter?.usage;
  if (typeof usage !== "object" || usage === null) return undefined;

  const cost = Reflect.get(usage, "cost");
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0
    ? cost
    : undefined;
}

export function summarizeAITurnMetrics(
  input: SummarizeAITurnMetricsInput,
): AITurnMetrics {
  const providerDurationMs = input.stepPerformance.reduce(
    (total, step) => total + step.responseTimeMs,
    0,
  );
  const toolExecutionDurationMs = input.stepPerformance.reduce(
    (total, step) =>
      total +
      Object.values(step.toolExecutionMs).reduce(
        (stepTotal, durationMs) => stepTotal + durationMs,
        0,
      ),
    0,
  );
  const providerCosts = (input.stepProviderMetadata ?? [])
    .map(getOpenRouterCostUsd)
    .filter((cost): cost is number => cost !== undefined);

  return {
    turnDurationMs: input.turnDurationMs,
    providerDurationMs,
    toolExecutionDurationMs,
    orchestrationDurationMs: Math.max(
      0,
      input.turnDurationMs - providerDurationMs - toolExecutionDurationMs,
    ),
    stepCount: input.stepPerformance.length,
    inputTokens: input.usage.inputTokens,
    noCacheInputTokens: input.usage.inputTokenDetails.noCacheTokens,
    cacheReadInputTokens: input.usage.inputTokenDetails.cacheReadTokens,
    cacheWriteInputTokens: input.usage.inputTokenDetails.cacheWriteTokens,
    outputTokens: input.usage.outputTokens,
    textOutputTokens: input.usage.outputTokenDetails.textTokens,
    reasoningOutputTokens: input.usage.outputTokenDetails.reasoningTokens,
    totalTokens: input.usage.totalTokens,
    providerReportedCostUsd:
      providerCosts.length === 0
        ? undefined
        : providerCosts.reduce((total, cost) => total + cost, 0),
  };
}
