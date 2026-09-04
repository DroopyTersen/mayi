import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Card } from "../../core/card/card.types";
import type { MeldSpec } from "../../core/engine/game-engine.types";
import { isValidRun, isValidSet } from "../../core/meld/meld.validation";
import type { GameAction } from "../ai-action-runtime.types";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  LUNA_BASELINE_CANDIDATE_ID,
} from "./ai-player-eval-candidates";
import { parseAIPlayerEvalCaseResults } from "./ai-player-eval-run-comparison";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import {
  AI_PLAYER_EVAL_HARNESS_VERSION,
  createAIPlayerEvalPromptSnapshot,
  createAIPlayerEvalRunDirectory,
  formatAIPlayerEvalSummaryMarkdown,
  summarizeAIPlayerEvalRun,
  type AIPlayerEvalPromptSnapshot,
  type AIPlayerEvalRunSummary,
} from "./ai-player-fixed-state-runner";
import {
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  AI_PLAYER_FIXED_STATE_SUITE_VERSION,
  createAIPlayerFixedStateRuntime,
  type AIPlayerFixedStateScenario,
} from "./ai-player-fixed-state-scenarios";

const DEFAULT_PRIMARY_DIRECTORY = ".data/ai-evals/luna-frozen-baseline-v1";
const DEFAULT_REPLACEMENT_DIRECTORY = ".data/ai-evals/luna-baseline-ace-fix-v1";
const DEFAULT_CERTIFIED_RUN_ID = "luna-frozen-baseline-certified-v4";

export interface FrozenLunaBaselineSource {
  runId: string;
  cases: AIPlayerEvalCaseResult[];
}

export interface FrozenLunaBaselineCaseAudit {
  caseKey: string;
  inputStateMatches: boolean;
  legalMatches: boolean;
  rubricMatches: boolean;
  outcomeMatches: boolean;
  passed: boolean;
}

export interface CertifiedFrozenLunaBaselineManifest {
  schemaVersion: 1;
  runId: string;
  harnessVersion: string;
  suiteVersion: string;
  startedAt: string;
  split: "all";
  repetitions: 1;
  candidates: [
    (typeof AI_PLAYER_EVAL_CANDIDATES)[typeof LUNA_BASELINE_CANDIDATE_ID],
  ];
  prompt: AIPlayerEvalPromptSnapshot;
  scenarios: Array<{
    id: string;
    split: "development" | "holdout";
    category: string;
    description: string;
    rubric: AIPlayerFixedStateScenario["rubric"];
  }>;
  certification: {
    certifiedAt: string;
    primaryRunId: string;
    replacementRunIds: string[];
    replayedCaseCount: number;
    replacementCaseKeys: string[];
  };
}

export interface CertifiedFrozenLunaBaseline {
  manifest: CertifiedFrozenLunaBaselineManifest;
  cases: AIPlayerEvalCaseResult[];
  summary: AIPlayerEvalRunSummary;
}

interface ParsedRecordedAction {
  name: string;
  input: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function caseKey(result: AIPlayerEvalCaseResult): string {
  return `${result.scenario.id}:${result.repetition}`;
}

function parseRecordedAction(value: string): ParsedRecordedAction {
  const openParenthesis = value.indexOf("(");
  if (openParenthesis <= 0 || !value.endsWith(")")) {
    throw new Error(`Invalid recorded action: ${value}`);
  }
  const name = value.slice(0, openParenthesis);
  const inputValue = JSON.parse(
    value.slice(openParenthesis + 1, -1),
  ) as unknown;
  if (!isRecord(inputValue)) {
    throw new Error(`Recorded action input must be an object: ${value}`);
  }
  return { name, input: inputValue };
}

function requirePositiveInteger(
  input: Record<string, unknown>,
  key: string,
  actionName: string,
): number {
  const value = input[key];
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) {
    throw new Error(`${actionName}.${key} must be a positive integer`);
  }
  return value;
}

function requirePosition(
  values: readonly { id: string }[],
  position: number,
  label: string,
): string {
  const value = values[position - 1];
  if (value === undefined) {
    throw new Error(`${label} position ${position} is out of range`);
  }
  return value.id;
}

function recordedMelds(
  input: Record<string, unknown>,
  hand: readonly Card[],
): MeldSpec[] {
  const rawMelds = input.melds;
  if (!Array.isArray(rawMelds) || rawMelds.length === 0) {
    throw new Error("lay_down.melds must be a non-empty array");
  }
  return rawMelds.map((rawMeld, meldIndex) => {
    if (!Array.isArray(rawMeld) || rawMeld.length === 0) {
      throw new Error(`lay_down.melds[${meldIndex}] must be non-empty`);
    }
    const positions = rawMeld.map((position) => {
      if (
        !Number.isInteger(position) ||
        typeof position !== "number" ||
        position < 1
      ) {
        throw new Error(
          `lay_down.melds[${meldIndex}] positions must be positive integers`,
        );
      }
      return position;
    });
    const cards = positions.map((position) => {
      const card = hand[position - 1];
      if (card === undefined) {
        throw new Error(
          `lay_down.melds[${meldIndex}] position ${position} is out of range`,
        );
      }
      return card;
    });
    const canBeSet = isValidSet(cards);
    const canBeRun = isValidRun(cards);
    if (!canBeSet && !canBeRun) {
      throw new Error(`lay_down.melds[${meldIndex}] is not a valid set or run`);
    }
    const type: MeldSpec["type"] =
      canBeSet && !canBeRun ? "set" : canBeRun && !canBeSet ? "run" : "set";
    return { type, cardIds: cards.map((card) => card.id) };
  });
}

async function recordedActionToGameAction(
  actionText: string,
  runtime: ReturnType<typeof createAIPlayerFixedStateRuntime>["runtime"],
): Promise<GameAction> {
  const action = parseRecordedAction(actionText);
  const snapshot = await runtime.getSnapshot();
  const player = snapshot.players.find(
    (candidate) => candidate.id === "eval-player-0",
  );
  if (player === undefined) throw new Error("Evaluated player is missing");

  switch (action.name) {
    case "draw_from_stock":
      return { type: "DRAW_FROM_STOCK" };
    case "draw_from_discard":
      return { type: "DRAW_FROM_DISCARD" };
    case "lay_down":
      return {
        type: "LAY_DOWN",
        melds: recordedMelds(action.input, player.hand),
      };
    case "discard":
      return {
        type: "DISCARD",
        cardId: requirePosition(
          player.hand,
          requirePositiveInteger(action.input, "position", action.name),
          "discard card",
        ),
      };
    case "lay_off": {
      const cardPosition = requirePositiveInteger(
        action.input,
        "cardPosition",
        action.name,
      );
      const meldNumber = requirePositiveInteger(
        action.input,
        "meldNumber",
        action.name,
      );
      const position = action.input.position;
      if (
        position !== undefined &&
        position !== "start" &&
        position !== "end"
      ) {
        throw new Error("lay_off.position must be start or end");
      }
      return {
        type: "LAY_OFF",
        cardId: requirePosition(player.hand, cardPosition, "lay-off card"),
        meldId: requirePosition(snapshot.table, meldNumber, "lay-off meld"),
        ...(position === undefined ? {} : { position }),
      };
    }
    case "swap_joker": {
      const meldNumber = requirePositiveInteger(
        action.input,
        "meldNumber",
        action.name,
      );
      const jokerPosition = requirePositiveInteger(
        action.input,
        "jokerPosition",
        action.name,
      );
      const cardPosition = requirePositiveInteger(
        action.input,
        "cardPosition",
        action.name,
      );
      const meld = snapshot.table[meldNumber - 1];
      if (meld === undefined) {
        throw new Error(`swap meld position ${meldNumber} is out of range`);
      }
      return {
        type: "SWAP_JOKER",
        meldId: meld.id,
        jokerCardId: requirePosition(meld.cards, jokerPosition, "swap Joker"),
        swapCardId: requirePosition(player.hand, cardPosition, "swap card"),
      };
    }
    case "allow_may_i":
      return { type: "ALLOW_MAY_I" };
    case "claim_may_i":
      return { type: "CLAIM_MAY_I" };
    case "skip":
      return { type: "SKIP" };
    default:
      throw new Error(`Unsupported recorded action: ${action.name}`);
  }
}

function currentOutcome(
  snapshot: Awaited<
    ReturnType<
      ReturnType<
        typeof createAIPlayerFixedStateRuntime
      >["runtime"]["getSnapshot"]
    >
  >,
): AIPlayerEvalCaseResult["outcome"] {
  const evaluatedPlayer = snapshot.players.find(
    (player) => player.id === "eval-player-0",
  );
  return {
    phase: snapshot.phase,
    turnPhase: snapshot.turnPhase,
    awaitingPlayerId: snapshot.awaitingPlayerId,
    evaluatedPlayerHandCardIds:
      evaluatedPlayer?.hand.map((card) => card.id) ?? [],
    tableMeldCount: snapshot.table.length,
    topDiscardCardId: snapshot.discard[0]?.id ?? null,
    lastError: snapshot.lastError,
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function auditRecordedAIPlayerEvalCase(
  recorded: AIPlayerEvalCaseResult,
  scenario: AIPlayerFixedStateScenario,
): Promise<FrozenLunaBaselineCaseAudit> {
  const key = caseKey(recorded);
  if (recorded.scenario.id !== scenario.identity.id) {
    throw new Error(
      `Scenario mismatch for ${key}: expected ${scenario.identity.id}`,
    );
  }
  const state = createAIPlayerFixedStateRuntime(scenario, recorded.repetition);
  try {
    const before = await state.runtime.getSnapshot();
    const inputState = outputGameStateForLLM(before, "eval-player-0", {
      actionLog: scenario.actionLog,
    });
    for (const actionText of recorded.actions) {
      const action = await recordedActionToGameAction(
        actionText,
        state.runtime,
      );
      await state.runtime.executeAction(action);
    }
    const after = await state.runtime.getSnapshot();
    const legal = state.attempts.every((attempt) => attempt.ok);
    const criteria = scenario.grade(after, state.attempts);
    const inputStateMatches = recorded.inputState === inputState;
    const legalMatches = recorded.legal === legal;
    const rubricMatches = sameValue(recorded.criteria, criteria);
    const outcomeMatches = sameValue(recorded.outcome, currentOutcome(after));
    return {
      caseKey: key,
      inputStateMatches,
      legalMatches,
      rubricMatches,
      outcomeMatches,
      passed:
        inputStateMatches && legalMatches && rubricMatches && outcomeMatches,
    };
  } finally {
    state.actor.stop();
  }
}

function indexedCases(
  source: FrozenLunaBaselineSource,
  role: "primary" | "replacement",
): Map<string, AIPlayerEvalCaseResult> {
  const indexed = new Map<string, AIPlayerEvalCaseResult>();
  for (const result of source.cases) {
    const key = caseKey(result);
    if (indexed.has(key)) {
      throw new Error(`Duplicate ${role} case in ${source.runId}: ${key}`);
    }
    indexed.set(key, result);
  }
  return indexed;
}

export async function certifyFrozenLunaBaseline(options: {
  runId: string;
  primary: FrozenLunaBaselineSource;
  replacements: FrozenLunaBaselineSource[];
  scenarios: readonly AIPlayerFixedStateScenario[];
  prompt: AIPlayerEvalPromptSnapshot;
  certifiedAt: string;
}): Promise<CertifiedFrozenLunaBaseline> {
  const expectedKeys = new Set(
    options.scenarios.map((scenario) => `${scenario.identity.id}:1`),
  );
  const primaryByKey = indexedCases(options.primary, "primary");
  const replacementByKey = new Map<string, AIPlayerEvalCaseResult>();
  for (const source of options.replacements) {
    for (const [key, result] of indexedCases(source, "replacement")) {
      if (!expectedKeys.has(key)) {
        throw new Error(`Unexpected replacement case: ${key}`);
      }
      if (replacementByKey.has(key)) {
        throw new Error(`Multiple replacements supplied for ${key}`);
      }
      replacementByKey.set(key, result);
    }
  }

  const certifiedCases: AIPlayerEvalCaseResult[] = [];
  const candidate = AI_PLAYER_EVAL_CANDIDATES[LUNA_BASELINE_CANDIDATE_ID];
  for (const scenario of options.scenarios) {
    const key = `${scenario.identity.id}:1`;
    const selected = replacementByKey.get(key) ?? primaryByKey.get(key);
    if (selected === undefined) {
      throw new Error(`Missing frozen baseline case: ${key}`);
    }
    if (selected.candidate.id !== LUNA_BASELINE_CANDIDATE_ID) {
      throw new Error(
        `Frozen baseline case ${key} uses ${selected.candidate.id}, not Luna`,
      );
    }
    if (selected.candidate.promptVersion !== options.prompt.version) {
      throw new Error(`Prompt version differs for frozen baseline case ${key}`);
    }
    const audit = await auditRecordedAIPlayerEvalCase(selected, scenario);
    if (!audit.passed) {
      throw new Error(
        `Frozen baseline replay failed for ${key}: ${JSON.stringify(audit)}`,
      );
    }
    certifiedCases.push({
      ...structuredClone(selected),
      runId: options.runId,
      scenario: structuredClone(scenario.identity),
      candidate: {
        ...structuredClone(selected.candidate),
        modelConfigurationSha256: candidate.modelConfigurationSha256,
      },
    });
  }

  const manifest: CertifiedFrozenLunaBaselineManifest = {
    schemaVersion: 1,
    runId: options.runId,
    harnessVersion: AI_PLAYER_EVAL_HARNESS_VERSION,
    suiteVersion: AI_PLAYER_FIXED_STATE_SUITE_VERSION,
    startedAt: options.certifiedAt,
    split: "all",
    repetitions: 1,
    candidates: [candidate],
    prompt: options.prompt,
    scenarios: options.scenarios.map((scenario) => ({
      ...scenario.identity,
      rubric: scenario.rubric,
    })),
    certification: {
      certifiedAt: options.certifiedAt,
      primaryRunId: options.primary.runId,
      replacementRunIds: options.replacements.map((source) => source.runId),
      replayedCaseCount: certifiedCases.length,
      replacementCaseKeys: [...replacementByKey.keys()].sort((left, right) =>
        left.localeCompare(right),
      ),
    },
  };
  return {
    manifest,
    cases: certifiedCases,
    summary: summarizeAIPlayerEvalRun(options.runId, certifiedCases),
  };
}

async function loadFrozenLunaBaselineSource(
  directory: string,
): Promise<{
  source: FrozenLunaBaselineSource;
  prompt: AIPlayerEvalPromptSnapshot;
}> {
  const [manifestText, casesText] = await Promise.all([
    readFile(join(directory, "manifest.json"), "utf8"),
    readFile(join(directory, "cases.jsonl"), "utf8"),
  ]);
  const manifestValue = JSON.parse(manifestText) as unknown;
  if (!isRecord(manifestValue) || typeof manifestValue.runId !== "string") {
    throw new Error(`${directory}/manifest.json has no runId`);
  }
  if (!isRecord(manifestValue.prompt)) {
    throw new Error(`${directory}/manifest.json has no prompt snapshot`);
  }
  const version = manifestValue.prompt.version;
  const sha256 = manifestValue.prompt.sha256;
  const content = manifestValue.prompt.content;
  if (
    typeof version !== "string" ||
    typeof sha256 !== "string" ||
    typeof content !== "string"
  ) {
    throw new Error(
      `${directory}/manifest.json has an invalid prompt snapshot`,
    );
  }
  const prompt = createAIPlayerEvalPromptSnapshot(version, content);
  if (prompt.sha256 !== sha256) {
    throw new Error(`${directory}/manifest.json prompt fingerprint is invalid`);
  }
  return {
    source: {
      runId: manifestValue.runId,
      cases: parseAIPlayerEvalCaseResults(casesText),
    },
    prompt,
  };
}

export async function runFrozenLunaBaselineCertification(
  options: {
    primaryDirectory?: string;
    replacementDirectory?: string;
    outputRoot?: string;
    runId?: string;
    certifiedAt?: string;
  } = {},
): Promise<{ directory: string; certified: CertifiedFrozenLunaBaseline }> {
  const primaryDirectory =
    options.primaryDirectory ?? DEFAULT_PRIMARY_DIRECTORY;
  const replacementDirectory =
    options.replacementDirectory ?? DEFAULT_REPLACEMENT_DIRECTORY;
  const runId = options.runId ?? DEFAULT_CERTIFIED_RUN_ID;
  const [primary, replacement] = await Promise.all([
    loadFrozenLunaBaselineSource(primaryDirectory),
    loadFrozenLunaBaselineSource(replacementDirectory),
  ]);
  if (!sameValue(primary.prompt, replacement.prompt)) {
    throw new Error("Frozen baseline and repair runs use different prompts");
  }
  const certified = await certifyFrozenLunaBaseline({
    runId,
    primary: primary.source,
    replacements: [replacement.source],
    scenarios: AI_PLAYER_FIXED_STATE_SCENARIOS,
    prompt: primary.prompt,
    certifiedAt: options.certifiedAt ?? new Date().toISOString(),
  });
  const directory = await createAIPlayerEvalRunDirectory(
    options.outputRoot ?? ".data/ai-evals",
    runId,
  );
  await Promise.all([
    writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(certified.manifest, null, 2),
    ),
    writeFile(
      join(directory, "cases.jsonl"),
      `${certified.cases.map((result) => JSON.stringify(result)).join("\n")}\n`,
    ),
    writeFile(
      join(directory, "summary.json"),
      JSON.stringify(certified.summary, null, 2),
    ),
    writeFile(
      join(directory, "summary.md"),
      formatAIPlayerEvalSummaryMarkdown(certified.summary),
    ),
  ]);
  return { directory, certified };
}

if (import.meta.main) {
  try {
    const result = await runFrozenLunaBaselineCertification();
    console.log(formatAIPlayerEvalSummaryMarkdown(result.certified.summary));
    console.log(`Certified artifacts: ${result.directory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
