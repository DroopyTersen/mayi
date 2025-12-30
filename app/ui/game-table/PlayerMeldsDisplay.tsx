import type { Meld } from "core/meld/meld.types";
import { MeldDisplay } from "./MeldDisplay";
import { cn } from "~/shadcn/lib/utils";

interface PlayerMeldsDisplayProps {
  playerName: string;
  melds: Meld[];
  isCurrentPlayer?: boolean;
  className?: string;
}

export function PlayerMeldsDisplay({
  playerName,
  melds,
  isCurrentPlayer = false,
  className,
}: PlayerMeldsDisplayProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isCurrentPlayer ? "border-primary bg-primary/5" : "border-border",
        className
      )}
    >
      {/* Player name header */}
      <h3
        className={cn(
          "text-sm font-semibold mb-2",
          isCurrentPlayer && "text-primary"
        )}
      >
        {playerName}
        {isCurrentPlayer && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (You)
          </span>
        )}
      </h3>

      {/* Melds */}
      {melds.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No melds yet</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {melds.map((meld) => (
            <MeldDisplay key={meld.id} meld={meld} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
