import type { Card } from "core/card/card.types";
import { getPointValue } from "core/card/card.utils";
import { PlayingCard } from "~/ui/playing-card/PlayingCard";
import { cn } from "~/shadcn/lib/utils";

interface RemainingHandsDisplayProps {
  /** Map of player ID to their remaining cards */
  playerHands: Record<string, Card[]>;
  /** Map of player ID to display name */
  playerNames: Record<string, string>;
  /** ID of the player who went out (they have 0 cards) */
  winnerId: string;
  /** ID of the viewing player (for "(You)" label) */
  currentPlayerId: string;
  className?: string;
}

export function RemainingHandsDisplay({
  playerHands,
  playerNames,
  winnerId,
  currentPlayerId,
  className,
}: RemainingHandsDisplayProps) {
  // Filter out the winner (they have 0 cards) and sort by name
  const playersWithCards = Object.entries(playerHands)
    .filter(([playerId]) => playerId !== winnerId)
    .sort(([, a], [, b]) => b.length - a.length); // Most cards first

  if (playersWithCards.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Remaining Cards
      </h3>
      <div className="space-y-3">
        {playersWithCards.map(([playerId, cards]) => {
          const name = playerNames[playerId] ?? "Unknown";
          const isYou = playerId === currentPlayerId;
          const pointsInHand = cards.reduce((sum, card) => sum + getPointValue(card), 0);

          return (
            <div key={playerId} className="space-y-1.5">
              {/* Player name and point count */}
              <div className="flex items-baseline justify-between">
                <span className={cn("text-sm", isYou && "font-semibold")}>
                  {isYou ? `${name} (You)` : name}
                </span>
                <span className="text-xs text-muted-foreground">
                  +{pointsInHand} pts
                </span>
              </div>

              {/* Cards display */}
              <div className="flex flex-wrap gap-0.5">
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    className={cn(
                      index > 0 && "-ml-4",
                      "relative"
                    )}
                    style={{ zIndex: index }}
                  >
                    <PlayingCard card={card} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
