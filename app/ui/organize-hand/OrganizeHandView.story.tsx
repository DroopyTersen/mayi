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
