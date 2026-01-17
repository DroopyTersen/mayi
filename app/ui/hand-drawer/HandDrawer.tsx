import { useCallback, useMemo, useRef } from "react";
import { Drawer } from "vaul";
import type { Card } from "core/card/card.types";
import type {
  ActionAvailabilityState,
  AvailableActions,
} from "core/engine/game-engine.availability";
import type { UnavailabilityHint } from "core/engine/game-engine.types";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { StockPileDisplay } from "~/ui/game-table/StockPileDisplay";
import { ActionBar } from "~/ui/action-bar/ActionBar";
import { getDiscardInteractiveLabel } from "~/ui/game-view/game-view.utils";
import { cn } from "~/shadcn/lib/utils";

export const MOBILE_HAND_PEEK_HEIGHT_PX = 104;

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
  /** Full action availability breakdown (for disabled actions and future hints) */
  actionStates?: ActionAvailabilityState[];
  /** Hints explaining why certain actions are unavailable */
  unavailabilityHints?: UnavailabilityHint[];
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer opens/closes */
  onOpenChange: (open: boolean) => void;
  /** Optional container element for Portal (useful for storybook/testing) */
  container?: HTMLElement | null;
}

/**
 * Bottom drawer for the player's hand on mobile using Vaul's default open/close behavior.
 * The "peek" effect is implemented as a fixed `Drawer.Trigger` bar (not snap points).
 */
export function HandDrawer({
  hand,
  topDiscard,
  selectedCardIds,
  onCardClick,
  onAction,
  availableActions,
  actionStates,
  unavailabilityHints = [],
  open,
  onOpenChange,
  container,
}: HandDrawerProps) {
  const peekHandleGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    triggered: boolean;
  } | null>(null);

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

  const handlePeekHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;

      peekHandleGesture.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        triggered: false,
      };

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePeekHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const gesture = peekHandleGesture.current;
      if (!gesture) return;
      if (gesture.pointerId !== e.pointerId) return;
      if (gesture.triggered) return;

      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;

      // Open on an intentional upward swipe. Keep thresholds forgiving.
      const SWIPE_OPEN_THRESHOLD_PX = 24;
      const HORIZONTAL_TOLERANCE_PX = 80;
      const isMostlyVertical = Math.abs(dy) > Math.abs(dx);
      const isUpSwipe =
        dy <= -SWIPE_OPEN_THRESHOLD_PX &&
        Math.abs(dx) <= HORIZONTAL_TOLERANCE_PX &&
        isMostlyVertical;

      if (isUpSwipe) {
        gesture.triggered = true;
        onOpenChange(true);
      }
    },
    [onOpenChange]
  );

  const handlePeekHandlePointerUpOrCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const gesture = peekHandleGesture.current;
      if (!gesture) return;
      if (gesture.pointerId !== e.pointerId) return;
      peekHandleGesture.current = null;
    },
    []
  );

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      {!open && (
        <Drawer.Trigger asChild>
          <button
            type="button"
            aria-label="Open hand"
            className={cn(
              "inset-x-0 bottom-0 z-30",
              "border-t bg-background/95 backdrop-blur",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              container ? "absolute" : "fixed"
            )}
            style={{
              height: `calc(${MOBILE_HAND_PEEK_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
            }}
          >
            <div className="max-w-6xl mx-auto px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
              <div
                className="flex justify-center py-2"
                style={{ touchAction: "none" }}
                onPointerDown={handlePeekHandlePointerDown}
                onPointerMove={handlePeekHandlePointerMove}
                onPointerUp={handlePeekHandlePointerUpOrCancel}
                onPointerCancel={handlePeekHandlePointerUpOrCancel}
              >
                <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
              </div>

              <div className="h-[48px] overflow-hidden">
                <HandDisplay
                  cards={hand}
                  size="sm"
                  className="justify-center items-start"
                />
              </div>
            </div>
          </button>
        </Drawer.Trigger>
      )}

      <Drawer.Portal container={container}>
        <Drawer.Overlay
          className={cn(
            "bg-black/50 z-40",
            container ? "absolute inset-0" : "fixed inset-0"
          )}
        />

        <Drawer.Content
          className={cn(
            "inset-x-0 bottom-0 z-50 flex flex-col",
            "bg-background border-t rounded-t-xl",
            "outline-none",
            // Keep the drawer compact; let content determine height (with a sane max).
            "max-h-[70vh] overflow-y-auto",
            container ? "absolute" : "fixed"
          )}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <Drawer.Handle className="!h-1.5 !w-12 !bg-muted-foreground/40 !opacity-100" />
          </div>

          <div className="px-4 pb-3">
            <HandDisplay
              cards={hand}
              selectedIds={selectedCardIds}
              onCardClick={onCardClick}
              size="auto"
              className="justify-center"
            />

            {selectedCardIds.size > 0 && (
              <div className="mt-2 text-center text-sm text-muted-foreground">
                {selectedCardIds.size} card
                {selectedCardIds.size !== 1 && "s"} selected
              </div>
            )}

            <div className="flex gap-3 justify-center mt-4">
              <DiscardPileDisplay
                topCard={topDiscard}
                size="sm"
                interactiveLabel={discardInteractiveLabel}
                isClickable={!!discardInteractiveLabel}
                onClick={discardInteractiveLabel ? handleDiscardClick : undefined}
              />
              {isYourTurn && (
                <StockPileDisplay
                  size="sm"
                  isClickable={availableActions.canDrawFromStock}
                  onClick={handleStockClick}
                />
              )}
            </div>
          </div>

          <div
            className="shrink-0"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <ActionBar
              availableActions={availableActions}
              actionStates={actionStates}
              unavailabilityHints={unavailabilityHints}
              onAction={onAction}
              touchOptimized
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
