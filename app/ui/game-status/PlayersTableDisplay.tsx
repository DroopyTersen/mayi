import { cn } from "~/shadcn/lib/utils";
import { Check, Minus } from "lucide-react";

interface PlayerStatus {
  id: string;
  name: string;
  avatarId?: string;
  cardCount: number;
  isDown: boolean;
  score: number;
}

interface PlayersTableDisplayProps {
  players: PlayerStatus[];
  /** The player viewing this table (shows "(You)" label) */
  viewingPlayerId?: string;
  /** The player whose turn it is (highlighted row) */
  activePlayerId?: string;
  /** Hide the outer border (useful when embedded in a container) */
  borderless?: boolean;
  className?: string;
}

export function PlayersTableDisplay({
  players,
  viewingPlayerId,
  activePlayerId,
  borderless = false,
  className,
}: PlayersTableDisplayProps) {
  return (
    <div className={cn(!borderless && "rounded-lg border", "overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium">Player</th>
            <th className="text-center py-2 px-3 font-medium">Cards</th>
            <th className="text-center py-2 px-3 font-medium">Down?</th>
            <th className="text-right py-2 px-3 font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {players.map((player) => {
            const isViewingPlayer = player.id === viewingPlayerId;
            const isActivePlayer = player.id === activePlayerId;
            return (
              <tr
                key={player.id}
                className={cn(
                  isActivePlayer && isViewingPlayer && "bg-blue-50",
                  isActivePlayer && !isViewingPlayer && "bg-orange-50"
                )}
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar
                      name={player.name}
                      avatarId={player.avatarId}
                    />
                    <span className="font-medium">
                      {player.name}
                    </span>
                    {isViewingPlayer && (
                      <span className="text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-center py-2 px-3 tabular-nums">
                  {player.cardCount}
                </td>
                <td className="text-center py-2 px-3">
                  {player.isDown ? (
                    <Check className="inline-block w-4 h-4 text-green-600" />
                  ) : (
                    <Minus className="inline-block w-4 h-4 text-muted-foreground" />
                  )}
                </td>
                <td className="text-right py-2 px-3 tabular-nums">
                  {player.score}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerAvatar({ name, avatarId }: { name: string; avatarId?: string }) {
  if (avatarId) {
    return (
      <img
        src={`/avatars/${avatarId}.svg`}
        alt={name}
        className="w-6 h-6 rounded-full shrink-0"
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
      <span className="text-xs font-medium text-muted-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
