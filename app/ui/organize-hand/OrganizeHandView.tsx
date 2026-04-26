import { useState } from "react";
import type { Card } from "core/card/card.types";
import { sortHandByRank, sortHandBySuit } from "core/engine/hand.reordering";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { OrganizeSortableHand } from "./OrganizeSortableHand";
import {
  reorderCardsAfterDrag,
  type OrganizeDragReorderInput,
} from "./organize-hand.drag-state";

interface OrganizeHandViewProps {
  hand: Card[];
  onSave: (newOrder: Card[]) => void;
  onCancel: () => void;
  /** When rendered inside a modal/drawer that already provides a title/description */
  showHeader?: boolean;
  className?: string;
}

export function OrganizeHandView({
  hand,
  onSave,
  onCancel,
  showHeader = true,
  className,
}: OrganizeHandViewProps) {
  const [cards, setCards] = useState<Card[]>([...hand]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedIndex =
    selectedCardId === null ? -1 : cards.findIndex((card) => card.id === selectedCardId);

  const handleCardClick = (cardId: string) => {
    setSelectedCardId((current) => (current === cardId ? null : cardId));
  };

  const moveCard = (direction: "left" | "right") => {
    if (selectedIndex === -1) return;

    const newCards = [...cards];
    const newIndex = direction === "left" ? selectedIndex - 1 : selectedIndex + 1;

    if (newIndex < 0 || newIndex >= cards.length) return;

    const current = newCards[selectedIndex];
    const swap = newCards[newIndex];
    if (!current || !swap) return;

    newCards[selectedIndex] = swap;
    newCards[newIndex] = current;
    setCards(newCards);
  };

  const handleSortByRank = () => {
    setCards(sortHandByRank(cards));
    setSelectedCardId(null);
  };

  const handleSortBySuit = () => {
    setCards(sortHandBySuit(cards));
    setSelectedCardId(null);
  };

  const handleDragReorder = (input: OrganizeDragReorderInput) => {
    setCards((currentCards) => reorderCardsAfterDrag(currentCards, input));
  };

  const handleSave = () => {
    onSave(cards);
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showHeader && (
        <div className="text-center">
          <h2 className="text-lg font-semibold">Organize Your Hand</h2>
          <p className="text-sm text-muted-foreground">
            Drag cards to reorder, use arrows as a fallback, or sort automatically
          </p>
        </div>
      )}

      {/* Hand display */}
      <div
        className="overflow-x-auto overflow-y-visible overscroll-x-contain py-4 pb-5"
        data-testid="organize-hand-scroll"
      >
        <OrganizeSortableHand
          cards={cards}
          selectedId={selectedCardId}
          onCardClick={handleCardClick}
          onReorder={handleDragReorder}
          className="mx-auto w-max justify-start px-1"
        />
      </div>

      {/* Move controls */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => moveCard("left")}
          disabled={selectedIndex <= 0}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Left
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => moveCard("right")}
          disabled={selectedIndex === -1 || selectedIndex >= cards.length - 1}
        >
          Right
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Sort buttons */}
      <div className="flex justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleSortByRank}>
          Sort by Rank
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSortBySuit}>
          Sort by Suit
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
