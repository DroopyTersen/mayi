import type { PlayerView } from "~/party/protocol.types";
import type { Card } from "core/card/card.types";
import { SortableHandDisplay } from "~/ui/player-hand/SortableHandDisplay";
import { ActionBar } from "~/ui/action-bar/ActionBar";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import { StockPileDisplay } from "~/ui/game-table/StockPileDisplay";
import { cn } from "~/shadcn/lib/utils";

interface GameViewDesktopFooterProps {
  gameState: PlayerView;
  selectedCardIds: Set<string>;
  turnPhaseText: string;
  discardInteractiveLabel: "pickup" | "may-i" | undefined;
  onCardClick: (cardId: string) => void;
  onReorderHand: (newOrder: Card[]) => void;
  onAction: (action: string) => void;
}

/**
 * Desktop-only sticky footer with turn status, draw/discard piles, hand, and action bar.
 */
export function GameViewDesktopFooter({
  gameState,
  selectedCardIds,
  turnPhaseText,
  discardInteractiveLabel,
  onCardClick,
  onReorderHand,
  onAction,
}: GameViewDesktopFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 bg-background border-t">
      <div className="max-w-6xl mx-auto px-4 py-3">
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
                  ? () =>
                      onAction(
                        discardInteractiveLabel === "pickup"
                          ? "pickUpDiscard"
                          : "mayI"
                      )
                  : undefined
              }
            />
            {gameState.isYourTurn && (
              <StockPileDisplay
                size="lg"
                isClickable={gameState.availableActions.canDrawFromStock}
                onClick={() => onAction("drawStock")}
              />
            )}
          </div>

          {/* Hand Display - flexible, centered */}
          <div className="flex-1 min-w-0 basis-48">
            <SortableHandDisplay
              cards={gameState.yourHand}
              selectedIds={selectedCardIds}
              onCardClick={onCardClick}
              onReorder={onReorderHand}
              reorderEnabled={gameState.availableActions.canReorderHand}
              className="justify-center"
            />
          </div>
        </div>
      </div>

      {/* Action Bar - turn status piped in via leadingSlot */}
      <ActionBar
        availableActions={gameState.availableActions}
        actionStates={gameState.actionStates}
        unavailabilityHints={gameState.unavailabilityHints}
        onAction={onAction}
        leadingSlot={
          <>
            <span
              className={cn(
                "font-medium",
                gameState.isYourTurn
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {turnPhaseText}
            </span>
            {selectedCardIds.size > 0 && (
              <span className="text-muted-foreground ml-2">
                · {selectedCardIds.size} card
                {selectedCardIds.size !== 1 && "s"} selected
              </span>
            )}
          </>
        }
      />
    </div>
  );
}
