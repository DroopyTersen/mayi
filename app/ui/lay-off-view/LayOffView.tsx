import { useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { needsPositionChoice } from "core/engine/layoff";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { MeldDisplay } from "~/ui/game-table/MeldDisplay";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";

interface Player {
  id: string;
  name: string;
}

interface LayOffViewProps {
  hand: Card[];
  tableMelds: Meld[];
  players: Player[];
  viewingPlayerId: string;
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
  players,
  viewingPlayerId,
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

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      {/* Fixed header with hand - centered */}
      <div className="flex-shrink-0 pb-3 border-b">
        <div className="flex justify-center">
          <HandDisplay
            cards={hand}
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
                  {meldsByPlayer.get(player.id)!.map((meld) => (
                    <div
                      key={meld.id}
                      className={cn(
                        "p-1.5 rounded-md border cursor-pointer transition-colors",
                        selectedCardId && !positionPrompt
                          ? "border-primary/50 hover:border-primary hover:bg-primary/5"
                          : "border-transparent"
                      )}
                      onClick={() => !positionPrompt && handleMeldClick(meld.id)}
                    >
                      <MeldDisplay meld={meld} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed footer with actions */}
      <div className="flex-shrink-0 pt-3 border-t">
        <div className="flex justify-center">
          <Button onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
