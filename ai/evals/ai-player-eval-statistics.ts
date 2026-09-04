import type { AIPlayerEvalConfidenceInterval } from "./ai-player-eval-score";

const STUDENT_T_CRITICAL_95 = [
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.16,
  2.145,
  2.131,
  2.12,
  2.11,
  2.101,
  2.093,
  2.086,
  2.08,
  2.074,
  2.069,
  2.064,
  2.06,
  2.056,
  2.052,
  2.048,
  2.045,
  2.042,
] as const;

export function meanAIPlayerEvalMetric(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function meanAIPlayerEvalMetricByGroup(
  values: readonly { groupId: string; value: number }[],
): number[] {
  const grouped = new Map<string, number[]>();
  for (const entry of values) {
    const group = grouped.get(entry.groupId) ?? [];
    group.push(entry.value);
    grouped.set(entry.groupId, group);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => meanAIPlayerEvalMetric(group));
}

export function pairedStudentTConfidence95(
  values: readonly number[],
  bounds: { lower: number; upper: number } = {
    lower: -Infinity,
    upper: Infinity,
  },
): AIPlayerEvalConfidenceInterval {
  if (values.length === 0) {
    throw new Error("Paired confidence interval requires at least one value");
  }
  const average = meanAIPlayerEvalMetric(values);
  if (values.length === 1) return { lower: average, upper: average };
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    (values.length - 1);
  const standardError = Math.sqrt(variance / values.length);
  const degreesOfFreedom = values.length - 1;
  const criticalValue =
    STUDENT_T_CRITICAL_95[degreesOfFreedom - 1] ?? 1.96;
  const margin = criticalValue * standardError;
  return {
    lower: Math.max(bounds.lower, average - margin),
    upper: Math.min(bounds.upper, average + margin),
  };
}
