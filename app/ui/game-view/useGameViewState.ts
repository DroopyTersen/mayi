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

type ActionDrawer = Exclude<ActiveDrawer, null>;

export type GameViewActionResolution =
  | {
      kind: "openDrawer";
      drawer: ActionDrawer;
    }
  | {
      kind: "sendAction";
      action: string;
      payload?: { selectedCardIds: string[] };
    };

const ACTION_DRAWERS: ReadonlySet<ActionDrawer> = new Set([
  "layDown",
  "layOff",
  "discard",
  "swapJoker",
  "organize",
]);

function isActionDrawer(action: string): action is ActionDrawer {
  return ACTION_DRAWERS.has(action as ActionDrawer);
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

export function resolveGameViewAction(
  action: string,
  selectedCardIds: ReadonlySet<string>
): GameViewActionResolution {
  if (action === "discard") {
    const cardId = getOnlySelectedCardId(selectedCardIds);
    if (cardId) {
      return {
        kind: "sendAction",
        action: "discard",
        payload: { selectedCardIds: [cardId] },
      };
    }
  }

  if (isActionDrawer(action)) {
    return { kind: "openDrawer", drawer: action };
  }

  return {
    kind: "sendAction",
    action,
    payload: { selectedCardIds: Array.from(selectedCardIds) },
  };
}

export function createReorderHandPayload(
  newOrder: Array<{ id: string }>
) {
  return { cardIds: newOrder.map((card) => card.id) };
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

  // Handle actions from ActionBar
  const handleAction = useCallback(
    (action: string) => {
      registerActivity();
      const resolution = resolveGameViewAction(action, selectedCardIds);

      if (resolution.kind === "openDrawer") {
        setIsHandDrawerOpen(false);
        setActiveDrawer(resolution.drawer);
        return;
      }

      if (action === "discard") {
        setIsHandDrawerOpen(false);
        setActiveDrawer(null);
      }

      onAction?.(resolution.action, resolution.payload);
    },
    [onAction, registerActivity, selectedCardIds]
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
      onAction?.("layDown", {
        melds: melds.map((m) => ({
          type: m.type,
          cardIds: m.cards.map((c) => c.id),
        })),
      });
      setActiveDrawer(null);
    },
    [onAction, registerActivity]
  );

  // Handle lay off action
  const handleLayOff = useCallback(
    (cardId: string, meldId: string, position?: "start" | "end") => {
      registerActivity();
      onAction?.("layOff", { cardId, meldId, position });
      // Don't close - user might want to lay off more cards
    },
    [onAction, registerActivity]
  );

  // Handle discard action
  const handleDiscard = useCallback(
    (cardId: string) => {
      registerActivity();
      onAction?.("discard", { selectedCardIds: [cardId] });
      setActiveDrawer(null);
    },
    [onAction, registerActivity]
  );

  // Handle swap joker action
  const handleSwapJoker = useCallback(
    (meldId: string, jokerCardId: string, swapCardId: string) => {
      registerActivity();
      onAction?.("swapJoker", { meldId, jokerCardId, swapCardId });
      setActiveDrawer(null);
    },
    [onAction, registerActivity]
  );

  // Handle organize hand (reorder)
  const handleOrganize = useCallback(
    (newOrder: Array<{ id: string }>) => {
      registerActivity();
      onAction?.("reorderHand", createReorderHandPayload(newOrder));
      setActiveDrawer(null);
    },
    [onAction, registerActivity]
  );

  const handleReorderHand = useCallback(
    (newOrder: Card[]) => {
      registerActivity();
      onAction?.("reorderHand", createReorderHandPayload(newOrder));
    },
    [onAction, registerActivity]
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
