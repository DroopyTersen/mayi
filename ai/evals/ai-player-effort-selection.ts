import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  SPARK_HILL_CLIMB_CANDIDATE_IDS,
  type SparkHillClimbCandidateId,
} from "./ai-player-eval-candidates";
import {
  aggregateAIPlayerEvalResults,
  scoreAIPlayerEvalCase,
  type AIPlayerEvalCaseResult,
} from "./ai-player-eval-score";
import {
  meanAIPlayerEvalMetricByGroup,
  meanAIPlayerEvalMetric,
  pairedStudentTConfidence95,
} from "./ai-player-eval-statistics";
import type { AIPlayerEvalConfidenceInterval } from "./ai-player-eval-score";
import { fingerprintAIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";
import {
  loadAIPlayerEvalRunArtifact,
  type AIPlayerEvalRunArtifact,
} from "./ai-player-eval-run-comparison";

export const DEFAULT_SPARK_NONINFERIORITY_MARGIN_PERCENT_POINTS = 2.5;
const MINIMUM_EFFORT_SELECTION_REPETITIONS_PER_SCENARIO = 3;
const MINIMUM_EFFORT_SELECTION_SCENARIOS = 3;

export interface AIPlayerEffortSelectionArguments {
  runDirectory: string;
  noninferiorityMarginPercentPoints: number;
}

export interface AIPlayerEffortSelectionCandidate {
  candidateId: SparkHillClimbCandidateId;
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
  qualityDeltaVsStrongestPercentPoints: number;
  qualityDeltaConfidence95: AIPlayerEvalConfidenceInterval;
  providerLatencyP50Ms: number | undefined;
  providerLatencyP95Ms: number | undefined;
  costPerCaseUsd: number;
  categoryDeltasVsStrongest: AIPlayerEffortSelectionCategoryDelta[];
  eligible: boolean;
  eligibilityReasons: string[];
}

export interface AIPlayerEffortSelectionCategoryDelta {
  category: string;
  scenarioCount: number;
  qualityDeltaPercentPoints: number;
}

export interface AIPlayerEffortSelection {
  schemaVersion: 3;
  runId: string;
  qualityConfidenceUnit: "scenario-mean";
  strongestCandidateId: SparkHillClimbCandidateId;
  selectedCandidateId: SparkHillClimbCandidateId;
  noninferiorityMarginPercentPoints: number;
  scenarioCount: number;
  minimumRepetitionsPerScenario: number;
  candidates: AIPlayerEffortSelectionCandidate[];
}

function nextValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseMargin(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      "Non-inferiority margin must be a nonnegative finite number",
    );
  }
  return parsed;
}

export function parseAIPlayerEffortSelectionArguments(
  args: readonly string[],
): AIPlayerEffortSelectionArguments {
  let runDirectory: string | undefined;
  let noninferiorityMarginPercentPoints =
    DEFAULT_SPARK_NONINFERIORITY_MARGIN_PERCENT_POINTS;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--run") {
      runDirectory = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--noninferiority-margin-pp") {
      noninferiorityMarginPercentPoints = parseMargin(
        nextValue(args, index, argument),
      );
      index++;
      continue;
    }
    throw new Error(`Unknown effort selection argument: ${argument}`);
  }
  if (runDirectory === undefined) throw new Error("--run is required");
  return { runDirectory, noninferiorityMarginPercentPoints };
}

function isSparkCandidateId(value: string): value is SparkHillClimbCandidateId {
  return SPARK_HILL_CLIMB_CANDIDATE_IDS.some(
    (candidateId) => candidateId === value,
  );
}

function caseKey(result: AIPlayerEvalCaseResult): string {
  return `${result.scenario.id}:${result.repetition}`;
}

function rubricSignature(result: AIPlayerEvalCaseResult): string {
  return JSON.stringify(
    result.criteria.map(({ id, description, weight }) => ({
      id,
      description,
      weight,
    })),
  );
}

function indexCases(
  results: readonly AIPlayerEvalCaseResult[],
  candidateId: string,
): Map<string, AIPlayerEvalCaseResult> {
  const indexed = new Map<string, AIPlayerEvalCaseResult>();
  for (const result of results) {
    const key = caseKey(result);
    if (indexed.has(key)) {
      throw new Error(`Duplicate case key for ${candidateId}: ${key}`);
    }
    indexed.set(key, result);
  }
  return indexed;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateArtifact(
  artifact: AIPlayerEvalRunArtifact,
): {
  candidateIds: SparkHillClimbCandidateId[];
  resultsByCandidate: Map<
    SparkHillClimbCandidateId,
    AIPlayerEvalCaseResult[]
  >;
  scenarioCount: number;
  minimumRepetitionsPerScenario: number;
} {
  if (artifact.manifest.split !== "development") {
    throw new Error("Effort selection requires a development-only sweep");
  }
  if (artifact.runStatus?.status !== "completed") {
    throw new Error(
      "The Spark effort sweep must be completed before effort selection",
    );
  }
  if (
    artifact.runStatus.completedUnitCount !==
      artifact.runStatus.plannedUnitCount ||
    artifact.runStatus.executedResultCount !==
      artifact.runStatus.plannedResultCount ||
    artifact.runStatus.executedResultCount !== artifact.cases.length ||
    artifact.runStatus.unknownCostResultCount !== 0
  ) {
    throw new Error("The completed Spark effort sweep has inconsistent coverage");
  }

  const manifestIds = artifact.manifest.candidates.map(
    (candidate) => candidate.id,
  );
  if (manifestIds.length < 2 || new Set(manifestIds).size !== manifestIds.length) {
    throw new Error("Effort selection requires at least two distinct candidates");
  }
  if (!manifestIds.every(isSparkCandidateId)) {
    throw new Error("Effort selection accepts Spark hill-climb candidates only");
  }
  const candidateIds = manifestIds.filter(isSparkCandidateId);
  const resultsByCandidate = new Map<
    SparkHillClimbCandidateId,
    AIPlayerEvalCaseResult[]
  >();
  for (const candidateId of candidateIds) {
    const identity = artifact.manifest.candidates.find(
      (candidate) => candidate.id === candidateId,
    );
    const definition = AI_PLAYER_EVAL_CANDIDATES[candidateId];
    if (
      identity === undefined ||
      identity.modelId !== definition.modelId ||
      identity.provider !== definition.provider ||
      identity.reasoningEffort !== definition.reasoningEffort ||
      identity.promptVersion !== artifact.manifest.prompt.version
    ) {
      throw new Error(`Candidate identity is invalid for ${candidateId}`);
    }
    if (
      artifact.manifest.harnessVersion === "ai-player-eval-harness-v3" &&
      (identity.modelConfiguration === undefined ||
        identity.modelConfigurationSha256 === undefined ||
        fingerprintAIPlayerEvalModelConfiguration(
          identity.modelConfiguration,
        ) !== identity.modelConfigurationSha256 ||
        identity.modelConfigurationSha256 !==
          definition.modelConfigurationSha256)
    ) {
      throw new Error(
        `Resolved model configuration is invalid for ${candidateId}`,
      );
    }
    const results = artifact.cases.filter(
      (result) => result.candidate.id === candidateId,
    );
    if (results.length === 0) {
      throw new Error(`No cases were recorded for ${candidateId}`);
    }
    if (
      artifact.manifest.harnessVersion === "ai-player-eval-harness-v3" &&
      results.some(
        (result) =>
          result.candidate.modelConfigurationSha256 !==
          identity.modelConfigurationSha256,
      )
    ) {
      throw new Error(
        `Case model configuration is invalid for ${candidateId}`,
      );
    }
    resultsByCandidate.set(candidateId, results);
  }
  const candidateIdSet = new Set<string>(candidateIds);
  if (artifact.cases.some((result) => !candidateIdSet.has(result.candidate.id))) {
    throw new Error("Cases contain a candidate absent from the manifest");
  }

  const firstCandidateId = candidateIds[0];
  if (firstCandidateId === undefined) {
    throw new Error("Effort selection requires candidate results");
  }
  const firstResults = resultsByCandidate.get(firstCandidateId);
  if (firstResults === undefined) {
    throw new Error("Effort selection requires candidate results");
  }
  const referenceByKey = indexCases(firstResults, firstCandidateId);
  const referenceKeys = [...referenceByKey.keys()].sort();
  for (const candidateId of candidateIds.slice(1)) {
    const results = resultsByCandidate.get(candidateId);
    if (results === undefined) {
      throw new Error(`No cases were recorded for ${candidateId}`);
    }
    const candidateByKey = indexCases(results, candidateId);
    const candidateKeys = [...candidateByKey.keys()].sort();
    if (!sameStrings(referenceKeys, candidateKeys)) {
      throw new Error(`Matched case keys differ for ${candidateId}`);
    }
    for (const key of referenceKeys) {
      const reference = referenceByKey.get(key);
      const candidate = candidateByKey.get(key);
      if (reference === undefined || candidate === undefined) {
        throw new Error(`Missing matched case ${key}`);
      }
      if (
        reference.inputState !== candidate.inputState ||
        reference.scenario.category !== candidate.scenario.category ||
        rubricSignature(reference) !== rubricSignature(candidate)
      ) {
        throw new Error(`Matched case evidence differs for ${candidateId}/${key}`);
      }
    }
  }

  const repetitionsByScenario = new Map<string, number[]>();
  for (const result of firstResults) {
    const repetitions = repetitionsByScenario.get(result.scenario.id) ?? [];
    repetitions.push(result.repetition);
    repetitionsByScenario.set(result.scenario.id, repetitions);
  }
  const repetitionSets = [...repetitionsByScenario.values()].map(
    (repetitions) => [...repetitions].sort((left, right) => left - right),
  );
  const repetitionCounts = repetitionSets.map(
    (repetitions) => repetitions.length,
  );
  const scenarioCount = repetitionsByScenario.size;
  if (scenarioCount < MINIMUM_EFFORT_SELECTION_SCENARIOS) {
    throw new Error(
      "Effort selection requires at least 3 distinct scenarios",
    );
  }
  const minimumRepetitionsPerScenario = Math.min(...repetitionCounts);
  if (
    minimumRepetitionsPerScenario <
    MINIMUM_EFFORT_SELECTION_REPETITIONS_PER_SCENARIO
  ) {
    throw new Error(
      "Effort selection requires at least 3 repetitions per scenario",
    );
  }
  const firstRepetitionSet = repetitionSets[0];
  if (
    firstRepetitionSet === undefined ||
    repetitionSets.some(
      (repetitions) =>
        repetitions.length !== firstRepetitionSet.length ||
        repetitions.some(
          (repetition, index) => repetition !== firstRepetitionSet[index],
        ),
    )
  ) {
    throw new Error(
      "Effort selection requires the same repetition set for every scenario",
    );
  }

  return {
    candidateIds,
    resultsByCandidate,
    scenarioCount,
    minimumRepetitionsPerScenario,
  };
}

function effortRank(candidateId: SparkHillClimbCandidateId): number {
  return SPARK_HILL_CLIMB_CANDIDATE_IDS.indexOf(candidateId);
}

function resultCost(result: AIPlayerEvalCaseResult): number {
  const cost = result.providerReportedCostUsd ?? result.reconstructedCostUsd;
  if (cost === undefined || !Number.isFinite(cost) || cost < 0) {
    throw new Error(`Missing trustworthy cost for ${result.candidate.id}/${caseKey(result)}`);
  }
  return cost;
}

export function selectAIPlayerSparkEffort(
  artifact: AIPlayerEvalRunArtifact,
  noninferiorityMarginPercentPoints =
    DEFAULT_SPARK_NONINFERIORITY_MARGIN_PERCENT_POINTS,
): AIPlayerEffortSelection {
  if (
    !Number.isFinite(noninferiorityMarginPercentPoints) ||
    noninferiorityMarginPercentPoints < 0
  ) {
    throw new Error(
      "Non-inferiority margin must be a nonnegative finite number",
    );
  }
  const validated = validateArtifact(artifact);
  const aggregates = new Map(
    validated.candidateIds.map((candidateId) => {
      const results = validated.resultsByCandidate.get(candidateId);
      if (results === undefined) {
        throw new Error(`No cases were recorded for ${candidateId}`);
      }
      return [candidateId, aggregateAIPlayerEvalResults(results)] as const;
    }),
  );
  const strongestCandidateId = [...validated.candidateIds].sort((left, right) => {
    const leftAggregate = aggregates.get(left);
    const rightAggregate = aggregates.get(right);
    if (leftAggregate === undefined || rightAggregate === undefined) return 0;
    return (
      rightAggregate.qualityPercent - leftAggregate.qualityPercent ||
      rightAggregate.completionRate - leftAggregate.completionRate ||
      rightAggregate.legalRate - leftAggregate.legalRate ||
      effortRank(right) - effortRank(left)
    );
  })[0];
  if (strongestCandidateId === undefined) {
    throw new Error("Effort selection requires candidate results");
  }
  const strongestResults = validated.resultsByCandidate.get(strongestCandidateId);
  if (strongestResults === undefined) {
    throw new Error(`No cases were recorded for ${strongestCandidateId}`);
  }
  const strongestByKey = indexCases(strongestResults, strongestCandidateId);

  const candidates = validated.candidateIds.map((candidateId) => {
    const results = validated.resultsByCandidate.get(candidateId);
    const aggregate = aggregates.get(candidateId);
    if (results === undefined || aggregate === undefined) {
      throw new Error(`No cases were recorded for ${candidateId}`);
    }
    const keyedDeltas = results.map((result) => {
      const strongest = strongestByKey.get(caseKey(result));
      if (strongest === undefined) {
        throw new Error(`Missing strongest-effort case ${caseKey(result)}`);
      }
      return {
        groupId: result.scenario.id,
        category: result.scenario.category,
        value:
          scoreAIPlayerEvalCase(result).qualityPercent -
          scoreAIPlayerEvalCase(strongest).qualityPercent,
      };
    });
    const scenarioMeanDeltas =
      meanAIPlayerEvalMetricByGroup(keyedDeltas);
    const categoryDeltasVsStrongest = [
      ...new Set(keyedDeltas.map((delta) => delta.category)),
    ].map((category) => {
      const categoryScenarioIds = [
        ...new Set(
          keyedDeltas
            .filter((delta) => delta.category === category)
            .map((delta) => delta.groupId),
        ),
      ];
      const categoryScenarioDeltas = categoryScenarioIds.map((scenarioId) =>
        meanAIPlayerEvalMetric(
          keyedDeltas
            .filter(
              (delta) =>
                delta.category === category && delta.groupId === scenarioId,
            )
            .map((delta) => delta.value),
        ),
      );
      return {
        category,
        scenarioCount: categoryScenarioIds.length,
        qualityDeltaPercentPoints: meanAIPlayerEvalMetric(
          categoryScenarioDeltas,
        ),
      };
    });
    const hardGateRegression = results.some((result) => {
      const strongest = strongestByKey.get(caseKey(result));
      return (
        strongest !== undefined &&
        ((strongest.completed && !result.completed) ||
          (strongest.legal && !result.legal))
      );
    });
    const qualityDeltaConfidence95 = pairedStudentTConfidence95(
      scenarioMeanDeltas,
      { lower: -100, upper: 100 },
    );
    const eligibilityReasons: string[] = [];
    if (
      qualityDeltaConfidence95.lower <
      -noninferiorityMarginPercentPoints
    ) {
      eligibilityReasons.push(
        `Scenario-clustered quality is not within the ${noninferiorityMarginPercentPoints} percentage-point non-inferiority margin`,
      );
    }
    if (hardGateRegression) {
      eligibilityReasons.push(
        "Completion or legality regressed versus the strongest effort",
      );
    }
    for (const categoryDelta of categoryDeltasVsStrongest) {
      if (
        categoryDelta.qualityDeltaPercentPoints <
        -noninferiorityMarginPercentPoints
      ) {
        eligibilityReasons.push(
          `Category ${categoryDelta.category} is ${Math.abs(categoryDelta.qualityDeltaPercentPoints).toFixed(1)} percentage points below the strongest effort, exceeding the ${noninferiorityMarginPercentPoints} percentage-point non-inferiority margin`,
        );
      }
    }
    return {
      candidateId,
      qualityPercent: aggregate.qualityPercent,
      completionRate: aggregate.completionRate,
      legalRate: aggregate.legalRate,
      qualityDeltaVsStrongestPercentPoints:
        meanAIPlayerEvalMetric(scenarioMeanDeltas),
      qualityDeltaConfidence95,
      providerLatencyP50Ms: aggregate.providerLatencyMs.p50,
      providerLatencyP95Ms: aggregate.providerLatencyMs.p95,
      costPerCaseUsd: meanAIPlayerEvalMetric(results.map(resultCost)),
      categoryDeltasVsStrongest,
      eligible: eligibilityReasons.length === 0,
      eligibilityReasons,
    } satisfies AIPlayerEffortSelectionCandidate;
  });
  const selected = candidates
    .filter((candidate) => candidate.eligible)
    .sort(
      (left, right) =>
        left.costPerCaseUsd - right.costPerCaseUsd ||
        right.qualityPercent - left.qualityPercent ||
        (left.providerLatencyP95Ms ?? Infinity) -
          (right.providerLatencyP95Ms ?? Infinity) ||
        effortRank(right.candidateId) - effortRank(left.candidateId),
    )[0];
  if (selected === undefined) {
    throw new Error("No Spark effort satisfies the skill and reliability gate");
  }

  return {
    schemaVersion: 3,
    runId: artifact.manifest.runId,
    qualityConfidenceUnit: "scenario-mean",
    strongestCandidateId,
    selectedCandidateId: selected.candidateId,
    noninferiorityMarginPercentPoints,
    scenarioCount: validated.scenarioCount,
    minimumRepetitionsPerScenario:
      validated.minimumRepetitionsPerScenario,
    candidates,
  };
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function metric(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(0);
}

export function formatAIPlayerEffortSelectionMarkdown(
  selection: AIPlayerEffortSelection,
): string {
  const categorySections = selection.candidates.flatMap((candidate) => [
    `## ${candidate.candidateId} category deltas`,
    "",
    "Category | Scenarios | Quality delta vs strongest pp",
    "--- | ---: | ---:",
    ...candidate.categoryDeltasVsStrongest.map((category) =>
      [
        category.category,
        category.scenarioCount,
        category.qualityDeltaPercentPoints.toFixed(1),
      ].join(" | "),
    ),
    "",
  ]);
  return [
    "# Spark Reasoning-Effort Selection",
    "",
    `Run: \`${selection.runId}\``,
    "",
    `Strongest measured effort: \`${selection.strongestCandidateId}\``,
    `Selected effort: \`${selection.selectedCandidateId}\``,
    `Non-inferiority margin: ${selection.noninferiorityMarginPercentPoints.toFixed(1)} percentage points`,
    `Scenario-mean confidence units: ${selection.scenarioCount}`,
    "",
    "Candidate | Quality | Delta vs strongest | Scenario-mean delta 95% CI | Completed | Legal | Provider p50 ms | Provider p95 ms | Cost/case USD | Eligible",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---",
    ...selection.candidates.map((candidate) =>
      [
        candidate.candidateId,
        percent(candidate.qualityPercent),
        candidate.qualityDeltaVsStrongestPercentPoints.toFixed(1),
        `${candidate.qualityDeltaConfidence95.lower.toFixed(1)} to ${candidate.qualityDeltaConfidence95.upper.toFixed(1)}`,
        percent(candidate.completionRate * 100),
        percent(candidate.legalRate * 100),
        metric(candidate.providerLatencyP50Ms),
        metric(candidate.providerLatencyP95Ms),
        candidate.costPerCaseUsd.toFixed(6),
        candidate.eligible
          ? "yes"
          : `no: ${candidate.eligibilityReasons.join("; ")}`,
      ].join(" | "),
    ),
    "",
    "Skill is the gate. Repetitions stabilize each scenario mean; distinct scenarios are the confidence units. Cost selects only among efforts whose scenario-clustered 95% lower bound and every strategic-category mean are within the declared margin, and whose completion and legality do not regress. Provider latency remains a separate diagnostic.",
    "",
    ...categorySections,
    "",
  ].join("\n");
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerEffortSelectionArguments(Bun.argv.slice(2));
    const artifact = await loadAIPlayerEvalRunArtifact(options.runDirectory);
    const selection = selectAIPlayerSparkEffort(
      artifact,
      options.noninferiorityMarginPercentPoints,
    );
    const markdown = formatAIPlayerEffortSelectionMarkdown(selection);
    await Promise.all([
      writeFile(
        join(options.runDirectory, "effort-selection.json"),
        JSON.stringify(selection, null, 2),
      ),
      writeFile(
        join(options.runDirectory, "effort-selection.md"),
        markdown,
      ),
    ]);
    console.log(markdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
