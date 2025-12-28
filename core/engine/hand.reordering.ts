/**
 * Hand reordering utilities for May I? card game
 *
 * Hand reordering is a "free action" - it can be done at any time during a turn
 * without consuming the turn action.
 */

import type { Card } from "../card/card.types";
import { isWild, getRankValue } from "../card/card.utils";

/**
 * Result of a reorder operation
 */
export type ReorderResult =
  | { success: true; hand: Card[] }
  | { success: false; error: string };

/**
 * Reorders cards in hand according to provided card IDs order
 */
export function reorderHand(hand: Card[], newOrder: string[]): ReorderResult {
  // Validate same length
  if (newOrder.length !== hand.length) {
    return { success: false, error: "Card count mismatch" };
  }

  // Check for duplicates in newOrder
  const uniqueIds = new Set(newOrder);
  if (uniqueIds.size !== newOrder.length) {
    return { success: false, error: "Duplicate card IDs in new order" };
  }

  // Check all cards in newOrder exist in hand
  const handIds = new Set(hand.map((c) => c.id));
  for (const id of newOrder) {
    if (!handIds.has(id)) {
      return { success: false, error: `Card ${id} not in hand` };
    }
  }

  // Check all cards in hand are in newOrder
  for (const card of hand) {
    if (!uniqueIds.has(card.id)) {
      return { success: false, error: `Card ${card.id} missing from new order` };
    }
  }

  // Build reordered hand
  const cardMap = new Map(hand.map((c) => [c.id, c]));
  const reordered = newOrder.map((id) => cardMap.get(id)!);

  return { success: true, hand: reordered };
}

/**
 * Sort order for suits
 */
const SUIT_ORDER: Record<string, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
};

/**
 * Sorts hand by rank (A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3), wilds at end
 */
export function sortHandByRank(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const aWild = isWild(a);
    const bWild = isWild(b);

    // Wilds go to end
    if (aWild && !bWild) return 1;
    if (!aWild && bWild) return -1;

    // Both wilds: Jokers after 2s
    if (aWild && bWild) {
      if (a.rank === "Joker" && b.rank !== "Joker") return 1;
      if (a.rank !== "Joker" && b.rank === "Joker") return -1;
      return 0;
    }

    // Both naturals: sort by rank value (higher first)
    const aValue = getRankValue(a.rank);
    const bValue = getRankValue(b.rank);
    if (aValue !== bValue) return bValue - aValue;

    // Same rank: sort by suit
    const aSuit = SUIT_ORDER[a.suit ?? ""] ?? 4;
    const bSuit = SUIT_ORDER[b.suit ?? ""] ?? 4;
    return aSuit - bSuit;
  });
}

/**
 * Sorts hand by suit (spades, hearts, diamonds, clubs), within suit by rank, wilds at end
 */
export function sortHandBySuit(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const aWild = isWild(a);
    const bWild = isWild(b);

    // Wilds go to end
    if (aWild && !bWild) return 1;
    if (!aWild && bWild) return -1;

    // Both wilds: Jokers after 2s
    if (aWild && bWild) {
      if (a.rank === "Joker" && b.rank !== "Joker") return 1;
      if (a.rank !== "Joker" && b.rank === "Joker") return -1;
      return 0;
    }

    // Both naturals: sort by suit first
    const aSuit = SUIT_ORDER[a.suit ?? ""] ?? 4;
    const bSuit = SUIT_ORDER[b.suit ?? ""] ?? 4;
    if (aSuit !== bSuit) return aSuit - bSuit;

    // Same suit: sort by rank value (higher first)
    const aValue = getRankValue(a.rank);
    const bValue = getRankValue(b.rank);
    return bValue - aValue;
  });
}

/**
 * Moves a card from one position to another
 * Positions are 0-indexed
 */
export function moveCard(hand: Card[], fromIndex: number, toIndex: number): ReorderResult {
  if (fromIndex < 0 || fromIndex >= hand.length) {
    return { success: false, error: "Invalid from position" };
  }
  if (toIndex < 0 || toIndex >= hand.length) {
    return { success: false, error: "Invalid to position" };
  }

  const result = [...hand];
  const [card] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, card);

  return { success: true, hand: result };
}
