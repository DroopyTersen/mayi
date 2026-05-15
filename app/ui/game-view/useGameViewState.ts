import { useState, useCallback, useEffect } from "react";
import type { Card } from "core/card/card.types";
import type { ActiveDrawer } from "./game-view.types";
import type { GameAction } from "core/engine/game-action.command";
import {
  createDiscardIntent,
  createLayDownIntent,
  createLayOffIntent,
  createReorderHandIntent,
  createSwapJokerIntent,
  resolvePlayerActionIntent,
  type PlayerActionIntent,
  type PlayerActionResolution,
} from "./player-action.intent";

interface MeldSubmission {
  type: "set" | "run";
  cards: Array<{ id: string }>;
}

interface UseGameViewStateOptions {
  /** The player's current hand (for cleanup stale selections) */
  hand: Card[];
  /** Callback for game actions (passed to parent) */
  onAction?: (action: GameAction) => void;
}

export function getOnlySelectedCardId(
  selectedCardIds: ReadonlySet<string>
): string | null {
  if (selectedCardIds.size !== 1) {
    return null;
  }

  const result = selectedCardIds.values().next();
  return result.done ? null : result.value;
}

export function toggleSingleSelectedCard(
  selectedCardIds: ReadonlySet<string>,
  cardId: string
): Set<string> {
  if (selectedCardIds.has(cardId)) {
    return new Set();
  }

  return new Set([cardId]);
}

export interface UseGameViewStateReturn {
  // Selection state
  selectedCardIds: Set<string>;
  selectedCardId: string | null;

  // Drawer state
  activeDrawer: ActiveDrawer;
  isHandDrawerOpen: boolean;
  setIsHandDrawerOpen: (open: boolean) => void;
  activityCounter: number;

  // Card selection handlers
  handleCardClick: (cardId: string) => void;

  // Action handlers
  handleAction: (intent: PlayerActionIntent) => void;
  handleLayDown: (
    melds: Array<MeldSubmission>
  ) => void;
  handleLayOff: (
    cardId: string,
    meldId: string,
    position?: "start" | "end"
  ) => void;
  handleDiscard: (cardId: string) => void;
  handleSwapJoker: (
    meldId: string,
    jokerCardId: string,
    swapCardId: string
  ) => void;
  handleOrganize: (newOrder: Array<{ id: string }>) => void;
  handleReorderHand: (newOrder: Card[]) => void;
  closeDrawer: () => void;
}

/**
 * Manages GameView state: card selection, drawer visibility, and action handlers.
 * Separates behavior logic from presentation.
 */
export function useGameViewState({
  hand,
  onAction,
}: UseGameViewStateOptions): UseGameViewStateReturn {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set()
  );
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [isHandDrawerOpen, setIsHandDrawerOpen] = useState(false);
  const [activityCounter, setActivityCounter] = useState(0);

  const registerActivity = useCallback(() => {
    setActivityCounter((prev) => prev + 1);
  }, []);

  // Clean up stale selected card IDs when hand changes
  // This fixes the bug where "X cards selected" persists after discarding
  useEffect(() => {
    const handCardIds = new Set(hand.map((c) => c.id));
    setSelectedCardIds((prev) => {
      const cleaned = new Set([...prev].filter((id) => handCardIds.has(id)));
      // Only update if there's a difference to avoid infinite loops
      if (cleaned.size !== prev.size) {
        return cleaned;
      }
      return prev;
    });
  }, [hand]);

  // Toggle single-card selection
  const handleCardClick = useCallback((cardId: string) => {
    registerActivity();
    setSelectedCardIds((prev) => toggleSingleSelectedCard(prev, cardId));
  }, [registerActivity]);

  const applyResolution = useCallback(
    (
      resolution: PlayerActionResolution,
      options: { closeDrawer?: boolean } = {}
    ) => {
      if (resolution.kind === "openDrawer") {
        setIsHandDrawerOpen(false);
        setActiveDrawer(resolution.drawer);
        return;
      }

      if (resolution.kind === "invalid") {
        return;
      }

      if (options.closeDrawer) {
        setIsHandDrawerOpen(false);
        setActiveDrawer(null);
      }

      onAction?.(resolution.action);
    },
    [onAction]
  );

  // Handle actions from ActionBar
  const handleAction = useCallback(
    (intent: PlayerActionIntent) => {
      registerActivity();
      applyResolution(resolvePlayerActionIntent(intent, selectedCardIds), {
        closeDrawer: intent.type === "discard",
      });
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  // Close the active drawer
  const closeDrawer = useCallback(() => {
    registerActivity();
    setActiveDrawer(null);
  }, [registerActivity]);

  // Handle lay down action
  const handleLayDown = useCallback(
    (melds: Array<MeldSubmission>) => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(
          createLayDownIntent(
            melds.map((m) => ({
              type: m.type,
              cardIds: m.cards.map((c) => c.id),
            }))
          ),
          selectedCardIds
        ),
        { closeDrawer: true }
      );
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  // Handle lay off action
  const handleLayOff = useCallback(
    (cardId: string, meldId: string, position?: "start" | "end") => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(
          createLayOffIntent(cardId, meldId, position),
          selectedCardIds
        )
      );
      // Don't close - user might want to lay off more cards
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  // Handle discard action
  const handleDiscard = useCallback(
    (cardId: string) => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(createDiscardIntent(cardId), selectedCardIds),
        { closeDrawer: true }
      );
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  // Handle swap joker action
  const handleSwapJoker = useCallback(
    (meldId: string, jokerCardId: string, swapCardId: string) => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(
          createSwapJokerIntent(meldId, jokerCardId, swapCardId),
          selectedCardIds
        ),
        { closeDrawer: true }
      );
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  // Handle organize hand (reorder)
  const handleOrganize = useCallback(
    (newOrder: Array<{ id: string }>) => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(
          createReorderHandIntent(newOrder),
          selectedCardIds
        ),
        { closeDrawer: true }
      );
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  const handleReorderHand = useCallback(
    (newOrder: Card[]) => {
      registerActivity();
      applyResolution(
        resolvePlayerActionIntent(
          createReorderHandIntent(newOrder),
          selectedCardIds
        )
      );
    },
    [applyResolution, registerActivity, selectedCardIds]
  );

  const setHandDrawerOpen = useCallback(
    (open: boolean) => {
      registerActivity();
      setIsHandDrawerOpen(open);
    },
    [registerActivity]
  );

  return {
    selectedCardIds,
    selectedCardId: getOnlySelectedCardId(selectedCardIds),
    activeDrawer,
    isHandDrawerOpen,
    setIsHandDrawerOpen: setHandDrawerOpen,
    activityCounter,
    handleCardClick,
    handleAction,
    handleLayDown,
    handleLayOff,
    handleDiscard,
    handleSwapJoker,
    handleOrganize,
    handleReorderHand,
    closeDrawer,
  };
}
