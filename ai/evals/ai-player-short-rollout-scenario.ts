import type { GameAction } from "../ai-action-runtime.types";
import type { ActionLogEntry } from "../mayIAgent.prompt-renderer";
import type { Card } from "../../core/card/card.types";
import type { Player } from "../../core/engine/engine.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { Meld } from "../../core/meld/meld.types";
import type { RoundInput } from "../../core/engine/round.machine";
import type { AIPlayerEvalCriterionResult } from "./ai-player-eval-score";
import type { AIPlayerRolloutActionEvidence } from "./ai-player-rollout-decision-evidence";
import type {
  AIPlayerFixedStateAttempt,
  AIPlayerFixedStateRuntimeScenario,
} from "./ai-player-fixed-state-scenarios";

export type AIPlayerShortRolloutDecisionKind =
  | "candidate-turn"
  | "candidate-may-i"
  | "candidate-response"
  | "opponent-script";

export interface AIPlayerShortRolloutReferenceDecision {
  playerId: string;
  kind: AIPlayerShortRolloutDecisionKind;
  actions: readonly GameAction[];
  mayIDecision?: "call" | "pass";
  /** Evaluator-only responsive opponent; cannot inspect other hands or stock. */
  opponentPolicy?: {
    id: string;
    selectActions: (view: { hand: readonly Card[]; table: readonly Meld[] }) => readonly GameAction[];
  };
}

export interface AIPlayerShortRolloutDecisionRecord {
  playerId: string;
  kind: Exclude<AIPlayerShortRolloutDecisionKind, "opponent-script">;
  success: boolean;
  mayIDecision?: "call" | "pass" | "incomplete";
  /** Present in harness v7+; actual candidate-perspective action boundaries. */
  actionEvidence?: readonly AIPlayerRolloutActionEvidence[];
}

export interface AIPlayerShortRolloutRubricCriterion {
  id: string;
  description: string;
  weight: number;
}

export interface AIPlayerShortRolloutObservation {
  snapshot: GameSnapshot;
  candidateAttempts: readonly AIPlayerFixedStateAttempt[];
  decisions: readonly AIPlayerShortRolloutDecisionRecord[];
}

export interface AIPlayerShortRolloutScenario extends AIPlayerFixedStateRuntimeScenario {
  /** Strategic preferences are not proofs of dominance over unknown cards. */
  assessment: "tactical" | "scripted-outcome" | "strategic-preference";
  evaluatedPlayerId: string;
  objective: string;
  organizationOrder: "rank" | "suit";
  maxCandidateTurns: number;
  maxModelDecisions: number;
  rubric: readonly AIPlayerShortRolloutRubricCriterion[];
  actionLog?: ActionLogEntry[];
  /** Replayable public provenance; supersedes a manually written actionLog. */
  historyPrelude?: readonly { playerId: string; action: GameAction }[];
  referenceSequence: readonly AIPlayerShortRolloutReferenceDecision[];
  grade: (
    observation: AIPlayerShortRolloutObservation,
  ) => AIPlayerEvalCriterionResult[];
}

export interface AIPlayerShortRolloutReferenceResult {
  attempts: AIPlayerRolloutAttempt[];
  decisions: AIPlayerShortRolloutDecisionRecord[];
  finalSnapshot: GameSnapshot;
  observationVersion: string;
  decisionHistories: ActionLogEntry[][];
  candidateTurns: number;
  modelDecisions: number;
  completed: boolean;
  legal: boolean;
  qualityPercent: number;
  criteria: AIPlayerEvalCriterionResult[];
  winnerPlayerId: string | undefined;
}

export interface AIPlayerRolloutAttempt extends AIPlayerFixedStateAttempt {
  playerId: string;
  kind: AIPlayerShortRolloutDecisionKind;
}

export function card(id: string, rank: Card["rank"], suit: Card["suit"]): Card {
  return { id, rank, suit };
}

export function joker(id: string): Card {
  return card(id, "Joker", null);
}

export function roundInput(options: {
  roundNumber: RoundInput["roundNumber"];
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  dealerIndex?: number;
  down?: boolean[];
  table?: Meld[];
}): RoundInput {
  const down = options.down ?? [];
  const players: Player[] = options.hands.map((hand, index) => ({
    id: `eval-player-${index}`,
    name: index === 0 ? "Evaluated Player" : `Scripted Opponent ${index}`,
    hand,
    isDown: down[index] ?? false,
    totalScore: 0,
  }));
  return {
    roundNumber: options.roundNumber,
    players,
    dealerIndex: options.dealerIndex ?? options.hands.length - 1,
    predefinedState: {
      hands: options.hands,
      stock: options.stock,
      discard: options.discard,
      table: options.table,
      playerDownStatus: down,
    },
  };
}

export function criterion(
  definition: AIPlayerShortRolloutRubricCriterion,
  passed: boolean,
  evidence: string,
): AIPlayerEvalCriterionResult {
  return { ...definition, passed, evidence };
}

export function successfulAction<T extends GameAction["type"]>(
  observation: AIPlayerShortRolloutObservation,
  type: T,
): Extract<GameAction, { type: T }> | undefined {
  return observation.candidateAttempts.find(
    (attempt) => attempt.ok && attempt.action.type === type,
  )?.action as Extract<GameAction, { type: T }> | undefined;
}

export function successfulCardAction(
  observation: AIPlayerShortRolloutObservation,
  type: "DISCARD" | "LAY_OFF",
  cardId: string,
): boolean {
  return observation.candidateAttempts.some(
    (attempt) =>
      attempt.ok &&
      attempt.action.type === type &&
      attempt.action.cardId === cardId,
  );
}

export function mayIDecision(
  observation: AIPlayerShortRolloutObservation,
): "call" | "pass" | "incomplete" | undefined {
  return observation.decisions.find(
    (decision) => decision.kind === "candidate-may-i",
  )?.mayIDecision;
}

export function wentOut(
  observation: AIPlayerShortRolloutObservation,
  playerId: string,
): boolean {
  return (
    observation.snapshot.players.find((player) => player.id === playerId)?.hand
      .length === 0
  );
}

export function allCardActions(
  observation: AIPlayerShortRolloutObservation,
  type: "LAY_OFF",
  cardIds: readonly string[],
): boolean {
  return cardIds.every((cardId) =>
    successfulCardAction(observation, type, cardId),
  );
}
