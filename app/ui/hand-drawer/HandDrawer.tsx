import { useState, useCallback, useRef, useMemo } from "react";
import type { Card } from "core/card/card.types";
import type { AvailableActions } from "core/engine/game-engine.availability";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { StockPileDisplay } from "~/ui/game-table/StockPileDisplay";
import { ActionBar } from "~/ui/action-bar/ActionBar";
import { getDiscardInteractiveLabel } from "~/ui/game-view/game-view.utils";
import { cn } from "~/shadcn/lib/utils";

interface HandDrawerProps {
  /** Cards in the player's hand */
  hand: Card[];
  /** Top card of the discard pile */
  topDiscard: Card | null;
  /** Turn phase text to display */
  turnPhaseText: string;
  /** Currently selected card IDs */
  selectedCardIds: Set<string>;
  /** Callback when a card is clicked */
  onCardClick: (cardId: string) => void;
  /** Callback when an action is performed */
  onAction: (action: string) => void;
  /** Available actions - drives all button visibility and interactions */
  availableActions: AvailableActions;
}

type DrawerState = "minimized" | "collapsed" | "expanded";

// Heights for each state
const DRAWER_HEIGHTS = {
  minimized: "100px",
  collapsed: "280px",
  expanded: "85vh",
} as const;

/**
 * Bottom drawer for the player's hand on mobile.
 * Three states: minimized (peek), collapsed (hand visible), expanded (full view).
 */
export function HandDrawer({
  hand,
  topDiscard,
  turnPhaseText,
  selectedCardIds,
  onCardClick,
  onAction,
  availableActions,
}: HandDrawerProps) {
  const [drawerState, setDrawerState] = useState<DrawerState>("collapsed");
  const touchStartY = useRef<number | null>(null);

  // Derive turn state from available actions (same pattern as ActionBar)
  const isYourTurn = availableActions.canDrawFromStock || availableActions.canLayDown ||
                     availableActions.canDiscard || availableActions.canLayOff;

  // Interactive label for discard pile - reuses shared utility
  const discardInteractiveLabel = useMemo(
    () => getDiscardInteractiveLabel(availableActions),
    [availableActions]
  );

  // Handle discard pile click
  const handleDiscardClick = useCallback(() => {
    if (availableActions.canMayI) {
      onAction("mayI");
    } else if (availableActions.canDrawFromDiscard) {
      onAction("pickUpDiscard");
    }
  }, [availableActions.canMayI, availableActions.canDrawFromDiscard, onAction]);

  // Handle stock pile click
  const handleStockClick = useCallback(() => {
    if (availableActions.canDrawFromStock) {
      onAction("drawStock");
    }
  }, [availableActions.canDrawFromStock, onAction]);

  // Touch handlers for swipe gesture on the handle
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartY.current = touch.clientY;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const touchEndY = touch.clientY;
    const deltaY = touchStartY.current - touchEndY;

    // Swipe up = expand one level, swipe down = collapse one level
    if (deltaY > 50) {
      // Swipe up
      setDrawerState(prev => {
        if (prev === "minimized") return "collapsed";
        if (prev === "collapsed") return "expanded";
        return prev;
      });
    } else if (deltaY < -50) {
      // Swipe down
      setDrawerState(prev => {
        if (prev === "expanded") return "collapsed";
        if (prev === "collapsed") return "minimized";
        return prev;
      });
    }

    touchStartY.current = null;
  }, []);

  // Cycle through states on tap
  const handleToggle = useCallback(() => {
    setDrawerState(prev => {
      if (prev === "minimized") return "collapsed";
      if (prev === "collapsed") return "expanded";
      return "minimized";
    });
  }, []);

  // When minimized, the entire drawer should be swipeable to expand
  const isMinimized = drawerState === "minimized";

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex flex-col",
        "bg-background border-t rounded-t-xl shadow-lg",
        "transition-[height] duration-300 ease-out",
        // When minimized, make entire drawer swipeable
        isMinimized && "touch-none cursor-grab active:cursor-grabbing"
      )}
      style={{ height: DRAWER_HEIGHTS[drawerState] }}
      // Apply touch handlers to entire drawer when minimized
      onTouchStart={isMinimized ? handleTouchStart : undefined}
      onTouchEnd={isMinimized ? handleTouchEnd : undefined}
      onClick={isMinimized ? handleToggle : undefined}
    >
      {/* Drag Handle - swipeable area (always works, but entire drawer works when minimized) */}
      <div
        className={cn(
          "flex flex-col items-center pt-3 pb-2 shrink-0",
          // Only show grab cursor on handle when not minimized (whole drawer has it when minimized)
          !isMinimized && "cursor-grab active:cursor-grabbing touch-none"
        )}
        onTouchStart={!isMinimized ? handleTouchStart : undefined}
        onTouchEnd={!isMinimized ? handleTouchEnd : undefined}
        onClick={!isMinimized ? handleToggle : undefined}
      >
        <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
      </div>

      {/* Turn Status - always visible */}
      <div className="px-4 pb-2 text-sm text-center shrink-0">
        <span
          className={cn(
            "font-medium",
            isYourTurn ? "text-primary" : "text-muted-foreground"
          )}
        >
          {turnPhaseText}
        </span>
        {selectedCardIds.size > 0 && (
          <span className="ml-2 text-muted-foreground">
            ({selectedCardIds.size} selected)
          </span>
        )}
      </div>

      {/* Hand + Piles Area - scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0 flex flex-col">
        {/* Hand - shown first/above */}
        <div className="mb-3">
          <HandDisplay
            cards={hand}
            selectedIds={selectedCardIds}
            onCardClick={onCardClick}
            size="auto"
            className="justify-center"
          />
        </div>

        {/* Piles row - below hand (only show when not minimized) */}
        {drawerState !== "minimized" && (
          <div className="flex gap-3 justify-center mt-auto">
            <DiscardPileDisplay
              topCard={topDiscard}
              size="sm"
              interactiveLabel={discardInteractiveLabel}
              isClickable={!!discardInteractiveLabel}
              onClick={handleDiscardClick}
            />
            {isYourTurn && (
              <StockPileDisplay
                size="sm"
                isClickable={availableActions.canDrawFromStock}
                onClick={handleStockClick}
              />
            )}
          </div>
        )}
      </div>

      {/* Action Bar - same component as desktop */}
      <ActionBar
        availableActions={availableActions}
        onAction={onAction}
        className="shrink-0"
      />
    </div>
  );
}
