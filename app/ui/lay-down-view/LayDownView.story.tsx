import { useState } from "react";
import { LayDownView } from "./LayDownView";
import { LayDownDrawer } from "./LayDownDrawer";
import { Button } from "~/shadcn/components/ui/button";
import type { Card } from "core/card/card.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_HAND: Card[] = [
  { id: "1", rank: "9", suit: "hearts" },
  { id: "2", rank: "9", suit: "diamonds" },
  { id: "3", rank: "9", suit: "clubs" },
  { id: "4", rank: "5", suit: "spades" },
  { id: "5", rank: "6", suit: "spades" },
  { id: "6", rank: "7", suit: "spades" },
  { id: "7", rank: "8", suit: "spades" },
  { id: "8", rank: "K", suit: "hearts" },
  { id: "9", rank: "Q", suit: "diamonds" },
  { id: "10", rank: "2", suit: "clubs" },
  { id: "11", rank: "Joker", suit: null },
];

// Pre-staged melds for showing cards in staging area
const STAGED_MELDS_COMPLETE: Array<{ type: "set" | "run"; cards: Card[] }> = [
  {
    type: "set",
    cards: [
      { id: "1", rank: "9", suit: "hearts" },
      { id: "2", rank: "9", suit: "diamonds" },
      { id: "3", rank: "9", suit: "clubs" },
    ],
  },
  {
    type: "run",
    cards: [
      { id: "4", rank: "5", suit: "spades" },
      { id: "5", rank: "6", suit: "spades" },
      { id: "6", rank: "7", suit: "spades" },
      { id: "7", rank: "8", suit: "spades" },
    ],
  },
];

const STAGED_MELDS_PARTIAL: Array<{ type: "set" | "run"; cards: Card[] }> = [
  {
    type: "set",
    cards: [
      { id: "1", rank: "9", suit: "hearts" },
      { id: "2", rank: "9", suit: "diamonds" },
    ],
  },
  {
    type: "run",
    cards: [
      { id: "4", rank: "5", suit: "spades" },
      { id: "5", rank: "6", suit: "spades" },
      { id: "6", rank: "7", suit: "spades" },
    ],
  },
];

/** Large hand for 4-meld scenarios */
const LARGE_HAND: Card[] = [
  { id: "1", rank: "9", suit: "hearts" },
  { id: "2", rank: "9", suit: "diamonds" },
  { id: "3", rank: "9", suit: "clubs" },
  { id: "4", rank: "5", suit: "spades" },
  { id: "5", rank: "6", suit: "spades" },
  { id: "6", rank: "7", suit: "spades" },
  { id: "7", rank: "8", suit: "spades" },
  { id: "8", rank: "K", suit: "hearts" },
  { id: "9", rank: "K", suit: "diamonds" },
  { id: "10", rank: "K", suit: "clubs" },
  { id: "11", rank: "3", suit: "hearts" },
  { id: "12", rank: "4", suit: "hearts" },
  { id: "13", rank: "5", suit: "hearts" },
  { id: "14", rank: "6", suit: "hearts" },
  { id: "15", rank: "Q", suit: "spades" },
  { id: "16", rank: "2", suit: "clubs" },
  { id: "17", rank: "Joker", suit: null },
];

interface Contract {
  sets: number;
  runs: number;
}

/** Interactive drawer demo component */
function LayDownDrawerDemo({ contract, hand }: { contract: Contract; hand: Card[] }) {
  const [open, setOpen] = useState(false);

  const handleLayDown = (melds: Array<{ type: "set" | "run"; cards: Card[] }>) => {
    const summary = melds.map((m, i) => `${m.type} ${i + 1}: ${m.cards.length} cards`).join("\n");
    alert(`Laying down ${melds.length} melds:\n${summary}`);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Lay Down Dialog</Button>
      <LayDownDrawer
        open={open}
        onOpenChange={setOpen}
        hand={hand}
        contract={contract}
        onLayDown={handleLayDown}
        onCancel={handleCancel}
      />
    </>
  );
}

export function LayDownViewStory() {
  const handleLayDown = (melds: any[]) => {
    console.log("Laying down:", melds);
    alert(`Laying down ${melds.length} melds!`);
  };

  const handleCancel = () => {
    alert("Cancelled");
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">LayDownView</h1>
        <p className="text-muted-foreground mt-1">
          Wizard for laying down contract melds.
        </p>
      </header>

      {/* Interactive Dialog - 4 Melds (tests scrolling) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive Dialog (4 Melds)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button to open the lay down dialog with 4 melds. Tests scrolling behavior with many staging areas.
        </p>
        <LayDownDrawerDemo contract={{ sets: 2, runs: 2 }} hand={LARGE_HAND} />
      </section>

      {/* Interactive Dialog - 2 Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive Dialog (2 Melds)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button to open the lay down dialog with fewer melds.
        </p>
        <LayDownDrawerDemo contract={{ sets: 1, runs: 1 }} hand={SAMPLE_HAND} />
      </section>

      {/* Round 1: 2 Sets */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Round 1 Contract (2 Sets)</h2>
        <div className="border rounded-lg p-4">
          <LayDownView
            hand={SAMPLE_HAND}
            contract={{ sets: 2, runs: 0 }}
            onLayDown={handleLayDown}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Round 2: 1 Set + 1 Run */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Round 2 Contract (1 Set + 1 Run)</h2>
        <div className="border rounded-lg p-4">
          <LayDownView
            hand={SAMPLE_HAND}
            contract={{ sets: 1, runs: 1 }}
            onLayDown={handleLayDown}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Round 7: 3 Runs */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Round 7 Contract (3 Runs)</h2>
        <div className="border rounded-lg p-4">
          <LayDownView
            hand={SAMPLE_HAND}
            contract={{ sets: 0, runs: 3 }}
            onLayDown={handleLayDown}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* With Cards in Staging - Complete */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Cards in Staging (Ready to Lay Down)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Shows cards staged in meld slots, ready to lay down. Hover cards to remove.
        </p>
        <div className="border rounded-lg p-4">
          <LayDownView
            hand={SAMPLE_HAND}
            contract={{ sets: 1, runs: 1 }}
            initialStagedMelds={STAGED_MELDS_COMPLETE}
            onLayDown={handleLayDown}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* With Cards in Staging - Partial */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Cards in Staging (Still Need More)</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Shows partially filled melds - Set 1 needs 1 more card.
        </p>
        <div className="border rounded-lg p-4">
          <LayDownView
            hand={SAMPLE_HAND}
            contract={{ sets: 1, runs: 1 }}
            initialStagedMelds={STAGED_MELDS_PARTIAL}
            onLayDown={handleLayDown}
            onCancel={handleCancel}
          />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the lay down view adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-4">
            <LayDownView
              hand={SAMPLE_HAND}
              contract={{ sets: 1, runs: 1 }}
              onLayDown={handleLayDown}
              onCancel={handleCancel}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
