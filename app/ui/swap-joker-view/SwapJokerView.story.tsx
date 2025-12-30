import { SwapJokerView } from "./SwapJokerView";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_HAND: Card[] = [
  { id: "h1", rank: "J", suit: "hearts" },
  { id: "h2", rank: "K", suit: "spades" },
  { id: "h3", rank: "3", suit: "diamonds" },
];

const MELDS_WITH_JOKERS: Meld[] = [
  {
    id: "meld-1",
    type: "run",
    ownerId: "p1",
    cards: [
      { id: "1", rank: "10", suit: "hearts" },
      { id: "2", rank: "Joker", suit: null },
      { id: "3", rank: "Q", suit: "hearts" },
      { id: "4", rank: "K", suit: "hearts" },
    ],
  },
];

const SWAPPABLE_JOKERS = [
  {
    meldId: "meld-1",
    jokerIndex: 1,
    replacementRank: "J",
    replacementSuit: "hearts",
  },
];

export function SwapJokerViewStory() {
  const handleSwap = (meldId: string, jokerIndex: number, cardId: string) => {
    alert(`Swapped joker at index ${jokerIndex} in meld ${meldId} with card ${cardId}`);
  };

  const handleCancel = () => {
    alert("Cancelled");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">SwapJokerView</h1>
        <p className="text-muted-foreground mt-1">
          Swap a natural card for a Joker in a run.
        </p>
      </header>

      {/* Has Swappable Joker */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Can Swap</h2>
        <div className="border rounded-lg p-4 max-w-md">
          <SwapJokerView
            hand={SAMPLE_HAND}
            meldsWithJokers={MELDS_WITH_JOKERS}
            swappableJokers={SWAPPABLE_JOKERS}
            onSwap={handleSwap}
            onCancel={handleCancel}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Has J♥ in hand, can swap for Joker in the run.
        </p>
      </section>

      {/* No Swappable Jokers */}
      <section>
        <h2 className="text-lg font-semibold mb-3">No Swaps Available</h2>
        <div className="border rounded-lg p-4 max-w-md">
          <SwapJokerView
            hand={SAMPLE_HAND}
            meldsWithJokers={MELDS_WITH_JOKERS}
            swappableJokers={[]}
            onSwap={handleSwap}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the swap joker view adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-4">
            <SwapJokerView
              hand={SAMPLE_HAND}
              meldsWithJokers={MELDS_WITH_JOKERS}
              swappableJokers={SWAPPABLE_JOKERS}
              onSwap={handleSwap}
              onCancel={handleCancel}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
