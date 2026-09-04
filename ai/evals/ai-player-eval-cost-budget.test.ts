import { describe, expect, it } from "bun:test";
import {
  AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
  DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD,
  completeAIPlayerEvalCostBudgetUnit,
  createAIPlayerEvalCostBudget,
  parseAIPlayerEvalMaxCostUsd,
  parseAIPlayerEvalCostBudgetSummary,
  recordAIPlayerEvalCost,
  shouldStartAIPlayerEvalCostBudgetUnit,
  summarizeAIPlayerEvalCostBudget,
} from "./ai-player-eval-cost-budget";

describe("AI player evaluation cost budget", () => {
  it("defaults to a cheap observed-cost stop policy", () => {
    expect(AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION).toBe(
      "matched-unit-observed-cost-v1",
    );
    expect(DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD).toBe(0.25);
    expect(parseAIPlayerEvalMaxCostUsd("0.075")).toBe(0.075);
  });

  it("rejects invalid dollar thresholds", () => {
    for (const value of ["0", "-1", "NaN", "Infinity", "one-dollar"]) {
      expect(() => parseAIPlayerEvalMaxCostUsd(value)).toThrow(
        "Maximum cost must be a positive finite number",
      );
    }
  });

  it("finishes the current matched unit before stopping at the threshold", () => {
    const budget = createAIPlayerEvalCostBudget(0.01);

    expect(shouldStartAIPlayerEvalCostBudgetUnit(budget)).toBe(true);
    recordAIPlayerEvalCost(budget, 0.006);
    recordAIPlayerEvalCost(budget, 0.006);
    completeAIPlayerEvalCostBudgetUnit(budget);

    expect(shouldStartAIPlayerEvalCostBudgetUnit(budget)).toBe(false);
    expect(
      summarizeAIPlayerEvalCostBudget(budget, {
        plannedUnitCount: 4,
        plannedResultCount: 8,
        executedResultCount: 2,
      }),
    ).toEqual({
      policyVersion: "matched-unit-observed-cost-v1",
      status: "cost-limit",
      maxCostUsd: 0.01,
      observedCostUsd: 0.012,
      overshootUsd: 0.002,
      unknownCostResultCount: 0,
      plannedUnitCount: 4,
      completedUnitCount: 1,
      plannedResultCount: 8,
      executedResultCount: 2,
    });
  });

  it("stops after a matched unit whose cost cannot be measured", () => {
    const budget = createAIPlayerEvalCostBudget(0.25);

    recordAIPlayerEvalCost(budget, undefined);
    completeAIPlayerEvalCostBudgetUnit(budget);

    expect(shouldStartAIPlayerEvalCostBudgetUnit(budget)).toBe(false);
    expect(
      summarizeAIPlayerEvalCostBudget(budget, {
        plannedUnitCount: 2,
        plannedResultCount: 2,
        executedResultCount: 1,
      }).status,
    ).toBe("unknown-cost");
  });

  it("does not call the run complete when the final result cost is unknown", () => {
    const budget = createAIPlayerEvalCostBudget(0.25);
    recordAIPlayerEvalCost(budget, undefined);
    completeAIPlayerEvalCostBudgetUnit(budget);

    expect(
      summarizeAIPlayerEvalCostBudget(budget, {
        plannedUnitCount: 1,
        plannedResultCount: 1,
        executedResultCount: 1,
      }).status,
    ).toBe("unknown-cost");
  });

  it("reports a complete run independently of unused budget", () => {
    const budget = createAIPlayerEvalCostBudget(0.25);
    recordAIPlayerEvalCost(budget, 0.001);
    completeAIPlayerEvalCostBudgetUnit(budget);

    expect(
      summarizeAIPlayerEvalCostBudget(budget, {
        plannedUnitCount: 1,
        plannedResultCount: 1,
        executedResultCount: 1,
      }).status,
    ).toBe("completed");
  });

  it("parses a persisted run status without trusting malformed data", () => {
    const summary = summarizeAIPlayerEvalCostBudget(
      createAIPlayerEvalCostBudget(0.25),
      {
        plannedUnitCount: 0,
        plannedResultCount: 0,
        executedResultCount: 0,
      },
    );
    expect(parseAIPlayerEvalCostBudgetSummary(summary)).toEqual(summary);
    expect(() =>
      parseAIPlayerEvalCostBudgetSummary({ ...summary, status: "running" }),
    ).toThrow("run-status.status is invalid");
  });
});
