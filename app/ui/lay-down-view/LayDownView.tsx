import { useState } from "react";
import type { Card } from "core/card/card.types";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface Contract {
  sets: number;
  runs: number;
}

interface StagedMeld {
  type: "set" | "run";
  cards: Card[];
}

interface LayDownViewProps {
  hand: Card[];
  contract: Contract;
  /** Optional initial staged melds (for storybook/testing) */
  initialStagedMelds?: StagedMeld[];
  onLayDown: (melds: StagedMeld[]) => void;
  onCancel: () => void;
  className?: string;
}

export function LayDownView({
  hand,
  contract,
  initialStagedMelds,
  onLayDown,
  onCancel,
  className,
}: LayDownViewProps) {
  // Create staging areas based on contract
  const defaultMelds: StagedMeld[] = [
    ...Array(contract.sets).fill(null).map(() => ({ type: "set" as const, cards: [] })),
    ...Array(contract.runs).fill(null).map(() => ({ type: "run" as const, cards: [] })),
  ];

  const [stagedMelds, setStagedMelds] = useState<StagedMeld[]>(initialStagedMelds ?? defaultMelds);
  const [activeMeldIndex, setActiveMeldIndex] = useState<number>(0);

  // Cards not yet staged
  const stagedCardIds = new Set(stagedMelds.flatMap((m) => m.cards.map((c) => c.id)));
  const availableCards = hand.filter((c) => !stagedCardIds.has(c.id));

  const handleCardClick = (cardId: string) => {
    const card = availableCards.find((c) => c.id === cardId);
    if (!card) return;

    setStagedMelds((prev) => {
      const activeMeld = prev[activeMeldIndex];
      if (!activeMeld) return prev;

      const next = [...prev];
      next[activeMeldIndex] = {
        ...activeMeld,
        cards: [...activeMeld.cards, card],
      };
      return next;
    });
  };

  const removeCardFromMeld = (meldIndex: number, cardId: string) => {
    setStagedMelds((prev) => {
      const meld = prev[meldIndex];
      if (!meld) return prev;

      const next = [...prev];
      next[meldIndex] = {
        ...meld,
        cards: meld.cards.filter((c) => c.id !== cardId),
      };
      return next;
    });
  };

  const handleLayDown = () => {
    onLayDown(stagedMelds);
  };

  // Validation: sets need 3+ cards, runs need 4+ cards
  const allMeldsValid = stagedMelds.every((m) =>
    m.type === "set" ? m.cards.length >= 3 : m.cards.length >= 4
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Lay Down Your Contract</h2>
        <p className="text-sm text-muted-foreground">
          {contract.sets} set{contract.sets !== 1 ? "s" : ""} + {contract.runs} run{contract.runs !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Staging areas */}
      <div className="space-y-3">
        {stagedMelds.map((meld, index) => (
          <div
            key={index}
            data-testid={`meld-${meld.type}-${index + 1}`}
            data-meld-index={index}
            data-meld-type={meld.type}
            data-meld-active={activeMeldIndex === index}
            className={cn(
              "p-3 rounded-lg border-2 cursor-pointer",
              activeMeldIndex === index
                ? "border-primary bg-primary/5"
                : "border-dashed border-muted-foreground/30"
            )}
            onClick={() => setActiveMeldIndex(index)}
          >
            <div className="text-xs text-muted-foreground mb-2 font-medium">
              {meld.type === "set" ? "Set" : "Run"} {index + 1}
              {(() => {
                const minCards = meld.type === "set" ? 3 : 4;
                const needed = minCards - meld.cards.length;
                return needed > 0 ? (
                  <span className="text-destructive ml-2">
                    (need {needed} more)
                  </span>
                ) : null;
              })()}
            </div>
            {meld.cards.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {meld.cards.map((card) => (
                  <div
                    key={card.id}
                    className="relative group cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCardFromMeld(index, card.id);
                    }}
                  >
                    <PlayingCard card={card} size="sm" />
                    {/* Remove overlay on hover */}
                    <div className="absolute inset-0 bg-destructive/0 group-hover:bg-destructive/30 rounded-lg transition-colors flex items-center justify-center">
                      <span className="text-transparent group-hover:text-destructive-foreground text-xs font-bold">
                        ✕
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Tap cards below to add
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Available cards */}
      <div>
        <p className="text-sm text-muted-foreground mb-2 text-center">
          Your hand (tap to add to selected meld)
        </p>
        <div className="flex justify-center">
          <HandDisplay
            cards={availableCards}
            onCardClick={handleCardClick}
            size="sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleLayDown} disabled={!allMeldsValid}>
          Lay Down
        </Button>
      </div>
    </div>
  );
}
