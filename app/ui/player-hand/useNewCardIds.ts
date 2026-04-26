import { useEffect, useMemo, useRef, useState } from "react";
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
  { durationMs = 1200, maxBatchSize = 3 }: UseNewCardIdsOptions = {}
): ReadonlySet<string> {
  const idsKey = cards.map((c) => c.id).join("|");
  const currentIds = useMemo(
    () => new Set(idsKey ? idsKey.split("|") : []),
    [idsKey]
  );
  const previousIdsRef = useRef<Set<string>>(currentIds);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    const added = diffCardIds(previousIdsRef.current, currentIds);
    previousIdsRef.current = currentIds;

    if (added.size === 0 || added.size > maxBatchSize) return;

    setHighlighted((prev) => new Set([...prev, ...added]));

    const timer = setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        for (const id of added) next.delete(id);
        return next;
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [currentIds, durationMs, maxBatchSize]);

  return highlighted;
}
