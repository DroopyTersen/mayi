import type { GameAction } from "../ai-action-runtime.types";
import { getPointValue } from "../../core/card/card.utils";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { canLayOffToSet, getRunInsertPosition } from "../../core/engine/layoff";
import {
  createAIPlayerFixedStateRuntime,
  type AIPlayerFixedStateAttempt,
  type AIPlayerFixedStateScenario,
} from "./ai-player-fixed-state-scenarios";

const EVALUATED_PLAYER_ID = "eval-player-0";

export interface AIPlayerEvalSanityBaselineCaseResult {
  scenarioId: string;
  split: "development" | "holdout";
  repetition: number;
  completed: boolean;
  legal: boolean;
  earnedWeight: number;
  oracleEarnedWeight: number;
  possibleWeight: number;
}

export interface AIPlayerEvalSanityBaselineRepetitionSummary {
  repetition: number;
  qualityPercent: number;
  oracleQualityPercent: number;
}

export interface AIPlayerEvalSanityBaselineSplitSummary {
  split: "development" | "holdout";
  caseCount: number;
  qualityPercent: number;
  oracleQualityPercent: number;
}

export interface AIPlayerEvalSanityBaselineSummary {
  policyId: "blind-legal-v2" | "rule-aware-greedy-v1";
  repetitionCount: number;
  caseCount: number;
  completedRate: number;
  legalRate: number;
  qualityPercent: number;
  oracleQualityPercent: number;
  qualityGapVsOraclePercentPoints: number;
  repetitionSummaries: AIPlayerEvalSanityBaselineRepetitionSummary[];
  splits: AIPlayerEvalSanityBaselineSplitSummary[];
  caseResults: AIPlayerEvalSanityBaselineCaseResult[];
}

function chooseBlindLegalAction(
  snapshot: GameSnapshot,
): GameAction | undefined {
  if (snapshot.awaitingPlayerId !== EVALUATED_PLAYER_ID) return undefined;
  if (snapshot.phase === "RESOLVING_MAY_I") {
    return { type: "ALLOW_MAY_I" };
  }
  if (snapshot.phase !== "ROUND_ACTIVE") return undefined;
  if (snapshot.turnPhase === "AWAITING_DRAW") {
    return { type: "DRAW_FROM_STOCK" };
  }
  if (snapshot.turnPhase === "AWAITING_ACTION") {
    return { type: "SKIP" };
  }
  if (snapshot.turnPhase === "AWAITING_DISCARD") {
    const player = snapshot.players.find(
      (candidate) => candidate.id === EVALUATED_PLAYER_ID,
    );
    const cardId = player?.hand
      .map((card) => card.id)
      .sort((left, right) => left.localeCompare(right))[0];
    return cardId === undefined ? undefined : { type: "DISCARD", cardId };
  }
  return undefined;
}

function hasNaturalPairForRank(
  snapshot: GameSnapshot,
  rank: GameSnapshot["players"][number]["hand"][number]["rank"],
): boolean {
  if (rank === "2" || rank === "Joker") return false;
  const player = snapshot.players.find(
    (candidate) => candidate.id === EVALUATED_PLAYER_ID,
  );
  return (player?.hand.filter((card) => card.rank === rank).length ?? 0) >= 2;
}

function chooseGreedyLayoff(snapshot: GameSnapshot): GameAction | undefined {
  const player = snapshot.players.find(
    (candidate) => candidate.id === EVALUATED_PLAYER_ID,
  );
  if (player?.isDown !== true) return undefined;

  const candidates: Array<{
    action: Extract<GameAction, { type: "LAY_OFF" }>;
    pointValue: number;
  }> = [];
  for (const card of player.hand) {
    for (const meld of snapshot.table) {
      if (canLayOffToSet(card, meld)) {
        candidates.push({
          action: { type: "LAY_OFF", cardId: card.id, meldId: meld.id },
          pointValue: getPointValue(card),
        });
        continue;
      }
      const runPosition = getRunInsertPosition(card, meld);
      if (runPosition !== null) {
        candidates.push({
          action: {
            type: "LAY_OFF",
            cardId: card.id,
            meldId: meld.id,
            position: runPosition === "low" ? "start" : "end",
          },
          pointValue: getPointValue(card),
        });
      }
    }
  }

  return candidates.sort(
    (left, right) =>
      right.pointValue - left.pointValue ||
      left.action.cardId.localeCompare(right.action.cardId) ||
      left.action.meldId.localeCompare(right.action.meldId),
  )[0]?.action;
}

function chooseRuleAwareGreedyAction(
  snapshot: GameSnapshot,
): GameAction | undefined {
  if (snapshot.awaitingPlayerId !== EVALUATED_PLAYER_ID) return undefined;
  if (snapshot.phase === "RESOLVING_MAY_I") {
    const exposed = snapshot.mayIContext?.cardBeingClaimed;
    return exposed !== undefined &&
      hasNaturalPairForRank(snapshot, exposed.rank)
      ? { type: "CLAIM_MAY_I" }
      : { type: "ALLOW_MAY_I" };
  }
  if (snapshot.phase !== "ROUND_ACTIVE") return undefined;

  const player = snapshot.players.find(
    (candidate) => candidate.id === EVALUATED_PLAYER_ID,
  );
  if (snapshot.turnPhase === "AWAITING_DRAW") {
    const exposed = snapshot.discard.at(-1);
    return player?.isDown !== true &&
      exposed !== undefined &&
      hasNaturalPairForRank(snapshot, exposed.rank)
      ? { type: "DRAW_FROM_DISCARD" }
      : { type: "DRAW_FROM_STOCK" };
  }
  if (snapshot.turnPhase === "AWAITING_ACTION") {
    return chooseGreedyLayoff(snapshot) ?? { type: "SKIP" };
  }
  if (snapshot.turnPhase === "AWAITING_DISCARD") {
    const cardId = player?.hand
      .map((card) => ({ card, pointValue: getPointValue(card) }))
      .sort(
        (left, right) =>
          right.pointValue - left.pointValue ||
          left.card.id.localeCompare(right.card.id),
      )[0]?.card.id;
    return cardId === undefined ? undefined : { type: "DISCARD", cardId };
  }
  return undefined;
}

function completedScenarioDecision(
  scenario: AIPlayerFixedStateScenario,
  attempts: readonly AIPlayerFixedStateAttempt[],
  after: GameSnapshot,
): boolean {
  if (scenario.maxSteps !== undefined && attempts.length >= scenario.maxSteps) {
    return attempts.every((attempt) => attempt.ok);
  }
  return (
    after.phase !== "ROUND_ACTIVE" ||
    after.awaitingPlayerId !== EVALUATED_PLAYER_ID
  );
}

async function evaluatePolicyScenario(
  scenario: AIPlayerFixedStateScenario,
  repetition: number,
  chooseAction: (snapshot: GameSnapshot) => GameAction | undefined,
): Promise<{
  completed: boolean;
  legal: boolean;
  earnedWeight: number;
  possibleWeight: number;
}> {
  const state = createAIPlayerFixedStateRuntime(
    scenario,
    repetition,
    EVALUATED_PLAYER_ID,
  );
  try {
    const maximumActions = scenario.maxSteps ?? 10;
    for (let actionIndex = 0; actionIndex < maximumActions; actionIndex++) {
      const action = chooseAction(await state.runtime.getSnapshot());
      if (action === undefined) break;
      const result = await state.runtime.executeAction(action);
      if (!result.ok) break;
    }
    const after = await state.runtime.getSnapshot();
    const legal = state.attempts.every((attempt) => attempt.ok);
    const completed = completedScenarioDecision(
      scenario,
      state.attempts,
      after,
    );
    const criteria = scenario.grade(after, state.attempts);
    const possibleWeight = criteria.reduce(
      (total, criterion) => total + Math.max(0, criterion.weight),
      0,
    );
    const earnedWeight =
      completed && legal
        ? criteria.reduce(
            (total, criterion) =>
              total + (criterion.passed ? Math.max(0, criterion.weight) : 0),
            0,
          )
        : 0;
    return { completed, legal, earnedWeight, possibleWeight };
  } finally {
    state.actor.stop();
  }
}

async function oracleEarnedWeight(
  scenario: AIPlayerFixedStateScenario,
  repetition: number,
): Promise<number> {
  const state = createAIPlayerFixedStateRuntime(
    scenario,
    repetition,
    EVALUATED_PLAYER_ID,
  );
  try {
    for (const action of scenario.referenceActions) {
      const result = await state.runtime.executeAction(action);
      if (!result.ok) return 0;
    }
    const criteria = scenario.grade(
      await state.runtime.getSnapshot(),
      state.attempts,
    );
    return criteria.reduce(
      (total, criterion) =>
        total + (criterion.passed ? Math.max(0, criterion.weight) : 0),
      0,
    );
  } finally {
    state.actor.stop();
  }
}

function percent(earned: number, possible: number): number {
  return possible === 0 ? 0 : (earned / possible) * 100;
}

async function evaluateFixedStateSanityBaseline(
  scenarios: readonly AIPlayerFixedStateScenario[],
  repetitionCount: number,
  policyId: AIPlayerEvalSanityBaselineSummary["policyId"],
  chooseAction: (snapshot: GameSnapshot) => GameAction | undefined,
): Promise<AIPlayerEvalSanityBaselineSummary> {
  if (!Number.isInteger(repetitionCount) || repetitionCount <= 0) {
    throw new Error(
      "Sanity baseline repetition count must be a positive integer",
    );
  }
  const caseResults: AIPlayerEvalSanityBaselineCaseResult[] = [];
  for (let repetition = 1; repetition <= repetitionCount; repetition++) {
    for (const scenario of scenarios) {
      const [blind, oracle] = await Promise.all([
        evaluatePolicyScenario(scenario, repetition, chooseAction),
        oracleEarnedWeight(scenario, repetition),
      ]);
      caseResults.push({
        scenarioId: scenario.identity.id,
        split: scenario.identity.split,
        repetition,
        completed: blind.completed,
        legal: blind.legal,
        earnedWeight: blind.earnedWeight,
        oracleEarnedWeight: oracle,
        possibleWeight: blind.possibleWeight,
      });
    }
  }
  const possibleWeight = caseResults.reduce(
    (total, result) => total + result.possibleWeight,
    0,
  );
  const qualityPercent = percent(
    caseResults.reduce((total, result) => total + result.earnedWeight, 0),
    possibleWeight,
  );
  const oracleQualityPercent = percent(
    caseResults.reduce((total, result) => total + result.oracleEarnedWeight, 0),
    possibleWeight,
  );
  const repetitionSummaries = Array.from(
    { length: repetitionCount },
    (_, index) => index + 1,
  ).map((repetition) => {
    const repetitionCases = caseResults.filter(
      (result) => result.repetition === repetition,
    );
    const repetitionPossibleWeight = repetitionCases.reduce(
      (total, result) => total + result.possibleWeight,
      0,
    );
    return {
      repetition,
      qualityPercent: percent(
        repetitionCases.reduce(
          (total, result) => total + result.earnedWeight,
          0,
        ),
        repetitionPossibleWeight,
      ),
      oracleQualityPercent: percent(
        repetitionCases.reduce(
          (total, result) => total + result.oracleEarnedWeight,
          0,
        ),
        repetitionPossibleWeight,
      ),
    };
  });
  const splits: AIPlayerEvalSanityBaselineSplitSummary[] = (
    ["development", "holdout"] as const
  ).map((split) => {
    const splitCases = caseResults.filter((result) => result.split === split);
    const splitPossibleWeight = splitCases.reduce(
      (total, result) => total + result.possibleWeight,
      0,
    );
    return {
      split,
      caseCount: splitCases.length,
      qualityPercent: percent(
        splitCases.reduce((total, result) => total + result.earnedWeight, 0),
        splitPossibleWeight,
      ),
      oracleQualityPercent: percent(
        splitCases.reduce(
          (total, result) => total + result.oracleEarnedWeight,
          0,
        ),
        splitPossibleWeight,
      ),
    };
  });
  return {
    policyId,
    repetitionCount,
    caseCount: caseResults.length,
    completedRate:
      caseResults.length === 0
        ? 0
        : caseResults.filter((result) => result.completed).length /
          caseResults.length,
    legalRate:
      caseResults.length === 0
        ? 0
        : caseResults.filter((result) => result.legal).length /
          caseResults.length,
    qualityPercent,
    oracleQualityPercent,
    qualityGapVsOraclePercentPoints: oracleQualityPercent - qualityPercent,
    repetitionSummaries,
    splits,
    caseResults,
  };
}

export function evaluateBlindLegalFixedStateBaseline(
  scenarios: readonly AIPlayerFixedStateScenario[],
  repetitionCount = 1,
): Promise<AIPlayerEvalSanityBaselineSummary> {
  return evaluateFixedStateSanityBaseline(
    scenarios,
    repetitionCount,
    "blind-legal-v2",
    chooseBlindLegalAction,
  );
}

export function evaluateRuleAwareGreedyFixedStateBaseline(
  scenarios: readonly AIPlayerFixedStateScenario[],
  repetitionCount = 1,
): Promise<AIPlayerEvalSanityBaselineSummary> {
  return evaluateFixedStateSanityBaseline(
    scenarios,
    repetitionCount,
    "rule-aware-greedy-v1",
    chooseRuleAwareGreedyAction,
  );
}
