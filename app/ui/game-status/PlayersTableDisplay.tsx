import { cn } from "~/shadcn/lib/utils";
import { Check, Minus } from "lucide-react";

interface PlayerStatus {
  id: string;
  name: string;
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
  className?: string;
}

export function PlayersTableDisplay({
  players,
  viewingPlayerId,
  activePlayerId,
  className,
}: PlayersTableDisplayProps) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left py-2 px-3 font-medium">Player</th>
            <th className="text-center py-2 px-3 font-medium">Cards</th>
            <th className="text-center py-2 px-3 font-medium">Down?</th>
            <th className="text-right py-2 px-3 font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const isViewingPlayer = player.id === viewingPlayerId;
            const isActivePlayer = player.id === activePlayerId;
            return (
              <tr
                key={player.id}
                className={cn(
                  "border-t border-border",
                  isActivePlayer && "bg-primary/10"
                )}
              >
                <td className="py-2 px-3">
                  <span
                    className={cn(
                      "font-medium",
                      isActivePlayer && "text-primary"
                    )}
                  >
                    {player.name}
                  </span>
                  {isViewingPlayer && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (You)
                    </span>
                  )}
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
