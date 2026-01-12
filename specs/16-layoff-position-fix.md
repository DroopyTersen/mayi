# Spec: Lay-off Position Fix (#16)

## Problem

When staging multiple cards to the same run during lay-off, only the first card's position choice (start/end) is respected. Subsequent cards always go to the end regardless of position selection.

## Root Cause

In `LayOffView.tsx`, `handleMeldClick` uses the original meld to determine position instead of an "effective meld" that includes previously staged cards. This causes `needsPositionChoice()` to make incorrect decisions for 2nd+ cards.

## Solution: Clean Architecture

Create a layered solution with pure functions for meld projection and a custom hook for staging logic.

### New Files

#### `core/meld/meld.projection.ts`

Pure functions for computing effective melds:

```typescript
import { Card, Meld } from "../card/card.types";
import { StagedLayOff } from "../../app/ui/lay-off-view/LayOffView.types";

/**
 * Apply a single lay-off to a meld, returning the new effective meld.
 * Does NOT mutate the original meld.
 */
export function applyLayOffToMeld(
  meld: Meld,
  card: Card,
  position: "start" | "end"
): Meld {
  const newCards = position === "start"
    ? [card, ...meld.cards]
    : [...meld.cards, card];

  return { ...meld, cards: newCards };
}

/**
 * Compute the effective state of a meld after applying all staged lay-offs.
 * Uses hand to resolve card IDs to actual Card objects.
 */
export function getEffectiveMeld(
  meld: Meld,
  stagedLayOffs: StagedLayOff[],
  hand: Card[]
): Meld {
  const relevantLayOffs = stagedLayOffs.filter(s => s.meldId === meld.id);

  if (relevantLayOffs.length === 0) {
    return meld;
  }

  // Sort: start cards first (in staging order), then end cards (in staging order)
  const startLayOffs = relevantLayOffs.filter(s => s.position === "start");
  const endLayOffs = relevantLayOffs.filter(s => s.position !== "start");

  const startCards = startLayOffs
    .map(s => hand.find(c => c.id === s.cardId))
    .filter((c): c is Card => c !== undefined);

  const endCards = endLayOffs
    .map(s => hand.find(c => c.id === s.cardId))
    .filter((c): c is Card => c !== undefined);

  return {
    ...meld,
    cards: [...startCards, ...meld.cards, ...endCards]
  };
}
```

#### `app/ui/lay-off-view/useStagedLayOffs.ts`

Custom hook encapsulating staging logic:

```typescript
import { useState, useCallback, useMemo } from "react";
import { Card, Meld } from "~/core/card/card.types";
import { getEffectiveMeld } from "~/core/meld/meld.projection";
import { needsPositionChoice, getRunInsertPosition } from "~/core/engine/layoff";

interface StagedLayOff {
  cardId: string;
  meldId: string;
  position: "start" | "end";
}

interface UseStagedLayOffsOptions {
  hand: Card[];
  tableMelds: Meld[];
}

export function useStagedLayOffs({ hand, tableMelds }: UseStagedLayOffsOptions) {
  const [stagedLayOffs, setStagedLayOffs] = useState<StagedLayOff[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pendingMeld, setPendingMeld] = useState<Meld | null>(null);

  // Compute effective melds (original melds + staged lay-offs)
  const effectiveMelds = useMemo(() => {
    return tableMelds.map(meld => getEffectiveMeld(meld, stagedLayOffs, hand));
  }, [tableMelds, stagedLayOffs, hand]);

  // Get effective meld for a specific meld ID
  const getEffectiveMeldById = useCallback((meldId: string): Meld | undefined => {
    const originalMeld = tableMelds.find(m => m.id === meldId);
    if (!originalMeld) return undefined;
    return getEffectiveMeld(originalMeld, stagedLayOffs, hand);
  }, [tableMelds, stagedLayOffs, hand]);

  // Stage a card to a meld
  const stageLayOff = useCallback((
    card: Card,
    meldId: string,
    position: "start" | "end"
  ) => {
    setStagedLayOffs(prev => [
      ...prev,
      { cardId: card.id, meldId, position }
    ]);
    setSelectedCard(null);
  }, []);

  // Retract a staged lay-off
  const retractLayOff = useCallback((cardId: string) => {
    setStagedLayOffs(prev => prev.filter(s => s.cardId !== cardId));
  }, []);

  // Check if a card needs position choice (using effective meld)
  const checkNeedsPositionChoice = useCallback((
    card: Card,
    meldId: string
  ): boolean => {
    const effectiveMeld = getEffectiveMeldById(meldId);
    if (!effectiveMeld) return false;
    return needsPositionChoice(card, effectiveMeld);
  }, [getEffectiveMeldById]);

  // Get insert position for a card (using effective meld)
  const getInsertPosition = useCallback((
    card: Card,
    meldId: string
  ): "start" | "end" | null => {
    const effectiveMeld = getEffectiveMeldById(meldId);
    if (!effectiveMeld) return null;
    return getRunInsertPosition(card, effectiveMeld);
  }, [getEffectiveMeldById]);

  // Clear all staged lay-offs
  const clearStaged = useCallback(() => {
    setStagedLayOffs([]);
    setSelectedCard(null);
    setPendingMeld(null);
  }, []);

  return {
    stagedLayOffs,
    selectedCard,
    setSelectedCard,
    pendingMeld,
    setPendingMeld,
    effectiveMelds,
    getEffectiveMeldById,
    stageLayOff,
    retractLayOff,
    checkNeedsPositionChoice,
    getInsertPosition,
    clearStaged,
  };
}
```

### Modified Files

#### `app/ui/lay-off-view/LayOffView.tsx`

Update to use the hook:

```typescript
// Remove inline staging logic
// Import and use useStagedLayOffs hook

import { useStagedLayOffs } from "./useStagedLayOffs";

export function LayOffView({ hand, tableMelds, onLayOff, onCancel }: Props) {
  const {
    stagedLayOffs,
    selectedCard,
    setSelectedCard,
    pendingMeld,
    setPendingMeld,
    effectiveMelds,
    stageLayOff,
    retractLayOff,
    checkNeedsPositionChoice,
    getInsertPosition,
    clearStaged,
  } = useStagedLayOffs({ hand, tableMelds });

  const handleMeldClick = (meld: Meld) => {
    if (!selectedCard) return;

    // Use effective meld for position determination
    if (checkNeedsPositionChoice(selectedCard, meld.id)) {
      setPendingMeld(meld);
      // Show position choice dialog
    } else {
      const position = getInsertPosition(selectedCard, meld.id);
      stageLayOff(selectedCard, meld.id, position ?? "end");
    }
  };

  // ... rest of component
}
```

## Test Plan

### Unit Tests: `meld.projection.test.ts`

1. `applyLayOffToMeld` - card to start
2. `applyLayOffToMeld` - card to end
3. `getEffectiveMeld` - no staged lay-offs returns original
4. `getEffectiveMeld` - single staged lay-off at start
5. `getEffectiveMeld` - single staged lay-off at end
6. `getEffectiveMeld` - multiple staged lay-offs same position
7. `getEffectiveMeld` - mixed start and end lay-offs
8. `getEffectiveMeld` - filters by meld ID
9. `getEffectiveMeld` - handles missing cards in hand gracefully

### Hook Tests: `useStagedLayOffs.test.ts`

1. Initial state is empty
2. `stageLayOff` adds to staged list
3. `retractLayOff` removes from staged list
4. `effectiveMelds` updates when staging changes
5. `checkNeedsPositionChoice` uses effective meld
6. `getInsertPosition` uses effective meld
7. Multiple cards to start of same run
8. Multiple cards to end of same run

### Integration Test

Use agent harness with Round 2 run contract:
1. Start with a run on table (e.g., 7-8-9-10 hearts)
2. Have 5 and 6 hearts in hand
3. Lay off 6 to start, then 5 to start
4. Verify both cards at start in correct order

## Verification Commands

```bash
bun run typecheck
bun test core/meld/meld.projection.test.ts
bun test app/ui/lay-off-view/useStagedLayOffs.test.ts
bun test
bun run build
```
