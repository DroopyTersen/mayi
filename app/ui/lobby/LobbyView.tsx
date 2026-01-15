import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/shadcn/components/ui/card";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { LobbyPlayersList } from "./LobbyPlayersList";
import { AIPlayersList } from "./AIPlayersList";
import { EmptyPlayersState } from "./EmptyPlayersState";
import { ShareLinkCard } from "./ShareLinkCard";
import { NamePromptDialog } from "./NamePromptDialog";
import { AddAIPlayerDialog } from "./AddAIPlayerDialog";
import { StartingRoundSelector } from "./StartingRoundSelector";
import { StartGameButton } from "./StartGameButton";
import { UserPlus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
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
  /** Fallback avatar selection when player isn't in `players` yet (e.g., join failures) */
  fallbackAvatarId?: string;
  /** Whether name prompt is open */
  showNamePrompt: boolean;
  onNamePromptChange: (open: boolean) => void;
  onJoin: (name: string, avatarId?: string) => void;
  /** Phase 3: Game settings */
  gameSettings?: LobbyGameSettings;
  /** Phase 3: Callbacks for game setup */
  onAddAIPlayer?: (name: string, modelId: AIModelId, avatarId: string) => void;
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
  fallbackAvatarId,
  showNamePrompt,
  onNamePromptChange,
  onJoin,
  gameSettings,
  onAddAIPlayer,
  onRemoveAIPlayer,
  onSetStartingRound,
  onStartGame,
  isStartingGame,
  className,
}: LobbyViewProps) {
  const isJoining = joinStatus === "joining";
  const isJoined = joinStatus === "joined";
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get current player's avatar for pre-filling the dialog
  const currentPlayer = players.find((p) => p.playerId === currentPlayerId);
  const currentPlayerAvatarId = currentPlayer?.avatarId;

  // Calculate total player count (human + AI)
  const humanCount = players.length;
  const aiCount = gameSettings?.aiPlayers.length ?? 0;
  const totalPlayerCount = humanCount + aiCount;

  // Collect taken character IDs (from both human and AI players)
  const takenCharacterIds = [
    ...players.map((p) => p.avatarId).filter((id): id is string => id != null),
    ...(gameSettings?.aiPlayers.map((p) => p.avatarId).filter((id): id is string => id != null) ?? []),
  ];
  const takenCharacterIdsForNamePrompt = currentPlayerAvatarId
    ? takenCharacterIds.filter((id) => id !== currentPlayerAvatarId)
    : takenCharacterIds;
  const rawDefaultAvatarId = currentPlayerAvatarId ?? fallbackAvatarId;
  const effectiveDefaultAvatarId =
    rawDefaultAvatarId && !takenCharacterIdsForNamePrompt.includes(rawDefaultAvatarId)
      ? rawDefaultAvatarId
      : undefined;

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

      {/* Join/Change Name button - prominent CTA */}
      <Button
        size="lg"
        className="w-full"
        variant={isJoined ? "outline" : "default"}
        onClick={() => onNamePromptChange(true)}
      >
        {isJoined ? (
          <>
            <Pencil className="h-4 w-4 mr-2" />
            Change Character
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Choose Character
          </>
        )}
      </Button>

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
          {/* Players grid - human and AI in one row */}
          {totalPlayerCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              <LobbyPlayersList
                players={players}
                currentPlayerId={currentPlayerId}
                onClickCurrentPlayer={() => onNamePromptChange(true)}
              />
              {gameSettings && gameSettings.aiPlayers.length > 0 && (
                <AIPlayersList
                  aiPlayers={gameSettings.aiPlayers}
                  onRemove={onRemoveAIPlayer ?? (() => {})}
                />
              )}
            </div>
          ) : (
            <EmptyPlayersState />
          )}

          {/* Add AI Player button (joined players only) */}
          {isJoined && onAddAIPlayer && (
            <AddAIPlayerDialog
              onAdd={onAddAIPlayer}
              takenCharacterIds={takenCharacterIds}
              disabled={totalPlayerCount >= 8}
            />
          )}
        </CardContent>
      </Card>

      {/* Start Game Button (joined players, Phase 3) */}
      {isJoined && onStartGame && (
        <StartGameButton
          playerCount={totalPlayerCount}
          onStart={onStartGame}
          isLoading={isStartingGame}
        />
      )}

      {/* Advanced Settings toggle (joined players, Phase 3) */}
      {isJoined && gameSettings && onSetStartingRound && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-muted-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Advanced
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Advanced
              </>
            )}
          </Button>
          {showAdvanced && (
            <Card>
              <CardContent className="pt-4">
                <StartingRoundSelector
                  value={gameSettings.startingRound}
                  onChange={onSetStartingRound}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Name prompt dialog */}
      <NamePromptDialog
        open={showNamePrompt}
        onOpenChange={onNamePromptChange}
        onSubmit={onJoin}
        isSubmitting={isJoining}
        mode={isJoined ? "change" : "join"}
        defaultAvatarId={effectiveDefaultAvatarId}
        takenCharacterIds={takenCharacterIdsForNamePrompt}
      />
    </div>
  );
}
