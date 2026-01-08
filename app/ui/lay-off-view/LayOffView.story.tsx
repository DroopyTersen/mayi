import { useState } from "react";
import { LayOffView } from "./LayOffView";
import { ResponsiveDrawer } from "~/ui/responsive-drawer/ResponsiveDrawer";
import { Button } from "~/shadcn/components/ui/button";
import type { Card } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const PLAYERS = [
  { id: "you", name: "You" },
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "charlie", name: "Charlie" },
];

const VIEWING_PLAYER_ID = "you";

const SAMPLE_HAND: Card[] = [
  { id: "h1", rank: "5", suit: "hearts" },
  { id: "h2", rank: "K", suit: "spades" },
  { id: "h3", rank: "3", suit: "diamonds" },
  { id: "h4", rank: "Q", suit: "hearts" },
  { id: "h5", rank: "7", suit: "clubs" },
  { id: "h6", rank: "9", suit: "hearts" },
];

/** Hand with a wild card (2 or Joker) for testing position selection */
const HAND_WITH_WILD: Card[] = [
  { id: "w1", rank: "2", suit: "hearts" },
  { id: "w2", rank: "Joker", suit: "hearts" },
  { id: "h3", rank: "K", suit: "spades" },
];

/** Run that can be extended at both ends (5-6-7 of clubs) */
const EXTENSIBLE_RUN_MELDS: Meld[] = [
  {
    id: "run-both-ends",
    type: "run",
    ownerId: "alice",
    cards: [
      { id: "r1", rank: "5", suit: "clubs" },
      { id: "r2", rank: "6", suit: "clubs" },
      { id: "r3", rank: "7", suit: "clubs" },
    ],
  },
];

const TABLE_MELDS: Meld[] = [
  {
    id: "meld-1",
    type: "run",
    ownerId: "alice",
    cards: [
      { id: "1", rank: "10", suit: "hearts" },
      { id: "2", rank: "J", suit: "hearts" },
      { id: "3", rank: "Q", suit: "hearts" },
    ],
  },
  {
    id: "meld-2",
    type: "set",
    ownerId: "bob",
    cards: [
      { id: "4", rank: "K", suit: "hearts" },
      { id: "5", rank: "K", suit: "clubs" },
      { id: "6", rank: "K", suit: "diamonds" },
    ],
  },
  {
    id: "meld-3",
    type: "run",
    ownerId: "alice",
    cards: [
      { id: "7", rank: "3", suit: "clubs" },
      { id: "8", rank: "4", suit: "clubs" },
      { id: "9", rank: "5", suit: "clubs" },
      { id: "10", rank: "6", suit: "clubs" },
    ],
  },
];

/** Many melds across all 4 players to stress test scrolling */
const MANY_MELDS: Meld[] = [
  // You (viewing player) - 2 melds
  { id: "you-1", type: "set", ownerId: "you", cards: [
    { id: "y1", rank: "A", suit: "hearts" }, { id: "y2", rank: "A", suit: "spades" }, { id: "y3", rank: "A", suit: "clubs" },
  ]},
  { id: "you-2", type: "set", ownerId: "you", cards: [
    { id: "y4", rank: "Q", suit: "hearts" }, { id: "y5", rank: "Q", suit: "spades" }, { id: "y6", rank: "Q", suit: "clubs" },
  ]},
  // Alice - 3 melds
  { id: "alice-1", type: "run", ownerId: "alice", cards: [
    { id: "a1", rank: "3", suit: "hearts" }, { id: "a2", rank: "4", suit: "hearts" }, { id: "a3", rank: "5", suit: "hearts" }, { id: "a4", rank: "6", suit: "hearts" },
  ]},
  { id: "alice-2", type: "set", ownerId: "alice", cards: [
    { id: "a5", rank: "K", suit: "hearts" }, { id: "a6", rank: "K", suit: "spades" }, { id: "a7", rank: "K", suit: "clubs" },
  ]},
  { id: "alice-3", type: "set", ownerId: "alice", cards: [
    { id: "a8", rank: "J", suit: "hearts" }, { id: "a9", rank: "J", suit: "spades" }, { id: "a10", rank: "J", suit: "clubs" },
  ]},
  // Bob - 2 melds
  { id: "bob-1", type: "set", ownerId: "bob", cards: [
    { id: "b1", rank: "8", suit: "hearts" }, { id: "b2", rank: "8", suit: "spades" }, { id: "b3", rank: "8", suit: "clubs" }, { id: "b4", rank: "8", suit: "diamonds" },
  ]},
  { id: "bob-2", type: "run", ownerId: "bob", cards: [
    { id: "b5", rank: "9", suit: "clubs" }, { id: "b6", rank: "10", suit: "clubs" }, { id: "b7", rank: "J", suit: "clubs" }, { id: "b8", rank: "Q", suit: "clubs" },
  ]},
  // Charlie - 2 melds
  { id: "charlie-1", type: "set", ownerId: "charlie", cards: [
    { id: "c1", rank: "2", suit: "hearts" }, { id: "c2", rank: "2", suit: "spades" }, { id: "c3", rank: "2", suit: "clubs" },
  ]},
  { id: "charlie-2", type: "set", ownerId: "charlie", cards: [
    { id: "c4", rank: "3", suit: "diamonds" }, { id: "c5", rank: "3", suit: "spades" }, { id: "c6", rank: "3", suit: "clubs" },
  ]},
];

/** Interactive drawer demo component */
function LayOffDrawerDemo({ melds, hand }: { melds: Meld[]; hand: Card[] }) {
  const [open, setOpen] = useState(false);

  const handleLayOff = (cardId: string, meldId: string, position?: "start" | "end") => {
    const posText = position ? ` at ${position}` : "";
    alert(`Laid off card ${cardId} to meld ${meldId}${posText}`);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Lay Off Dialog</Button>
      <ResponsiveDrawer
        open={open}
        onOpenChange={setOpen}
        title="Lay Off"
        description="Add cards to existing melds"
        className="sm:max-w-lg"
      >
        <LayOffView
          hand={hand}
          tableMelds={melds}
          players={PLAYERS}
          viewingPlayerId={VIEWING_PLAYER_ID}
          onLayOff={handleLayOff}
          onDone={() => setOpen(false)}
        />
      </ResponsiveDrawer>
    </>
  );
}

export function LayOffViewStory() {
  const handleLayOff = (cardId: string, meldId: string, position?: "start" | "end") => {
    const posText = position ? ` at ${position}` : "";
    alert(`Laid off card ${cardId} to meld ${meldId}${posText}`);
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

      {/* Interactive Dialog Demo - Many Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive Dialog (Many Melds)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button to open the lay off dialog with many melds. Tests scrolling behavior with 4 players and 9 total melds.
        </p>
        <LayOffDrawerDemo melds={MANY_MELDS} hand={SAMPLE_HAND} />
      </section>

      {/* Interactive Dialog Demo - Few Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive Dialog (Few Melds)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click the button to open the lay off dialog with a smaller number of melds.
        </p>
        <LayOffDrawerDemo melds={TABLE_MELDS} hand={SAMPLE_HAND} />
      </section>

      {/* Wild Card Position Selection */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Wild Card Position Selection</h2>
        <div className="border rounded-lg p-4 max-w-md h-80">
          <LayOffView
            hand={HAND_WITH_WILD}
            tableMelds={EXTENSIBLE_RUN_MELDS}
            players={PLAYERS}
            viewingPlayerId={VIEWING_PLAYER_ID}
            onLayOff={handleLayOff}
            onDone={handleDone}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Select the 2♥ or Joker, then tap the run. A position choice dialog will appear
          since wild cards can extend either end of this run (5-6-7♣).
        </p>
      </section>

      {/* Standalone - With Table Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Standalone - With Table Melds</h2>
        <div className="border rounded-lg p-4 max-w-md h-96">
          <LayOffView
            hand={SAMPLE_HAND}
            tableMelds={TABLE_MELDS}
            players={PLAYERS}
            viewingPlayerId={VIEWING_PLAYER_ID}
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
        <div className="border rounded-lg p-4 max-w-md h-80">
          <LayOffView
            hand={SAMPLE_HAND}
            tableMelds={[]}
            players={PLAYERS}
            viewingPlayerId={VIEWING_PLAYER_ID}
            onLayOff={handleLayOff}
            onDone={handleDone}
          />
        </div>
      </section>

      {/* Responsive Comparison - Many Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison (Many Melds)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the lay off view adapts to different container widths with many melds.
        </p>
        <ViewportComparison>
          <div className="border rounded-lg p-4 h-[400px]">
            <LayOffView
              hand={SAMPLE_HAND}
              tableMelds={MANY_MELDS}
              players={PLAYERS}
              viewingPlayerId={VIEWING_PLAYER_ID}
              onLayOff={handleLayOff}
              onDone={handleDone}
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
