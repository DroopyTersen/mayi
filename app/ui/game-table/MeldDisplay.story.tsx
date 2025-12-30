import { MeldDisplay } from "./MeldDisplay";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

// Sample melds for testing
const SET_MELD: Meld = {
  id: "set-1",
  type: "set",
  ownerId: "player-1",
  cards: [
    { id: "1", rank: "9", suit: "hearts" },
    { id: "2", rank: "9", suit: "diamonds" },
    { id: "3", rank: "9", suit: "clubs" },
  ],
};

const RUN_MELD: Meld = {
  id: "run-1",
  type: "run",
  ownerId: "player-1",
  cards: [
    { id: "4", rank: "5", suit: "spades" },
    { id: "5", rank: "6", suit: "spades" },
    { id: "6", rank: "7", suit: "spades" },
    { id: "7", rank: "8", suit: "spades" },
  ],
};

const SET_WITH_WILD: Meld = {
  id: "set-2",
  type: "set",
  ownerId: "player-1",
  cards: [
    { id: "8", rank: "K", suit: "hearts" },
    { id: "9", rank: "K", suit: "spades" },
    { id: "10", rank: "2", suit: "clubs" }, // Wild 2
  ],
};

const RUN_WITH_JOKER: Meld = {
  id: "run-2",
  type: "run",
  ownerId: "player-1",
  cards: [
    { id: "11", rank: "10", suit: "diamonds" },
    { id: "12", rank: "Joker", suit: null }, // Joker as Jack
    { id: "13", rank: "Q", suit: "diamonds" },
    { id: "14", rank: "K", suit: "diamonds" },
  ],
};

const LARGE_SET: Meld = {
  id: "set-3",
  type: "set",
  ownerId: "player-1",
  cards: [
    { id: "15", rank: "A", suit: "hearts" },
    { id: "16", rank: "A", suit: "diamonds" },
    { id: "17", rank: "A", suit: "clubs" },
    { id: "18", rank: "A", suit: "spades" },
    { id: "19", rank: "2", suit: "hearts" }, // Wild
  ],
};

export function MeldDisplayStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">MeldDisplay</h1>
        <p className="text-muted-foreground mt-1">
          Single meld (set or run) with label.
        </p>
      </header>

      {/* Set Meld */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Set (Same Rank)</h2>
        <MeldDisplay meld={SET_MELD} />
        <p className="text-xs text-muted-foreground mt-2">
          Three 9s of different suits.
        </p>
      </section>

      {/* Run Meld */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Run (Sequential)</h2>
        <MeldDisplay meld={RUN_MELD} />
        <p className="text-xs text-muted-foreground mt-2">
          5-6-7-8 of spades.
        </p>
      </section>

      {/* Sizes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Sizes</h2>
        <div className="flex gap-8 items-end">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Small (default)</p>
            <MeldDisplay meld={SET_MELD} size="sm" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Medium</p>
            <MeldDisplay meld={SET_MELD} size="md" />
          </div>
        </div>
      </section>

      {/* With Wild Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Wild Cards</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Set with wild 2</p>
            <MeldDisplay meld={SET_WITH_WILD} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Run with Joker</p>
            <MeldDisplay meld={RUN_WITH_JOKER} />
          </div>
        </div>
      </section>

      {/* Large Meld */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Large Meld (5 cards)</h2>
        <MeldDisplay meld={LARGE_SET} />
        <p className="text-xs text-muted-foreground mt-2">
          Four Aces plus a wild 2.
        </p>
      </section>

      {/* Custom Labels */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Custom Labels</h2>
        <div className="flex gap-8">
          <MeldDisplay meld={SET_MELD} label="Nines" />
          <MeldDisplay meld={RUN_MELD} label="Spade Run" />
        </div>
      </section>

      {/* Side by Side */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Multiple Melds</h2>
        <div className="flex flex-wrap gap-6">
          <MeldDisplay meld={SET_MELD} />
          <MeldDisplay meld={RUN_MELD} />
          <MeldDisplay meld={SET_WITH_WILD} />
          <MeldDisplay meld={RUN_WITH_JOKER} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Multiple melds shown side by side.
        </p>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How multiple melds adapt to different container widths.
        </p>
        <ViewportComparison>
          <div className="p-4 flex flex-wrap gap-4">
            <MeldDisplay meld={SET_MELD} />
            <MeldDisplay meld={RUN_MELD} />
            <MeldDisplay meld={SET_WITH_WILD} />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
