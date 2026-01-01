import { useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { needsPositionChoice } from "core/engine/layoff";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { MeldDisplay } from "~/ui/game-table/MeldDisplay";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface LayOffViewProps {
  hand: Card[];
  tableMelds: Meld[];
  onLayOff: (cardId: string, meldId: string, position?: "start" | "end") => void;
  onDone: () => void;
  className?: string;
}

/** State for position selection dialog */
interface PositionPrompt {
  cardId: string;
  meldId: string;
}

export function LayOffView({
  hand,
  tableMelds,
  onLayOff,
  onDone,
  className,
}: LayOffViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [positionPrompt, setPositionPrompt] = useState<PositionPrompt | null>(null);

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId === selectedCardId ? null : cardId);
    setPositionPrompt(null);
  };

  const handleMeldClick = (meldId: string) => {
    if (!selectedCardId) return;

    const selectedCard = hand.find((c) => c.id === selectedCardId);
    const targetMeld = tableMelds.find((m) => m.id === meldId);

    if (selectedCard && targetMeld && needsPositionChoice(selectedCard, targetMeld)) {
      // Show position selection dialog
      setPositionPrompt({ cardId: selectedCardId, meldId });
    } else {
      // No position choice needed, lay off immediately
      onLayOff(selectedCardId, meldId);
      setSelectedCardId(null);
    }
  };

  const handlePositionSelect = (position: "start" | "end") => {
    if (positionPrompt) {
      onLayOff(positionPrompt.cardId, positionPrompt.meldId, position);
      setPositionPrompt(null);
      setSelectedCardId(null);
    }
  };

  const handleCancelPosition = () => {
    setPositionPrompt(null);
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Lay Off Cards</h2>
        <p className="text-sm text-muted-foreground">
          Select a card, then tap a meld to add it
        </p>
      </div>

      {/* Position selection dialog */}
      {positionPrompt && (
        <div className="p-4 rounded-lg border border-primary bg-primary/5">
          <p className="text-sm text-center mb-3">
            This wild card can extend either end of the run. Where would you like to place it?
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePositionSelect("start")}
            >
              Start (prepend)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePositionSelect("end")}
            >
              End (append)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelPosition}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Your hand */}
      <div>
        <p className="text-sm text-muted-foreground mb-2 text-center">
          Your hand
        </p>
        <div className="flex justify-center">
          <HandDisplay
            cards={hand}
            selectedIds={selectedCardId ? new Set([selectedCardId]) : new Set()}
            onCardClick={handleCardClick}
            size="sm"
          />
        </div>
      </div>

      {/* Table melds */}
      <div>
        <p className="text-sm text-muted-foreground mb-2 text-center">
          Table melds (tap to add selected card)
        </p>
        {tableMelds.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground italic py-4">
            No melds on table
          </p>
        ) : (
          <div className="space-y-2">
            {tableMelds.map((meld) => (
              <div
                key={meld.id}
                className={cn(
                  "p-2 rounded-lg border cursor-pointer transition-colors",
                  selectedCardId && !positionPrompt
                    ? "border-primary/50 hover:border-primary hover:bg-primary/5"
                    : "border-border"
                )}
                onClick={() => !positionPrompt && handleMeldClick(meld.id)}
              >
                <MeldDisplay meld={meld} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 pt-2">
        <Button onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
