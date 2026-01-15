import { useState, useCallback, useEffect } from "react";
import type { Card } from "core/card/card.types";
import type { ActiveDrawer } from "./game-view.types";

interface MeldSubmission {
  type: "set" | "run";
  cards: Array<{ id: string }>;
}

interface UseGameViewStateOptions {
  /** The player's current hand (for cleanup stale selections) */
  hand: Card[];
  /** Callback for game actions (passed to parent) */
  onAction?: (action: string, payload?: unknown) => void;
}

export interface UseGameViewStateReturn {
  // Selection state
  selectedCardIds: Set<string>;

  // Drawer state
  activeDrawer: ActiveDrawer;
  isHandDrawerOpen: boolean;
  setIsHandDrawerOpen: (open: boolean) => void;

  // Card selection handlers
  handleCardClick: (cardId: string) => void;

  // Action handlers
  handleAction: (action: string) => void;
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

  // Toggle card selection
  const handleCardClick = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  // Handle actions from ActionBar
  const handleAction = useCallback(
    (action: string) => {
      // Open drawer for view-based actions
      if (
        action === "layDown" ||
        action === "layOff" ||
        action === "discard" ||
        action === "swapJoker" ||
        action === "organize"
      ) {
        setIsHandDrawerOpen(false);
        setActiveDrawer(action);
        return;
      }
      // Pass through other actions (drawStock, pickUpDiscard, mayI, skip)
      onAction?.(action, { selectedCardIds: Array.from(selectedCardIds) });
    },
    [onAction, selectedCardIds]
  );

  // Close the active drawer
  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  // Handle lay down action
  const handleLayDown = useCallback(
    (melds: Array<MeldSubmission>) => {
      onAction?.("layDown", {
        melds: melds.map((m) => ({
          type: m.type,
          cardIds: m.cards.map((c) => c.id),
        })),
      });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle lay off action
  const handleLayOff = useCallback(
    (cardId: string, meldId: string, position?: "start" | "end") => {
      onAction?.("layOff", { cardId, meldId, position });
      // Don't close - user might want to lay off more cards
    },
    [onAction]
  );

  // Handle discard action
  const handleDiscard = useCallback(
    (cardId: string) => {
      onAction?.("discard", { selectedCardIds: [cardId] });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle swap joker action
  const handleSwapJoker = useCallback(
    (meldId: string, jokerCardId: string, swapCardId: string) => {
      onAction?.("swapJoker", { meldId, jokerCardId, swapCardId });
      setActiveDrawer(null);
    },
    [onAction]
  );

  // Handle organize hand (reorder)
  const handleOrganize = useCallback(
    (newOrder: Array<{ id: string }>) => {
      onAction?.("reorderHand", { cardIds: newOrder.map((c) => c.id) });
      setActiveDrawer(null);
    },
    [onAction]
  );

  return {
    selectedCardIds,
    activeDrawer,
    isHandDrawerOpen,
    setIsHandDrawerOpen,
    handleCardClick,
    handleAction,
    handleLayDown,
    handleLayOff,
    handleDiscard,
    handleSwapJoker,
    handleOrganize,
    closeDrawer,
  };
}
