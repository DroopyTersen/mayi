import { useState } from "react";
import { HandDisplay } from "./HandDisplay";
import type { Card } from "core/card/card.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

// Sample hands for testing
const SAMPLE_HAND: Card[] = [
  { id: "1", rank: "3", suit: "hearts" },
  { id: "2", rank: "5", suit: "diamonds" },
  { id: "3", rank: "6", suit: "diamonds" },
  { id: "4", rank: "7", suit: "diamonds" },
  { id: "5", rank: "8", suit: "diamonds" },
  { id: "6", rank: "9", suit: "clubs" },
  { id: "7", rank: "9", suit: "hearts" },
  { id: "8", rank: "J", suit: "spades" },
  { id: "9", rank: "Q", suit: "spades" },
  { id: "10", rank: "2", suit: "clubs" },
  { id: "11", rank: "Joker", suit: null },
];

const SMALL_HAND: Card[] = [
  { id: "1", rank: "A", suit: "spades" },
  { id: "2", rank: "K", suit: "hearts" },
  { id: "3", rank: "Q", suit: "diamonds" },
];

function InteractiveHand() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCardClick = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  return (
    <div>
      <HandDisplay
        cards={SAMPLE_HAND}
        selectedIds={selectedIds}
        onCardClick={handleCardClick}
      />
      <p className="text-xs text-muted-foreground mt-2">
        Selected: {selectedIds.size === 0 ? "none" : Array.from(selectedIds).join(", ")}
      </p>
    </div>
  );
}

export function HandDisplayStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">HandDisplay</h1>
        <p className="text-muted-foreground mt-1">
          Player's hand as fanned/overlapping cards.
        </p>
      </header>

      {/* Auto-sizing (default) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Auto-sizing (default)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Uses container queries to pick card size: large for wide containers, small for narrow.
        </p>
        <HandDisplay cards={SAMPLE_HAND} />
      </section>

      {/* Fixed Sizes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Fixed Sizes</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Small</p>
            <HandDisplay cards={SAMPLE_HAND} size="sm" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Medium</p>
            <HandDisplay cards={SAMPLE_HAND} size="md" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Large</p>
            <HandDisplay cards={SAMPLE_HAND} size="lg" />
          </div>
        </div>
      </section>

      {/* Small Hand */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Small Hand (3 cards)</h2>
        <HandDisplay cards={SMALL_HAND} />
      </section>

      {/* Empty Hand */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Empty Hand</h2>
        <HandDisplay cards={[]} />
      </section>

      {/* Interactive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive (click to select)</h2>
        <InteractiveHand />
        <p className="text-xs text-muted-foreground mt-2">
          Click cards to toggle selection. Hover to lift card.
        </p>
      </section>

      {/* Pre-selected */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Pre-selected Cards</h2>
        <HandDisplay
          cards={SAMPLE_HAND}
          selectedIds={new Set(["3", "4", "5"])}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Cards 3, 4, 5 (the diamond run) are pre-selected.
        </p>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Auto-sizing</h2>
        <p className="text-sm text-muted-foreground mb-4">
          With auto-sizing, cards are small on phone, medium on tablet, large on desktop.
          Overlap is tighter on mobile to fit more cards.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <HandDisplay cards={SAMPLE_HAND} />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
