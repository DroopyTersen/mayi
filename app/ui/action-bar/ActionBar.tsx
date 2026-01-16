import type { ComponentProps } from "react";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import type { AvailableActions } from "core/engine/game-engine.availability";
import type { UnavailabilityHint } from "core/engine/game-engine.hints";
import { ActionInfoButton } from "./ActionInfoButton";

interface ActionBarProps {
  /** Available actions for the current player - from PlayerView.availableActions */
  availableActions: AvailableActions;
  /** Hints explaining why certain actions are unavailable */
  unavailabilityHints?: UnavailabilityHint[];
  /** Called when player performs an action */
  onAction: (action: string) => void;
  /** Improves tap reliability in touch contexts like drawers */
  touchOptimized?: boolean;
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
  unavailabilityHints = [],
  onAction,
  touchOptimized = false,
  className,
}: ActionBarProps) {
  type ButtonSize = ComponentProps<typeof Button>["size"];
  const buttonSize: ButtonSize = touchOptimized ? "mobile" : undefined;
  const organizeButtonSize: ButtonSize = touchOptimized ? "mobile" : "sm";
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
    hasPendingMayIRequest,
    shouldNudgeDiscard,
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
    canClaimMayI ||
    hasPendingMayIRequest;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 p-3 bg-muted/50 border-t",
        touchOptimized && "touch-manipulation",
        className
      )}
      data-vaul-no-drag={touchOptimized ? "" : undefined}
    >
      {/* Draw Phase */}
      {canDrawFromStock && (
        <Button
          onClick={() => onAction("drawStock")}
          variant="default"
          size={buttonSize}
        >
          Draw Card
        </Button>
      )}
      {canDrawFromDiscard && (
        <Button
          onClick={() => onAction("pickUpDiscard")}
          variant="outline"
          size={buttonSize}
        >
          Pick Up Discard
        </Button>
      )}

      {/* Action Phase - Lay Down */}
      {canLayDown && (
        <Button
          onClick={() => onAction("layDown")}
          variant="default"
          size={buttonSize}
        >
          Lay Down
        </Button>
      )}

      {/* Action Phase - Lay Off (only when down) */}
      {canLayOff && (
        <Button
          onClick={() => onAction("layOff")}
          variant="default"
          size={buttonSize}
        >
          Lay Off
        </Button>
      )}

      {/* Action Phase - Swap Joker (only when not down, runs with jokers exist) */}
      {canSwapJoker && (
        <Button
          onClick={() => onAction("swapJoker")}
          variant="outline"
          size={buttonSize}
        >
          Swap Joker
        </Button>
      )}

      {/* Discard - with nudge animation when player took an action and needs to discard */}
      {canDiscard && (
        <Button
          onClick={() => onAction("discard")}
          variant="outline"
          size={buttonSize}
          className={cn(shouldNudgeDiscard && "animate-pulse")}
        >
          Discard
        </Button>
      )}

      {/* May I - when not your turn */}
      {canMayI && (
        <Button
          onClick={() => onAction("mayI")}
          variant="secondary"
          size={buttonSize}
        >
          May I?
        </Button>
      )}

      {/* May I pending - waiting for resolution */}
      {hasPendingMayIRequest && (
        <Button variant="secondary" size={buttonSize} disabled>
          Waiting...
        </Button>
      )}

      {/* May I Resolution - Allow/Claim */}
      {canAllowMayI && (
        <Button
          onClick={() => onAction("allowMayI")}
          variant="outline"
          size={buttonSize}
        >
          Allow
        </Button>
      )}
      {canClaimMayI && (
        <Button
          onClick={() => onAction("claimMayI")}
          variant="default"
          size={buttonSize}
        >
          Claim
        </Button>
      )}

      {/* Waiting message when no actions available and not your turn */}
      {!hasAnyAction && (
        <span className="text-sm text-muted-foreground">
          Waiting for other players...
        </span>
      )}

      {/* Info button for unavailability hints */}
      <ActionInfoButton hints={unavailabilityHints} />

      {/* Organize available during round for any player (free action) */}
      {canReorderHand && (
        <Button
          onClick={() => onAction("organize")}
          variant="ghost"
          size={organizeButtonSize}
          className="ml-2"
        >
          Organize
        </Button>
      )}
    </div>
  );
}
