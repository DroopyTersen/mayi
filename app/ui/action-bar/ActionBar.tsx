import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import type { AvailableActions } from "core/engine/game-engine.availability";

interface ActionBarProps {
  /** Available actions for the current player - from PlayerView.availableActions */
  availableActions: AvailableActions;
  /** Called when player performs an action */
  onAction: (action: string) => void;
  className?: string;
}

/**
 * Action bar showing available game actions based on centralized game logic.
 *
 * The visibility of each button is determined by `availableActions` which comes
 * from the game engine via PlayerView. No game logic in this component.
 */
export function ActionBar({
  availableActions,
  onAction,
  className,
}: ActionBarProps) {
  const {
    canDrawFromStock,
    canDrawFromDiscard,
    canLayDown,
    canLayOff,
    canSwapJoker,
    canDiscard,
    canMayI,
    canAllowMayI,
    canClaimMayI,
    canReorderHand,
  } = availableActions;

  // Check if any main action is available (for showing waiting message)
  const hasAnyAction =
    canDrawFromStock ||
    canDrawFromDiscard ||
    canLayDown ||
    canLayOff ||
    canSwapJoker ||
    canDiscard ||
    canMayI ||
    canAllowMayI ||
    canClaimMayI;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 p-3 bg-muted/50 border-t",
        className
      )}
    >
      {/* Draw Phase */}
      {canDrawFromStock && (
        <Button onClick={() => onAction("drawStock")} variant="default">
          Draw Card
        </Button>
      )}
      {canDrawFromDiscard && (
        <Button onClick={() => onAction("pickUpDiscard")} variant="outline">
          Pick Up Discard
        </Button>
      )}

      {/* Action Phase - Lay Down */}
      {canLayDown && (
        <Button onClick={() => onAction("layDown")} variant="default">
          Lay Down
        </Button>
      )}

      {/* Action Phase - Lay Off (only when down) */}
      {canLayOff && (
        <Button onClick={() => onAction("layOff")} variant="default">
          Lay Off
        </Button>
      )}

      {/* Action Phase - Swap Joker (only when not down, runs with jokers exist) */}
      {canSwapJoker && (
        <Button onClick={() => onAction("swapJoker")} variant="outline">
          Swap Joker
        </Button>
      )}

      {/* Discard */}
      {canDiscard && (
        <Button onClick={() => onAction("discard")} variant="outline">
          Discard
        </Button>
      )}

      {/* May I - when not your turn */}
      {canMayI && (
        <Button onClick={() => onAction("mayI")} variant="secondary">
          May I?
        </Button>
      )}

      {/* May I Resolution - Allow/Claim */}
      {canAllowMayI && (
        <Button onClick={() => onAction("allowMayI")} variant="outline">
          Allow
        </Button>
      )}
      {canClaimMayI && (
        <Button onClick={() => onAction("claimMayI")} variant="default">
          Claim
        </Button>
      )}

      {/* Waiting message when no actions available and not your turn */}
      {!hasAnyAction && (
        <span className="text-sm text-muted-foreground">
          Waiting for other players...
        </span>
      )}

      {/* Organize available during round for any player (free action) */}
      {canReorderHand && (
        <Button
          onClick={() => onAction("organize")}
          variant="ghost"
          size="sm"
          className="ml-2"
        >
          Organize
        </Button>
      )}
    </div>
  );
}
