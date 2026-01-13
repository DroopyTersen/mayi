/**
 * Custom hook and pure functions for managing staged lay-offs in the LayOffView.
 *
 * This module separates the state management logic from the React component,
 * making it easier to test and reason about.
 *
 * The key insight for the bug fix: when staging multiple cards to the same meld,
 * we must compute the "effective meld" (original + already-staged cards) before
 * checking whether a new card needs position selection.
 */

import { useState, useCallback } from "react";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { getEffectiveMeld, type StagedLayOff } from "core/meld/meld.projection";
import {
  needsPositionChoice,
  getRunInsertPosition,
} from "core/engine/layoff";
import { isWild } from "core/card/card.utils";

export type { StagedLayOff };

/**
 * State shape for staged lay-offs
 */
export interface StagedLayOffsState {
  stagedLayOffs: StagedLayOff[];
}

/**
 * Result of attempting to stage a card
 */
export interface StageCardResult {
  /** The staged lay-off if card was successfully staged, null otherwise */
  staged: StagedLayOff | null;
  /** True if user needs to choose position (wild card on run with both ends valid) */
  needsPositionPrompt: boolean;
}

/**
 * A staged card with its card object (for rendering)
 */
export interface StagedCardWithCard {
  cardId: string;
  meldId: string;
  position?: "start" | "end";
  card: Card;
}

/**
 * Creates initial empty state
 */
export function createInitialState(): StagedLayOffsState {
  return { stagedLayOffs: [] };
}

/**
 * Attempts to stage a card on a meld.
 *
 * This is the core function that fixes the bug: it computes the effective meld
 * (including previously staged cards) before determining position.
 *
 * @param state - Current staged lay-offs state
 * @param cardId - ID of the card to stage
 * @param meldId - ID of the target meld
 * @param melds - All melds on the table
 * @param hand - Player's hand (to look up cards)
 * @param explicitPosition - Optional explicit position (when user selected from prompt)
 * @returns Result indicating success or need for position prompt
 */
export function stageCard(
  state: StagedLayOffsState,
  cardId: string,
  meldId: string,
  melds: Meld[],
  hand: Card[],
  explicitPosition?: "start" | "end"
): StageCardResult {
  const card = hand.find((c) => c.id === cardId);
  const meld = melds.find((m) => m.id === meldId);

  if (!card || !meld) {
    return { staged: null, needsPositionPrompt: false };
  }

  // THE BUG FIX: Compute effective meld with already-staged cards
  const effectiveMeld = getEffectiveMeld(meld, state.stagedLayOffs, hand);

  // If explicit position was provided (user already chose), use it
  if (explicitPosition !== undefined) {
    return {
      staged: { cardId, meldId, position: explicitPosition },
      needsPositionPrompt: false,
    };
  }

  // For sets, position doesn't matter
  if (effectiveMeld.type === "set") {
    return {
      staged: { cardId, meldId, position: undefined },
      needsPositionPrompt: false,
    };
  }

  // For runs, check if position choice is needed using effective meld
  if (needsPositionChoice(card, effectiveMeld)) {
    // Wild card can fit at both ends - user must choose
    return { staged: null, needsPositionPrompt: true };
  }

  // Natural card or wild with only one valid end - auto-determine position
  let position: "start" | "end" | undefined;
  if (effectiveMeld.type === "run") {
    const insertPos = getRunInsertPosition(card, effectiveMeld);
    if (insertPos === "low") {
      position = "start";
    } else if (insertPos === "high") {
      position = "end";
    }
    // Note: if insertPos is null, card doesn't fit - but we let it through
    // since validation happens elsewhere
  }

  return {
    staged: { cardId, meldId, position },
    needsPositionPrompt: false,
  };
}

/**
 * Removes a staged card from state
 */
export function unstageCard(
  state: StagedLayOffsState,
  cardId: string
): StagedLayOffsState {
  return {
    stagedLayOffs: state.stagedLayOffs.filter((s) => s.cardId !== cardId),
  };
}

/**
 * Gets staged cards for a specific meld with their card objects
 */
export function getStagedForMeld(
  meldId: string,
  stagedLayOffs: StagedLayOff[],
  hand: Card[]
): StagedCardWithCard[] {
  const result: StagedCardWithCard[] = [];

  for (const s of stagedLayOffs) {
    if (s.meldId !== meldId) continue;

    const card = hand.find((c) => c.id === s.cardId);
    if (!card) continue;

    result.push({
      cardId: s.cardId,
      meldId: s.meldId,
      position: s.position,
      card,
    });
  }

  return result;
}

/**
 * Hook return type
 */
export interface UseStagedLayOffsReturn {
  /** Current list of staged lay-offs */
  stagedLayOffs: StagedLayOff[];
  /** Stage a card on a meld. Returns true if staged, false if position prompt needed */
  stageCard: (
    cardId: string,
    meldId: string,
    melds: Meld[],
    hand: Card[],
    explicitPosition?: "start" | "end"
  ) => { staged: boolean; needsPositionPrompt: boolean };
  /** Remove a staged card */
  unstageCard: (cardId: string) => void;
  /** Get staged cards for a specific meld */
  getStagedForMeld: (meldId: string, hand: Card[]) => StagedCardWithCard[];
  /** Clear all staged lay-offs */
  clearAll: () => void;
  /** Commit all staged lay-offs via callback */
  commitAll: (
    onLayOff: (cardId: string, meldId: string, position?: "start" | "end") => void
  ) => void;
}

/**
 * React hook for managing staged lay-offs.
 *
 * Encapsulates the state management and provides convenient methods
 * for the LayOffView component.
 */
export function useStagedLayOffs(): UseStagedLayOffsReturn {
  const [state, setState] = useState<StagedLayOffsState>(createInitialState);

  const stageCardFn = useCallback(
    (
      cardId: string,
      meldId: string,
      melds: Meld[],
      hand: Card[],
      explicitPosition?: "start" | "end"
    ) => {
      const result = stageCard(state, cardId, meldId, melds, hand, explicitPosition);

      if (result.staged) {
        setState((prev) => ({
          stagedLayOffs: [...prev.stagedLayOffs, result.staged!],
        }));
        return { staged: true, needsPositionPrompt: false };
      }

      return { staged: false, needsPositionPrompt: result.needsPositionPrompt };
    },
    [state]
  );

  const unstageCardFn = useCallback((cardId: string) => {
    setState((prev) => unstageCard(prev, cardId));
  }, []);

  const getStagedForMeldFn = useCallback(
    (meldId: string, hand: Card[]) => {
      return getStagedForMeld(meldId, state.stagedLayOffs, hand);
    },
    [state.stagedLayOffs]
  );

  const clearAll = useCallback(() => {
    setState(createInitialState());
  }, []);

  const commitAll = useCallback(
    (
      onLayOff: (cardId: string, meldId: string, position?: "start" | "end") => void
    ) => {
      for (const staged of state.stagedLayOffs) {
        onLayOff(staged.cardId, staged.meldId, staged.position);
      }
    },
    [state.stagedLayOffs]
  );

  return {
    stagedLayOffs: state.stagedLayOffs,
    stageCard: stageCardFn,
    unstageCard: unstageCardFn,
    getStagedForMeld: getStagedForMeldFn,
    clearAll,
    commitAll,
  };
}
