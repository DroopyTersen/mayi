import { useState, useMemo, useCallback, useEffect } from "react";
import type { PlayerView } from "~/party/protocol.types";
import { GameHeader } from "~/ui/game-status/GameHeader";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { ActionBar } from "~/ui/action-bar/ActionBar";
import { TableDisplay } from "~/ui/game-table/TableDisplay";
import { PlayersTableDisplay } from "~/ui/game-status/PlayersTableDisplay";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { StockPileDisplay } from "~/ui/game-table/StockPileDisplay";
import { ActivityLog } from "~/ui/game-status/ActivityLog";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { LayDownDrawer } from "~/ui/lay-down-view/LayDownDrawer";
import { LayOffView } from "~/ui/lay-off-view/LayOffView";
import { DiscardView } from "~/ui/discard-view/DiscardView";
import { SwapJokerView } from "~/ui/swap-joker-view/SwapJokerView";
import { OrganizeHandView } from "~/ui/organize-hand/OrganizeHandView";
import { HandDrawer } from "~/ui/hand-drawer/HandDrawer";
import { useMediaQuery } from "~/shadcn/hooks/useMediaQuery";
import { MOBILE_MEDIA_QUERY } from "~/ui/playing-card/playing-card.constants";
import { getDiscardInteractiveLabel, getTurnPhaseText } from "./game-view.utils";
import { cn } from "~/shadcn/lib/utils";
import { Layers } from "lucide-react";
import { identifyJokerPositions } from "core/meld/meld.joker";
import type { SwappableJoker } from "~/ui/swap-joker-view/swap-joker-view.types";

/** Height reserved for the mobile hand drawer at bottom */
const MOBILE_DRAWER_PADDING = 300;

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
  /** Error message to display (e.g., from failed game action) */
  errorMessage?: string | null;
  className?: string;
}

type ActiveDrawer = "layDown" | "layOff" | "discard" | "swapJoker" | "organize" | null;

export function GameView({
  gameState,
  aiThinkingPlayerName,
  activityLog = [],
  onAction,
  errorMessage,
  className,
}: GameViewProps) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);

  // Clean up stale selected card IDs when hand changes
  // This fixes the bug where "X cards selected" persists after discarding
  useEffect(() => {
    const handCardIds = new Set(gameState.yourHand.map((c) => c.id));
    setSelectedCardIds((prev) => {
      const cleaned = new Set([...prev].filter((id) => handCardIds.has(id)));
      // Only update if there's a difference to avoid infinite loops
      if (cleaned.size !== prev.size) {
        return cleaned;
      }
      return prev;
    });
  }, [gameState.yourHand]);

  // Compute swappable jokers - find jokers in runs where player has matching natural card
  const swappableJokers = useMemo((): SwappableJoker[] => {
    const result: SwappableJoker[] = [];

    for (const meld of gameState.table) {
      if (meld.type !== "run") continue;

      const positions = identifyJokerPositions(meld);
      for (const pos of positions) {
        if (!pos.isJoker) continue; // Only actual Jokers, not 2s

        // Check if player has a matching natural card in hand
        const hasMatchingCard = gameState.yourHand.some(
          (c) => c.rank === pos.actingAsRank && c.suit === pos.actingAsSuit
        );
        if (hasMatchingCard) {
          result.push({
            meldId: meld.id,
            jokerCardId: pos.wildCard.id,
            jokerIndex: pos.positionIndex,
            replacementRank: pos.actingAsRank,
            replacementSuit: pos.actingAsSuit,
          });
        }
      }
    }
    return result;
  }, [gameState.table, gameState.yourHand]);

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
    (cardId: string, meldId: string, position?: "start" | "end") => {
      onAction?.("layOff", { cardId, meldId, position });
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
    (meldId: string, jokerCardId: string, swapCardId: string) => {
      onAction?.("swapJoker", { meldId, jokerCardId, swapCardId });
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


  // Build players list for TableDisplay and PlayersTableDisplay
  // Players are ordered by turnOrder from the game state
  const allPlayers = useMemo(() => {
    const self = {
      id: gameState.viewingPlayerId,
      name: "You",
      cardCount: gameState.yourHand.length,
      isDown: gameState.youAreDown,
      score: gameState.yourTotalScore,
    };
    const othersMap = new Map(
      gameState.opponents.map((opp) => [
        opp.id,
        {
          id: opp.id,
          name: opp.name,
          cardCount: opp.handCount,
          isDown: opp.isDown,
          score: opp.totalScore,
        },
      ])
    );

    // Order players by turnOrder (if available), otherwise fall back to self-first
    if (gameState.turnOrder && gameState.turnOrder.length > 0) {
      return gameState.turnOrder.map((playerId) =>
        playerId === gameState.viewingPlayerId
          ? self
          : othersMap.get(playerId)!
      );
    }

    // Fallback for older state without turnOrder
    return [self, ...Array.from(othersMap.values())];
  }, [gameState]);

  // Build simple players list for TableDisplay (just id and name)
  const tablePlayers = useMemo(() => {
    return allPlayers.map((p) => ({ id: p.id, name: p.name }));
  }, [allPlayers]);

  // Current player (the one whose turn it is)
  const currentPlayerId = gameState.awaitingPlayerId;

  // Interactive discard label - driven by availableActions
  const discardInteractiveLabel = useMemo(
    () => getDiscardInteractiveLabel(gameState.availableActions),
    [gameState.availableActions]
  );

  // Turn phase text for display
  const awaitingPlayerName = useMemo(() => {
    const opponent = gameState.opponents.find((o) => o.id === currentPlayerId);
    return opponent?.name;
  }, [gameState.opponents, currentPlayerId]);

  const turnPhaseText = useMemo(
    () => getTurnPhaseText(gameState.isYourTurn, gameState.turnPhase, awaitingPlayerName),
    [gameState.isYourTurn, gameState.turnPhase, awaitingPlayerName]
  );

  return (
    <div className={cn("flex flex-col min-h-screen", className)}>
      {/* Header - includes turn status on mobile */}
      <GameHeader
        round={gameState.currentRound}
        totalRounds={6}
        contract={gameState.contract}
        turnStatus={isMobile ? turnPhaseText : undefined}
        isYourTurn={isMobile ? gameState.isYourTurn : undefined}
      />

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
      <div className={cn(
        "flex-1 p-4 min-h-0 overflow-y-auto",
        isMobile && `pb-[${MOBILE_DRAWER_PADDING}px]`
      )}>
        {/* Desktop: 2-column layout, Mobile: stacked */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left Column: Game Table Area - scroll container on desktop */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            {/* Table - Melds only (piles moved to bottom section) */}
            <div className="rounded-lg border bg-card p-4 flex flex-col min-h-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4 shrink-0">
                <Layers className="w-4 h-4" />
                <span>Table</span>
              </div>

              {/* Melds on table - scrollable */}
              <div className="overflow-y-auto flex-1 min-h-0">
                <TableDisplay
                  melds={gameState.table}
                  players={tablePlayers}
                  currentPlayerId={currentPlayerId}
                  viewingPlayerId={gameState.viewingPlayerId}
                />
              </div>
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
                viewingPlayerId={gameState.viewingPlayerId}
                activePlayerId={gameState.awaitingPlayerId}
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

      {/* Mobile: Swipeable Hand Drawer */}
      {isMobile && (
        <HandDrawer
          hand={gameState.yourHand}
          topDiscard={gameState.topDiscard}
          selectedCardIds={selectedCardIds}
          onCardClick={handleCardClick}
          onAction={handleAction}
          availableActions={gameState.availableActions}
        />
      )}

      {/* Desktop: Fixed bottom section with piles + hand + action bar */}
      {!isMobile && (
        <div className="sticky bottom-0 z-10 bg-background border-t">
          <div className="max-w-6xl mx-auto p-4 space-y-3">
            {/* Turn status indicator */}
            <div className="flex items-center justify-between text-sm">
              <span
                className={cn(
                  "font-medium",
                  gameState.isYourTurn ? "text-primary" : "text-muted-foreground"
                )}
              >
                {turnPhaseText}
              </span>
              {selectedCardIds.size > 0 && (
                <span className="text-muted-foreground">
                  {selectedCardIds.size} card{selectedCardIds.size !== 1 && "s"}{" "}
                  selected
                </span>
              )}
            </div>

            {/* Piles + Hand - Flexible layout */}
            <div className="flex flex-wrap items-end justify-center gap-4 lg:gap-6">
              {/* Discard and Stock piles - sized to match hand cards */}
              <div className="flex gap-4 shrink-0">
                <DiscardPileDisplay
                  topCard={gameState.topDiscard}
                  size="lg"
                  isClickable={gameState.availableActions.canDrawFromDiscard}
                  interactiveLabel={discardInteractiveLabel}
                  onClick={
                    discardInteractiveLabel
                      ? () => handleAction(discardInteractiveLabel === "pickup" ? "pickUpDiscard" : "mayI")
                      : undefined
                  }
                />
                {gameState.isYourTurn && (
                  <StockPileDisplay
                    size="lg"
                    isClickable={gameState.availableActions.canDrawFromStock}
                    onClick={() => handleAction("drawStock")}
                  />
                )}
              </div>

              {/* Hand Display - flexible, centered */}
              <div className="flex-1 min-w-0 basis-48">
                <HandDisplay
                  cards={gameState.yourHand}
                  selectedIds={selectedCardIds}
                  onCardClick={handleCardClick}
                  size="auto"
                  className="justify-center"
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <ActionBar
            availableActions={gameState.availableActions}
            onAction={handleAction}
          />
        </div>
      )}

      {/* Lay Down Drawer */}
      <LayDownDrawer
        open={activeDrawer === "layDown"}
        onOpenChange={(open) => !open && closeDrawer()}
        hand={gameState.yourHand}
        contract={gameState.contract}
        onLayDown={handleLayDown}
        onCancel={closeDrawer}
      />

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
          players={tablePlayers}
          viewingPlayerId={gameState.viewingPlayerId}
          onLayOff={handleLayOff}
          onDone={closeDrawer}
          onCancel={closeDrawer}
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
          swappableJokers={swappableJokers}
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
