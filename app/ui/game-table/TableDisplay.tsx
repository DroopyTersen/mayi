import type { Meld } from "core/meld/meld.types";
import { PlayerMeldsDisplay } from "./PlayerMeldsDisplay";
import { cn } from "~/shadcn/lib/utils";

interface Player {
  id: string;
  name: string;
}

interface TableDisplayProps {
  melds: Meld[];
  players: Player[];
  currentPlayerId?: string;
  className?: string;
}

export function TableDisplay({
  melds,
  players,
  currentPlayerId,
  className,
}: TableDisplayProps) {
  // Group melds by player
  const meldsByPlayer = new Map<string, Meld[]>();
  for (const meld of melds) {
    const existing = meldsByPlayer.get(meld.ownerId) ?? [];
    existing.push(meld);
    meldsByPlayer.set(meld.ownerId, existing);
  }

  // Get players who have melds (in order of players array)
  const playersWithMelds = players.filter(
    (p) => meldsByPlayer.has(p.id) && meldsByPlayer.get(p.id)!.length > 0
  );

  if (playersWithMelds.length === 0) {
    return (
      <div
        className={cn(
          "text-center text-muted-foreground py-8 border border-dashed rounded-lg",
          className
        )}
      >
        <p className="text-sm">No melds on the table yet</p>
        <p className="text-xs mt-1">Be the first to lay down!</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {playersWithMelds.map((player) => (
        <PlayerMeldsDisplay
          key={player.id}
          playerName={player.name}
          melds={meldsByPlayer.get(player.id) ?? []}
          isCurrentPlayer={player.id === currentPlayerId}
        />
      ))}
    </div>
  );
}
