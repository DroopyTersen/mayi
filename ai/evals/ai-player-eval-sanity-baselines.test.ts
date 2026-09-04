import { describe, expect, it } from "bun:test";
import { AI_PLAYER_FIXED_STATE_SCENARIOS } from "./ai-player-fixed-state-scenarios";
import {
  evaluateBlindLegalFixedStateBaseline,
  evaluateRuleAwareGreedyFixedStateBaseline,
} from "./ai-player-eval-sanity-baselines";

describe("AI player evaluation sanity baselines", () => {
  it("makes legal but strategically blind play score far below the oracle", async () => {
    const summary = await evaluateBlindLegalFixedStateBaseline(
      AI_PLAYER_FIXED_STATE_SCENARIOS,
    );

    expect(summary.policyId).toBe("blind-legal-v2");
    expect(summary.caseCount).toBe(20);
    expect(summary.completedRate).toBe(1);
    expect(summary.legalRate).toBe(1);
    expect(summary.oracleQualityPercent).toBe(100);
    expect(summary.qualityPercent).toBe(31);
    expect(summary.qualityGapVsOraclePercentPoints).toBe(69);
    expect(summary.caseResults).toHaveLength(20);
  });

  it("keeps the blind baseline weak across deterministic hand-order permutations", async () => {
    const summary = await evaluateBlindLegalFixedStateBaseline(
      AI_PLAYER_FIXED_STATE_SCENARIOS,
      3,
    );

    expect(summary.repetitionCount).toBe(3);
    expect(summary.caseCount).toBe(60);
    expect(summary.completedRate).toBe(1);
    expect(summary.legalRate).toBe(1);
    expect(summary.oracleQualityPercent).toBe(100);
    expect(summary.qualityPercent).toBe(31);
    expect(summary.qualityGapVsOraclePercentPoints).toBe(69);
    expect(summary.repetitionSummaries).toHaveLength(3);
    expect(
      summary.repetitionSummaries.every(
        (repetition) =>
          repetition.oracleQualityPercent === 100 &&
          repetition.qualityPercent === 31,
      ),
    ).toBe(true);
    expect(
      new Set(summary.caseResults.map((result) => result.repetition)),
    ).toEqual(new Set([1, 2, 3]));
    expect(summary.splits).toEqual([
      {
        split: "development",
        caseCount: 42,
        qualityPercent: 160 / 7,
        oracleQualityPercent: 100,
      },
      {
        split: "holdout",
        caseCount: 18,
        qualityPercent: 50,
        oracleQualityPercent: 100,
      },
    ]);
  });

  it("places a rule-aware greedy policy between blind legality and the oracle", async () => {
    const [blind, greedy] = await Promise.all([
      evaluateBlindLegalFixedStateBaseline(AI_PLAYER_FIXED_STATE_SCENARIOS, 3),
      evaluateRuleAwareGreedyFixedStateBaseline(
        AI_PLAYER_FIXED_STATE_SCENARIOS,
        3,
      ),
    ]);

    expect(greedy.policyId).toBe("rule-aware-greedy-v1");
    expect(greedy.completedRate).toBe(1);
    expect(greedy.legalRate).toBe(1);
    expect(greedy.qualityPercent).toBe(62);
    expect(greedy.qualityPercent).toBeGreaterThan(blind.qualityPercent);
    expect(greedy.qualityPercent).toBeLessThan(greedy.oracleQualityPercent);
    expect(
      new Set(
        greedy.repetitionSummaries.map(
          (repetition) => repetition.qualityPercent,
        ),
      ).size,
    ).toBe(1);
    expect(greedy.splits[0]).toEqual({
      split: "development",
      caseCount: 42,
      qualityPercent: 60,
      oracleQualityPercent: 100,
    });
    expect(greedy.splits[1]?.split).toBe("holdout");
    expect(greedy.splits[1]?.caseCount).toBe(18);
    expect(greedy.splits[1]?.qualityPercent).toBeCloseTo(200 / 3, 12);
    expect(greedy.splits[1]?.oracleQualityPercent).toBe(100);
  });
});
