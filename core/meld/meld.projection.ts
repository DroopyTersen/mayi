/**
 * Meld projection functions for computing effective melds with staged lay-offs.
 *
 * These pure functions help calculate what a meld would look like after
 * applying one or more staged lay-off cards, without mutating the original meld.
 *
 * Used by the UI to determine position choices for subsequent lay-offs
 * when multiple cards are being staged to the same meld.
 */

import type { Card } from "../card/card.types";
import type { Meld } from "./meld.types";

/**
 * A staged lay-off waiting to be committed.
 * This matches the StagedLayOff interface in LayOffView.tsx.
 */
export interface StagedLayOff {
  cardId: string;
  meldId: string;
  position?: "start" | "end";
}

/**
 * Applies a single lay-off card to a meld and returns a new meld with the card included.
 *
 * For runs:
 * - position "start" prepends the card to the run
 * - position "end" or undefined appends the card to the run
 *
 * For sets:
 * - position is ignored (sets have no order)
 * - card is appended to the cards array
 *
 * @param meld - The original meld
 * @param card - The card to add
 * @param position - Where to insert ("start" | "end" | undefined)
 * @returns A new Meld with the card applied (original meld is not mutated)
 */
export function applyLayOffToMeld(
  meld: Meld,
  card: Card,
  position?: "start" | "end"
): Meld {
  let newCards: Card[];

  if (meld.type === "run" && position === "start") {
    // Prepend to run
    newCards = [card, ...meld.cards];
  } else {
    // Append (default for runs without position, or for sets)
    newCards = [...meld.cards, card];
  }

  return {
    ...meld,
    cards: newCards,
  };
}

/**
 * Computes the effective state of a meld after applying all staged lay-offs for that meld.
 *
 * This is the key function for fixing the bug: when staging multiple cards to the same run,
 * each subsequent card needs to check position against the effective meld (with previous
 * staged cards included), not the original meld.
 *
 * @param meld - The original meld from the table
 * @param stagedLayOffs - All currently staged lay-offs (will filter to this meld)
 * @param hand - The player's hand (to look up card objects by ID)
 * @returns A new Meld representing the effective state with staged cards applied
 */
export function getEffectiveMeld(
  meld: Meld,
  stagedLayOffs: StagedLayOff[],
  hand: Card[]
): Meld {
  // Filter to only lay-offs for this meld
  const layOffsForMeld = stagedLayOffs.filter((s) => s.meldId === meld.id);

  if (layOffsForMeld.length === 0) {
    // No staged cards for this meld, return as-is
    // Return a shallow copy to maintain immutability contract
    return { ...meld, cards: [...meld.cards] };
  }

  // Apply each staged lay-off in order
  let effectiveMeld: Meld = meld;

  for (const staged of layOffsForMeld) {
    const card = hand.find((c) => c.id === staged.cardId);
    if (!card) {
      // Card not found in hand - skip it
      // This can happen if the card was removed or state is inconsistent
      continue;
    }

    effectiveMeld = applyLayOffToMeld(effectiveMeld, card, staged.position);
  }

  return effectiveMeld;
}
