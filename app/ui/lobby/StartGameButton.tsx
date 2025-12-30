import { Button } from "~/shadcn/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { MIN_PLAYERS, MAX_PLAYERS } from "~/party/mayi-room.lobby";
import { cn } from "~/shadcn/lib/utils";

interface StartGameButtonProps {
  playerCount: number;
  onStart: () => void;
  isLoading?: boolean;
  className?: string;
}

export function StartGameButton({
  playerCount,
  onStart,
  isLoading,
  className,
}: StartGameButtonProps) {
  const canStart = playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS;
  const needsMore = MIN_PLAYERS - playerCount;

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={onStart}
        disabled={!canStart || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Starting Game...</span>
          </>
        ) : (
          <>
            <Play className="h-5 w-5" />
            <span>
              Start Game ({playerCount} player{playerCount !== 1 ? "s" : ""})
            </span>
          </>
        )}
      </Button>
      {!canStart && needsMore > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Need {needsMore} more player{needsMore !== 1 ? "s" : ""} to start
          (minimum {MIN_PLAYERS})
        </p>
      )}
    </div>
  );
}
