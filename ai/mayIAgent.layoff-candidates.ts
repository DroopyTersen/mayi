import type { Card } from "../core/card/card.types";
import { isWild } from "../core/card/card.utils";
import {
  canLayOffToSet,
  resolveRunInsertPosition,
} from "../core/engine/layoff";
import { applyLayOffToMeld } from "../core/meld/meld.projection";
import type { Meld } from "../core/meld/meld.types";

const MAX_LAYOFF_SOLVER_HAND_SIZE = 16;
const MAX_LAYOFF_SOLVER_STATES = 50_000;
const MIN_SEQUENCE_LENGTH = 2;

export interface LayoffPlanStep {
  cardId: string;
  meldId: string;
  position?: "start" | "end";
}

export interface LayoffPlan {
  steps: LayoffPlanStep[];
  remainingCardIds: string[];
}

interface LayoffAction extends LayoffPlanStep {
  cardIndex: number;
  meldIndex: number;
}

function stateKey(hand: readonly Card[], table: readonly Meld[]): string {
  return `${hand.map((card) => card.id).join(",")}|${table
    .map((meld) => `${meld.id}:${meld.cards.map((card) => card.id).join(",")}`)
    .join("|")}`;
}

function availableActions(
  hand: readonly Card[],
  table: readonly Meld[],
): LayoffAction[] {
  const actions: LayoffAction[] = [];
  const orderedCards = hand
    .map((card, cardIndex) => ({ card, cardIndex }))
    .sort((left, right) => Number(isWild(left.card)) - Number(isWild(right.card)));

  for (const { card, cardIndex } of orderedCards) {
    for (let meldIndex = 0; meldIndex < table.length; meldIndex++) {
      const meld = table[meldIndex];
      if (meld === undefined) continue;

      if (meld.type === "set") {
        if (canLayOffToSet(card, meld)) {
          actions.push({ cardId: card.id, cardIndex, meldId: meld.id, meldIndex });
        }
        continue;
      }

      if (!isWild(card)) {
        const position = resolveRunInsertPosition(card, meld);
        if (position !== null) {
          actions.push({
            cardId: card.id,
            cardIndex,
            meldId: meld.id,
            meldIndex,
            position,
          });
        }
        continue;
      }

      for (const position of ["start", "end"] as const) {
        if (resolveRunInsertPosition(card, meld, position) === position) {
          actions.push({
            cardId: card.id,
            cardIndex,
            meldId: meld.id,
            meldIndex,
            position,
          });
        }
      }
    }
  }

  return actions;
}

function isBetterPlan(candidate: LayoffPlan, current: LayoffPlan): boolean {
  return candidate.remainingCardIds.length < current.remainingCardIds.length;
}

/**
 * Finds a legal multi-step layoff sequence that empties the hand or leaves one
 * final discard. Each step is evaluated against the table produced by all
 * preceding steps, so a flexible wild cannot hide a longer natural-card line.
 */
export function findBestLayoffPlan(
  hand: readonly Card[],
  table: readonly Meld[],
): LayoffPlan | null {
  if (
    hand.length < MIN_SEQUENCE_LENGTH ||
    hand.length > MAX_LAYOFF_SOLVER_HAND_SIZE ||
    table.length === 0
  ) {
    return null;
  }

  const memo = new Map<string, LayoffPlan>();
  let visitedStates = 0;

  function search(currentHand: readonly Card[], currentTable: readonly Meld[]): LayoffPlan {
    const key = stateKey(currentHand, currentTable);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    visitedStates++;
    let best: LayoffPlan = {
      steps: [],
      remainingCardIds: currentHand.map((card) => card.id),
    };
    if (visitedStates > MAX_LAYOFF_SOLVER_STATES) return best;

    for (const action of availableActions(currentHand, currentTable)) {
      const card = currentHand[action.cardIndex];
      const meld = currentTable[action.meldIndex];
      if (card === undefined || meld === undefined) continue;

      const nextHand = currentHand.filter((_entry, index) => index !== action.cardIndex);
      const nextTable = currentTable.map((entry, index) =>
        index === action.meldIndex
          ? applyLayOffToMeld(entry, card, action.position)
          : entry,
      );
      const continuation = search(nextHand, nextTable);
      const candidate: LayoffPlan = {
        steps: [
          {
            cardId: action.cardId,
            meldId: action.meldId,
            ...(action.position === undefined ? {} : { position: action.position }),
          },
          ...continuation.steps,
        ],
        remainingCardIds: continuation.remainingCardIds,
      };

      if (isBetterPlan(candidate, best)) best = candidate;
      if (best.remainingCardIds.length === 0) break;
    }

    memo.set(key, best);
    return best;
  }

  const plan = search(hand, table);
  if (
    plan.steps.length < MIN_SEQUENCE_LENGTH ||
    plan.remainingCardIds.length > 1
  ) {
    return null;
  }
  return plan;
}
