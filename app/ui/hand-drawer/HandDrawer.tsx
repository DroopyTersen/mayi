import { useCallback, useMemo } from "react";
import { Drawer } from "vaul";
import { ChevronUp } from "lucide-react";
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
  /** Turn status text shown in the peek (e.g., "Your turn — Draw a card") */
  turnStatus?: string;
  /**
   * Whether it's the viewing player's turn — drives status text styling and
   * stock-pile visibility. Falls back to a derivation from `availableActions`
   * when omitted.
   */
  isYourTurn?: boolean;
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
  turnStatus,
  isYourTurn: isYourTurnProp,
  container,
}: HandDrawerProps) {
  // Fall back to deriving from available actions when the explicit prop isn't set.
  const isYourTurn =
    isYourTurnProp ??
    (availableActions.canDrawFromStock ||
      availableActions.canLayDown ||
      availableActions.canDiscard ||
      availableActions.canLayOff);

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

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      {!open && (
        <Drawer.Trigger asChild>
          <button
            type="button"
            aria-label="Open hand"
            className={cn(
              "inset-x-0 bottom-0 z-30",
              "rounded-t-2xl bg-background",
              "shadow-[0_-8px_24px_-8px_rgb(0_0_0/0.18),0_-2px_6px_-2px_rgb(0_0_0/0.08)]",
              "hover:bg-muted transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "[-webkit-tap-highlight-color:transparent]",
              container ? "absolute" : "fixed"
            )}
            style={{
              height: `calc(${MOBILE_HAND_PEEK_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="relative flex items-center justify-center px-4 pt-1 pb-3">
                {turnStatus && (
                  <span
                    className={cn(
                      "block text-center text-sm font-medium",
                      isYourTurn ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {turnStatus}
                  </span>
                )}
                <ChevronUp
                  className="absolute right-4 top-[calc(50%-4px)] -translate-y-1/2 size-4 text-muted-foreground"
                  aria-hidden
                />
              </div>

              <div className="h-[48px] overflow-hidden px-3 pb-2">
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
            // Scroll lives on the inner cards/piles area so the action bar at the
            // bottom isn't inside an overflow-y-auto container — taps on its
            // buttons (esp. Organize on the right edge) stay unambiguous.
            "max-h-[70vh]",
            container ? "absolute" : "fixed"
          )}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <Drawer.Handle className="!h-1.5 !w-12 !bg-muted-foreground/40 !opacity-100" />
          </div>

          <div className="px-4 pb-3 overflow-y-auto flex-1 min-h-0">
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
