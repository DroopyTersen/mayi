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
import { AddAIPlayerDialog } from "./AddAIPlayerDialog";
import { AIPlayersList } from "./AIPlayersList";
import { StartingRoundSelector } from "./StartingRoundSelector";
import { StartGameButton } from "./StartGameButton";
import type {
  ConnectionStatus,
  JoinStatus,
  PlayerInfo,
  LobbyGameSettings,
  AIModelId,
  RoundNumber,
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
  /** Phase 3: Game settings */
  gameSettings?: LobbyGameSettings;
  /** Phase 3: Whether this player is the host (first player) */
  isHost?: boolean;
  /** Phase 3: Callbacks for game setup */
  onAddAIPlayer?: (name: string, modelId: AIModelId) => void;
  onRemoveAIPlayer?: (playerId: string) => void;
  onSetStartingRound?: (round: RoundNumber) => void;
  onStartGame?: () => void;
  /** Phase 3: Loading state for start game */
  isStartingGame?: boolean;
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
  gameSettings,
  isHost = false,
  onAddAIPlayer,
  onRemoveAIPlayer,
  onSetStartingRound,
  onStartGame,
  isStartingGame,
  className,
}: LobbyViewProps) {
  const isJoining = joinStatus === "joining";
  const isJoined = joinStatus === "joined";

  // Calculate total player count (human + AI)
  const humanCount = players.length;
  const aiCount = gameSettings?.aiPlayers.length ?? 0;
  const totalPlayerCount = humanCount + aiCount;

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
        <CardContent className="space-y-4">
          <LobbyPlayersList
            players={players}
            currentPlayerId={currentPlayerId}
          />

          {/* AI Players list (Phase 3) */}
          {gameSettings && gameSettings.aiPlayers.length > 0 && (
            <AIPlayersList
              aiPlayers={gameSettings.aiPlayers}
              onRemove={onRemoveAIPlayer ?? (() => {})}
            />
          )}

          {/* Add AI Player button (host only) */}
          {isHost && onAddAIPlayer && (
            <AddAIPlayerDialog
              onAdd={onAddAIPlayer}
              disabled={totalPlayerCount >= 8}
            />
          )}
        </CardContent>
      </Card>

      {/* Game Settings (host only, Phase 3) */}
      {isHost && gameSettings && onSetStartingRound && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Game Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <StartingRoundSelector
              value={gameSettings.startingRound}
              onChange={onSetStartingRound}
            />
          </CardContent>
        </Card>
      )}

      {/* Start Game Button (host only, Phase 3) */}
      {isHost && onStartGame && (
        <StartGameButton
          playerCount={totalPlayerCount}
          onStart={onStartGame}
          isLoading={isStartingGame}
        />
      )}

      {/* Join status message for non-host joined players */}
      {isJoined && !isHost && (
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
