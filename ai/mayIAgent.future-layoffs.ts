import type { Card } from "../core/card/card.types";
import { getPointValue } from "../core/card/card.utils";
import {
  canLayOffToSet,
  resolveRunInsertPosition,
} from "../core/engine/layoff";
import type { Meld } from "../core/meld/meld.types";

export interface ProtectedFutureLayoff {
  cardId: string;
  meldId: string;
  position?: "start" | "end";
}

export interface FutureLayoffProtection {
  protectedCards: ProtectedFutureLayoff[];
  discardCandidateId: string | null;
}

interface FindProtectedFutureLayoffsInput {
  hand: readonly Card[];
  table: readonly Meld[];
  /** Cards left after an already-validated contract candidate is laid down. */
  remainingCardIds: readonly string[];
}

/**
 * Identifies contract leftovers that can be laid off to a public meld on a
 * later turn. Cards used by the contract are deliberately out of scope, so
 * this advice can never weaken the validated laydown.
 */
export function findProtectedFutureLayoffs(
  input: FindProtectedFutureLayoffsInput,
): FutureLayoffProtection {
  const remainingIds = new Set(input.remainingCardIds);
  const remainingCards = input.hand.filter((card) => remainingIds.has(card.id));
  const protectedCards: ProtectedFutureLayoff[] = [];
  const protectedIds = new Set<string>();

  for (const card of remainingCards) {
    for (const meld of input.table) {
      if (meld.type === "set") {
        if (!canLayOffToSet(card, meld)) continue;
        protectedCards.push({ cardId: card.id, meldId: meld.id });
        protectedIds.add(card.id);
        break;
      }

      const position = resolveRunInsertPosition(card, meld);
      if (position === null) continue;
      protectedCards.push({ cardId: card.id, meldId: meld.id, position });
      protectedIds.add(card.id);
      break;
    }
  }

  const discardCandidate = remainingCards
    .filter((card) => !protectedIds.has(card.id))
    .sort((left, right) => getPointValue(right) - getPointValue(left))[0];

  return {
    protectedCards,
    discardCandidateId: discardCandidate?.id ?? null,
  };
}
