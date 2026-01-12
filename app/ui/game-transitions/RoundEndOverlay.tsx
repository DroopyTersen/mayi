import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/shadcn/components/ui/card";
import { cn } from "~/shadcn/lib/utils";

interface RoundEndOverlayProps {
  roundNumber: number;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  currentPlayerId: string;
  /** Duration of the countdown in seconds (default: 4) */
  countdownSeconds?: number;
  className?: string;
}

export function RoundEndOverlay({
  roundNumber,
  scores,
  playerNames,
  currentPlayerId,
  countdownSeconds = 4,
  className,
}: RoundEndOverlayProps) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  // Simple countdown display - no callback, no dependencies that could cause re-triggers
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty deps - runs once on mount, stable behavior

  // Sort players by score (ascending - lowest is best)
  const sortedPlayers = Object.entries(scores).sort(([, a], [, b]) => a - b);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Round {roundNumber} Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scores Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Current Standings
            </h3>
            <div className="divide-y">
              {sortedPlayers.map(([playerId, score], index) => {
                const name = playerNames[playerId] ?? "Unknown";
                const isYou = playerId === currentPlayerId;
                return (
                  <div
                    key={playerId}
                    className={cn(
                      "flex items-center justify-between py-2",
                      isYou && "font-semibold"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <span>{isYou ? `${name} (You)` : name}</span>
                    </div>
                    <span className="tabular-nums">{score} pts</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next round countdown */}
          <div className="text-center text-sm text-muted-foreground">
            {countdown > 0
              ? `Next round starting in ${countdown}...`
              : "Starting now..."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
