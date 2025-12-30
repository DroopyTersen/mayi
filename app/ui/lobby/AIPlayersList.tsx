import { Button } from "~/shadcn/components/ui/button";
import { Bot, X } from "lucide-react";
import type { AIPlayerInfo } from "~/party/protocol.types";
import { cn } from "~/shadcn/lib/utils";

interface AIPlayersListProps {
  aiPlayers: AIPlayerInfo[];
  onRemove: (playerId: string) => void;
  className?: string;
}

export function AIPlayersList({
  aiPlayers,
  onRemove,
  className,
}: AIPlayersListProps) {
  if (aiPlayers.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">AI Players</h3>
      <ul className="space-y-1">
        {aiPlayers.map((player) => (
          <li
            key={player.playerId}
            className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{player.name}</span>
              <span className="text-xs text-muted-foreground">
                ({player.modelDisplayName})
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(player.playerId)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove {player.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
