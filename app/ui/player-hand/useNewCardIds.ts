import { useEffect, useRef, useState } from "react";
import type { Card } from "core/card/card.types";

export function diffCardIds(
  previous: ReadonlySet<string>,
  current: ReadonlySet<string>
): Set<string> {
  const added = new Set<string>();
  for (const id of current) {
    if (!previous.has(id)) added.add(id);
  }
  return added;
}

interface UseNewCardIdsOptions {
  /** How long each highlighted id stays in the returned set (ms) */
  durationMs?: number;
  /** If more than this many ids appear in a single update, skip highlighting
   * (avoids flashing every card on initial deal). */
  maxBatchSize?: number;
}

export function useNewCardIds(
  cards: Card[],
  options: UseNewCardIdsOptions = {}
): ReadonlySet<string> {
  const { durationMs = 1200, maxBatchSize = 3 } = options;
  const previousIdsRef = useRef<Set<string>>(new Set(cards.map((c) => c.id)));
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(cards.map((c) => c.id));
    const added = diffCardIds(previousIdsRef.current, currentIds);
    previousIdsRef.current = currentIds;

    if (added.size === 0 || added.size > maxBatchSize) return;

    setHighlighted((prev) => {
      const next = new Set(prev);
      added.forEach((id) => next.add(id));
      return next;
    });

    const timer = setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        added.forEach((id) => next.delete(id));
        return next;
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [cards, durationMs, maxBatchSize]);

  return highlighted;
}
