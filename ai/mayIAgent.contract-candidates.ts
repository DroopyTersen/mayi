import type { Card } from "../core/card/card.types";
import { getPointValue, isWild } from "../core/card/card.utils";
import type { Contract } from "../core/engine/contracts";
import { validateContractMelds } from "../core/engine/contracts";
import type { Meld } from "../core/meld/meld.types";
import { isValidSet } from "../core/meld/meld.validation";
import { normalizeRunCards } from "../core/meld/run.normalizer";

const MAX_EXACT_SOLVER_HAND_SIZE = 16;
const DEFAULT_CANDIDATE_LIMIT = 3;

interface MeldOption {
  mask: number;
  meld: Meld;
}

export interface LayDownCandidate {
  positionGroups: number[][];
  usedCardCount: number;
  remainingCardIds: string[];
}

export interface FindLayDownCandidatesInput {
  hand: Card[];
  contract: Contract;
  playerId: string;
  limit?: number;
  /** Diversify the bounded preview by leftover rank/suit multiset, not copy ID. */
  distinctResidualHands?: boolean;
}

function cardsForMask(hand: readonly Card[], mask: number): Card[] {
  const cards: Card[] = [];
  for (let index = 0; index < hand.length; index++) {
    if ((mask & (1 << index)) !== 0) {
      const card = hand[index];
      if (card !== undefined) cards.push(card);
    }
  }
  return cards;
}

function countBits(mask: number): number {
  let value = mask;
  let count = 0;
  while (value !== 0) {
    value &= value - 1;
    count++;
  }
  return count;
}

function createMeldOptions(
  hand: readonly Card[],
  playerId: string,
  roundNumber: Contract["roundNumber"],
): { sets: MeldOption[]; runs: MeldOption[] } {
  const sets: MeldOption[] = [];
  const runs: MeldOption[] = [];
  const subsetCount = 1 << hand.length;

  for (let mask = 1; mask < subsetCount; mask++) {
    const cardCount = countBits(mask);
    if (cardCount < 3) continue;
    const validSetSize = cardCount === 3 || roundNumber === 6;
    const validRunSize = cardCount >= 4 && (cardCount === 4 || roundNumber === 6);
    if (!validSetSize && !validRunSize) continue;
    const cards = cardsForMask(hand, mask);

    if (validSetSize && isValidSet(cards)) {
      sets.push({
        mask,
        meld: {
          id: `candidate-set-${mask}`,
          ownerId: playerId,
          type: "set",
          cards,
        },
      });
    }

    if (!validRunSize) continue;
    const normalized = normalizeRunCards(cards);
    if (!normalized.success) continue;
    runs.push({
      mask,
      meld: {
        id: `candidate-run-${mask}`,
        ownerId: playerId,
        type: "run",
        cards: normalized.cards,
      },
    });
  }

  return { sets, runs };
}

function candidateKey(melds: readonly MeldOption[]): string {
  return melds
    .map((option) => `${option.meld.type}:${option.mask}`)
    .sort()
    .join("|");
}

function positionGroupsForMelds(
  hand: readonly Card[],
  melds: readonly MeldOption[],
): number[][] {
  const positions = new Map(
    hand.map((card, index) => [card.id, index + 1] as const),
  );
  return melds.map((option) =>
    option.meld.cards.flatMap((card) => {
      const position = positions.get(card.id);
      return position === undefined ? [] : [position];
    }),
  );
}

export function findLayDownCandidates(
  input: FindLayDownCandidatesInput,
): LayDownCandidate[] {
  const { hand, contract, playerId } = input;
  const limit = input.limit ?? DEFAULT_CANDIDATE_LIMIT;
  if (
    limit <= 0 ||
    hand.length === 0 ||
    hand.length > MAX_EXACT_SOLVER_HAND_SIZE
  ) {
    return [];
  }

  const options = createMeldOptions(hand, playerId, contract.roundNumber);
  const requiredTypes: Array<"set" | "run"> = [
    ...Array.from({ length: contract.sets }, () => "set" as const),
    ...Array.from({ length: contract.runs }, () => "run" as const),
  ];
  const completeMasks = 1 << hand.length;
  const allCardsMask = completeMasks - 1;
  const found = new Map<
    string,
    LayDownCandidate & { wildsUsed: number; remainingPoints: number }
  >();

  function search(
    slotIndex: number,
    usedMask: number,
    selected: MeldOption[],
    previousOptionIndex: number,
  ): void {
    if (slotIndex === requiredTypes.length) {
      if (contract.roundNumber === 6 && usedMask !== allCardsMask) return;
      const melds = selected.map((option) => option.meld);
      if (!validateContractMelds(contract, melds).valid) return;
      const key = candidateKey(selected);
      if (found.has(key)) return;
      const usedCards = cardsForMask(hand, usedMask);
      const remainingCards = hand.filter(
        (_card, index) => (usedMask & (1 << index)) === 0,
      );
      found.set(key, {
        positionGroups: positionGroupsForMelds(hand, selected),
        usedCardCount: usedCards.length,
        remainingCardIds: remainingCards.map((card) => card.id),
        wildsUsed: usedCards.filter(isWild).length,
        remainingPoints: remainingCards.reduce(
          (total, card) => total + getPointValue(card),
          0,
        ),
      });
      return;
    }

    const requiredType = requiredTypes[slotIndex];
    if (requiredType === undefined) return;
    const typeOptions = requiredType === "set" ? options.sets : options.runs;
    const sameAsPrevious =
      slotIndex > 0 && requiredTypes[slotIndex - 1] === requiredType;
    const firstOptionIndex = sameAsPrevious ? previousOptionIndex + 1 : 0;

    for (
      let optionIndex = firstOptionIndex;
      optionIndex < typeOptions.length;
      optionIndex++
    ) {
      const option = typeOptions[optionIndex];
      if (option === undefined || (option.mask & usedMask) !== 0) continue;
      selected.push(option);
      search(
        slotIndex + 1,
        usedMask | option.mask,
        selected,
        optionIndex,
      );
      selected.pop();
    }
  }

  search(0, 0, [], -1);

  const residualHands = new Set<string>();
  return [...found.values()]
    .sort(
      (left, right) =>
        right.usedCardCount - left.usedCardCount ||
        left.wildsUsed - right.wildsUsed ||
        left.remainingPoints - right.remainingPoints ||
        JSON.stringify(left.positionGroups).localeCompare(
          JSON.stringify(right.positionGroups),
        ),
    )
    .filter((candidate) => {
      if (!input.distinctResidualHands) return true;
      const remainingIds = new Set(candidate.remainingCardIds);
      const signature = hand.filter((card) => remainingIds.has(card.id))
        .map((card) => `${card.rank}:${card.suit}`).sort().join("|");
      if (residualHands.has(signature)) return false;
      residualHands.add(signature);
      return true;
    })
    .slice(0, limit)
    .map(({ wildsUsed: _wildsUsed, remainingPoints: _remainingPoints, ...candidate }) =>
      candidate,
    );
}
