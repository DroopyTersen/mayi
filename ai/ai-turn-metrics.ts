import type { LanguageModelUsage } from "ai";

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
}

export interface SummarizeAITurnMetricsInput {
  turnDurationMs: number;
  stepPerformance: AITurnStepPerformance[];
  usage: LanguageModelUsage;
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
  };
}
