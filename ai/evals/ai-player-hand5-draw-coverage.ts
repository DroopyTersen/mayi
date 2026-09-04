import { createDeck } from "../../core/card/card.deck";
import type { Card } from "../../core/card/card.types";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";

export interface Hand5CompletingDraw {
  rank: Card["rank"];
  suit: Card["suit"];
  remainingCopies: number;
  /** Positions in kept-hand order followed by the hypothetical drawn card. */
  positionGroups: number[][];
}

export interface Hand5DrawCoverage {
  unseenCardCount: number;
  immediateContractAvailable: boolean;
  bestDiscardCardIds: string[];
  candidates: {
    discardCardId: string;
    completingDrawCount: number;
    completingDraws: Hand5CompletingDraw[];
  }[];
}

/**
 * Evaluator only. Maximizes next-stock-draw contract availability under an
 * exchangeable distribution of unobserved cards, conditional on survival and
 * no intervening claims/recycling. Not a full-game policy or expected-score
 * oracle. Only observed physical cards are accepted, never hidden hands/stock.
 */
export function evaluateHand5DiscardCoverage(input: {
  hand: readonly Card[];
  visibleOutsideHand: readonly Card[];
}): Hand5DrawCoverage {
  if (input.hand.length !== 12)
    throw new Error("Hand 5 coverage requires a 12-card post-draw hand");
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
    if (existing) existing.count++;
    else drawTypes.set(key, { card, count: 1 });
  }
  let drawId = "coverage-hypothetical-draw";
  while (observedIds.has(drawId)) drawId += "-next";
  const contract = { roundNumber: 5, sets: 2, runs: 1 } as const;
  const playerId = "coverage-evaluated-player";
  // The production engine currently permits extended initial melds. This
  // evaluator follows the written section-8 minimum sizes independently.
  const exactContract = (hand: Card[]) =>
    findLayDownCandidates({
      hand,
      contract,
      playerId,
      limit: Number.MAX_SAFE_INTEGER,
    }).find(
      (candidate) =>
        candidate.positionGroups.length === 3 &&
        candidate.positionGroups.every(
          (group, index) => group.length === (index < 2 ? 3 : 4),
        ),
    );
  const candidates = input.hand.map((discard) => {
    const kept = input.hand.filter((card) => card.id !== discard.id);
    const completingDraws: Hand5CompletingDraw[] = [];
    for (const { card, count } of drawTypes.values()) {
      const witness = exactContract([...kept, { ...card, id: drawId }]);
      if (witness)
        completingDraws.push({
          rank: card.rank,
          suit: card.suit,
          remainingCopies: count,
          positionGroups: witness.positionGroups,
        });
    }
    return {
      discardCardId: discard.id,
      completingDraws,
      completingDrawCount: completingDraws.reduce(
        (sum, draw) => sum + draw.remainingCopies,
        0,
      ),
    };
  });
  const bestCount = Math.max(
    ...candidates.map((candidate) => candidate.completingDrawCount),
  );
  return {
    unseenCardCount: unseen.length,
    immediateContractAvailable: exactContract([...input.hand]) !== undefined,
    bestDiscardCardIds: candidates
      .filter(
        (candidate) =>
          bestCount > 0 && candidate.completingDrawCount === bestCount,
      )
      .map((candidate) => candidate.discardCardId)
      .sort(),
    candidates,
  };
}
