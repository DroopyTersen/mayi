import { useState } from "react";
import type { Card } from "core/card/card.types";
import { sortHandByRank, sortHandBySuit } from "core/engine/hand.reordering";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleCardClick = (cardId: string) => {
    const index = cards.findIndex((c) => c.id === cardId);
    if (index === -1) return;
    setSelectedIndex(index === selectedIndex ? null : index);
  };

  const moveCard = (direction: "left" | "right") => {
    if (selectedIndex === null) return;

    const newCards = [...cards];
    const newIndex = direction === "left" ? selectedIndex - 1 : selectedIndex + 1;

    if (newIndex < 0 || newIndex >= cards.length) return;

    const current = newCards[selectedIndex];
    const swap = newCards[newIndex];
    if (!current || !swap) return;

    newCards[selectedIndex] = swap;
    newCards[newIndex] = current;
    setCards(newCards);
    setSelectedIndex(newIndex);
  };

  const handleSortByRank = () => {
    setCards(sortHandByRank(cards));
    setSelectedIndex(null);
  };

  const handleSortBySuit = () => {
    setCards(sortHandBySuit(cards));
    setSelectedIndex(null);
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
            Select a card and use arrows to move, or sort automatically
          </p>
        </div>
      )}

      {/* Hand display */}
      <div className="py-4">
        <HandDisplay
          cards={cards}
          selectedIds={
            selectedIndex !== null && cards[selectedIndex]
              ? new Set([cards[selectedIndex]!.id])
              : new Set()
          }
          onCardClick={handleCardClick}
          size="auto"
          className="justify-center"
        />
      </div>

      {/* Move controls */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => moveCard("left")}
          disabled={selectedIndex === null || selectedIndex === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Left
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => moveCard("right")}
          disabled={selectedIndex === null || selectedIndex === cards.length - 1}
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
