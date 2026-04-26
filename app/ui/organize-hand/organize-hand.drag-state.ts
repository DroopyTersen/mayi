import type { Card } from "core/card/card.types";

export interface OrganizeDragReorderInput {
  initialIndex: number;
  targetIndex: number;
  canceled?: boolean;
}

function isValidIndex(cards: Card[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < cards.length;
}

export function reorderCardsAfterDrag(
  cards: Card[],
  { initialIndex, targetIndex, canceled = false }: OrganizeDragReorderInput
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
