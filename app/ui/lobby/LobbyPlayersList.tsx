import type { PlayerInfo } from "./lobby.types";
import { PlayerCard } from "./PlayerCard";

interface LobbyPlayersListProps {
  players: PlayerInfo[];
  currentPlayerId?: string | null;
  onClickCurrentPlayer?: () => void;
}

export function LobbyPlayersList({
  players,
  currentPlayerId,
  onClickCurrentPlayer,
}: LobbyPlayersListProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <>
      {players.map((player) => {
        const isCurrentPlayer = player.playerId === currentPlayerId;

        return (
          <PlayerCard
            key={player.playerId}
            name={player.name}
            avatarId={player.avatarId}
            isCurrentPlayer={isCurrentPlayer}
            isConnected={player.isConnected}
            onClick={isCurrentPlayer ? onClickCurrentPlayer : undefined}
          />
        );
      })}
    </>
  );
}
