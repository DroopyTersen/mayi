import { Trophy } from "lucide-react";
import { cn } from "~/shadcn/lib/utils";

interface ScoreBreakdownProps {
  /** Map of player ID to score */
  scores: Record<string, number>;
  /** Map of player ID to display name */
  playerNames: Record<string, string>;
  /** ID of the player who went out this round */
  winnerId: string;
  /** ID of the viewing player (for "(You)" label) */
  currentPlayerId: string;
  className?: string;
}

export function ScoreBreakdown({
  scores,
  playerNames,
  winnerId,
  currentPlayerId,
  className,
}: ScoreBreakdownProps) {
  // Sort players by score (ascending - lowest is best)
  const sortedPlayers = Object.entries(scores).sort(([, a], [, b]) => a - b);

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Current Standings
      </h3>
      <div className="divide-y rounded-lg border">
        {sortedPlayers.map(([playerId, score], index) => {
          const name = playerNames[playerId] ?? "Unknown";
          const isYou = playerId === currentPlayerId;
          const isWinner = playerId === winnerId;
          return (
            <div
              key={playerId}
              className={cn(
                "flex items-center justify-between py-2.5 px-3",
                isWinner && "bg-primary/5",
                isYou && "font-semibold"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex items-center gap-1">
                  {isYou ? `${name} (You)` : name}
                  {isWinner && (
                    <Trophy className="w-3.5 h-3.5 text-primary" />
                  )}
                </span>
              </div>
              <span className="tabular-nums">{score} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
