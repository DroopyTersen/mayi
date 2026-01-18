import type { PlayerView } from "~/party/protocol.types";
import type { ConnectionStatus } from "~/ui/lobby/lobby.types";
import type { ActivityEntry } from "./game-view.types";
import { GameHeader } from "~/ui/game-status/GameHeader";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";
import { ActivityLog } from "~/ui/game-status/ActivityLog";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { InactivityHintBanner } from "./InactivityHintBanner";
import { ConnectionBanner } from "~/ui/connection-status/ConnectionBanner";
import {
  HandDrawer,
  MOBILE_HAND_PEEK_HEIGHT_PX,
} from "~/ui/hand-drawer/HandDrawer";
import { useMediaQuery } from "~/shadcn/hooks/useMediaQuery";
import { MOBILE_MEDIA_QUERY } from "~/ui/playing-card/playing-card.constants";
import { cn } from "~/shadcn/lib/utils";
import { useGameViewState } from "./useGameViewState";
import { useGameViewDerived } from "./useGameViewDerived";
import { GameViewDesktopFooter } from "./GameViewDesktopFooter";
import { GameViewDrawers } from "./GameViewDrawers";
import { useInactivityHint } from "./useInactivityHint";
import { getInactivityHintMessage } from "core/engine/game-engine.inactivity";

interface GameViewProps {
  gameState: PlayerView;
  /** Name of AI player currently thinking (if any) */
  aiThinkingPlayerName?: string;
  /** Activity log entries */
  activityLog?: ActivityEntry[];
  /** Called when player performs an action */
  onAction?: (action: string, payload?: unknown) => void;
  /** Error message to display (e.g., from failed game action) */
  errorMessage?: string | null;
  /** WebSocket connection status */
  connectionStatus?: ConnectionStatus;
  className?: string;
}

export function GameView({
  gameState,
  aiThinkingPlayerName,
  activityLog = [],
  onAction,
  errorMessage,
  connectionStatus = "connected",
  className,
}: GameViewProps) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  // State management and handlers
  const state = useGameViewState({
    hand: gameState.yourHand,
    onAction,
  });

  // Derived/computed values
  const derived = useGameViewDerived({ gameState });
  const inactivityMessage = getInactivityHintMessage(gameState);
  const inactivityHint = useInactivityHint({
    isEnabled: gameState.isYourTurn && gameState.phase === "ROUND_ACTIVE",
    message: inactivityMessage,
    activityKey: state.activityCounter,
  });

  return (
    <div className={cn("flex flex-col min-h-screen", className)}>
      {/* Connection Status Banner - shown when disconnected/reconnecting */}
      <ConnectionBanner status={connectionStatus} />

      {/* Header - includes turn status on mobile */}
      <GameHeader
        turnStatus={isMobile ? derived.turnPhaseText : undefined}
        isYourTurn={isMobile ? gameState.isYourTurn : undefined}
      />

      {/* Inactivity Hint */}
      {inactivityHint.isVisible && inactivityHint.message && (
        <div className="px-4 py-2">
          <InactivityHintBanner
            message={inactivityHint.message}
            onDismiss={inactivityHint.dismiss}
          />
        </div>
      )}

      {/* AI Thinking Indicator */}
      {aiThinkingPlayerName && (
        <div className="px-4 py-2">
          <AIThinkingIndicator playerName={aiThinkingPlayerName} />
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="px-4 py-2">
          <div className="bg-destructive/15 text-destructive border border-destructive/30 rounded-lg px-4 py-3 text-sm">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Main Content - Responsive Layout */}
      <div
        className={cn("flex-1 p-4 min-h-0 overflow-y-auto")}
        style={
          isMobile
            ? {
                paddingBottom: `calc(${MOBILE_HAND_PEEK_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
              }
            : undefined
        }
      >
        {/* Desktop: 2-column layout, Mobile: stacked */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left Column: Game Table Area - scroll container on desktop */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            {/* Table - Melds only (piles moved to bottom section) */}
            <div className="rounded-lg flex flex-col min-h-0 flex-1">
              {/* Melds on table - scrollable */}
              <div className="overflow-y-auto flex-1 min-h-0">
                <TableDisplay
                  melds={gameState.table}
                  players={derived.tablePlayers}
                  currentPlayerId={derived.currentPlayerId}
                  viewingPlayerId={gameState.viewingPlayerId}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Players & Activity in single container */}
          <div className="rounded-lg border bg-card overflow-hidden">
            {/* Round & Contract Info */}
            <div className="px-4 py-2 bg-muted/30 text-center text-sm text-muted-foreground">
              Round {gameState.currentRound} of 6 ·{" "}
              <span className="font-medium text-foreground">
                {gameState.contract.sets > 0 &&
                  `${gameState.contract.sets} set${gameState.contract.sets > 1 ? "s" : ""}`}
                {gameState.contract.sets > 0 &&
                  gameState.contract.runs > 0 &&
                  " + "}
                {gameState.contract.runs > 0 &&
                  `${gameState.contract.runs} run${gameState.contract.runs > 1 ? "s" : ""}`}
              </span>
            </div>

            {/* Players Table - full width, no padding */}
            <PlayersTableDisplay
              players={derived.allPlayers}
              viewingPlayerId={gameState.viewingPlayerId}
              activePlayerId={gameState.awaitingPlayerId}
              borderless
            />

            {/* Activity Log */}
            <div className="p-4 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Activity
              </h3>
              <ActivityLog entries={activityLog} maxEntries={6} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Swipeable Hand Drawer */}
      {isMobile && (
        <HandDrawer
          hand={gameState.yourHand}
          topDiscard={gameState.topDiscard}
          selectedCardIds={state.selectedCardIds}
          onCardClick={state.handleCardClick}
          onAction={state.handleAction}
          availableActions={gameState.availableActions}
          actionStates={gameState.actionStates}
          unavailabilityHints={gameState.unavailabilityHints}
          open={state.isHandDrawerOpen}
          onOpenChange={state.setIsHandDrawerOpen}
        />
      )}

      {/* Desktop: Fixed bottom section with piles + hand + action bar */}
      {!isMobile && (
        <GameViewDesktopFooter
          gameState={gameState}
          selectedCardIds={state.selectedCardIds}
          turnPhaseText={derived.turnPhaseText}
          discardInteractiveLabel={derived.discardInteractiveLabel}
          onCardClick={state.handleCardClick}
          onAction={state.handleAction}
        />
      )}

      {/* All Drawers */}
      <GameViewDrawers
        activeDrawer={state.activeDrawer}
        closeDrawer={state.closeDrawer}
        gameState={gameState}
        tablePlayers={derived.tablePlayers}
        swappableJokers={derived.swappableJokers}
        onLayDown={state.handleLayDown}
        onLayOff={state.handleLayOff}
        onDiscard={state.handleDiscard}
        onSwapJoker={state.handleSwapJoker}
        onOrganize={state.handleOrganize}
      />
    </div>
  );
}
