import { DiscardView } from "./DiscardView";
import type { Card } from "core/card/card.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

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
];

const SMALL_HAND: Card[] = [
  { id: "1", rank: "K", suit: "hearts" },
  { id: "2", rank: "A", suit: "spades" },
];

export function DiscardViewStory() {
  const handleDiscard = (cardId: string) => {
    const card = SAMPLE_HAND.find((c) => c.id === cardId);
    alert(`Discarded: ${card?.rank} of ${card?.suit}`);
  };

  const handleCancel = () => {
    alert("Cancelled");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">DiscardView</h1>
        <p className="text-muted-foreground mt-1">
          Select a card from hand to discard and end turn.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <div className="border rounded-lg p-4">
          <DiscardView
            hand={SAMPLE_HAND}
            onDiscard={handleDiscard}
            onCancel={handleCancel}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Click a card to select, then click "Discard" to confirm.
        </p>
      </section>

      {/* Small Hand */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Small Hand (2 cards)</h2>
        <div className="border rounded-lg p-4">
          <DiscardView
            hand={SMALL_HAND}
            onDiscard={handleDiscard}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the discard view adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-4">
            <DiscardView
              hand={SAMPLE_HAND}
              onDiscard={handleDiscard}
              onCancel={handleCancel}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
