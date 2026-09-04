import { describe, expect, it } from "bun:test";
import {
  formatAIPlayerMayICallSummaryMarkdown,
  parseAIPlayerMayICallRunnerArguments,
} from "./ai-player-may-i-call-runner";
import type { AIPlayerEvalRunSummary } from "./ai-player-fixed-state-runner";

describe("AI player May I call runner", () => {
  it("defaults to the cheapest Spark development calibration", () => {
    expect(parseAIPlayerMayICallRunnerArguments([])).toEqual({
      candidateIds: ["spark-minimal"],
      repetitions: 1,
      split: "development",
      runId: undefined,
      scenarioIds: undefined,
      promptExperiment: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("expands only the Spark effort ladder", () => {
    expect(
      parseAIPlayerMayICallRunnerArguments([
        "--all-spark",
        "--repetitions",
        "3",
        "--split",
        "all",
      ]),
    ).toMatchObject({
      candidateIds: [
        "spark-minimal",
        "spark-low",
        "spark-medium",
        "spark-high",
        "spark-xhigh",
      ],
      repetitions: 3,
      split: "all",
    });
  });

  it("accepts a frozen Luna baseline or a named scenario only when explicit", () => {
    expect(
      parseAIPlayerMayICallRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline",
        "--scenario",
        "call-contract-completing-set",
        "--run-id",
        "luna-may-i-call-baseline-v1",
      ]),
    ).toEqual({
      candidateIds: ["luna-xhigh-baseline"],
      repetitions: 1,
      split: "development",
      runId: "luna-may-i-call-baseline-v1",
      scenarioIds: ["call-contract-completing-set"],
      promptExperiment: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("accepts isolated Spark prompt experiments and never applies them to Luna", () => {
    expect(
      parseAIPlayerMayICallRunnerArguments([
        "--candidate",
        "spark-medium",
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
      ]).promptExperiment,
    ).toEqual({
      id: "phase-checklist-v1",
      addendumFile: "ai/evals/prompts/phase-checklist-v1.md",
    });
    expect(() =>
      parseAIPlayerMayICallRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline",
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
      ]),
    ).toThrow("Prompt experiments are Spark-only");
  });

  it("rejects unknown scenarios and invalid repetitions", () => {
    expect(() =>
      parseAIPlayerMayICallRunnerArguments([
        "--scenario",
        "missing-may-i-case",
      ]),
    ).toThrow("Unknown AI player May I call scenario: missing-may-i-case");
    expect(() =>
      parseAIPlayerMayICallRunnerArguments(["--repetitions", "0"]),
    ).toThrow("Repetitions must be a positive integer");
    expect(() =>
      parseAIPlayerMayICallRunnerArguments(["--max-cost-usd", "NaN"]),
    ).toThrow("Maximum cost must be a positive finite number");
  });

  it("accepts an explicit observed-cost stop threshold", () => {
    expect(
      parseAIPlayerMayICallRunnerArguments([
        "--max-cost-usd",
        "0.025",
      ]).maxCostUsd,
    ).toBe(0.025);
  });

  it("labels reports as May I initiation rather than ordinary turns", () => {
    const summary: AIPlayerEvalRunSummary = {
      schemaVersion: 2,
      runId: "may-i-call-run",
      candidates: [],
      comparisons: [],
    };

    expect(formatAIPlayerMayICallSummaryMarkdown(summary)).toStartWith(
      "# AI Player May I Initiation Evaluation",
    );
  });
});
