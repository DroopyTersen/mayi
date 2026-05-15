import { useState } from "react";
import type { Card } from "core/card/card.types";
import { isValidRun, isValidSet } from "core/meld/meld.validation";
import { normalizeRunCards } from "core/meld/run.normalizer";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface Contract {
  sets: number;
  runs: number;
}

export interface StagedMeld {
  type: "set" | "run";
  cards: Card[];
}

interface StageCardInMeldsInput {
  stagedMelds: StagedMeld[];
  card: Card;
  activeMeldIndex: number;
}

interface StageCardInMeldsResult {
  stagedMelds: StagedMeld[];
  activeMeldIndex: number;
}

interface LayDownStagingState {
  stagedMelds: StagedMeld[];
  activeMeldIndex: number;
}

function minimumMeldCardCount(type: StagedMeld["type"]): number {
  return type === "set" ? 3 : 4;
}

function isMeldComplete(meld: StagedMeld): boolean {
  return meld.cards.length >= minimumMeldCardCount(meld.type);
}

function findNextIncompleteMeldIndex(
  stagedMelds: StagedMeld[],
  fromIndex: number
): number {
  for (let offset = 1; offset <= stagedMelds.length; offset++) {
    const index = (fromIndex + offset) % stagedMelds.length;
    const meld = stagedMelds[index];
    if (meld && !isMeldComplete(meld)) {
      return index;
    }
  }

  return fromIndex;
}

function findCompatibleCompletedMeldIndex(
  stagedMelds: StagedMeld[],
  card: Card,
  preferredIndex: number
): number | null {
  const candidateIndexes = [
    preferredIndex,
    ...stagedMelds.map((_, index) => index).filter((index) => index !== preferredIndex),
  ];

  for (const index of candidateIndexes) {
    const meld = stagedMelds[index];
    if (!meld || !isMeldComplete(meld)) {
      continue;
    }

    const candidate = { ...meld, cards: [...meld.cards, card] };
    if (isStagedMeldValid(candidate)) {
      return index;
    }
  }

  return null;
}

function isStagedMeldValid(meld: StagedMeld): boolean {
  if (meld.type === "set") {
    return isValidSet(meld.cards);
  }

  return isValidRun(meld.cards) || normalizeRunCards(meld.cards).success;
}

export function stageCardInMelds({
  stagedMelds,
  card,
  activeMeldIndex,
}: StageCardInMeldsInput): StageCardInMeldsResult {
  if (stagedMelds.some((m) => m.cards.some((c) => c.id === card.id))) {
    return { stagedMelds, activeMeldIndex };
  }

  const preferredMeld = stagedMelds[activeMeldIndex];
  let targetIndex: number | null = null;

  if (preferredMeld && !isMeldComplete(preferredMeld)) {
    targetIndex = activeMeldIndex;
  } else {
    const compatibleCompletedIndex = findCompatibleCompletedMeldIndex(
      stagedMelds,
      card,
      activeMeldIndex
    );
    const nextIncompleteIndex = findNextIncompleteMeldIndex(
      stagedMelds,
      activeMeldIndex
    );
    const nextIncompleteMeld = stagedMelds[nextIncompleteIndex];

    targetIndex = compatibleCompletedIndex
      ?? (nextIncompleteMeld && !isMeldComplete(nextIncompleteMeld)
        ? nextIncompleteIndex
        : null);
  }

  if (targetIndex === null) {
    return { stagedMelds, activeMeldIndex };
  }

  const targetMeld = stagedMelds[targetIndex];
  if (!targetMeld) {
    return { stagedMelds, activeMeldIndex };
  }

  const next = stagedMelds.map((meld, index) =>
    index === targetIndex
      ? { ...meld, cards: [...meld.cards, card] }
      : meld
  );
  const nextTarget = next[targetIndex];
  const nextActiveMeldIndex = nextTarget && isMeldComplete(nextTarget)
    ? findNextIncompleteMeldIndex(next, targetIndex)
    : targetIndex;

  return { stagedMelds: next, activeMeldIndex: nextActiveMeldIndex };
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

  const [stagingState, setStagingState] = useState<LayDownStagingState>({
    stagedMelds: initialStagedMelds ?? defaultMelds,
    activeMeldIndex: 0,
  });
  const { stagedMelds, activeMeldIndex } = stagingState;

  // Cards not yet staged
  const stagedCardIds = new Set(stagedMelds.flatMap((m) => m.cards.map((c) => c.id)));
  const availableCards = hand.filter((c) => !stagedCardIds.has(c.id));

  const handleCardClick = (cardId: string) => {
    const card = availableCards.find((c) => c.id === cardId);
    if (!card) return;

    setStagingState((prev) =>
      stageCardInMelds({
        stagedMelds: prev.stagedMelds,
        card,
        activeMeldIndex: prev.activeMeldIndex,
      })
    );
  };

  const removeCardFromMeld = (meldIndex: number, cardId: string) => {
    setStagingState((prev) => {
      const meld = prev.stagedMelds[meldIndex];
      if (!meld) return prev;

      const next = [...prev.stagedMelds];
      next[meldIndex] = {
        ...meld,
        cards: meld.cards.filter((c) => c.id !== cardId),
      };
      return {
        stagedMelds: next,
        activeMeldIndex: meldIndex,
      };
    });
  };

  const handleLayDown = () => {
    onLayDown(stagedMelds);
  };

  const allMeldsValid = stagedMelds.every(isStagedMeldValid);

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      {/* Fixed header with contract description and hand */}
      <div className="flex-shrink-0 pb-3 border-b">
        <p className="text-sm text-muted-foreground mb-2 text-center">
          {contract.sets} set{contract.sets !== 1 ? "s" : ""} + {contract.runs} run{contract.runs !== 1 ? "s" : ""}
        </p>
        <div className="flex justify-center">
          <HandDisplay
            cards={availableCards}
            onCardClick={handleCardClick}
            size="sm"
            overlap="none"
          />
        </div>
      </div>

      {/* Scrollable staging areas */}
      <div className="flex-1 overflow-y-auto py-3 min-h-0">
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
              onClick={() =>
                setStagingState((prev) => ({
                  ...prev,
                  activeMeldIndex: index,
                }))
              }
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
                      <PlayingCard card={card} size="sm" onClick={() => undefined} />
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
                  Add cards from your hand
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed footer with actions */}
      <div className="flex-shrink-0 pt-3 border-t">
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleLayDown} disabled={!allMeldsValid}>
            Lay Down
          </Button>
        </div>
      </div>
    </div>
  );
}
