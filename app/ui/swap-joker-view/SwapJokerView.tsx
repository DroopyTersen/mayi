import { useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { MeldDisplay } from "~/ui/game-table/MeldDisplay";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface SwappableJoker {
  meldId: string;
  jokerIndex: number;
  replacementRank: string;
  replacementSuit: string;
}

interface SwapJokerViewProps {
  hand: Card[];
  meldsWithJokers: Meld[];
  swappableJokers: SwappableJoker[];
  onSwap: (meldId: string, jokerIndex: number, cardId: string) => void;
  onCancel: () => void;
  className?: string;
}

export function SwapJokerView({
  hand,
  meldsWithJokers,
  swappableJokers,
  onSwap,
  onCancel,
  className,
}: SwapJokerViewProps) {
  const [selectedSwap, setSelectedSwap] = useState<SwappableJoker | null>(null);

  // Find cards in hand that can replace a joker
  const getMatchingCards = (swap: SwappableJoker) => {
    return hand.filter(
      (c) => c.rank === swap.replacementRank && c.suit === swap.replacementSuit
    );
  };

  const handleSwapClick = (swap: SwappableJoker) => {
    setSelectedSwap(swap);
  };

  const handleConfirmSwap = (cardId: string) => {
    if (selectedSwap) {
      onSwap(selectedSwap.meldId, selectedSwap.jokerIndex, cardId);
    }
  };

  const matchingCards = selectedSwap ? getMatchingCards(selectedSwap) : [];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Swap a Joker</h2>
        <p className="text-sm text-muted-foreground">
          Replace a Joker with the natural card from your hand
        </p>
      </div>

      {swappableJokers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No Jokers available to swap</p>
          <p className="text-sm mt-1">
            You need the natural card in your hand to swap
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* List swappable jokers */}
          {swappableJokers.map((swap, index) => {
            const meld = meldsWithJokers.find((m) => m.id === swap.meldId);
            if (!meld) return null;

            return (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer",
                  selectedSwap === swap
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => handleSwapClick(swap)}
              >
                <div className="flex items-center gap-4">
                  <MeldDisplay meld={meld} size="sm" />
                  <div className="text-sm">
                    <p>
                      Swap Joker for{" "}
                      <span className="font-medium">
                        {swap.replacementRank} of {swap.replacementSuit}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show matching cards from hand */}
          {selectedSwap && matchingCards.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Select card from your hand:
              </p>
              <div className="flex gap-2 justify-center">
                {matchingCards.map((card) => (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    size="sm"
                    onClick={() => handleConfirmSwap(card.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
