import { useState, useCallback, useMemo } from "react";
import { Drawer } from "vaul";
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
  /** Currently selected card IDs */
  selectedCardIds: Set<string>;
  /** Callback when a card is clicked */
  onCardClick: (cardId: string) => void;
  /** Callback when an action is performed */
  onAction: (action: string) => void;
  /** Available actions - drives all button visibility and interactions */
  availableActions: AvailableActions;
  /** Optional container element for Portal (useful for storybook/testing) */
  container?: HTMLElement | null;
}

// Snap points: minimized (peek cards), half (comfortable view), expanded (full + actions)
const SNAP_POINTS = ["85px", "50%", 0.9] as const;
type SnapPoint = (typeof SNAP_POINTS)[number];

/**
 * Bottom drawer for the player's hand on mobile using Vaul snap points.
 *
 * Three states:
 * - Minimized (85px): Cards peek out, not interactive. Tap/swipe to expand.
 * - Half (50%): Full hand view with piles, scrollable, interactive.
 * - Expanded (90%): Full view with action bar visible.
 *
 * Background overlay appears at half+ and tapping it minimizes the drawer.
 */
export function HandDrawer({
  hand,
  topDiscard,
  selectedCardIds,
  onCardClick,
  onAction,
  availableActions,
  container,
}: HandDrawerProps) {
  const [snap, setSnap] = useState<SnapPoint | null>(SNAP_POINTS[0]);

  // Derive turn state from available actions
  const isYourTurn =
    availableActions.canDrawFromStock ||
    availableActions.canLayDown ||
    availableActions.canDiscard ||
    availableActions.canLayOff;

  // Interactive label for discard pile
  const discardInteractiveLabel = useMemo(
    () => getDiscardInteractiveLabel(availableActions),
    [availableActions]
  );

  // State checks
  const isMinimized = snap === SNAP_POINTS[0];
  const isHalfOrExpanded = snap === SNAP_POINTS[1] || snap === SNAP_POINTS[2];

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

  // Handle overlay click - minimize the drawer
  const handleOverlayClick = useCallback(() => {
    setSnap(SNAP_POINTS[0]);
  }, []);

  // Handle card click - only if not minimized
  const handleCardClick = useCallback(
    (cardId: string) => {
      if (!isMinimized) {
        onCardClick(cardId);
      }
    },
    [isMinimized, onCardClick]
  );

  return (
    <Drawer.Root
      open={true}
      snapPoints={SNAP_POINTS as unknown as (string | number)[]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap as (snap: string | number | null) => void}
      fadeFromIndex={1}
      modal={false}
      dismissible={false}
    >
      <Drawer.Portal container={container}>
        {/* Overlay - only visible at half+ */}
        {isHalfOrExpanded && (
          <div
            className={cn(
              "bg-black/40 z-40",
              container ? "absolute inset-0" : "fixed inset-0"
            )}
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}

        <Drawer.Content
          className={cn(
            "inset-x-0 bottom-0 z-50 flex flex-col",
            "bg-background border-t rounded-t-xl",
            "outline-none",
            "h-full max-h-[97%]",
            container ? "absolute" : "fixed"
          )}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
          </div>

          {/* Hand + Piles Area - scrollable content */}
          <div
            className={cn(
              "flex-1 overflow-y-auto px-4 pb-2 min-h-0 flex flex-col",
              // Disable pointer events when minimized
              isMinimized && "pointer-events-none"
            )}
          >
            {/* Hand Display */}
            <div className="mb-3">
              <HandDisplay
                cards={hand}
                selectedIds={isMinimized ? new Set() : selectedCardIds}
                onCardClick={handleCardClick}
                size="auto"
                className="justify-center"
              />
            </div>

            {/* Selection indicator - only when not minimized */}
            {!isMinimized && selectedCardIds.size > 0 && (
              <div className="text-center text-sm text-muted-foreground mb-2">
                {selectedCardIds.size} card{selectedCardIds.size !== 1 && "s"} selected
              </div>
            )}

            {/* Piles row - only show when not minimized */}
            {isHalfOrExpanded && (
              <div className="flex gap-3 justify-center mt-auto pt-2">
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

          {/* Action Bar - only when half or expanded */}
          {isHalfOrExpanded && (
            <ActionBar
              availableActions={availableActions}
              onAction={onAction}
              className="shrink-0"
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
