import { Button } from "~/shadcn/components/ui/button";
import { X } from "lucide-react";
import type { AIPlayerInfo } from "~/party/protocol.types";
import { PlayerCard } from "./PlayerCard";

interface AIPlayersListProps {
  aiPlayers: AIPlayerInfo[];
  onRemove: (playerId: string) => void;
}

export function AIPlayersList({ aiPlayers, onRemove }: AIPlayersListProps) {
  if (aiPlayers.length === 0) {
    return null;
  }

  return (
    <>
      {aiPlayers.map((player) => (
        <PlayerCard
          key={player.playerId}
          name={player.name}
          avatarId={player.avatarId}
          isAI
        >
          <RemoveButton
            name={player.name}
            onRemove={() => onRemove(player.playerId)}
          />
        </PlayerCard>
      ))}
    </>
  );
}

interface RemoveButtonProps {
  name: string;
  onRemove: () => void;
}

function RemoveButton({ name, onRemove }: RemoveButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <X className="h-3.5 w-3.5" />
      <span className="sr-only">Remove {name}</span>
    </Button>
  );
}
