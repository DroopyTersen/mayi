import type { PlayerView } from "~/party/protocol.types";
import { HandDisplay } from "~/ui/player-hand/HandDisplay";
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
  onAction,
}: GameViewDesktopFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-3">
        {/* Turn status indicator */}
        <div className="text-sm text-center">
          <span
            className={cn(
              "font-medium",
              gameState.isYourTurn ? "text-primary" : "text-muted-foreground"
            )}
          >
            {turnPhaseText}
          </span>
          {selectedCardIds.size > 0 && (
            <span className="text-muted-foreground ml-3">
              · {selectedCardIds.size} card
              {selectedCardIds.size !== 1 && "s"} selected
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
            <HandDisplay
              cards={gameState.yourHand}
              selectedIds={selectedCardIds}
              onCardClick={onCardClick}
              size="auto"
              className="justify-center"
            />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar
        availableActions={gameState.availableActions}
        onAction={onAction}
      />
    </div>
  );
}
