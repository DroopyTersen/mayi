import { useState, useMemo, useCallback } from "react";
import type { PlayerView } from "~/party/protocol.types";
import { GameHeader } from "~/ui/game-status/GameHeader";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { ActionBar } from "~/ui/action-bar/ActionBar";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { ActivityLog } from "~/ui/game-status/ActivityLog";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { LayDownView } from "~/ui/lay-down-view/LayDownView";
import { LayOffView } from "~/ui/lay-off-view/LayOffView";
import { DiscardView } from "~/ui/discard-view/DiscardView";
import { SwapJokerView } from "~/ui/swap-joker-view/SwapJokerView";
import { OrganizeHandView } from "~/ui/organize-hand/OrganizeHandView";
import { cn } from "~/shadcn/lib/utils";
import { Layers } from "lucide-react";

interface ActivityEntry {
  id: string;
  message: string;
  timestamp?: string;
}

interface GameViewProps {
  gameState: PlayerView;
  /** Name of AI player currently thinking (if any) */
  aiThinkingPlayerName?: string;
  /** Activity log entries */
  activityLog?: ActivityEntry[];
  /** Called when player performs an action */
  onAction?: (action: string, payload?: unknown) => void;
  className?: string;
}

type GamePhase = "draw" | "action" | "waiting";
type ActiveDrawer = "layDown" | "layOff" | "discard" | "swapJoker" | "organize" | null;

/**
 * Map engine phase/turnPhase to ActionBar's simpler phase model
 */
function mapToActionPhase(
  phase: PlayerView["phase"],
  turnPhase: PlayerView["turnPhase"],
  isYourTurn: boolean,
  hasDrawn: boolean
): GamePhase {
  if (!isYourTurn) return "waiting";

  if (phase === "RESOLVING_MAY_I") return "waiting";

  if (turnPhase === "AWAITING_DRAW") return "draw";
  if (turnPhase === "AWAITING_ACTION" || turnPhase === "AWAITING_DISCARD") {
    return hasDrawn ? "action" : "draw";
  }

  return "waiting";
}

export function GameView({
  gameState,
  aiThinkingPlayerName,
  activityLog = [],
  onAction,
  className,
}: GameViewProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);

  // Toggle card selection
  const handleCardClick = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  // Handle actions from ActionBar
  const handleAction = useCallback(
    (action: string) => {
      // Open drawer for view-based actions
      if (action === "layDown" || action === "layOff" || action === "discard" ||
          action === "swapJoker" || action === "organize") {
        setActiveDrawer(action);
        return;
      }
      // Pass through other actions (drawStock, pickUpDiscard, mayI, skip)
      onAction?.(action, { selectedCardIds: Array.from(selectedCardIds) });
    },
    [onAction, selectedCardIds]
  );

  // Close the active drawer
  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  // Handle lay down action
  const handleLayDown = useCallback(
    (melds: Array<{ type: "set" | "run"; cards: Array<{ id: string }> }>) => {
      onAction?.("layDown", { melds: melds.map(m => ({ type: m.type, cardIds: m.cards.map(c => c.id) })) });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle lay off action
  const handleLayOff = useCallback(
    (cardId: string, meldId: string) => {
      onAction?.("layOff", { cardId, meldId });
      // Don't close - user might want to lay off more cards
    },
    [onAction]
  );

  // Handle discard action
  const handleDiscard = useCallback(
    (cardId: string) => {
      onAction?.("discard", { selectedCardIds: [cardId] });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle swap joker action
  const handleSwapJoker = useCallback(
    (meldId: string, jokerIndex: number, cardId: string) => {
      onAction?.("swapJoker", { meldId, jokerCardId: `joker-${jokerIndex}`, swapCardId: cardId });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle organize hand (reorder)
  const handleOrganize = useCallback(
    (newOrder: Array<{ id: string }>) => {
      onAction?.("reorderHand", { cardIds: newOrder.map(c => c.id) });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Calculate ActionBar phase
  const actionPhase = mapToActionPhase(
    gameState.phase,
    gameState.turnPhase,
    gameState.isYourTurn,
    gameState.turnPhase !== "AWAITING_DRAW"
  );

  // Determine if May I is available
  // TODO: Add proper May I eligibility check based on game rules
  const canMayI =
    !gameState.isYourTurn &&
    gameState.phase === "ROUND_ACTIVE" &&
    gameState.topDiscard !== null &&
    gameState.mayIContext === null;

  // Build players list for TableDisplay and PlayersTableDisplay
  const allPlayers = useMemo(() => {
    const self = {
      id: gameState.viewingPlayerId,
      name: "You",
      cardCount: gameState.yourHand.length,
      isDown: gameState.youAreDown,
      score: gameState.yourTotalScore,
    };
    const others = gameState.opponents.map((opp) => ({
      id: opp.id,
      name: opp.name,
      cardCount: opp.handCount,
      isDown: opp.isDown,
      score: opp.totalScore,
    }));
    return [self, ...others];
  }, [gameState]);

  // Build simple players list for TableDisplay (just id and name)
  const tablePlayers = useMemo(() => {
    return allPlayers.map((p) => ({ id: p.id, name: p.name }));
  }, [allPlayers]);

  // Current player (the one whose turn it is)
  const currentPlayerId = gameState.awaitingPlayerId;

  // Interactive discard label
  const discardInteractiveLabel = useMemo(() => {
    if (gameState.isYourTurn && gameState.turnPhase === "AWAITING_DRAW") {
      return "pickup" as const;
    }
    if (canMayI) {
      return "may-i" as const;
    }
    return undefined;
  }, [gameState.isYourTurn, gameState.turnPhase, canMayI]);

  return (
    <div className={cn("flex flex-col min-h-screen", className)}>
      {/* Header */}
      <GameHeader
        round={gameState.currentRound}
        totalRounds={6}
        contract={gameState.contract}
      />

      {/* AI Thinking Indicator */}
      {aiThinkingPlayerName && (
        <div className="px-4 py-2">
          <AIThinkingIndicator playerName={aiThinkingPlayerName} />
        </div>
      )}

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 p-4">
        {/* Desktop: 2-column layout, Mobile: stacked */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left Column: Game Table Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Table and Discard */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers className="w-4 h-4" />
                <span>Table</span>
              </div>

              {/* Discard pile and stock indicator */}
              <div className="flex items-start gap-6">
                {/* Discard Pile */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Discard</span>
                  <DiscardPileDisplay
                    topCard={gameState.topDiscard}
                    size="md"
                    interactiveLabel={discardInteractiveLabel}
                    onClick={
                      discardInteractiveLabel
                        ? () => handleAction(discardInteractiveLabel === "pickup" ? "pickUpDiscard" : "mayI")
                        : undefined
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {gameState.discardCount} cards
                  </span>
                </div>

                {/* Stock indicator */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Stock</span>
                  <div
                    className={cn(
                      "rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground",
                      gameState.isYourTurn &&
                        gameState.turnPhase === "AWAITING_DRAW" &&
                        "border-primary cursor-pointer hover:bg-primary/5"
                    )}
                    style={{ width: 64, height: 90 }}
                    onClick={
                      gameState.isYourTurn &&
                      gameState.turnPhase === "AWAITING_DRAW"
                        ? () => handleAction("drawStock")
                        : undefined
                    }
                    role={
                      gameState.isYourTurn &&
                      gameState.turnPhase === "AWAITING_DRAW"
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      gameState.isYourTurn &&
                      gameState.turnPhase === "AWAITING_DRAW"
                        ? 0
                        : undefined
                    }
                  >
                    <span className="text-lg font-bold tabular-nums">
                      {gameState.stockCount}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">cards</span>
                </div>
              </div>

              {/* Melds on table */}
              <TableDisplay
                melds={gameState.table}
                players={tablePlayers}
                currentPlayerId={currentPlayerId}
              />
            </div>
          </div>

          {/* Right Column: Players & Activity */}
          <div className="space-y-4">
            {/* Players Table */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Players
              </h3>
              <PlayersTableDisplay
                players={allPlayers}
                currentPlayerId={gameState.viewingPlayerId}
              />
            </div>

            {/* Activity Log */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Activity
              </h3>
              <ActivityLog entries={activityLog} maxEntries={6} />
            </div>
          </div>
        </div>
      </div>

      {/* Your Hand - Fixed at bottom on mobile, inline on desktop */}
      <div className="sticky bottom-0 bg-background border-t">
        <div className="max-w-6xl mx-auto p-4 space-y-3">
          {/* Turn status indicator */}
          <div className="flex items-center justify-between text-sm">
            <span
              className={cn(
                "font-medium",
                gameState.isYourTurn ? "text-primary" : "text-muted-foreground"
              )}
            >
              {gameState.isYourTurn
                ? gameState.turnPhase === "AWAITING_DRAW"
                  ? "Your turn - Draw a card"
                  : gameState.turnPhase === "AWAITING_DISCARD"
                    ? "Your turn - Discard a card"
                    : "Your turn"
                : `Waiting for ${gameState.opponents.find((o) => o.id === currentPlayerId)?.name ?? "other player"}`}
            </span>
            {selectedCardIds.size > 0 && (
              <span className="text-muted-foreground">
                {selectedCardIds.size} card{selectedCardIds.size !== 1 && "s"}{" "}
                selected
              </span>
            )}
          </div>

          {/* Hand Display */}
          <HandDisplay
            cards={gameState.yourHand}
            selectedIds={selectedCardIds}
            onCardClick={handleCardClick}
            size="auto"
          />
        </div>

        {/* Action Bar */}
        <ActionBar
          phase={actionPhase}
          isYourTurn={gameState.isYourTurn}
          isDown={gameState.youAreDown}
          hasDrawn={gameState.turnPhase !== "AWAITING_DRAW"}
          canMayI={canMayI}
          onAction={handleAction}
        />
      </div>

      {/* Lay Down Drawer */}
      <ResponsiveDrawer
        open={activeDrawer === "layDown"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Lay Down"
        description="Arrange your cards into melds"
        className="sm:max-w-lg"
      >
        <LayDownView
          hand={gameState.yourHand}
          contract={gameState.contract}
          onLayDown={handleLayDown}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Lay Off Drawer */}
      <ResponsiveDrawer
        open={activeDrawer === "layOff"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Lay Off"
        description="Add cards to existing melds"
        className="sm:max-w-lg"
      >
        <LayOffView
          hand={gameState.yourHand}
          tableMelds={gameState.table}
          onLayOff={handleLayOff}
          onDone={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Discard Drawer */}
      <ResponsiveDrawer
        open={activeDrawer === "discard"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Discard"
        description="Choose a card to discard"
        className="sm:max-w-lg"
      >
        <DiscardView
          hand={gameState.yourHand}
          onDiscard={handleDiscard}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Swap Joker Drawer */}
      <ResponsiveDrawer
        open={activeDrawer === "swapJoker"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Swap Joker"
        description="Replace a joker with a natural card"
        className="sm:max-w-lg"
      >
        <SwapJokerView
          hand={gameState.yourHand}
          meldsWithJokers={gameState.table.filter(m => m.cards.some(c => c.rank === "Joker"))}
          swappableJokers={[]}
          onSwap={handleSwapJoker}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>

      {/* Organize Hand Drawer */}
      <ResponsiveDrawer
        open={activeDrawer === "organize"}
        onOpenChange={(open) => !open && closeDrawer()}
        title="Organize Hand"
        description="Rearrange your cards"
        className="sm:max-w-lg"
      >
        <OrganizeHandView
          hand={gameState.yourHand}
          onSave={handleOrganize}
          onCancel={closeDrawer}
        />
      </ResponsiveDrawer>
    </div>
  );
}
