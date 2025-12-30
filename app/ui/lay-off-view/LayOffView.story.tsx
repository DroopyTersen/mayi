import { LayOffView } from "./LayOffView";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_HAND: Card[] = [
  { id: "h1", rank: "5", suit: "hearts" },
  { id: "h2", rank: "K", suit: "spades" },
  { id: "h3", rank: "3", suit: "diamonds" },
  { id: "h4", rank: "Q", suit: "hearts" },
  { id: "h5", rank: "7", suit: "clubs" },
];

const TABLE_MELDS: Meld[] = [
  {
    id: "meld-1",
    type: "run",
    ownerId: "p1",
    cards: [
      { id: "1", rank: "10", suit: "hearts" },
      { id: "2", rank: "J", suit: "hearts" },
      { id: "3", rank: "Q", suit: "hearts" },
    ],
  },
  {
    id: "meld-2",
    type: "set",
    ownerId: "p2",
    cards: [
      { id: "4", rank: "K", suit: "hearts" },
      { id: "5", rank: "K", suit: "clubs" },
      { id: "6", rank: "K", suit: "diamonds" },
    ],
  },
  {
    id: "meld-3",
    type: "run",
    ownerId: "p1",
    cards: [
      { id: "7", rank: "3", suit: "clubs" },
      { id: "8", rank: "4", suit: "clubs" },
      { id: "9", rank: "5", suit: "clubs" },
      { id: "10", rank: "6", suit: "clubs" },
    ],
  },
];

export function LayOffViewStory() {
  const handleLayOff = (cardId: string, meldId: string) => {
    alert(`Laid off card ${cardId} to meld ${meldId}`);
  };

  const handleDone = () => {
    alert("Done laying off");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">LayOffView</h1>
        <p className="text-muted-foreground mt-1">
          Add cards from hand to existing table melds.
        </p>
      </header>

      {/* With Table Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Table Melds</h2>
        <div className="border rounded-lg p-4 max-w-md">
          <LayOffView
            hand={SAMPLE_HAND}
            tableMelds={TABLE_MELDS}
            onLayOff={handleLayOff}
            onDone={handleDone}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Select a card, then tap a meld to add it.
        </p>
      </section>

      {/* Empty Table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">No Melds on Table</h2>
        <div className="border rounded-lg p-4 max-w-md">
          <LayOffView
            hand={SAMPLE_HAND}
            tableMelds={[]}
            onLayOff={handleLayOff}
            onDone={handleDone}
          />
        </div>
      </section>

      {/* Small Hand */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Small Hand</h2>
        <div className="border rounded-lg p-4 max-w-md">
          <LayOffView
            hand={SAMPLE_HAND.slice(0, 2)}
            tableMelds={TABLE_MELDS}
            onLayOff={handleLayOff}
            onDone={handleDone}
          />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the lay off view adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-4">
            <LayOffView
              hand={SAMPLE_HAND}
              tableMelds={TABLE_MELDS}
              onLayOff={handleLayOff}
              onDone={handleDone}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
