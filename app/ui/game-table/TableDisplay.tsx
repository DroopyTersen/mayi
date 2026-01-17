import type { Meld } from "core/meld/meld.types";
import type { MayINotificationState } from "~/routes/game.$roomId";
import { PlayerMeldsDisplay } from "./PlayerMeldsDisplay";
import { cn } from "~/shadcn/lib/utils";

interface Player {
  id: string;
  name: string;
  avatarId?: string;
}

interface TableDisplayProps {
  melds: Meld[];
  players: Player[];
  /** The player whose turn it is (for highlighting) */
  currentPlayerId?: string;
  /** The player viewing the game (for "(You)" label) */
  viewingPlayerId?: string;
  /** May I notification to display for the calling player */
  mayINotification?: MayINotificationState | null;
  className?: string;
}

export function TableDisplay({
  melds,
  players,
  currentPlayerId,
  viewingPlayerId,
  mayINotification,
  className,
}: TableDisplayProps) {
  // Group melds by player
  const meldsByPlayer = new Map<string, Meld[]>();
  for (const meld of melds) {
    const existing = meldsByPlayer.get(meld.ownerId) ?? [];
    existing.push(meld);
    meldsByPlayer.set(meld.ownerId, existing);
  }

  // Show all players, regardless of whether they have melds
  return (
    <div className={cn("space-y-3", className)}>
      {players.map((player) => {
        // Only pass notification to the player who called May I
        const playerNotification =
          mayINotification?.callerId === player.id ? mayINotification : null;

        return (
          <PlayerMeldsDisplay
            key={player.id}
            playerName={player.name}
            playerAvatarId={player.avatarId}
            melds={meldsByPlayer.get(player.id) ?? []}
            isActiveTurn={player.id === currentPlayerId}
            isViewingPlayer={player.id === viewingPlayerId}
            mayINotification={playerNotification}
          />
        );
      })}
    </div>
  );
}
