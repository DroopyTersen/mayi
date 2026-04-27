import { useCallback, useState } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { getLayOffPositionDecision } from "~/ui/lay-off-view/lay-off-position";

interface InlineLayOffPlayer {
  name: string;
}

interface PendingLayOffPosition {
  cardId: string;
  meldId: string;
}

interface UseInlineLayOffOptions {
  enabled: boolean;
  selectedCardId: string | null;
  hand: Card[];
  onLayOff: (
    cardId: string,
    meldId: string,
    position?: "start" | "end"
  ) => void;
}

export interface InlineLayOffTargetProps {
  enabled: boolean;
  label: string;
  isPending: boolean;
  onSelect: () => void;
  testId: string;
}

export interface UseInlineLayOffReturn {
  isActive: boolean;
  prompt: PendingLayOffPosition | null;
  promptProps: {
    onSelect: (position: "start" | "end") => void;
    onCancel: () => void;
  };
  getMeldTargetProps: (
    meld: Meld,
    player?: InlineLayOffPlayer
  ) => InlineLayOffTargetProps;
}

function getTargetLabel(meld: Meld, player?: InlineLayOffPlayer): string {
  const ownerLabel = player ? `${player.name}'s` : "target";
  return `Lay off selected card to ${ownerLabel} ${meld.type}`;
}

function getSelectedCard(
  hand: Card[],
  selectedCardId: string | null
): Card | null {
  if (selectedCardId === null) {
    return null;
  }

  return hand.find((card) => card.id === selectedCardId) ?? null;
}

export function useInlineLayOff({
  enabled,
  selectedCardId,
  hand,
  onLayOff,
}: UseInlineLayOffOptions): UseInlineLayOffReturn {
  const [pendingPrompt, setPendingPrompt] =
    useState<PendingLayOffPosition | null>(null);
  const selectedCard = getSelectedCard(hand, selectedCardId);
  const isActive = enabled && selectedCard !== null;
  const prompt =
    isActive && pendingPrompt?.cardId === selectedCardId
      ? pendingPrompt
      : null;

  const selectMeld = useCallback(
    (meld: Meld) => {
      if (!isActive || selectedCard === null) {
        return;
      }

      const decision = getLayOffPositionDecision(selectedCard, meld);
      if (decision.kind === "needsPosition") {
        setPendingPrompt({ cardId: selectedCard.id, meldId: meld.id });
        return;
      }

      setPendingPrompt(null);
      onLayOff(selectedCard.id, meld.id, decision.position);
    },
    [isActive, onLayOff, selectedCard]
  );

  const selectPosition = useCallback(
    (position: "start" | "end") => {
      if (prompt === null) {
        return;
      }

      setPendingPrompt(null);
      onLayOff(prompt.cardId, prompt.meldId, position);
    },
    [onLayOff, prompt]
  );

  const cancelPosition = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const getMeldTargetProps = useCallback(
    (meld: Meld, player?: InlineLayOffPlayer): InlineLayOffTargetProps => ({
      enabled: isActive,
      label: getTargetLabel(meld, player),
      isPending: prompt?.meldId === meld.id,
      onSelect: () => selectMeld(meld),
      testId: `inline-layoff-target-${meld.id}`,
    }),
    [isActive, prompt?.meldId, selectMeld]
  );

  return {
    isActive,
    prompt,
    promptProps: {
      onSelect: selectPosition,
      onCancel: cancelPosition,
    },
    getMeldTargetProps,
  };
}
