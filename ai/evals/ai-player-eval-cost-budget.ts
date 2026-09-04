export const AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION =
  "matched-unit-observed-cost-v1";
export const DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD = 0.25;

export type AIPlayerEvalCostBudgetStatus =
  | "completed"
  | "cost-limit"
  | "unknown-cost";

export interface AIPlayerEvalCostBudget {
  maxCostUsd: number;
  observedCostUsd: number;
  unknownCostResultCount: number;
  completedUnitCount: number;
}

export interface AIPlayerEvalCostBudgetSummary {
  policyVersion: typeof AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION;
  status: AIPlayerEvalCostBudgetStatus;
  maxCostUsd: number;
  observedCostUsd: number;
  overshootUsd: number;
  unknownCostResultCount: number;
  plannedUnitCount: number;
  completedUnitCount: number;
  plannedResultCount: number;
  executedResultCount: number;
}

interface AIPlayerEvalCostBudgetPlan {
  plannedUnitCount: number;
  plannedResultCount: number;
  executedResultCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonnegativeFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`run-status.${key} must be a nonnegative finite number`);
  }
  return value;
}

function requireNonnegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = requireNonnegativeFiniteNumber(record, key);
  if (!Number.isInteger(value)) {
    throw new Error(`run-status.${key} must be a nonnegative integer`);
  }
  return value;
}

function currency(value: number): number {
  return Number(value.toFixed(12));
}

export function parseAIPlayerEvalMaxCostUsd(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Maximum cost must be a positive finite number");
  }
  return parsed;
}

export function createAIPlayerEvalCostBudget(
  maxCostUsd: number,
): AIPlayerEvalCostBudget {
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    throw new Error("Maximum cost must be a positive finite number");
  }
  return {
    maxCostUsd,
    observedCostUsd: 0,
    unknownCostResultCount: 0,
    completedUnitCount: 0,
  };
}

export function recordAIPlayerEvalCost(
  budget: AIPlayerEvalCostBudget,
  costUsd: number | undefined,
): void {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd < 0) {
    budget.unknownCostResultCount++;
    return;
  }
  budget.observedCostUsd = currency(budget.observedCostUsd + costUsd);
}

export function completeAIPlayerEvalCostBudgetUnit(
  budget: AIPlayerEvalCostBudget,
): void {
  budget.completedUnitCount++;
}

export function shouldStartAIPlayerEvalCostBudgetUnit(
  budget: AIPlayerEvalCostBudget,
): boolean {
  if (budget.completedUnitCount === 0) return true;
  return (
    budget.unknownCostResultCount === 0 &&
    budget.observedCostUsd < budget.maxCostUsd
  );
}

export function summarizeAIPlayerEvalCostBudget(
  budget: AIPlayerEvalCostBudget,
  plan: AIPlayerEvalCostBudgetPlan,
): AIPlayerEvalCostBudgetSummary {
  const status: AIPlayerEvalCostBudgetStatus =
    budget.unknownCostResultCount > 0
      ? "unknown-cost"
      : budget.completedUnitCount >= plan.plannedUnitCount
        ? "completed"
        : "cost-limit";
  return {
    policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
    status,
    maxCostUsd: budget.maxCostUsd,
    observedCostUsd: budget.observedCostUsd,
    overshootUsd: currency(
      Math.max(0, budget.observedCostUsd - budget.maxCostUsd),
    ),
    unknownCostResultCount: budget.unknownCostResultCount,
    plannedUnitCount: plan.plannedUnitCount,
    completedUnitCount: budget.completedUnitCount,
    plannedResultCount: plan.plannedResultCount,
    executedResultCount: plan.executedResultCount,
  };
}

export function parseAIPlayerEvalCostBudgetSummary(
  value: unknown,
): AIPlayerEvalCostBudgetSummary {
  if (!isRecord(value)) throw new Error("run-status must be an object");
  if (value.policyVersion !== AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION) {
    throw new Error("run-status.policyVersion is invalid");
  }
  if (
    value.status !== "completed" &&
    value.status !== "cost-limit" &&
    value.status !== "unknown-cost"
  ) {
    throw new Error("run-status.status is invalid");
  }
  const maxCostUsd = requireNonnegativeFiniteNumber(value, "maxCostUsd");
  if (maxCostUsd === 0) {
    throw new Error("run-status.maxCostUsd must be positive");
  }
  return {
    policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
    status: value.status,
    maxCostUsd,
    observedCostUsd: requireNonnegativeFiniteNumber(value, "observedCostUsd"),
    overshootUsd: requireNonnegativeFiniteNumber(value, "overshootUsd"),
    unknownCostResultCount: requireNonnegativeInteger(
      value,
      "unknownCostResultCount",
    ),
    plannedUnitCount: requireNonnegativeInteger(value, "plannedUnitCount"),
    completedUnitCount: requireNonnegativeInteger(
      value,
      "completedUnitCount",
    ),
    plannedResultCount: requireNonnegativeInteger(
      value,
      "plannedResultCount",
    ),
    executedResultCount: requireNonnegativeInteger(
      value,
      "executedResultCount",
    ),
  };
}
