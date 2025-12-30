import { TableDisplay } from "./TableDisplay";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const PLAYERS = [
  { id: "p1", name: "Alice" },
  { id: "p2", name: "Bob" },
  { id: "p3", name: "Charlie" },
  { id: "p4", name: "Diana" },
];

const MELDS_ON_TABLE: Meld[] = [
  // Alice's melds
  {
    id: "meld-1",
    type: "set",
    ownerId: "p1",
    cards: [
      { id: "1", rank: "9", suit: "hearts" },
      { id: "2", rank: "9", suit: "diamonds" },
      { id: "3", rank: "9", suit: "clubs" },
    ],
  },
  {
    id: "meld-2",
    type: "run",
    ownerId: "p1",
    cards: [
      { id: "4", rank: "5", suit: "spades" },
      { id: "5", rank: "6", suit: "spades" },
      { id: "6", rank: "7", suit: "spades" },
    ],
  },
  // Bob's meld
  {
    id: "meld-3",
    type: "set",
    ownerId: "p2",
    cards: [
      { id: "7", rank: "K", suit: "hearts" },
      { id: "8", rank: "K", suit: "spades" },
      { id: "9", rank: "K", suit: "diamonds" },
    ],
  },
  // Charlie has no melds
  // Diana's meld
  {
    id: "meld-4",
    type: "run",
    ownerId: "p4",
    cards: [
      { id: "10", rank: "10", suit: "hearts" },
      { id: "11", rank: "J", suit: "hearts" },
      { id: "12", rank: "Q", suit: "hearts" },
      { id: "13", rank: "K", suit: "hearts" },
    ],
  },
];

export function TableDisplayStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">TableDisplay</h1>
        <p className="text-muted-foreground mt-1">
          All melds on the table grouped by player.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <TableDisplay melds={MELDS_ON_TABLE} players={PLAYERS} />
        <p className="text-xs text-muted-foreground mt-2">
          Only players with melds are shown. Charlie has no melds.
        </p>
      </section>

      {/* With Current Player */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Current Player</h2>
        <TableDisplay
          melds={MELDS_ON_TABLE}
          players={PLAYERS}
          currentPlayerId="p1"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Alice is the current player, shown with highlighted border.
        </p>
      </section>

      {/* Empty Table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Empty Table</h2>
        <TableDisplay melds={[]} players={PLAYERS} />
      </section>

      {/* Single Player with Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Single Player</h2>
        <TableDisplay
          melds={MELDS_ON_TABLE.filter((m) => m.ownerId === "p2")}
          players={PLAYERS}
          currentPlayerId="p2"
        />
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the table display adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="p-4">
            <TableDisplay
              melds={MELDS_ON_TABLE}
              players={PLAYERS}
              currentPlayerId="p1"
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
