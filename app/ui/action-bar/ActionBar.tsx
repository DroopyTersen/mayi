import type { ComponentProps, ReactNode } from "react";
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
  /** Optional content rendered at the leading edge (e.g. turn status text on desktop) */
  leadingSlot?: ReactNode;
  className?: string;
}

type ActionId = ActionAvailabilityState["id"];
type ButtonSize = ComponentProps<typeof Button>["size"];
type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ActionDisplayState = {
  shouldRender: boolean;
  label: string;
  status: ActionAvailabilityState["status"];
};
type ActionDisplayConfig = {
  id: ActionId;
  action: string;
  availableFlag: AvailableActionFlag;
  label: string;
  variant: ButtonVariant;
};
type ActionDisplay = ActionDisplayConfig & {
  size: ButtonSize;
  className?: string;
  state: ActionDisplayState;
};
type AvailableActionFlag = keyof Pick<
  AvailableActions,
  | "canDrawFromStock"
  | "canDrawFromDiscard"
  | "canLayDown"
  | "canLayOff"
  | "canSwapJoker"
  | "canDiscard"
  | "canMayI"
  | "canAllowMayI"
  | "canClaimMayI"
  | "canReorderHand"
>;

const MAIN_ACTION_DEFINITIONS: ActionDisplayConfig[] = [
  {
    id: "drawStock",
    action: "drawStock",
    availableFlag: "canDrawFromStock",
    label: "Draw Card",
    variant: "outline",
  },
  {
    id: "pickUpDiscard",
    action: "pickUpDiscard",
    availableFlag: "canDrawFromDiscard",
    label: "Pick Up Discard",
    variant: "outline",
  },
  {
    id: "layDown",
    action: "layDown",
    availableFlag: "canLayDown",
    label: "Lay Down",
    variant: "outline",
  },
  {
    id: "layOff",
    action: "layOff",
    availableFlag: "canLayOff",
    label: "Lay Off",
    variant: "outline",
  },
  {
    id: "swapJoker",
    action: "swapJoker",
    availableFlag: "canSwapJoker",
    label: "Swap Joker",
    variant: "outline",
  },
  {
    id: "discard",
    action: "discard",
    availableFlag: "canDiscard",
    label: "Discard",
    variant: "default",
  },
  {
    id: "mayI",
    action: "mayI",
    availableFlag: "canMayI",
    label: "May I?",
    variant: "outline",
  },
];

const MAY_I_RESOLUTION_ACTION_DEFINITIONS: ActionDisplayConfig[] = [
  {
    id: "allowMayI",
    action: "allowMayI",
    availableFlag: "canAllowMayI",
    label: "Allow",
    variant: "outline",
  },
  {
    id: "claimMayI",
    action: "claimMayI",
    availableFlag: "canClaimMayI",
    label: "Claim",
    variant: "outline",
  },
];

const TURN_ACTION_DEFINITIONS = [
  ...MAIN_ACTION_DEFINITIONS,
  ...MAY_I_RESOLUTION_ACTION_DEFINITIONS,
];

const REORDER_HAND_ACTION_DEFINITION: ActionDisplayConfig = {
  id: "reorderHand",
  action: "organize",
  availableFlag: "canReorderHand",
  label: "Organize",
  variant: "ghost",
};

function getActionDisplayState(
  actionStateMap: Map<ActionId, ActionAvailabilityState> | null,
  actionId: ActionId,
  fallbackAvailable: boolean,
  fallbackLabel: string
): ActionDisplayState {
  const state = actionStateMap?.get(actionId);
  if (!state) {
    return {
      shouldRender: fallbackAvailable,
      label: fallbackLabel,
      status: fallbackAvailable ? "available" : "hidden",
    };
  }

  return {
    shouldRender: state.status === "available",
    label: state.label,
    status: state.status,
  };
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
  leadingSlot,
  className,
}: ActionBarProps) {
  const buttonSize: ButtonSize = touchOptimized ? "mobile" : undefined;
  const organizeButtonSize: ButtonSize = touchOptimized ? "mobile" : "sm";
  const { hasPendingMayIRequest, shouldNudgeDiscard } = availableActions;

  const actionStateMap = actionStates
    ? new Map<ActionId, ActionAvailabilityState>(
        actionStates.map((state) => [state.id, state])
      )
    : null;

  const makeActionDisplay = ({
    definition,
    size,
    className,
  }: {
    definition: ActionDisplayConfig;
    size: ButtonSize;
    className?: string;
  }): ActionDisplay => ({
    ...definition,
    ...(className ? { className } : {}),
    size,
    state: getActionDisplayState(
      actionStateMap,
      definition.id,
      availableActions[definition.availableFlag],
      definition.label
    ),
  });

  const renderActionButton = (display: ActionDisplay) => {
    if (!display.state.shouldRender) {
      return null;
    }

    return (
      <Button
        key={display.id}
        onClick={() => onAction(display.action)}
        variant={display.variant}
        size={display.size}
        className={cn(
          display.className,
          display.id === "discard" &&
            display.state.status === "available" &&
            shouldNudgeDiscard &&
            "animate-pulse"
        )}
      >
        {display.state.label}
      </Button>
    );
  };

  const hasAnyActionFromFlags =
    TURN_ACTION_DEFINITIONS.some(
      (definition) => availableActions[definition.availableFlag]
    ) ||
    hasPendingMayIRequest;

  const hasAnyAction = actionStates
    ? actionStates.some((state) => state.status === "available") ||
      hasPendingMayIRequest
    : hasAnyActionFromFlags;

  const mainActions = MAIN_ACTION_DEFINITIONS.map((definition) =>
    makeActionDisplay({ definition, size: buttonSize })
  );
  const mayIResolutionActions = MAY_I_RESOLUTION_ACTION_DEFINITIONS.map(
    (definition) => makeActionDisplay({ definition, size: buttonSize })
  );
  const reorderHandAction = makeActionDisplay({
    definition: REORDER_HAND_ACTION_DEFINITION,
    size: organizeButtonSize,
    className: "ml-2",
  });

  return (
    <div
      className={cn(
        "relative flex items-center justify-center gap-2 p-3 bg-muted/50 border-t",
        touchOptimized && "touch-manipulation",
        className
      )}
      data-vaul-no-drag={touchOptimized ? "" : undefined}
    >
      {leadingSlot && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
          {leadingSlot}
        </div>
      )}

      {mainActions.map(renderActionButton)}

      {/* May I pending - waiting for resolution */}
      {hasPendingMayIRequest && (
        <Button variant="secondary" size={buttonSize} disabled>
          Waiting...
        </Button>
      )}

      {mayIResolutionActions.map(renderActionButton)}

      {/* Waiting message when no actions available and not your turn */}
      {!hasAnyAction && (
        <span className="text-sm text-muted-foreground">
          Waiting for other players...
        </span>
      )}

      {/* Info button for unavailability hints */}
      <ActionInfoButton hints={unavailabilityHints} />

      {renderActionButton(reorderHandAction)}
    </div>
  );
}
