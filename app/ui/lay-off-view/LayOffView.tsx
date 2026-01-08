import { useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { needsPositionChoice, getRunInsertPosition } from "core/engine/layoff";
import { isWild } from "core/card/card.utils";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface Player {
  id: string;
  name: string;
}

/** A staged lay-off waiting to be committed */
export interface StagedLayOff {
  cardId: string;
  meldId: string;
  position?: "start" | "end";
}

interface LayOffViewProps {
  hand: Card[];
  tableMelds: Meld[];
  players: Player[];
  viewingPlayerId: string;
  onLayOff: (cardId: string, meldId: string, position?: "start" | "end") => void;
  onDone: () => void;
  onCancel: () => void;
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
  players,
  viewingPlayerId,
  onLayOff,
  onDone,
  onCancel,
  className,
}: LayOffViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [positionPrompt, setPositionPrompt] = useState<PositionPrompt | null>(null);
  const [stagedLayOffs, setStagedLayOffs] = useState<StagedLayOff[]>([]);

  // Cards not yet staged (available to select)
  const stagedCardIds = new Set(stagedLayOffs.map((s) => s.cardId));
  const availableCards = hand.filter((c) => !stagedCardIds.has(c.id));

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId === selectedCardId ? null : cardId);
    setPositionPrompt(null);
  };

  const handleMeldClick = (meldId: string) => {
    if (!selectedCardId) return;

    const selectedCard = availableCards.find((c) => c.id === selectedCardId);
    const targetMeld = tableMelds.find((m) => m.id === meldId);

    if (selectedCard && targetMeld && needsPositionChoice(selectedCard, targetMeld)) {
      // Show position selection dialog
      setPositionPrompt({ cardId: selectedCardId, meldId });
    } else {
      // No position choice needed, stage immediately
      // For wild cards on runs, auto-determine the valid position
      let position: "start" | "end" | undefined;
      if (selectedCard && targetMeld?.type === "run" && isWild(selectedCard)) {
        const insertPos = getRunInsertPosition(selectedCard, targetMeld);
        position = insertPos === "low" ? "start" : insertPos === "high" ? "end" : undefined;
      }
      setStagedLayOffs((prev) => [...prev, { cardId: selectedCardId, meldId, position }]);
      setSelectedCardId(null);
    }
  };

  const handlePositionSelect = (position: "start" | "end") => {
    if (positionPrompt) {
      // Stage with the selected position
      setStagedLayOffs((prev) => [
        ...prev,
        { cardId: positionPrompt.cardId, meldId: positionPrompt.meldId, position },
      ]);
      setPositionPrompt(null);
      setSelectedCardId(null);
    }
  };

  const handleCancelPosition = () => {
    setPositionPrompt(null);
  };

  const handleRetract = (cardId: string) => {
    setStagedLayOffs((prev) => prev.filter((s) => s.cardId !== cardId));
  };

  const handleDone = () => {
    // Commit all staged lay-offs
    for (const staged of stagedLayOffs) {
      onLayOff(staged.cardId, staged.meldId, staged.position);
    }
    onDone();
  };

  const handleCancel = () => {
    // Discard staged and close
    setStagedLayOffs([]);
    onCancel();
  };

  // Group melds by player (like TableDisplay)
  const meldsByPlayer = new Map<string, Meld[]>();
  for (const meld of tableMelds) {
    const existing = meldsByPlayer.get(meld.ownerId) ?? [];
    existing.push(meld);
    meldsByPlayer.set(meld.ownerId, existing);
  }

  // Get players who have melds (in order of players array)
  const playersWithMelds = players.filter(
    (p) => meldsByPlayer.has(p.id) && meldsByPlayer.get(p.id)!.length > 0
  );

  const getPlayerDisplayName = (player: Player) => {
    return player.id === viewingPlayerId ? `${player.name} (You)` : player.name;
  };

  // Get staged cards for a specific meld
  const getStagedForMeld = (meldId: string) => {
    return stagedLayOffs
      .filter((s) => s.meldId === meldId)
      .map((s) => ({
        ...s,
        card: hand.find((c) => c.id === s.cardId)!,
      }))
      .filter((s) => s.card); // Filter out any with missing cards
  };

  // Overlap for meld cards (matching MeldDisplay)
  const OVERLAP = { sm: "-ml-4", md: "-ml-5" } as const;

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      {/* Fixed header with hand */}
      <div className="flex-shrink-0 pb-3 border-b">
        {/* Hand display */}
        <div className="flex justify-center">
          <HandDisplay
            cards={availableCards}
            selectedIds={selectedCardId ? new Set([selectedCardId]) : new Set()}
            onCardClick={handleCardClick}
            size="sm"
          />
        </div>

        {/* Position selection dialog */}
        {positionPrompt && (
          <div className="mt-3 p-3 rounded-lg border border-primary bg-primary/5">
            <p className="text-sm text-center mb-2">
              Where should this wild card go?
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePositionSelect("start")}
              >
                Start
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePositionSelect("end")}
              >
                End
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
      </div>

      {/* Scrollable melds section */}
      <div className="flex-1 overflow-y-auto py-3 min-h-0">
        <p className="text-xs text-muted-foreground mb-2 text-center">
          Table melds (tap to add selected card)
        </p>
        {playersWithMelds.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground italic py-4">
            No melds on table
          </p>
        ) : (
          <div className="space-y-3">
            {playersWithMelds.map((player) => (
              <div key={player.id} className="rounded-lg border border-border p-2">
                {/* Player name header */}
                <h3 className="text-xs font-medium text-muted-foreground mb-2">
                  {getPlayerDisplayName(player)}
                </h3>

                {/* Melds displayed horizontally */}
                <div className="flex flex-wrap gap-2">
                  {meldsByPlayer.get(player.id)!.map((meld) => {
                    const stagedForThisMeld = getStagedForMeld(meld.id);
                    const startStaged = stagedForThisMeld.filter((s) => s.position === "start");
                    const endStaged = stagedForThisMeld.filter((s) => s.position !== "start");

                    return (
                      <div
                        key={meld.id}
                        className={cn(
                          "p-1.5 rounded-md border transition-colors",
                          selectedCardId && !positionPrompt
                            ? "border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer"
                            : "border-transparent"
                        )}
                        onClick={() => !positionPrompt && handleMeldClick(meld.id)}
                      >
                        {/* Meld label */}
                        <div className="text-xs text-muted-foreground mb-1 font-medium">
                          {meld.type === "set" ? "Set" : "Run"}
                        </div>

                        {/* Cards with staged cards inline */}
                        <div className="flex items-end">
                          {/* Staged cards at start */}
                          {startStaged.map((staged, index) => (
                            <div
                              key={staged.cardId}
                              className={cn(
                                "relative cursor-pointer",
                                index > 0 && OVERLAP.sm
                              )}
                              style={{ zIndex: index }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetract(staged.cardId);
                              }}
                            >
                              <PlayingCard card={staged.card} size="sm" />
                              {/* Blue overlay */}
                              <div className="absolute inset-0 bg-blue-500/30 rounded-md pointer-events-none" />
                            </div>
                          ))}

                          {/* Original meld cards */}
                          {meld.cards.map((card, index) => (
                            <div
                              key={card.id}
                              className={cn((index > 0 || startStaged.length > 0) && OVERLAP.sm)}
                              style={{ zIndex: startStaged.length + index }}
                            >
                              <PlayingCard card={card} size="sm" />
                            </div>
                          ))}

                          {/* Staged cards at end */}
                          {endStaged.map((staged, index) => (
                            <div
                              key={staged.cardId}
                              className={cn("relative cursor-pointer", OVERLAP.sm)}
                              style={{ zIndex: startStaged.length + meld.cards.length + index }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetract(staged.cardId);
                              }}
                            >
                              <PlayingCard card={staged.card} size="sm" />
                              {/* Blue overlay */}
                              <div className="absolute inset-0 bg-blue-500/30 rounded-md pointer-events-none" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed footer with actions */}
      <div className="flex-shrink-0 pt-3 border-t">
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
