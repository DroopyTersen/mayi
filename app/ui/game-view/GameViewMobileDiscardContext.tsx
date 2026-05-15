import type { Card } from "core/card/card.types";
import type { PlayerView } from "~/party/protocol.types";
import { DiscardPileDisplay } from "~/ui/game-table/DiscardPileDisplay";
import type { PlayerActionIntent } from "./player-action.intent";

type DiscardInteractiveLabel = "pickup" | "may-i" | undefined;

export const MOBILE_DISCARD_CONTEXT_HAND_THRESHOLD = 6;

export function shouldShowMobileDiscardContext(gameState: PlayerView): boolean {
  if (!gameState.topDiscard) return false;
  return (
    gameState.youAreDown ||
    gameState.yourHand.length <= MOBILE_DISCARD_CONTEXT_HAND_THRESHOLD
  );
}

interface GameViewMobileDiscardContextProps {
  topDiscard: Card | null;
  interactiveLabel: DiscardInteractiveLabel;
  onAction: (intent: PlayerActionIntent) => void;
}

export function GameViewMobileDiscardContext({
  topDiscard,
  interactiveLabel,
  onAction,
}: GameViewMobileDiscardContextProps) {
  if (!topDiscard) return null;

  const handleClick = interactiveLabel
    ? () =>
        onAction(
          interactiveLabel === "pickup"
            ? { type: "pickUpDiscard" }
            : { type: "mayI" }
        )
    : undefined;

  return (
    <div
      data-testid="mobile-discard-context"
      className="mb-3 flex justify-center lg:hidden"
    >
      <DiscardPileDisplay
        topCard={topDiscard}
        size="sm"
        interactiveLabel={interactiveLabel}
        isClickable={Boolean(interactiveLabel)}
        onClick={handleClick}
        dimWhenDisabled={false}
      />
    </div>
  );
}
