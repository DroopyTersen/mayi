import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LUNA_BASELINE_CANDIDATE_ID } from "./ai-player-eval-candidates";
import {
  aggregateAIPlayerEvalResults,
  type AIPlayerEvalAggregate,
} from "./ai-player-eval-score";
import {
  evaluateBlindLegalFixedStateBaseline,
  evaluateRuleAwareGreedyFixedStateBaseline,
  type AIPlayerEvalSanityBaselineSummary,
} from "./ai-player-eval-sanity-baselines";
import {
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  AI_PLAYER_FIXED_STATE_SUITE_VERSION,
} from "./ai-player-fixed-state-scenarios";
import { AI_PLAYER_EVAL_HARNESS_VERSION } from "./ai-player-fixed-state-runner";
import {
  loadAIPlayerEvalRunArtifact,
  type AIPlayerEvalRunArtifact,
} from "./ai-player-eval-run-comparison";

const DEFAULT_LUNA_DIRECTORY =
  ".data/ai-evals/luna-frozen-baseline-certified-v4";
const DEFAULT_OUTPUT_DIRECTORY = ".data/ai-evals/fixed-state-v2-calibration";

export interface AIPlayerFixedStateCalibrationArguments {
  lunaDirectory: string;
  outputDirectory: string;
}

export interface AIPlayerFixedStateCalibrationRung {
  id:
    | "blind-legal-v2"
    | "rule-aware-greedy-v1"
    | typeof LUNA_BASELINE_CANDIDATE_ID
    | "reference-oracle";
  source: "deterministic-policy" | "frozen-model" | "reference-trajectory";
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
  caseCount: number;
  repetitionCount: number;
  providerLatencyP50Ms: number | undefined;
  providerLatencyP95Ms: number | undefined;
  observedCostUsd: number | undefined;
}

export interface AIPlayerFixedStateCalibrationReport {
  schemaVersion: 1;
  harnessVersion: typeof AI_PLAYER_EVAL_HARNESS_VERSION;
  suiteVersion: typeof AI_PLAYER_FIXED_STATE_SUITE_VERSION;
  frozenLunaRunId: string;
  strictOrderingPassed: true;
  qualityGapsPercentPoints: number[];
  rungs: AIPlayerFixedStateCalibrationRung[];
  interpretation: string;
}

function nextValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAIPlayerFixedStateCalibrationArguments(
  args: readonly string[],
): AIPlayerFixedStateCalibrationArguments {
  let lunaDirectory = DEFAULT_LUNA_DIRECTORY;
  let outputDirectory = DEFAULT_OUTPUT_DIRECTORY;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--luna-run") {
      lunaDirectory = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--output") {
      outputDirectory = nextValue(args, index, argument);
      index++;
      continue;
    }
    throw new Error(`Unknown fixed-state calibration argument: ${argument}`);
  }
  return { lunaDirectory, outputDirectory };
}

function sameRubric(
  actual: AIPlayerEvalRunArtifact["cases"][number]["criteria"],
  expected: (typeof AI_PLAYER_FIXED_STATE_SCENARIOS)[number]["rubric"],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((criterion, index) => {
      const expectedCriterion = expected[index];
      return (
        expectedCriterion !== undefined &&
        criterion.id === expectedCriterion.id &&
        criterion.description === expectedCriterion.description &&
        criterion.weight === expectedCriterion.weight
      );
    })
  );
}

function validateFrozenLunaArtifact(
  artifact: AIPlayerEvalRunArtifact,
): AIPlayerEvalAggregate {
  if (
    artifact.manifest.suiteVersion !== AI_PLAYER_FIXED_STATE_SUITE_VERSION ||
    artifact.manifest.harnessVersion !== AI_PLAYER_EVAL_HARNESS_VERSION ||
    artifact.manifest.split !== "all"
  ) {
    throw new Error(
      "Frozen Luna evidence must use the current fixed-state suite, harness, and all split",
    );
  }
  if (
    artifact.manifest.candidates.length !== 1 ||
    artifact.manifest.candidates[0]?.id !== LUNA_BASELINE_CANDIDATE_ID
  ) {
    throw new Error("Calibration requires exactly one frozen Luna candidate");
  }
  if (artifact.cases.length !== AI_PLAYER_FIXED_STATE_SCENARIOS.length) {
    throw new Error("Frozen Luna evidence must contain every scenario once");
  }

  const indexedCases = new Map(
    artifact.cases.map((result) => [result.scenario.id, result]),
  );
  if (indexedCases.size !== artifact.cases.length) {
    throw new Error("Frozen Luna evidence contains duplicate scenarios");
  }
  for (const scenario of AI_PLAYER_FIXED_STATE_SCENARIOS) {
    const result = indexedCases.get(scenario.identity.id);
    if (
      result === undefined ||
      result.runId !== artifact.manifest.runId ||
      result.candidate.id !== LUNA_BASELINE_CANDIDATE_ID ||
      result.repetition !== 1 ||
      result.scenario.split !== scenario.identity.split ||
      result.scenario.category !== scenario.identity.category ||
      result.scenario.description !== scenario.identity.description ||
      !sameRubric(result.criteria, scenario.rubric)
    ) {
      throw new Error(
        `Frozen Luna evidence is not current for ${scenario.identity.id}`,
      );
    }
  }
  return aggregateAIPlayerEvalResults(artifact.cases);
}

function deterministicRung(
  summary: AIPlayerEvalSanityBaselineSummary,
): AIPlayerFixedStateCalibrationRung {
  return {
    id: summary.policyId,
    source: "deterministic-policy",
    qualityPercent: summary.qualityPercent,
    completionRate: summary.completedRate,
    legalRate: summary.legalRate,
    caseCount: summary.caseCount,
    repetitionCount: summary.repetitionCount,
    providerLatencyP50Ms: undefined,
    providerLatencyP95Ms: undefined,
    observedCostUsd: 0,
  };
}

export async function createAIPlayerFixedStateCalibrationReport(
  lunaArtifact: AIPlayerEvalRunArtifact,
  deterministicRepetitionCount = 3,
): Promise<AIPlayerFixedStateCalibrationReport> {
  const luna = validateFrozenLunaArtifact(lunaArtifact);
  const [blind, greedy] = await Promise.all([
    evaluateBlindLegalFixedStateBaseline(
      AI_PLAYER_FIXED_STATE_SCENARIOS,
      deterministicRepetitionCount,
    ),
    evaluateRuleAwareGreedyFixedStateBaseline(
      AI_PLAYER_FIXED_STATE_SCENARIOS,
      deterministicRepetitionCount,
    ),
  ]);
  const deterministicCaseCount =
    AI_PLAYER_FIXED_STATE_SCENARIOS.length * deterministicRepetitionCount;
  if (
    blind.caseCount !== deterministicCaseCount ||
    greedy.caseCount !== deterministicCaseCount ||
    blind.oracleQualityPercent !== 100 ||
    greedy.oracleQualityPercent !== 100
  ) {
    throw new Error("Deterministic calibration evidence is incomplete");
  }

  const rungs: AIPlayerFixedStateCalibrationRung[] = [
    deterministicRung(blind),
    deterministicRung(greedy),
    {
      id: LUNA_BASELINE_CANDIDATE_ID,
      source: "frozen-model",
      qualityPercent: luna.qualityPercent,
      completionRate: luna.completionRate,
      legalRate: luna.legalRate,
      caseCount: luna.caseCount,
      repetitionCount: 1,
      providerLatencyP50Ms: luna.providerLatencyMs.p50,
      providerLatencyP95Ms: luna.providerLatencyMs.p95,
      observedCostUsd: luna.totalCostUsd,
    },
    {
      id: "reference-oracle",
      source: "reference-trajectory",
      qualityPercent: blind.oracleQualityPercent,
      completionRate: 1,
      legalRate: 1,
      caseCount: blind.caseCount,
      repetitionCount: blind.repetitionCount,
      providerLatencyP50Ms: undefined,
      providerLatencyP95Ms: undefined,
      observedCostUsd: 0,
    },
  ];
  const qualityGapsPercentPoints = rungs.slice(1).map((rung, index) => {
    const previous = rungs[index];
    return previous === undefined
      ? Number.NaN
      : rung.qualityPercent - previous.qualityPercent;
  });
  if (
    qualityGapsPercentPoints.some((gap) => !Number.isFinite(gap) || gap <= 0)
  ) {
    throw new Error(
      "Fixed-state calibration is not strictly ordered from blind policy to oracle",
    );
  }

  return {
    schemaVersion: 1,
    harnessVersion: AI_PLAYER_EVAL_HARNESS_VERSION,
    suiteVersion: AI_PLAYER_FIXED_STATE_SUITE_VERSION,
    frozenLunaRunId: lunaArtifact.manifest.runId,
    strictOrderingPassed: true,
    qualityGapsPercentPoints,
    rungs,
    interpretation:
      "The fixed-state suite distinguishes blind legality, limited visible-state heuristics, a frozen model player, and reference-optimal tactical play without using latency or cost as skill points.",
  };
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function optionalMetric(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(0);
}

export function formatAIPlayerFixedStateCalibrationMarkdown(
  report: AIPlayerFixedStateCalibrationReport,
): string {
  return [
    "# AI Player Fixed-State Calibration",
    "",
    `Suite \`${report.suiteVersion}\`; strict ordering: passed.`,
    "",
    "Rung | Source | Quality | Completed | Legal | Provider p50 ms | Provider p95 ms | Observed cost USD | Cases | Repetitions",
    "--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...report.rungs.map((rung) =>
      [
        rung.id,
        rung.source,
        percent(rung.qualityPercent),
        percent(rung.completionRate * 100),
        percent(rung.legalRate * 100),
        optionalMetric(rung.providerLatencyP50Ms),
        optionalMetric(rung.providerLatencyP95Ms),
        rung.observedCostUsd?.toFixed(6) ?? "n/a",
        rung.caseCount,
        rung.repetitionCount,
      ].join(" | "),
    ),
    "",
    `Adjacent quality gaps: ${report.qualityGapsPercentPoints
      .map((gap) => gap.toFixed(1))
      .join(", ")} percentage points.`,
    "",
    report.interpretation,
    "",
  ].join("\n");
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerFixedStateCalibrationArguments(
      Bun.argv.slice(2),
    );
    const lunaArtifact = await loadAIPlayerEvalRunArtifact(
      options.lunaDirectory,
    );
    const report =
      await createAIPlayerFixedStateCalibrationReport(lunaArtifact);
    const markdown = formatAIPlayerFixedStateCalibrationMarkdown(report);
    await mkdir(dirname(options.outputDirectory), { recursive: true });
    await mkdir(options.outputDirectory);
    await Promise.all([
      writeFile(
        join(options.outputDirectory, "calibration.json"),
        JSON.stringify(report, null, 2),
      ),
      writeFile(join(options.outputDirectory, "calibration.md"), markdown),
    ]);
    console.log(markdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
