import { PointerSensor } from "@dnd-kit/react";
import type { Card } from "core/card/card.types";

export interface SortableDragReorderInput {
  initialIndex: number;
  targetIndex: number;
  canceled?: boolean;
}

export const SORTABLE_HAND_DRAG_SENSORS = [PointerSensor];

function isValidIndex(cards: Card[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < cards.length;
}

export function reorderCardsAfterDrag(
  cards: Card[],
  { initialIndex, targetIndex, canceled = false }: SortableDragReorderInput
): Card[] {
  if (canceled || initialIndex === targetIndex) {
    return cards;
  }

  if (!isValidIndex(cards, initialIndex) || !isValidIndex(cards, targetIndex)) {
    return cards;
  }

  const movedCard = cards[initialIndex];
  if (!movedCard) {
    return cards;
  }

  const nextCards = [...cards];
  nextCards.splice(initialIndex, 1);
  nextCards.splice(targetIndex, 0, movedCard);

  return nextCards;
}
