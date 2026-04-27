import { TableDisplay } from "./TableDisplay";
import { MeldDisplay } from "./MeldDisplay";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";
import { InlineLayOffMeldTarget } from "~/ui/game-view/InlineLayOffMeldTarget";

const PLAYERS = [
  { id: "p1", name: "Curt", avatarId: "curt" },
  { id: "p2", name: "Kate", avatarId: "kate" },
  { id: "p3", name: "Andrew", avatarId: "andrew" },
  { id: "p4", name: "Natalie", avatarId: "natalie" },
];

const MELDS_ON_TABLE: Meld[] = [
  // Curt's melds
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
  // Kate's meld
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
  // Andrew has no melds
  // Natalie's meld
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
  const viewerPlayerId = "p2";
  const canLayOffInline = true;

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
          All players are shown. Andrew hasn't laid down yet and shows a placeholder.
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
          Curt is the current player, shown with highlighted border.
        </p>
      </section>

      {/* No One Laid Down Yet */}
      <section>
        <h2 className="text-lg font-semibold mb-3">No One Laid Down Yet</h2>
        <TableDisplay melds={[]} players={PLAYERS} />
        <p className="text-xs text-muted-foreground mt-2">
          All players visible with placeholder text until they lay down.
        </p>
      </section>

      {/* One Player Has Laid Down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">One Player Has Laid Down</h2>
        <TableDisplay
          melds={MELDS_ON_TABLE.filter((m) => m.ownerId === "p2")}
          players={PLAYERS}
          currentPlayerId="p2"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Only Kate has laid down. Others show placeholder text.
        </p>
      </section>

      {/* Inline Lay Off Targets */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Inline Lay Off Targets</h2>
        <TableDisplay
          melds={MELDS_ON_TABLE}
          players={PLAYERS}
          currentPlayerId={viewerPlayerId}
          viewingPlayerId={viewerPlayerId}
          renderMeld={({ meld, player }) => (
            <InlineLayOffMeldTarget
              enabled={canLayOffInline}
              label={`Lay off selected card to ${player.name}'s ${meld.type}`}
              isPending={meld.id === "meld-2"}
              onSelect={() => undefined}
              testId={`inline-layoff-target-${meld.id}`}
            >
              <MeldDisplay meld={meld} size="sm" />
            </InlineLayOffMeldTarget>
          )}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Kate is viewing, down, has drawn, has a selected card, and can lay
          off. TableDisplay owns grouping/layout while the caller wraps each
          meld with inline lay-off target behavior.
        </p>
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
