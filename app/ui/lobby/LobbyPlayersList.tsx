import { cn } from "~/shadcn/lib/utils";
import type { PlayerInfo } from "./lobby.types";

interface LobbyPlayersListProps {
  players: PlayerInfo[];
  currentPlayerId?: string | null;
  className?: string;
}

/** Format "disconnected X ago" from timestamp */
function formatDisconnectedTime(disconnectedAt: number): string {
  const now = Date.now();
  const diffMs = now - disconnectedAt;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes === 1) {
    return "1m ago";
  }
  return `${diffMinutes}m ago`;
}

export function LobbyPlayersList({
  players,
  currentPlayerId,
  className,
}: LobbyPlayersListProps) {
  if (players.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-muted-foreground py-8 gap-2",
          className
        )}
      >
        <svg
          className="w-10 h-10 opacity-30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M12 11v4" strokeDasharray="2 2" />
        </svg>
        <p className="text-sm">Waiting for players to join...</p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {players.map((player) => {
        const isCurrentPlayer = player.playerId === currentPlayerId;

        return (
          <li
            key={player.playerId}
            className={cn(
              "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
              isCurrentPlayer
                ? "bg-primary/15 border-2 border-primary/30 shadow-sm"
                : "bg-muted/40 border border-transparent"
            )}
          >
            <div className="flex items-center gap-2">
              {/* Connection status dot */}
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  player.isConnected ? "bg-green-500" : "bg-gray-400"
                )}
              />
              {/* Player name */}
              <span className="font-medium">
                {player.name}
                {isCurrentPlayer && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (you)
                  </span>
                )}
              </span>
            </div>

            {/* Status text */}
            <span
              className={cn(
                "text-xs",
                player.isConnected
                  ? "text-green-600"
                  : "text-muted-foreground"
              )}
            >
              {player.isConnected
                ? "Online"
                : player.disconnectedAt
                  ? `Offline ${formatDisconnectedTime(player.disconnectedAt)}`
                  : "Offline"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
