import { createDeck } from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";

export interface Hand6WinningDraw {
  rank: Card["rank"];
  suit: Card["suit"];
  remainingCopies: number;
  /** Positions in kept-hand order followed by the hypothetical drawn card. */
  positionGroups: number[][];
}

export interface Hand6DiscardCoverage {
  discardCardId: string;
  winningDrawCount: number;
  winningDraws: Hand6WinningDraw[];
}

export interface Hand6DrawCoverage {
  unseenCardCount: number;
  immediateWinAvailable: boolean;
  bestDiscardCardIds: string[];
  candidates: Hand6DiscardCoverage[];
}

/**
 * Evaluator only: exact one-draw completion under an exchangeable unseen-card
 * distribution in a two-deck game. This is NOT a full-game optimality oracle:
 * it conditions on reaching another draw without intervening claims or an exit.
 * No opponent hand or actual stock is accepted, to prevent hidden-card grading.
 */
export function evaluateHand6DiscardCoverage(input: {
  hand: readonly Card[];
  /** Known cards outside the hand, each physical card listed exactly once. */
  visibleOutsideHand: readonly Card[];
}): Hand6DrawCoverage {
  if (![12, 14, 16].includes(input.hand.length)) {
    throw new Error(
      "Hand 6 coverage supports after-draw hands of 12, 14, or 16 cards",
    );
  }
  const unseen = createDeck({ deckCount: 2, jokerCount: 4 });
  const observedIds = new Set<string>();
  for (const observed of [...input.hand, ...input.visibleOutsideHand]) {
    if (observedIds.has(observed.id))
      throw new Error("Observed duplicate card ID");
    observedIds.add(observed.id);
    const index = unseen.findIndex(
      (card) => card.rank === observed.rank && card.suit === observed.suit,
    );
    if (index < 0)
      throw new Error(
        "Observed card multiplicity exceeds the two-deck inventory",
      );
    unseen.splice(index, 1);
  }
  if (unseen.length === 0)
    throw new Error("No unseen draw distribution remains");
  const drawTypes = new Map<string, { card: Card; count: number }>();
  for (const card of unseen) {
    const key = `${card.rank}:${card.suit}`;
    const existing = drawTypes.get(key);
    if (existing === undefined) drawTypes.set(key, { card, count: 1 });
    else existing.count++;
  }
  let drawId = "coverage-hypothetical-draw";
  while (observedIds.has(drawId)) drawId += "-next";
  const contract = { roundNumber: 6, sets: 1, runs: 2 } as const;
  const playerId = "coverage-evaluated-player";
  const candidates = input.hand.map((discard): Hand6DiscardCoverage => {
    const kept = input.hand.filter((card) => card.id !== discard.id);
    const winningDraws: Hand6WinningDraw[] = [];
    for (const { card, count } of drawTypes.values()) {
      const witness = findLayDownCandidates({
        hand: [...kept, { ...card, id: drawId }],
        contract,
        playerId,
        limit: 1,
      })[0];
      if (witness !== undefined) {
        winningDraws.push({
          rank: card.rank,
          suit: card.suit,
          remainingCopies: count,
          positionGroups: witness.positionGroups,
        });
      }
    }
    return {
      discardCardId: discard.id,
      winningDrawCount: winningDraws.reduce(
        (sum, draw) => sum + draw.remainingCopies,
        0,
      ),
      winningDraws,
    };
  });
  const bestCount = Math.max(
    ...candidates.map((candidate) => candidate.winningDrawCount),
  );
  return {
    unseenCardCount: unseen.length,
    immediateWinAvailable:
      findLayDownCandidates({
        hand: [...input.hand],
        contract,
        playerId,
        limit: 1,
      }).length > 0,
    bestDiscardCardIds: candidates
      .filter(
        (candidate) =>
          bestCount > 0 && candidate.winningDrawCount === bestCount,
      )
      .map((candidate) => candidate.discardCardId)
      .sort(),
    candidates,
  };
}
