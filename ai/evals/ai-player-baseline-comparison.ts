import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LUNA_BASELINE_CANDIDATE_ID,
  SPARK_HILL_CLIMB_CANDIDATE_IDS,
  type SparkHillClimbCandidateId,
} from "./ai-player-eval-candidates";
import {
  aggregateAIPlayerEvalResults,
  scoreAIPlayerEvalCase,
  type AIPlayerEvalCaseResult,
  type AIPlayerEvalConfidenceInterval,
} from "./ai-player-eval-score";
import {
  meanAIPlayerEvalMetric,
  pairedStudentTConfidence95,
} from "./ai-player-eval-statistics";
import {
  loadAIPlayerEvalRunArtifact,
  type AIPlayerEvalRunArtifact,
} from "./ai-player-eval-run-comparison";
import { fingerprintAIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";

const DEFAULT_FROZEN_LUNA_BASELINE_DIRECTORY =
  ".data/ai-evals/luna-frozen-baseline-certified-v4";

interface BaselineComparisonArguments {
  referenceDirectory: string;
  sparkDirectory: string;
  sparkCandidateId: SparkHillClimbCandidateId;
}

interface FrozenLunaMetrics {
  candidateId: typeof LUNA_BASELINE_CANDIDATE_ID;
  promptVersion: string;
  promptSha256: string;
  modelConfigurationSha256: string | undefined;
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
  providerLatencyP50Ms: number | undefined;
  providerLatencyP95Ms: number | undefined;
  totalCostUsd: number;
  costPerCaseUsd: number;
  repetitionCount: 1;
}

interface SparkCheckpointMetrics {
  candidateId: SparkHillClimbCandidateId;
  promptVersion: string;
  promptSha256: string;
  modelConfigurationSha256: string | undefined;
  canonicalQualityPercent: number;
  repeatedQualityPercent: number;
  completionRate: number;
  legalRate: number;
  providerLatencyP50Ms: number | undefined;
  providerLatencyP95Ms: number | undefined;
  totalCostUsd: number;
  costPerCaseUsd: number;
  repetitionCount: number;
}

export interface AIPlayerFrozenBaselineComparison {
  schemaVersion: 1;
  comparisonKind: "descriptive-frozen-baseline";
  harnessVersion: string;
  suiteVersion: string;
  matchedCanonicalCaseCount: number;
  qualityDeltaPercentPoints: number;
  qualityDeltaConfidence95: AIPlayerEvalConfidenceInterval;
  completionRateDeltaPercentPoints: number;
  legalRateDeltaPercentPoints: number;
  canonicalWins: number;
  canonicalTies: number;
  canonicalLosses: number;
  reference: FrozenLunaMetrics;
  candidate: SparkCheckpointMetrics;
  limitations: string[];
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

function parseSparkCandidateId(value: string): SparkHillClimbCandidateId {
  const candidateId = SPARK_HILL_CLIMB_CANDIDATE_IDS.find(
    (entry) => entry === value,
  );
  if (candidateId === undefined) {
    throw new Error(`Unknown Spark checkpoint candidate: ${value}`);
  }
  return candidateId;
}

export function parseAIPlayerFrozenBaselineComparisonArguments(
  args: readonly string[],
): BaselineComparisonArguments {
  let referenceDirectory = DEFAULT_FROZEN_LUNA_BASELINE_DIRECTORY;
  let sparkDirectory: string | undefined;
  let sparkCandidateId: SparkHillClimbCandidateId | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--reference") {
      referenceDirectory = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--spark-run") {
      sparkDirectory = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--spark-candidate") {
      sparkCandidateId = parseSparkCandidateId(
        nextValue(args, index, argument),
      );
      index++;
      continue;
    }
    throw new Error(`Unknown frozen baseline comparison argument: ${argument}`);
  }
  if (sparkDirectory === undefined || sparkCandidateId === undefined) {
    throw new Error("--spark-run and --spark-candidate are required");
  }
  return { referenceDirectory, sparkDirectory, sparkCandidateId };
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

function indexUniqueCases(
  results: readonly AIPlayerEvalCaseResult[],
  label: string,
): Map<string, AIPlayerEvalCaseResult> {
  const indexed = new Map<string, AIPlayerEvalCaseResult>();
  for (const result of results) {
    const key = caseKey(result);
    if (indexed.has(key)) throw new Error(`Duplicate ${label} case ${key}`);
    indexed.set(key, result);
  }
  return indexed;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function resultCost(result: AIPlayerEvalCaseResult): number {
  const cost = result.providerReportedCostUsd ?? result.reconstructedCostUsd;
  if (cost === undefined || !Number.isFinite(cost) || cost < 0) {
    throw new Error(
      `Missing trustworthy cost for ${result.candidate.id}/${caseKey(result)}`,
    );
  }
  return cost;
}

function candidateManifestIdentity(
  artifact: AIPlayerEvalRunArtifact,
  candidateId: string,
) {
  const matches = artifact.manifest.candidates.filter(
    (candidate) => candidate.id === candidateId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Manifest must contain exactly one ${candidateId} identity`,
    );
  }
  const identity = matches[0];
  if (identity === undefined) {
    throw new Error(`Manifest is missing ${candidateId}`);
  }
  if (artifact.manifest.harnessVersion === "ai-player-eval-harness-v3") {
    if (
      identity.modelConfiguration === undefined ||
      identity.modelConfigurationSha256 === undefined
    ) {
      throw new Error(
        `Resolved model configuration is missing for ${candidateId}`,
      );
    }
    if (
      fingerprintAIPlayerEvalModelConfiguration(identity.modelConfiguration) !==
      identity.modelConfigurationSha256
    ) {
      throw new Error(
        `Resolved model configuration is invalid for ${candidateId}`,
      );
    }
  }
  return identity;
}

function validateCaseIdentity(
  result: AIPlayerEvalCaseResult,
  artifact: AIPlayerEvalRunArtifact,
  candidateId: string,
): void {
  const identity = candidateManifestIdentity(artifact, candidateId);
  if (
    result.runId !== artifact.manifest.runId ||
    result.candidate.id !== identity.id ||
    result.candidate.modelId !== identity.modelId ||
    result.candidate.provider !== identity.provider ||
    result.candidate.reasoningEffort !== identity.reasoningEffort ||
    result.candidate.promptVersion !== identity.promptVersion ||
    result.candidate.modelConfigurationSha256 !==
      identity.modelConfigurationSha256 ||
    identity.promptVersion !== artifact.manifest.prompt.version
  ) {
    throw new Error(
      `Case identity is invalid for ${candidateId}/${caseKey(result)}`,
    );
  }
}

function validateAndSelectCases(options: {
  referenceArtifact: AIPlayerEvalRunArtifact;
  sparkArtifact: AIPlayerEvalRunArtifact;
  sparkCandidateId: SparkHillClimbCandidateId;
}): {
  referenceCases: AIPlayerEvalCaseResult[];
  canonicalSparkCases: AIPlayerEvalCaseResult[];
  repeatedSparkCases: AIPlayerEvalCaseResult[];
  sparkRepetitionCount: number;
} {
  const { referenceArtifact, sparkArtifact, sparkCandidateId } = options;
  if (
    referenceArtifact.manifest.candidates.length !== 1 ||
    referenceArtifact.manifest.candidates[0]?.id !== LUNA_BASELINE_CANDIDATE_ID
  ) {
    throw new Error("Reference must be the frozen Luna baseline");
  }
  if (referenceArtifact.manifest.split !== "all") {
    throw new Error("Frozen Luna reference must cover development and holdout");
  }
  if (sparkArtifact.manifest.split !== "all") {
    throw new Error("Spark checkpoint must cover development and holdout");
  }
  if (
    referenceArtifact.manifest.harnessVersion !==
    sparkArtifact.manifest.harnessVersion
  ) {
    throw new Error("Harness versions differ");
  }
  if (
    referenceArtifact.manifest.suiteVersion !==
    sparkArtifact.manifest.suiteVersion
  ) {
    throw new Error("Suite versions differ");
  }
  if (
    sparkArtifact.runStatus?.status !== "completed" ||
    sparkArtifact.runStatus.unknownCostResultCount !== 0
  ) {
    throw new Error("Spark checkpoint must be complete with trustworthy cost");
  }
  candidateManifestIdentity(sparkArtifact, sparkCandidateId);

  const referenceCases = referenceArtifact.cases.filter(
    (result) => result.candidate.id === LUNA_BASELINE_CANDIDATE_ID,
  );
  if (
    referenceCases.length === 0 ||
    referenceCases.some((result) => result.repetition !== 1)
  ) {
    throw new Error("Frozen Luna reference must have one canonical repetition");
  }
  const repeatedSparkCases = sparkArtifact.cases.filter(
    (result) => result.candidate.id === sparkCandidateId,
  );
  if (repeatedSparkCases.length === 0) {
    throw new Error(`Spark checkpoint has no cases for ${sparkCandidateId}`);
  }
  for (const result of referenceCases) {
    validateCaseIdentity(result, referenceArtifact, LUNA_BASELINE_CANDIDATE_ID);
  }
  for (const result of repeatedSparkCases) {
    validateCaseIdentity(result, sparkArtifact, sparkCandidateId);
  }

  const repetitionsByScenario = new Map<string, number>();
  for (const result of repeatedSparkCases) {
    repetitionsByScenario.set(
      result.scenario.id,
      (repetitionsByScenario.get(result.scenario.id) ?? 0) + 1,
    );
  }
  const repetitionCounts = [...repetitionsByScenario.values()];
  const distinctRepetitionCounts = new Set(repetitionCounts);
  const sparkRepetitionCount = repetitionCounts[0];
  if (
    sparkRepetitionCount === undefined ||
    sparkRepetitionCount < 3 ||
    distinctRepetitionCounts.size !== 1
  ) {
    throw new Error(
      "Spark checkpoint requires at least 3 matched repetitions per scenario",
    );
  }

  const canonicalSparkCases = repeatedSparkCases.filter(
    (result) => result.repetition === 1,
  );
  const referenceByKey = indexUniqueCases(referenceCases, "Luna");
  const sparkByKey = indexUniqueCases(canonicalSparkCases, "Spark canonical");
  const referenceKeys = [...referenceByKey.keys()].sort();
  const sparkKeys = [...sparkByKey.keys()].sort();
  if (!sameStrings(referenceKeys, sparkKeys)) {
    throw new Error("Frozen Luna and Spark canonical case keys differ");
  }
  for (const key of referenceKeys) {
    const reference = referenceByKey.get(key);
    const spark = sparkByKey.get(key);
    if (reference === undefined || spark === undefined) {
      throw new Error(`Missing canonical case ${key}`);
    }
    if (
      reference.inputState !== spark.inputState ||
      reference.scenario.split !== spark.scenario.split ||
      rubricSignature(reference) !== rubricSignature(spark)
    ) {
      throw new Error(
        `Canonical evidence differs for ${reference.scenario.id}`,
      );
    }
  }

  return {
    referenceCases,
    canonicalSparkCases,
    repeatedSparkCases,
    sparkRepetitionCount,
  };
}

export function compareAIPlayerToFrozenLuna(
  referenceArtifact: AIPlayerEvalRunArtifact,
  sparkArtifact: AIPlayerEvalRunArtifact,
  sparkCandidateId: SparkHillClimbCandidateId,
): AIPlayerFrozenBaselineComparison {
  const cases = validateAndSelectCases({
    referenceArtifact,
    sparkArtifact,
    sparkCandidateId,
  });
  const referenceByKey = indexUniqueCases(cases.referenceCases, "Luna");
  const deltas = cases.canonicalSparkCases.map((spark) => {
    const reference = referenceByKey.get(caseKey(spark));
    if (reference === undefined) {
      throw new Error(`Missing Luna case ${caseKey(spark)}`);
    }
    return {
      quality:
        scoreAIPlayerEvalCase(spark).qualityPercent -
        scoreAIPlayerEvalCase(reference).qualityPercent,
      completion: (Number(spark.completed) - Number(reference.completed)) * 100,
      legality: (Number(spark.legal) - Number(reference.legal)) * 100,
    };
  });
  const referenceAggregate = aggregateAIPlayerEvalResults(cases.referenceCases);
  const canonicalSparkAggregate = aggregateAIPlayerEvalResults(
    cases.canonicalSparkCases,
  );
  const repeatedSparkAggregate = aggregateAIPlayerEvalResults(
    cases.repeatedSparkCases,
  );
  const referenceIdentity = candidateManifestIdentity(
    referenceArtifact,
    LUNA_BASELINE_CANDIDATE_ID,
  );
  const sparkIdentity = candidateManifestIdentity(
    sparkArtifact,
    sparkCandidateId,
  );
  const referenceCosts = cases.referenceCases.map(resultCost);
  const sparkCosts = cases.repeatedSparkCases.map(resultCost);
  const qualityDeltas = deltas.map((delta) => delta.quality);

  return {
    schemaVersion: 1,
    comparisonKind: "descriptive-frozen-baseline",
    harnessVersion: referenceArtifact.manifest.harnessVersion,
    suiteVersion: referenceArtifact.manifest.suiteVersion,
    matchedCanonicalCaseCount: deltas.length,
    qualityDeltaPercentPoints: meanAIPlayerEvalMetric(qualityDeltas),
    qualityDeltaConfidence95: pairedStudentTConfidence95(qualityDeltas, {
      lower: -100,
      upper: 100,
    }),
    completionRateDeltaPercentPoints: meanAIPlayerEvalMetric(
      deltas.map((delta) => delta.completion),
    ),
    legalRateDeltaPercentPoints: meanAIPlayerEvalMetric(
      deltas.map((delta) => delta.legality),
    ),
    canonicalWins: qualityDeltas.filter((delta) => delta > 0).length,
    canonicalTies: qualityDeltas.filter((delta) => delta === 0).length,
    canonicalLosses: qualityDeltas.filter((delta) => delta < 0).length,
    reference: {
      candidateId: LUNA_BASELINE_CANDIDATE_ID,
      promptVersion: referenceIdentity.promptVersion,
      promptSha256: referenceArtifact.manifest.prompt.sha256,
      modelConfigurationSha256: referenceIdentity.modelConfigurationSha256,
      qualityPercent: referenceAggregate.qualityPercent,
      completionRate: referenceAggregate.completionRate,
      legalRate: referenceAggregate.legalRate,
      providerLatencyP50Ms: referenceAggregate.providerLatencyMs.p50,
      providerLatencyP95Ms: referenceAggregate.providerLatencyMs.p95,
      totalCostUsd: referenceCosts.reduce((total, cost) => total + cost, 0),
      costPerCaseUsd: meanAIPlayerEvalMetric(referenceCosts),
      repetitionCount: 1,
    },
    candidate: {
      candidateId: sparkCandidateId,
      promptVersion: sparkIdentity.promptVersion,
      promptSha256: sparkArtifact.manifest.prompt.sha256,
      modelConfigurationSha256: sparkIdentity.modelConfigurationSha256,
      canonicalQualityPercent: canonicalSparkAggregate.qualityPercent,
      repeatedQualityPercent: repeatedSparkAggregate.qualityPercent,
      completionRate: repeatedSparkAggregate.completionRate,
      legalRate: repeatedSparkAggregate.legalRate,
      providerLatencyP50Ms: repeatedSparkAggregate.providerLatencyMs.p50,
      providerLatencyP95Ms: repeatedSparkAggregate.providerLatencyMs.p95,
      totalCostUsd: sparkCosts.reduce((total, cost) => total + cost, 0),
      costPerCaseUsd: meanAIPlayerEvalMetric(sparkCosts),
      repetitionCount: cases.sparkRepetitionCount,
    },
    limitations: [
      "Luna has one provider observation per position, so its latency, cost, and stochastic gameplay variance are descriptive rather than repeated estimates.",
      "The paired quality interval describes variation across canonical game positions, not repeated Luna sampling.",
      "This cross-model report is a descriptive baseline, not a promotion gate.",
    ],
  };
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function metric(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(0);
}

export function formatAIPlayerFrozenBaselineComparisonMarkdown(
  comparison: AIPlayerFrozenBaselineComparison,
): string {
  return [
    "# Spark vs Frozen Luna",
    "",
    "This is a descriptive baseline, not a promotion gate.",
    "",
    "Configuration | Gameplay quality | Completed | Legal | Provider p50 ms | Provider p95 ms | Cost/case USD | Repetitions",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    [
      comparison.reference.candidateId,
      percent(comparison.reference.qualityPercent),
      percent(comparison.reference.completionRate * 100),
      percent(comparison.reference.legalRate * 100),
      metric(comparison.reference.providerLatencyP50Ms),
      metric(comparison.reference.providerLatencyP95Ms),
      comparison.reference.costPerCaseUsd.toFixed(6),
      comparison.reference.repetitionCount,
    ].join(" | "),
    [
      comparison.candidate.candidateId,
      `${percent(comparison.candidate.repeatedQualityPercent)} (${percent(comparison.candidate.canonicalQualityPercent)} canonical)`,
      percent(comparison.candidate.completionRate * 100),
      percent(comparison.candidate.legalRate * 100),
      metric(comparison.candidate.providerLatencyP50Ms),
      metric(comparison.candidate.providerLatencyP95Ms),
      comparison.candidate.costPerCaseUsd.toFixed(6),
      comparison.candidate.repetitionCount,
    ].join(" | "),
    "",
    `Canonical Spark-minus-Luna quality delta: ${comparison.qualityDeltaPercentPoints.toFixed(1)} percentage points (95% interval ${comparison.qualityDeltaConfidence95.lower.toFixed(1)} to ${comparison.qualityDeltaConfidence95.upper.toFixed(1)}; W-T-L ${comparison.canonicalWins}-${comparison.canonicalTies}-${comparison.canonicalLosses}).`,
    "",
    ...comparison.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerFrozenBaselineComparisonArguments(
      Bun.argv.slice(2),
    );
    const [referenceArtifact, sparkArtifact] = await Promise.all([
      loadAIPlayerEvalRunArtifact(options.referenceDirectory),
      loadAIPlayerEvalRunArtifact(options.sparkDirectory),
    ]);
    const comparison = compareAIPlayerToFrozenLuna(
      referenceArtifact,
      sparkArtifact,
      options.sparkCandidateId,
    );
    const markdown = formatAIPlayerFrozenBaselineComparisonMarkdown(comparison);
    const artifactName = `luna-comparison-${options.sparkCandidateId}`;
    await Promise.all([
      writeFile(
        join(options.sparkDirectory, `${artifactName}.json`),
        JSON.stringify(comparison, null, 2),
      ),
      writeFile(join(options.sparkDirectory, `${artifactName}.md`), markdown),
    ]);
    console.log(markdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
