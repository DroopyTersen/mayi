import { Trophy } from "lucide-react";
import { Button } from "~/shadcn/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/shadcn/components/ui/card";
import { cn } from "~/shadcn/lib/utils";

interface GameEndScreenProps {
  finalScores: Record<string, number>;
  winnerId: string;
  playerNames: Record<string, string>;
  currentPlayerId: string;
  onNewGame?: () => void;
  onLeave?: () => void;
  className?: string;
}

export function GameEndScreen({
  finalScores,
  winnerId,
  playerNames,
  currentPlayerId,
  onNewGame,
  onLeave,
  className,
}: GameEndScreenProps) {
  // Sort players by score (ascending - lowest is best)
  const sortedPlayers = Object.entries(finalScores).sort(([, a], [, b]) => a - b);
  const winnerName = playerNames[winnerId] ?? "Unknown";
  const isYouWinner = winnerId === currentPlayerId;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Game Over!</CardTitle>
          <p className="text-lg text-muted-foreground">
            {isYouWinner ? (
              <span className="text-primary font-semibold">
                Congratulations, You Won!
              </span>
            ) : (
              <>
                <span className="font-semibold">{winnerName}</span> wins!
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Final Standings */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Final Standings
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
                      "flex items-center justify-between py-3 px-4",
                      isWinner && "bg-primary/5",
                      isYou && "font-semibold"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      <span>
                        {isYou ? `${name} (You)` : name}
                        {isWinner && (
                          <Trophy className="inline-block w-4 h-4 ml-1 text-primary" />
                        )}
                      </span>
                    </div>
                    <span className="tabular-nums font-medium">{score} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          {onNewGame && (
            <Button onClick={onNewGame}>Play Again</Button>
          )}
          {onLeave && (
            <Button variant="outline" onClick={onLeave}>
              Leave Game
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
