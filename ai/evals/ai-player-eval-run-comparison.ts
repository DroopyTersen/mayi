import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  scoreAIPlayerEvalCase,
  type AIPlayerEvalCandidateIdentity,
  type AIPlayerEvalCaseResult,
  type AIPlayerEvalConfidenceInterval,
  type AIPlayerEvalFailureMode,
  type AIPlayerEvalSplit,
} from "./ai-player-eval-score";
import {
  parseAIPlayerEvalCostBudgetSummary,
  type AIPlayerEvalCostBudgetSummary,
} from "./ai-player-eval-cost-budget";
import {
  fingerprintAIPlayerEvalModelConfiguration,
  parseAIPlayerEvalModelConfiguration,
} from "./ai-player-model-configuration";
import {
  meanAIPlayerEvalMetricByGroup,
  pairedStudentTConfidence95,
} from "./ai-player-eval-statistics";

export type AIPlayerEvalPromotionVerdict = "promote" | "review" | "reject";
export type AIPlayerEvalRunComparisonKind =
  | "prompt-experiment"
  | "repeatability-check";

export interface AIPlayerEvalRunManifest {
  schemaVersion: 1;
  runId: string;
  harnessVersion: string;
  executionScheduleVersion?: string;
  suiteVersion: string;
  split: string;
  costBudget?: {
    policyVersion: string;
    maxCostUsd: number;
  };
  prompt: {
    version: string;
    sha256: string;
  };
  candidates: AIPlayerEvalCandidateIdentity[];
}

export interface AIPlayerEvalRunArtifact {
  manifest: AIPlayerEvalRunManifest;
  cases: AIPlayerEvalCaseResult[];
  runStatus?: AIPlayerEvalCostBudgetSummary;
}

export interface AIPlayerEvalFailureModeChange {
  caseKey: string;
  reference: AIPlayerEvalFailureMode;
  candidate: AIPlayerEvalFailureMode;
}

export interface AIPlayerEvalMatchedSliceComparison {
  split: AIPlayerEvalSplit;
  qualityConfidenceUnit: "scenario-mean";
  matchedCaseCount: number;
  scenarioCount: number;
  minimumRepetitionsPerScenario: number;
  maximumRepetitionsPerScenario: number;
  qualityDeltaPercentPoints: number;
  qualityDeltaConfidence95: AIPlayerEvalConfidenceInterval;
  completionRateDeltaPercentPoints: number;
  legalRateDeltaPercentPoints: number;
  providerLatencyDeltaMs: number | undefined;
  costPerCaseDeltaUsd: number | undefined;
  wins: number;
  ties: number;
  losses: number;
}

export interface AIPlayerEvalRunComparison
  extends Omit<AIPlayerEvalMatchedSliceComparison, "split"> {
  schemaVersion: 4;
  comparisonKind: AIPlayerEvalRunComparisonKind;
  verdict: AIPlayerEvalPromotionVerdict;
  harnessVersion: string;
  executionScheduleVersion: string | undefined;
  suiteVersion: string;
  reference: {
    runId: string;
    candidateId: string;
    promptVersion: string;
    promptSha256: string;
    modelConfigurationSha256: string | undefined;
  };
  candidate: {
    runId: string;
    candidateId: string;
    promptVersion: string;
    promptSha256: string;
    modelConfigurationSha256: string | undefined;
  };
  improvedCaseKeys: string[];
  regressedCaseKeys: string[];
  hardGateRegressionCaseKeys: string[];
  failureModeChanges: AIPlayerEvalFailureModeChange[];
  verdictReasons: string[];
  splits: AIPlayerEvalMatchedSliceComparison[];
}

export interface AIPlayerEvalRunComparisonOptions {
  referenceCandidateId?: string;
  candidateCandidateId?: string;
}

interface MatchedPair {
  caseKey: string;
  reference: AIPlayerEvalCaseResult;
  candidate: AIPlayerEvalCaseResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return value;
}

function parseCandidateIdentity(
  value: unknown,
  context: string,
): AIPlayerEvalCandidateIdentity {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const modelConfiguration =
    value.modelConfiguration === undefined
      ? undefined
      : parseAIPlayerEvalModelConfiguration(
          value.modelConfiguration,
          `${context}.modelConfiguration`,
        );
  const modelConfigurationSha256 = value.modelConfigurationSha256;
  if (
    modelConfigurationSha256 !== undefined &&
    (typeof modelConfigurationSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(modelConfigurationSha256))
  ) {
    throw new Error(`${context}.modelConfigurationSha256 is invalid`);
  }
  if (
    (modelConfiguration === undefined) !==
    (modelConfigurationSha256 === undefined)
  ) {
    throw new Error(
      `${context} must include both modelConfiguration and modelConfigurationSha256`,
    );
  }
  if (
    modelConfiguration !== undefined &&
    fingerprintAIPlayerEvalModelConfiguration(modelConfiguration) !==
      modelConfigurationSha256
  ) {
    throw new Error(`${context} model configuration fingerprint is invalid`);
  }
  return {
    id: requireString(value, "id", context),
    modelId: requireString(value, "modelId", context),
    provider: requireString(value, "provider", context),
    reasoningEffort: requireString(value, "reasoningEffort", context),
    promptVersion: requireString(value, "promptVersion", context),
    ...(modelConfigurationSha256 === undefined
      ? {}
      : { modelConfigurationSha256 }),
    ...(modelConfiguration === undefined ? {} : { modelConfiguration }),
  };
}

function parseManifest(value: unknown): AIPlayerEvalRunManifest {
  if (!isRecord(value)) throw new Error("manifest must be an object");
  if (value.schemaVersion !== 1) {
    throw new Error("manifest.schemaVersion must be 1");
  }
  if (!isRecord(value.prompt)) {
    throw new Error("manifest.prompt must be an object");
  }
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    throw new Error("manifest.candidates must be a non-empty array");
  }
  const executionScheduleVersion = value.executionScheduleVersion;
  const costBudget = value.costBudget;
  if (
    executionScheduleVersion !== undefined &&
    (typeof executionScheduleVersion !== "string" ||
      executionScheduleVersion.length === 0)
  ) {
    throw new Error(
      "manifest.executionScheduleVersion must be a non-empty string when present",
    );
  }
  if (
    costBudget !== undefined &&
    (!isRecord(costBudget) ||
      typeof costBudget.policyVersion !== "string" ||
      costBudget.policyVersion.length === 0 ||
      typeof costBudget.maxCostUsd !== "number" ||
      !Number.isFinite(costBudget.maxCostUsd) ||
      costBudget.maxCostUsd <= 0)
  ) {
    throw new Error("manifest.costBudget is invalid");
  }
  const harnessVersion = requireString(value, "harnessVersion", "manifest");
  const candidates = value.candidates.map((candidate, index) =>
    parseCandidateIdentity(candidate, `manifest.candidates[${index}]`),
  );
  if (
    harnessVersion === "ai-player-eval-harness-v3" &&
    candidates.some(
      (candidate) =>
        candidate.modelConfiguration === undefined ||
        candidate.modelConfigurationSha256 === undefined,
    )
  ) {
    throw new Error(
      "AI player eval harness v3 candidates must include a valid model configuration snapshot",
    );
  }
  return {
    schemaVersion: 1,
    runId: requireString(value, "runId", "manifest"),
    harnessVersion,
    ...(executionScheduleVersion === undefined
      ? {}
      : { executionScheduleVersion }),
    suiteVersion: requireString(value, "suiteVersion", "manifest"),
    split: requireString(value, "split", "manifest"),
    ...(costBudget === undefined
      ? {}
      : {
          costBudget: {
            policyVersion: costBudget.policyVersion as string,
            maxCostUsd: costBudget.maxCostUsd as number,
          },
        }),
    prompt: {
      version: requireString(value.prompt, "version", "manifest.prompt"),
      sha256: requireString(value.prompt, "sha256", "manifest.prompt"),
    },
    candidates,
  };
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code === "ENOENT") return undefined;
    throw error;
  }
}

function isEvalSplit(value: unknown): value is AIPlayerEvalSplit {
  return value === "development" || value === "holdout";
}

function isFailureMode(value: unknown): value is AIPlayerEvalFailureMode {
  return (
    value === "none" ||
    value === "provider" ||
    value === "turn-incomplete" ||
    value === "illegal-action" ||
    value === "strategy" ||
    value === "harness-artifact"
  );
}

export function isAIPlayerEvalCaseResult(
  value: unknown,
): value is AIPlayerEvalCaseResult {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (
    typeof value.runId !== "string" ||
    typeof value.repetition !== "number" ||
    !Number.isInteger(value.repetition) ||
    typeof value.completed !== "boolean" ||
    typeof value.legal !== "boolean" ||
    !isFailureMode(value.failureMode) ||
    typeof value.inputState !== "string" ||
    !isRecord(value.candidate) ||
    typeof value.candidate.id !== "string" ||
    (value.candidate.modelConfigurationSha256 !== undefined &&
      (typeof value.candidate.modelConfigurationSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(value.candidate.modelConfigurationSha256))) ||
    !isRecord(value.scenario) ||
    typeof value.scenario.id !== "string" ||
    !isEvalSplit(value.scenario.split) ||
    !Array.isArray(value.criteria) ||
    !isRecord(value.timing)
  ) {
    return false;
  }
  return value.criteria.every(
    (criterion) =>
      isRecord(criterion) &&
      typeof criterion.id === "string" &&
      typeof criterion.description === "string" &&
      typeof criterion.weight === "number" &&
      typeof criterion.passed === "boolean" &&
      typeof criterion.evidence === "string",
  );
}

export function parseAIPlayerEvalCaseResults(
  casesText: string,
): AIPlayerEvalCaseResult[] {
  return casesText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const parsed = JSON.parse(line) as unknown;
      if (!isAIPlayerEvalCaseResult(parsed)) {
        throw new Error(`cases.jsonl line ${index + 1} is not a valid eval case`);
      }
      return parsed;
    });
}

export async function loadAIPlayerEvalRunArtifact(
  directory: string,
): Promise<AIPlayerEvalRunArtifact> {
  const [manifestText, casesText, runStatusText] = await Promise.all([
    readFile(join(directory, "manifest.json"), "utf8"),
    readFile(join(directory, "cases.jsonl"), "utf8"),
    readOptionalFile(join(directory, "run-status.json")),
  ]);
  const manifest = parseManifest(JSON.parse(manifestText) as unknown);
  const cases = parseAIPlayerEvalCaseResults(casesText);
  if (cases.length === 0) {
    throw new Error("cases.jsonl must contain at least one eval case");
  }
  if (manifest.costBudget !== undefined && runStatusText === undefined) {
    throw new Error("Budgeted evaluation is missing run-status.json");
  }
  if (manifest.harnessVersion === "ai-player-eval-harness-v3") {
    for (const result of cases) {
      const identities = manifest.candidates.filter(
        (candidate) => candidate.id === result.candidate.id,
      );
      const identity = identities[0];
      if (
        identities.length !== 1 ||
        identity?.modelConfigurationSha256 === undefined ||
        result.candidate.modelConfigurationSha256 !==
          identity.modelConfigurationSha256
      ) {
        throw new Error(
          `Case model configuration fingerprint does not match the v3 manifest for ${result.candidate.id}`,
        );
      }
    }
  }
  const runStatus =
    runStatusText === undefined
      ? undefined
      : parseAIPlayerEvalCostBudgetSummary(
          JSON.parse(runStatusText) as unknown,
        );
  return {
    manifest,
    cases,
    ...(runStatus === undefined ? {} : { runStatus }),
  };
}

function requireCompleteRun(
  artifact: AIPlayerEvalRunArtifact,
  role: "reference" | "candidate",
): void {
  if (artifact.runStatus !== undefined && artifact.runStatus.status !== "completed") {
    throw new Error(
      `${role} run ${artifact.manifest.runId} is not complete: ${artifact.runStatus.status}`,
    );
  }
}

function selectedCandidateId(
  artifact: AIPlayerEvalRunArtifact,
  requestedId: string | undefined,
  role: "reference" | "candidate",
): string {
  const ids = [...new Set(artifact.cases.map((result) => result.candidate.id))];
  if (requestedId !== undefined) {
    if (!ids.includes(requestedId)) {
      throw new Error(
        `${role} candidate ${requestedId} is not present in run ${artifact.manifest.runId}`,
      );
    }
    return requestedId;
  }
  if (ids.length !== 1) {
    throw new Error(
      `${role} run ${artifact.manifest.runId} contains ${ids.length} candidates; select one explicitly`,
    );
  }
  const id = ids[0];
  if (id === undefined) {
    throw new Error(`${role} run ${artifact.manifest.runId} has no cases`);
  }
  return id;
}

function selectedManifestCandidate(
  artifact: AIPlayerEvalRunArtifact,
  candidateId: string,
  role: "reference" | "candidate",
): AIPlayerEvalCandidateIdentity {
  const matches = artifact.manifest.candidates.filter(
    (candidate) => candidate.id === candidateId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `${role} manifest must contain exactly one identity for ${candidateId}`,
    );
  }
  const identity = matches[0];
  if (identity === undefined) {
    throw new Error(`${role} manifest is missing ${candidateId}`);
  }
  if (identity.promptVersion !== artifact.manifest.prompt.version) {
    throw new Error(
      `${role} manifest candidate prompt version does not match its prompt snapshot`,
    );
  }
  const selectedCases = artifact.cases.filter(
    (result) => result.candidate.id === candidateId,
  );
  for (const result of selectedCases) {
    const recorded = result.candidate;
    if (
      recorded.modelId !== identity.modelId ||
      recorded.provider !== identity.provider ||
      recorded.reasoningEffort !== identity.reasoningEffort ||
      recorded.promptVersion !== identity.promptVersion ||
      recorded.modelConfigurationSha256 !==
        identity.modelConfigurationSha256
    ) {
      throw new Error(
        `${role} case candidate identity does not match its manifest for ${candidateId}`,
      );
    }
  }
  return identity;
}

function requireSameModelConfiguration(
  reference: AIPlayerEvalCandidateIdentity,
  candidate: AIPlayerEvalCandidateIdentity,
): void {
  if (
    reference.id !== candidate.id ||
    reference.modelId !== candidate.modelId ||
    reference.provider !== candidate.provider ||
    reference.reasoningEffort !== candidate.reasoningEffort ||
    reference.modelConfigurationSha256 !==
      candidate.modelConfigurationSha256
  ) {
    throw new Error(
      "Selected model configuration differs; prompt promotion requires the same candidate, resolved model, provider settings, and reasoning effort",
    );
  }
}

function caseKey(result: AIPlayerEvalCaseResult): string {
  return `${result.scenario.id}:${result.repetition}`;
}

function casesByKey(
  results: readonly AIPlayerEvalCaseResult[],
  role: "reference" | "candidate",
): Map<string, AIPlayerEvalCaseResult> {
  const indexed = new Map<string, AIPlayerEvalCaseResult>();
  for (const result of results) {
    const key = caseKey(result);
    if (indexed.has(key)) {
      throw new Error(`Duplicate ${role} case key: ${key}`);
    }
    indexed.set(key, result);
  }
  return indexed;
}

function sortedKeys(indexed: ReadonlyMap<string, AIPlayerEvalCaseResult>): string[] {
  return [...indexed.keys()].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function createPairs(
  referenceCases: readonly AIPlayerEvalCaseResult[],
  candidateCases: readonly AIPlayerEvalCaseResult[],
): MatchedPair[] {
  const referenceByKey = casesByKey(referenceCases, "reference");
  const candidateByKey = casesByKey(candidateCases, "candidate");
  const referenceKeys = sortedKeys(referenceByKey);
  const candidateKeys = sortedKeys(candidateByKey);
  if (!sameStrings(referenceKeys, candidateKeys)) {
    throw new Error(
      `Case keys differ: reference=[${referenceKeys.join(", ")}], candidate=[${candidateKeys.join(", ")}]`,
    );
  }

  return referenceKeys.map((key) => {
    const reference = referenceByKey.get(key);
    const candidate = candidateByKey.get(key);
    if (reference === undefined || candidate === undefined) {
      throw new Error(`Missing matched case ${key}`);
    }
    if (reference.inputState !== candidate.inputState) {
      throw new Error(`Input state differs for ${key}`);
    }
    if (reference.scenario.split !== candidate.scenario.split) {
      throw new Error(`Split differs for ${key}`);
    }
    if (rubricSignature(reference) !== rubricSignature(candidate)) {
      throw new Error(`Rubric differs for ${key}`);
    }
    return { caseKey: key, reference, candidate };
  });
}

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function repetitionCoverage(pairs: readonly MatchedPair[]): {
  scenarioCount: number;
  minimumRepetitionsPerScenario: number;
  maximumRepetitionsPerScenario: number;
} {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    const scenarioId = pair.reference.scenario.id;
    counts.set(scenarioId, (counts.get(scenarioId) ?? 0) + 1);
  }
  const repetitions = [...counts.values()];
  return {
    scenarioCount: counts.size,
    minimumRepetitionsPerScenario:
      repetitions.length === 0 ? 0 : Math.min(...repetitions),
    maximumRepetitionsPerScenario:
      repetitions.length === 0 ? 0 : Math.max(...repetitions),
  };
}

function resultCost(result: AIPlayerEvalCaseResult): number | undefined {
  return result.providerReportedCostUsd ?? result.reconstructedCostUsd;
}

function summarizePairs(
  pairs: readonly MatchedPair[],
  split: AIPlayerEvalSplit,
): AIPlayerEvalMatchedSliceComparison {
  const qualityDeltas = pairs.map(
    ({ reference, candidate }) =>
      scoreAIPlayerEvalCase(candidate).qualityPercent -
      scoreAIPlayerEvalCase(reference).qualityPercent,
  );
  const scenarioMeanQualityDeltas = meanAIPlayerEvalMetricByGroup(
    pairs.map((pair, index) => ({
      groupId: pair.reference.scenario.id,
      value: qualityDeltas[index] ?? 0,
    })),
  );
  const providerLatencyDeltas = pairs.flatMap(({ reference, candidate }) => {
    const referenceLatency = reference.timing.providerDurationMs;
    const candidateLatency = candidate.timing.providerDurationMs;
    return referenceLatency === undefined || candidateLatency === undefined
      ? []
      : [candidateLatency - referenceLatency];
  });
  const costDeltas = pairs.flatMap(({ reference, candidate }) => {
    const referenceCost = resultCost(reference);
    const candidateCost = resultCost(candidate);
    return referenceCost === undefined || candidateCost === undefined
      ? []
      : [candidateCost - referenceCost];
  });
  const completionDeltas = pairs.map(
    ({ reference, candidate }) =>
      (Number(candidate.completed) - Number(reference.completed)) * 100,
  );
  const legalDeltas = pairs.map(
    ({ reference, candidate }) =>
      (Number(candidate.legal) - Number(reference.legal)) * 100,
  );
  const coverage = repetitionCoverage(pairs);

  return {
    split,
    qualityConfidenceUnit: "scenario-mean",
    matchedCaseCount: pairs.length,
    ...coverage,
    qualityDeltaPercentPoints: mean(scenarioMeanQualityDeltas) ?? 0,
    qualityDeltaConfidence95: pairedStudentTConfidence95(
      scenarioMeanQualityDeltas,
      { lower: -100, upper: 100 },
    ),
    completionRateDeltaPercentPoints: mean(completionDeltas) ?? 0,
    legalRateDeltaPercentPoints: mean(legalDeltas) ?? 0,
    providerLatencyDeltaMs: mean(providerLatencyDeltas),
    costPerCaseDeltaUsd: mean(costDeltas),
    wins: qualityDeltas.filter((delta) => delta > 0).length,
    ties: qualityDeltas.filter((delta) => delta === 0).length,
    losses: qualityDeltas.filter((delta) => delta < 0).length,
  };
}

function promotionAssessment(options: {
  comparisonKind: AIPlayerEvalRunComparisonKind;
  qualityDeltaPercentPoints: number;
  qualityDeltaConfidence95: AIPlayerEvalConfidenceInterval;
  minimumRepetitionsPerScenario: number;
  scenarioCount: number;
  losses: number;
  hardGateRegressionCount: number;
}): { verdict: AIPlayerEvalPromotionVerdict; reasons: string[] } {
  if (options.comparisonKind === "repeatability-check") {
    return {
      verdict: "review",
      reasons: [
        "The prompt fingerprint did not change; this is repeatability evidence, not a promotable prompt experiment",
      ],
    };
  }
  const reasons: string[] = [];
  if (options.hardGateRegressionCount > 0) {
    reasons.push("One or more previously complete or legal cases failed");
  }
  if (options.qualityDeltaPercentPoints <= 0) {
    reasons.push("Mean paired tactical quality did not improve");
  }
  if (reasons.length > 0) {
    return { verdict: "reject", reasons };
  }
  if (options.minimumRepetitionsPerScenario < 3) {
    reasons.push(
      "At least 3 matched repetitions per scenario are required for promotion",
    );
  }
  if (options.scenarioCount < 3) {
    reasons.push(
      "At least 3 distinct scenarios are required for scenario-clustered confidence",
    );
  }
  if (options.qualityDeltaConfidence95.lower <= 0) {
    reasons.push(
      "The scenario-clustered 95% quality interval does not exclude zero",
    );
  }
  if (options.losses > 0) {
    reasons.push("One or more matched cases lost tactical quality");
  }
  return reasons.length > 0
    ? { verdict: "review", reasons }
    : {
        verdict: "promote",
        reasons: [
          "Scenario-clustered quality improved with a positive 95% bound and no case or hard-gate regressions",
        ],
      };
}

export function compareAIPlayerEvalRuns(
  referenceArtifact: AIPlayerEvalRunArtifact,
  candidateArtifact: AIPlayerEvalRunArtifact,
  options: AIPlayerEvalRunComparisonOptions = {},
): AIPlayerEvalRunComparison {
  const referenceManifest = referenceArtifact.manifest;
  const candidateManifest = candidateArtifact.manifest;
  requireCompleteRun(referenceArtifact, "reference");
  requireCompleteRun(candidateArtifact, "candidate");
  if (referenceManifest.harnessVersion !== candidateManifest.harnessVersion) {
    throw new Error(
      `Harness versions differ: ${referenceManifest.harnessVersion} vs ${candidateManifest.harnessVersion}`,
    );
  }
  if (referenceManifest.suiteVersion !== candidateManifest.suiteVersion) {
    throw new Error(
      `Suite versions differ: ${referenceManifest.suiteVersion} vs ${candidateManifest.suiteVersion}`,
    );
  }
  if (
    referenceManifest.executionScheduleVersion !==
    candidateManifest.executionScheduleVersion
  ) {
    throw new Error(
      `Execution schedule versions differ: ${referenceManifest.executionScheduleVersion ?? "unversioned"} vs ${candidateManifest.executionScheduleVersion ?? "unversioned"}`,
    );
  }

  const referenceCandidateId = selectedCandidateId(
    referenceArtifact,
    options.referenceCandidateId,
    "reference",
  );
  const candidateCandidateId = selectedCandidateId(
    candidateArtifact,
    options.candidateCandidateId,
    "candidate",
  );
  const referenceIdentity = selectedManifestCandidate(
    referenceArtifact,
    referenceCandidateId,
    "reference",
  );
  const candidateIdentity = selectedManifestCandidate(
    candidateArtifact,
    candidateCandidateId,
    "candidate",
  );
  requireSameModelConfiguration(referenceIdentity, candidateIdentity);
  const comparisonKind: AIPlayerEvalRunComparisonKind =
    referenceManifest.prompt.sha256 === candidateManifest.prompt.sha256
      ? "repeatability-check"
      : "prompt-experiment";
  const pairs = createPairs(
    referenceArtifact.cases.filter(
      (result) => result.candidate.id === referenceCandidateId,
    ),
    candidateArtifact.cases.filter(
      (result) => result.candidate.id === candidateCandidateId,
    ),
  );
  if (pairs.length === 0) {
    throw new Error("Matched comparison requires at least one case");
  }

  const combined = summarizePairs(pairs, pairs[0]?.reference.scenario.split ?? "development");
  const improvedCaseKeys = pairs
    .filter(
      ({ reference, candidate }) =>
        scoreAIPlayerEvalCase(candidate).qualityPercent >
        scoreAIPlayerEvalCase(reference).qualityPercent,
    )
    .map(({ caseKey: key }) => key);
  const regressedCaseKeys = pairs
    .filter(
      ({ reference, candidate }) =>
        scoreAIPlayerEvalCase(candidate).qualityPercent <
        scoreAIPlayerEvalCase(reference).qualityPercent,
    )
    .map(({ caseKey: key }) => key);
  const hardGateRegressionCaseKeys = pairs
    .filter(
      ({ reference, candidate }) =>
        (reference.completed && !candidate.completed) ||
        (reference.legal && !candidate.legal),
    )
    .map(({ caseKey: key }) => key);
  const failureModeChanges = pairs.flatMap(({ caseKey: key, reference, candidate }) =>
    reference.failureMode === candidate.failureMode
      ? []
      : [
          {
            caseKey: key,
            reference: reference.failureMode,
            candidate: candidate.failureMode,
          },
        ],
  );
  const splits = (["development", "holdout"] as const).flatMap((split) => {
    const splitPairs = pairs.filter(
      ({ reference }) => reference.scenario.split === split,
    );
    return splitPairs.length === 0 ? [] : [summarizePairs(splitPairs, split)];
  });
  const assessment = promotionAssessment({
    comparisonKind,
    qualityDeltaPercentPoints: combined.qualityDeltaPercentPoints,
    qualityDeltaConfidence95: combined.qualityDeltaConfidence95,
    minimumRepetitionsPerScenario: combined.minimumRepetitionsPerScenario,
    scenarioCount: combined.scenarioCount,
    losses: combined.losses,
    hardGateRegressionCount: hardGateRegressionCaseKeys.length,
  });

  return {
    schemaVersion: 4,
    comparisonKind,
    verdict: assessment.verdict,
    harnessVersion: referenceManifest.harnessVersion,
    executionScheduleVersion:
      referenceManifest.executionScheduleVersion,
    suiteVersion: referenceManifest.suiteVersion,
    qualityConfidenceUnit: combined.qualityConfidenceUnit,
    reference: {
      runId: referenceManifest.runId,
      candidateId: referenceCandidateId,
      promptVersion: referenceManifest.prompt.version,
      promptSha256: referenceManifest.prompt.sha256,
      modelConfigurationSha256:
        referenceIdentity.modelConfigurationSha256,
    },
    candidate: {
      runId: candidateManifest.runId,
      candidateId: candidateCandidateId,
      promptVersion: candidateManifest.prompt.version,
      promptSha256: candidateManifest.prompt.sha256,
      modelConfigurationSha256:
        candidateIdentity.modelConfigurationSha256,
    },
    matchedCaseCount: combined.matchedCaseCount,
    scenarioCount: combined.scenarioCount,
    minimumRepetitionsPerScenario:
      combined.minimumRepetitionsPerScenario,
    maximumRepetitionsPerScenario:
      combined.maximumRepetitionsPerScenario,
    qualityDeltaPercentPoints: combined.qualityDeltaPercentPoints,
    qualityDeltaConfidence95: combined.qualityDeltaConfidence95,
    completionRateDeltaPercentPoints:
      combined.completionRateDeltaPercentPoints,
    legalRateDeltaPercentPoints: combined.legalRateDeltaPercentPoints,
    providerLatencyDeltaMs: combined.providerLatencyDeltaMs,
    costPerCaseDeltaUsd: combined.costPerCaseDeltaUsd,
    wins: combined.wins,
    ties: combined.ties,
    losses: combined.losses,
    improvedCaseKeys,
    regressedCaseKeys,
    hardGateRegressionCaseKeys,
    failureModeChanges,
    verdictReasons: assessment.reasons,
    splits,
  };
}

function signed(value: number | undefined, digits: number): string {
  if (value === undefined) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function caseList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.map((value) => `\`${value}\``).join(", ");
}

export function formatAIPlayerEvalRunComparisonMarkdown(
  comparison: AIPlayerEvalRunComparison,
): string {
  const splitRows = comparison.splits.map((split) =>
    [
      split.split,
      split.matchedCaseCount,
      split.scenarioCount,
      `${split.minimumRepetitionsPerScenario}-${split.maximumRepetitionsPerScenario}`,
      `${signed(split.qualityDeltaPercentPoints, 1)} pp`,
      `${signed(split.qualityDeltaConfidence95.lower, 1)} to ${signed(split.qualityDeltaConfidence95.upper, 1)} pp`,
      `${signed(split.completionRateDeltaPercentPoints, 1)} pp`,
      `${signed(split.legalRateDeltaPercentPoints, 1)} pp`,
      signed(split.providerLatencyDeltaMs, 0),
      split.costPerCaseDeltaUsd === undefined
        ? "n/a"
        : `${split.costPerCaseDeltaUsd >= 0 ? "+" : "-"}$${Math.abs(split.costPerCaseDeltaUsd).toFixed(6)}`,
      `${split.wins}-${split.ties}-${split.losses}`,
    ].join(" | "),
  );
  const cost =
    comparison.costPerCaseDeltaUsd === undefined
      ? "n/a"
      : `${comparison.costPerCaseDeltaUsd >= 0 ? "+" : "-"}$${Math.abs(comparison.costPerCaseDeltaUsd).toFixed(6)}`;

  return [
    "# AI Player Matched Run Comparison",
    "",
    `Verdict: **${comparison.verdict.toUpperCase()}**`,
    `Comparison: **${comparison.comparisonKind}**`,
    "",
    `Reference: \`${comparison.reference.runId}\` / \`${comparison.reference.candidateId}\` / \`${comparison.reference.promptSha256}\``,
    `Candidate: \`${comparison.candidate.runId}\` / \`${comparison.candidate.candidateId}\` / \`${comparison.candidate.promptSha256}\``,
    `Execution schedule: \`${comparison.executionScheduleVersion ?? "unversioned"}\``,
    "",
    "Metric | Matched delta",
    "--- | ---:",
    `Quality delta | ${signed(comparison.qualityDeltaPercentPoints, 1)} pp`,
    `Scenario-clustered quality 95% CI | ${signed(comparison.qualityDeltaConfidence95.lower, 1)} to ${signed(comparison.qualityDeltaConfidence95.upper, 1)} pp`,
    `Scenarios | ${comparison.scenarioCount}`,
    `Repetitions per scenario | ${comparison.minimumRepetitionsPerScenario}-${comparison.maximumRepetitionsPerScenario}`,
    `Completion-rate delta | ${signed(comparison.completionRateDeltaPercentPoints, 1)} pp`,
    `Legal-rate delta | ${signed(comparison.legalRateDeltaPercentPoints, 1)} pp`,
    `Provider latency delta | ${signed(comparison.providerLatencyDeltaMs, 0)} ms`,
    `Cost per case delta | ${cost}`,
    `Quality W-T-L | ${comparison.wins}-${comparison.ties}-${comparison.losses}`,
    "",
    "Split | Cases | Scenarios | Reps | Quality pp | Scenario-mean quality 95% CI | Completion pp | Legal pp | Provider ms | Cost/case USD | W-T-L",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...splitRows,
    "",
    `Improved cases: ${caseList(comparison.improvedCaseKeys)}`,
    `Regressed cases: ${caseList(comparison.regressedCaseKeys)}`,
    `New hard-gate failures: ${caseList(comparison.hardGateRegressionCaseKeys)}`,
    "",
    "Verdict reasons:",
    ...comparison.verdictReasons.map((reason) => `- ${reason}`),
    "",
    "Promotion rule: quality must improve, its scenario-clustered 95% interval must exclude zero, at least three distinct scenarios each need at least three matched repetitions, completion and legality cannot regress, and any per-case quality regression requires review. Latency and cost are reported separately and never rescue a weaker player.",
  ].join("\n");
}

function nextArgument(
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

interface ComparisonCliOptions {
  referenceDirectory: string;
  candidateDirectory: string;
  referenceCandidateId?: string;
  candidateCandidateId?: string;
}

export function parseAIPlayerEvalRunComparisonArguments(
  args: readonly string[],
): ComparisonCliOptions {
  let referenceDirectory: string | undefined;
  let candidateDirectory: string | undefined;
  let referenceCandidateId: string | undefined;
  let candidateCandidateId: string | undefined;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--reference") {
      referenceDirectory = nextArgument(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--candidate") {
      candidateDirectory = nextArgument(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--reference-candidate") {
      referenceCandidateId = nextArgument(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--candidate-id") {
      candidateCandidateId = nextArgument(args, index, argument);
      index++;
      continue;
    }
    throw new Error(`Unknown comparison argument: ${argument}`);
  }
  if (referenceDirectory === undefined || candidateDirectory === undefined) {
    throw new Error("--reference and --candidate are required");
  }
  return {
    referenceDirectory,
    candidateDirectory,
    referenceCandidateId,
    candidateCandidateId,
  };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerEvalRunComparisonArguments(Bun.argv.slice(2));
    const [reference, candidate] = await Promise.all([
      loadAIPlayerEvalRunArtifact(options.referenceDirectory),
      loadAIPlayerEvalRunArtifact(options.candidateDirectory),
    ]);
    console.log(
      formatAIPlayerEvalRunComparisonMarkdown(
        compareAIPlayerEvalRuns(reference, candidate, options),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
