import { useState } from "react";
import type { Card } from "core/card/card.types";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface DiscardViewProps {
  hand: Card[];
  onDiscard: (cardId: string) => void;
  onCancel: () => void;
  className?: string;
}

export function DiscardView({
  hand,
  onDiscard,
  onCancel,
  className,
}: DiscardViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId === selectedCardId ? null : cardId);
  };

  const handleDiscard = () => {
    if (selectedCardId) {
      onDiscard(selectedCardId);
    }
  };

  const selectedCard = hand.find((c) => c.id === selectedCardId);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Select a card to discard</h2>
        <p className="text-sm text-muted-foreground">
          Tap a card to select it, then confirm
        </p>
      </div>

      {/* Hand display */}
      <div className="flex justify-center py-4">
        <HandDisplay
          cards={hand}
          selectedIds={selectedCardId ? new Set([selectedCardId]) : new Set()}
          onCardClick={handleCardClick}
          size="md"
        />
      </div>

      {/* Selection indicator */}
      {selectedCard && (
        <p className="text-center text-sm">
          Selected:{" "}
          <span className="font-medium">
            {selectedCard.rank}
            {selectedCard.suit && ` of ${selectedCard.suit}`}
          </span>
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleDiscard} disabled={!selectedCardId}>
          Discard
        </Button>
      </div>
    </div>
  );
}
