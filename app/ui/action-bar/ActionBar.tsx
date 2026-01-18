import type { ComponentProps } from "react";
import { Button } from "~/shadcn/components/ui/button";
import { cn } from "~/shadcn/lib/utils";
import type {
  ActionAvailabilityState,
  AvailableActions,
} from "core/engine/game-engine.availability";
import type { UnavailabilityHint } from "core/engine/game-engine.types";
import { ActionInfoButton } from "./ActionInfoButton";

interface ActionBarProps {
  /** Available actions for the current player - from PlayerView.availableActions */
  availableActions: AvailableActions;
  /** Full action availability breakdown (for disabled actions and future hints) */
  actionStates?: ActionAvailabilityState[];
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
 * The visibility of each button is determined by `actionStates` when present,
 * falling back to `availableActions`. No game logic in this component.
 */
export function ActionBar({
  availableActions,
  actionStates,
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

  type ActionId = ActionAvailabilityState["id"];
  type ActionDisplayState = {
    shouldRender: boolean;
    disabled: boolean;
    label: string;
    status: ActionAvailabilityState["status"];
  };

  const actionStateMap = actionStates
    ? new Map<ActionId, ActionAvailabilityState>(
        actionStates.map((state) => [state.id, state])
      )
    : null;

  const getActionDisplayState = (
    actionId: ActionId,
    fallbackAvailable: boolean,
    fallbackLabel: string
  ): ActionDisplayState => {
    const state = actionStateMap?.get(actionId);
    if (!state) {
      return {
        shouldRender: fallbackAvailable,
        disabled: false,
        label: fallbackLabel,
        status: fallbackAvailable ? "available" : "hidden",
      };
    }

    if (state.status === "hidden") {
      return {
        shouldRender: false,
        disabled: false,
        label: state.label,
        status: state.status,
      };
    }

    return {
      shouldRender: state.status === "available",
      disabled: false,
      label: state.label,
      status: state.status,
    };
  };

  const hasAnyActionFromFlags =
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

  const hasAnyAction = actionStates
    ? actionStates.some((state) => state.status === "available") ||
      hasPendingMayIRequest
    : hasAnyActionFromFlags;

  const drawStockState = getActionDisplayState(
    "drawStock",
    canDrawFromStock,
    "Draw Card"
  );
  const pickUpDiscardState = getActionDisplayState(
    "pickUpDiscard",
    canDrawFromDiscard,
    "Pick Up Discard"
  );
  const layDownState = getActionDisplayState("layDown", canLayDown, "Lay Down");
  const layOffState = getActionDisplayState("layOff", canLayOff, "Lay Off");
  const swapJokerState = getActionDisplayState(
    "swapJoker",
    canSwapJoker,
    "Swap Joker"
  );
  const discardState = getActionDisplayState(
    "discard",
    canDiscard,
    "Discard"
  );
  const mayIState = getActionDisplayState("mayI", canMayI, "May I?");
  const allowMayIState = getActionDisplayState(
    "allowMayI",
    canAllowMayI,
    "Allow"
  );
  const claimMayIState = getActionDisplayState(
    "claimMayI",
    canClaimMayI,
    "Claim"
  );
  const reorderHandState = getActionDisplayState(
    "reorderHand",
    canReorderHand,
    "Organize"
  );

  const shouldAnimateDiscard =
    discardState.status === "available" && shouldNudgeDiscard;

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
      {drawStockState.shouldRender && (
        <Button
          onClick={
            drawStockState.disabled ? undefined : () => onAction("drawStock")
          }
          variant="default"
          size={buttonSize}
          disabled={drawStockState.disabled}
        >
          {drawStockState.label}
        </Button>
      )}
      {pickUpDiscardState.shouldRender && (
        <Button
          onClick={
            pickUpDiscardState.disabled
              ? undefined
              : () => onAction("pickUpDiscard")
          }
          variant="outline"
          size={buttonSize}
          disabled={pickUpDiscardState.disabled}
        >
          {pickUpDiscardState.label}
        </Button>
      )}

      {/* Action Phase - Lay Down */}
      {layDownState.shouldRender && (
        <Button
          onClick={layDownState.disabled ? undefined : () => onAction("layDown")}
          variant="default"
          size={buttonSize}
          disabled={layDownState.disabled}
        >
          {layDownState.label}
        </Button>
      )}

      {/* Action Phase - Lay Off (only when down) */}
      {layOffState.shouldRender && (
        <Button
          onClick={layOffState.disabled ? undefined : () => onAction("layOff")}
          variant="default"
          size={buttonSize}
          disabled={layOffState.disabled}
        >
          {layOffState.label}
        </Button>
      )}

      {/* Action Phase - Swap Joker (only when not down, runs with jokers exist) */}
      {swapJokerState.shouldRender && (
        <Button
          onClick={
            swapJokerState.disabled ? undefined : () => onAction("swapJoker")
          }
          variant="outline"
          size={buttonSize}
          disabled={swapJokerState.disabled}
        >
          {swapJokerState.label}
        </Button>
      )}

      {/* Discard - with nudge animation when player took an action and needs to discard */}
      {discardState.shouldRender && (
        <Button
          onClick={
            discardState.disabled ? undefined : () => onAction("discard")
          }
          variant="outline"
          size={buttonSize}
          className={cn(shouldAnimateDiscard && "animate-pulse")}
          disabled={discardState.disabled}
        >
          {discardState.label}
        </Button>
      )}

      {/* May I - when not your turn */}
      {mayIState.shouldRender && (
        <Button
          onClick={mayIState.disabled ? undefined : () => onAction("mayI")}
          variant="secondary"
          size={buttonSize}
          disabled={mayIState.disabled}
        >
          {mayIState.label}
        </Button>
      )}

      {/* May I pending - waiting for resolution */}
      {hasPendingMayIRequest && (
        <Button variant="secondary" size={buttonSize} disabled>
          Waiting...
        </Button>
      )}

      {/* May I Resolution - Allow/Claim */}
      {allowMayIState.shouldRender && (
        <Button
          onClick={
            allowMayIState.disabled ? undefined : () => onAction("allowMayI")
          }
          variant="outline"
          size={buttonSize}
          disabled={allowMayIState.disabled}
        >
          {allowMayIState.label}
        </Button>
      )}
      {claimMayIState.shouldRender && (
        <Button
          onClick={
            claimMayIState.disabled ? undefined : () => onAction("claimMayI")
          }
          variant="default"
          size={buttonSize}
          disabled={claimMayIState.disabled}
        >
          {claimMayIState.label}
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
      {reorderHandState.shouldRender && (
        <Button
          onClick={
            reorderHandState.disabled ? undefined : () => onAction("organize")
          }
          variant="ghost"
          size={organizeButtonSize}
          className="ml-2"
          disabled={reorderHandState.disabled}
        >
          {reorderHandState.label}
        </Button>
      )}
    </div>
  );
}
