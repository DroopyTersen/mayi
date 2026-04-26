import { OrganizeHandView } from "./OrganizeHandView";
import type { Card } from "core/card/card.types";
import {
  ViewportSimulator,
  ViewportComparison,
} from "~/storybook/ViewportSimulator";

const SAMPLE_HAND: Card[] = [
  { id: "1", rank: "3", suit: "hearts" },
  { id: "2", rank: "5", suit: "diamonds" },
  { id: "3", rank: "6", suit: "diamonds" },
  { id: "4", rank: "7", suit: "diamonds" },
  { id: "5", rank: "9", suit: "clubs" },
  { id: "6", rank: "9", suit: "hearts" },
  { id: "7", rank: "J", suit: "spades" },
  { id: "8", rank: "Q", suit: "spades" },
  { id: "9", rank: "2", suit: "clubs" },
  { id: "10", rank: "Joker", suit: null },
];

const LONG_HAND: Card[] = [
  { id: "long-1", rank: "J", suit: "spades" },
  { id: "long-2", rank: "K", suit: "spades" },
  { id: "long-3", rank: "2", suit: "clubs" },
  { id: "long-4", rank: "J", suit: "hearts" },
  { id: "long-5", rank: "4", suit: "diamonds" },
  { id: "long-6", rank: "5", suit: "diamonds" },
  { id: "long-7", rank: "6", suit: "diamonds" },
  { id: "long-8", rank: "7", suit: "diamonds" },
  { id: "long-9", rank: "9", suit: "diamonds" },
  { id: "long-10", rank: "10", suit: "diamonds" },
  { id: "long-11", rank: "J", suit: "diamonds" },
  { id: "long-12", rank: "3", suit: "clubs" },
  { id: "long-13", rank: "9", suit: "clubs" },
  { id: "long-14", rank: "10", suit: "clubs" },
  { id: "long-15", rank: "Q", suit: "clubs" },
  { id: "long-16", rank: "K", suit: "clubs" },
  { id: "long-17", rank: "A", suit: "hearts" },
  { id: "long-18", rank: "8", suit: "spades" },
  { id: "long-19", rank: "2", suit: "hearts" },
  { id: "long-20", rank: "5", suit: "clubs" },
  { id: "long-21", rank: "7", suit: "spades" },
  { id: "long-22", rank: "Q", suit: "diamonds" },
  { id: "long-23", rank: "Joker", suit: null },
];

export function OrganizeHandViewStory() {
  const handleSave = (newOrder: Card[]) => {
    alert(`Saved new order: ${newOrder.map((c) => c.rank).join(", ")}`);
  };

  const handleCancel = () => {
    alert("Cancelled");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">OrganizeHandView</h1>
        <p className="text-muted-foreground mt-1">
          Reorder and sort cards in your hand.
        </p>
      </header>

      {/* Interactive with Viewport Switcher */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive (Switch Viewport)</h2>
        <ViewportSimulator defaultViewport="tablet">
          <div className="p-4">
            <OrganizeHandView
              hand={SAMPLE_HAND}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </ViewportSimulator>
        <p className="text-xs text-muted-foreground mt-2">
          Click a card to select, use arrows to move left/right, or use sort buttons.
        </p>
      </section>

      {/* Desktop dialog-width regression */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Desktop Dialog Width (23 Cards)</h2>
        <div className="max-w-lg rounded-lg border bg-background p-6 shadow-sm">
          <OrganizeHandView
            hand={LONG_HAND}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Viewport Comparison */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Viewport Comparison</h2>
        <ViewportComparison viewports={["phone", "tablet", "desktop"]}>
          <div className="p-4">
            <OrganizeHandView
              hand={SAMPLE_HAND}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
