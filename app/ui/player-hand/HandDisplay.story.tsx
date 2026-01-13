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

// Generate large hands for overflow testing
function generateHand(count: number): Card[] {
  const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const rank = ranks[i % ranks.length]!;
    const suit = suits[Math.floor(i / ranks.length) % suits.length]!;
    cards.push({
      id: `card-${i}`,
      rank,
      suit,
    });
  }
  return cards;
}

const HAND_15: Card[] = generateHand(15);
const HAND_20: Card[] = generateHand(20);
const HAND_25: Card[] = generateHand(25);

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

      {/* Large Hand (15 cards) - Tests "large" tier */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Large Hand (15 cards)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Tests the "large" tier (15-20 cards). Should increase overlap to fit all cards.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <HandDisplay cards={HAND_15} />
          </div>
        </ViewportComparison>
      </section>

      {/* Very Large Hand (20 cards) - Tests "large" tier boundary */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Very Large Hand (20 cards)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Tests the upper boundary of "large" tier (15-20 cards). All cards should remain visible.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <HandDisplay cards={HAND_20} />
          </div>
        </ViewportComparison>
      </section>

      {/* Huge Hand (25 cards) - Tests "huge" tier */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Huge Hand (25 cards)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Tests the "huge" tier (21+ cards). Maximum overlap to fit all cards while maintaining
          minimum touch target size (20-24px visible per card).
        </p>
        <ViewportComparison>
          <div className="p-4">
            <HandDisplay cards={HAND_25} />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
