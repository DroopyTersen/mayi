import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/shadcn/components/ui/card";
import { cn } from "~/shadcn/lib/utils";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { LobbyPlayersList } from "./LobbyPlayersList";
import { ShareLinkCard } from "./ShareLinkCard";
import { NamePromptDialog } from "./NamePromptDialog";
import type {
  ConnectionStatus,
  JoinStatus,
  PlayerInfo,
} from "./lobby.types";

interface LobbyViewProps {
  roomId: string;
  shareUrl?: string;
  connectionStatus: ConnectionStatus;
  joinStatus: JoinStatus;
  players: PlayerInfo[];
  currentPlayerId: string | null;
  /** Whether name prompt is open */
  showNamePrompt: boolean;
  onNamePromptChange: (open: boolean) => void;
  onJoin: (name: string) => void;
  className?: string;
}

export function LobbyView({
  roomId,
  shareUrl,
  connectionStatus,
  joinStatus,
  players,
  currentPlayerId,
  showNamePrompt,
  onNamePromptChange,
  onJoin,
  className,
}: LobbyViewProps) {
  const isJoining = joinStatus === "joining";
  const isJoined = joinStatus === "joined";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Game Lobby</h1>
          <p className="text-muted-foreground text-sm">
            Waiting for players to join...
          </p>
        </div>
        <ConnectionStatusIndicator status={connectionStatus} />
      </div>

      {/* Share link card */}
      <ShareLinkCard roomId={roomId} shareUrl={shareUrl} />

      {/* Players list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Players
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {players.filter((p) => p.isConnected).length} online
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LobbyPlayersList
            players={players}
            currentPlayerId={currentPlayerId}
          />
        </CardContent>
      </Card>

      {/* Join status message for joined players */}
      {isJoined && (
        <p className="text-sm text-center text-muted-foreground">
          Waiting for the host to start the game...
        </p>
      )}

      {/* Name prompt dialog */}
      <NamePromptDialog
        open={showNamePrompt}
        onOpenChange={onNamePromptChange}
        onSubmit={onJoin}
        isSubmitting={isJoining}
      />
    </div>
  );
}
