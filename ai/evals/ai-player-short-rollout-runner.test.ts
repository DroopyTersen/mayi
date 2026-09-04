import { describe, expect, it } from "bun:test";
import {
  parseAIPlayerShortRolloutRunnerArguments,
  selectAIPlayerShortRolloutSystemPrompt,
  selectAIPlayerShortRolloutScenarios,
  classifyAIPlayerShortRolloutFailure,
  runAIPlayerShortRollout,
  summarizeAIPlayerShortRollout,
} from "./ai-player-short-rollout-runner";
import { buildAIPlayerRolloutSelection } from "./ai-player-rollout-scope";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";

describe("AI player short rollout runner", () => {
  it("makes the mixed diagnostic mean unambiguous in the new JSON schema", () => {
    const selection = buildAIPlayerRolloutSelection(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
      { split: "development", scope: "all-eligible" },
    );
    const summary = summarizeAIPlayerShortRollout(
      "no-observations",
      "spark-low",
      4,
      [],
      "development",
      4,
      selection,
    );
    expect(summary.schemaVersion).toBe(7);
    expect(summary.toolRequestHealth).toEqual({ total: 0, succeeded: 0, rejected: 0, errors: 0, unresolved: 0, successRate: undefined });
    expect(summary).not.toHaveProperty("qualityPercent");
    expect(summary.diagnosticQualityPercent).toBe(0);
    expect(summary.scopeScores.strategy.qualityPercent).toBeNull();
    expect(summary.scopeScores.robustness.qualityPercent).toBeNull();
    expect(summary.selection).toEqual(selection);
  });
  it("does not let a later scenario selector hide a quarantined or duplicate request", () => {
    const options = parseAIPlayerShortRolloutRunnerArguments([
      "--scenario",
      "include-extended-run-to-go-out",
      "--scenario",
      "shared-run-delay-natural",
    ]);
    expect(options.scenarioIds).toEqual([
      "include-extended-run-to-go-out",
      "shared-run-delay-natural",
    ]);
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        options.scenarioIds,
        options.split,
        options.scope,
      ),
    ).toThrow("quarantine");
    const duplicate = parseAIPlayerShortRolloutRunnerArguments([
      "--scenario",
      "shared-run-delay-natural",
      "--scenario",
      "shared-run-delay-natural",
    ]);
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        duplicate.scenarioIds,
        duplicate.split,
        duplicate.scope,
      ),
    ).toThrow("Duplicate");
  });
  it("keeps eligible regressions by default but separates strategy and blocks quarantine", () => {
    expect(parseAIPlayerShortRolloutRunnerArguments([]).scope).toBe(
      "all-eligible",
    );
    const main = selectAIPlayerShortRolloutScenarios(
      undefined,
      "development",
      "strategy",
    );
    expect(
      main.some(
        (scenario) => scenario.identity.id === "shared-run-delay-natural",
      ),
    ).toBe(true);
    expect(
      main.some(
        (scenario) =>
          scenario.identity.id === "pass-may-i-before-delayed-exhaustion",
      ),
    ).toBe(false);
    expect(
      main.some(
        (scenario) => scenario.identity.id === "include-extended-run-to-go-out",
      ),
    ).toBe(false);
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        ["pass-may-i-before-delayed-exhaustion"],
        "development",
        "strategy",
      ),
    ).toThrow("scope");
    expect(
      selectAIPlayerShortRolloutScenarios(
        ["pass-may-i-before-delayed-exhaustion"],
        "development",
        "robustness",
      ),
    ).toHaveLength(1);
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        ["include-extended-run-to-go-out"],
        "development",
        "all-eligible",
      ),
    ).toThrow("quarantine");
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        ["shared-run-delay-natural", "include-extended-run-to-go-out"],
        "development",
        "all-eligible",
      ),
    ).toThrow("quarantine");
    expect(
      parseAIPlayerShortRolloutRunnerArguments(["--scope", "robustness"]).scope,
    ).toBe("robustness");
    expect(() =>
      parseAIPlayerShortRolloutRunnerArguments(["--scope", "all"]),
    ).toThrow("Scope");
  });

  it("rejects quarantined provider runs in preflight and supports a no-provider description", async () => {
    expect(
      parseAIPlayerShortRolloutRunnerArguments(["--describe"]).describe,
    ).toBe(true);
    await expect(
      runAIPlayerShortRollout({
        ...parseAIPlayerShortRolloutRunnerArguments([]),
        scenarioIds: ["include-extended-run-to-go-out"],
      }),
    ).rejects.toThrow("quarantine");
  });
  it("distinguishes a failed opponent script from a legal strategic loss", () => {
    expect(
      classifyAIPlayerShortRolloutFailure({
        completed: false,
        legal: true,
        qualityPercent: 0,
        warnings: ["Opponent script eval-player-1/LAY_OFF: invalid"],
      }),
    ).toBe("harness-artifact");
    expect(
      classifyAIPlayerShortRolloutFailure({
        completed: true,
        legal: true,
        qualityPercent: 0,
        warnings: [],
      }),
    ).toBe("strategy");
  });
  it("defaults to four uncapped Spark-low repetitions of the nuanced suite", () => {
    expect(parseAIPlayerShortRolloutRunnerArguments([])).toEqual({
      candidateId: "spark-low",
      repetitions: 4,
      scenarioIds: undefined,
      runId: undefined,
      promptExperiment: undefined,
      promptExperimentScope: "ordinary-turns",
      split: "development",
      concurrency: 4,
      scope: "all-eligible",
      describe: false,
    });
  });

  it("allows Spark prompt experiments but never uses Luna for hill climbing", () => {
    expect(
      parseAIPlayerShortRolloutRunnerArguments([
        "--candidate",
        "spark-medium",
        "--prompt-experiment",
        "planning-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/planning-v1.md",
        "--prompt-scope",
        "all-candidate-decisions",
        "--run-id",
        "planning-v1-smoke",
        "--repetitions",
        "4",
        "--scenario",
        "swap-joker-to-unlock-contract,allow-may-i-to-avoid-joker-liability",
      ]),
    ).toEqual({
      candidateId: "spark-medium",
      repetitions: 4,
      scenarioIds: [
        "swap-joker-to-unlock-contract",
        "allow-may-i-to-avoid-joker-liability",
      ],
      runId: "planning-v1-smoke",
      promptExperiment: {
        id: "planning-v1",
        addendumFile: "ai/evals/prompts/planning-v1.md",
      },
      promptExperimentScope: "all-candidate-decisions",
      split: "development",
      concurrency: 4,
      scope: "all-eligible",
      describe: false,
    });

    expect(() =>
      parseAIPlayerShortRolloutRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline",
      ]),
    ).toThrow("Spark-only");

    expect(() =>
      parseAIPlayerShortRolloutRunnerArguments(["--max-cost-usd", "0.01"]),
    ).toThrow("Unknown AI player short rollout argument");
  });

  it("isolates ordinary-turn prompt experiments from May I decisions", () => {
    expect(
      selectAIPlayerShortRolloutSystemPrompt(
        "candidate-turn",
        "baseline",
        "organized",
        "ordinary-turns",
      ),
    ).toBe("organized");
    expect(
      selectAIPlayerShortRolloutSystemPrompt(
        "candidate-may-i",
        "baseline",
        "organized",
        "ordinary-turns",
      ),
    ).toBe("baseline");
    expect(
      selectAIPlayerShortRolloutSystemPrompt(
        "candidate-response",
        "baseline",
        "organized",
        "ordinary-turns",
      ),
    ).toBe("baseline");
  });

  it("can apply a system prompt experiment to every candidate decision", () => {
    for (const decisionKind of [
      "candidate-turn",
      "candidate-may-i",
      "candidate-response",
    ] as const) {
      expect(
        selectAIPlayerShortRolloutSystemPrompt(
          decisionKind,
          "baseline",
          "experiment",
          "all-candidate-decisions",
        ),
      ).toBe("experiment");
    }
  });

  it("keeps the holdout out of ordinary configuration experiments", () => {
    expect(
      selectAIPlayerShortRolloutScenarios(undefined, "development"),
    ).toHaveLength(21);
    expect(
      selectAIPlayerShortRolloutScenarios(undefined, "holdout"),
    ).toHaveLength(6);
    expect(selectAIPlayerShortRolloutScenarios(undefined, "all")).toHaveLength(
      27,
    );
    expect(
      parseAIPlayerShortRolloutRunnerArguments(["--split", "holdout"]).split,
    ).toBe("holdout");
    expect(() =>
      selectAIPlayerShortRolloutScenarios(
        ["decline-unusable-joker-swap"],
        "development",
      ),
    ).toThrow("split");
  });

  it("allows an explicit concurrency setting for comparable timing runs", () => {
    expect(
      parseAIPlayerShortRolloutRunnerArguments(["--concurrency", "1"])
        .concurrency,
    ).toBe(1);
    expect(() =>
      parseAIPlayerShortRolloutRunnerArguments(["--concurrency", "0"]),
    ).toThrow("Concurrency");
    expect(() =>
      parseAIPlayerShortRolloutRunnerArguments(["--split", "typo"]),
    ).toThrow("Split");
  });
});
