import { PlayerMeldsDisplay } from "./PlayerMeldsDisplay";
import type { Meld } from "core/meld/meld.types";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const PLAYER_WITH_MELDS: Meld[] = [
  {
    id: "meld-1",
    type: "set",
    ownerId: "player-1",
    cards: [
      { id: "1", rank: "9", suit: "hearts" },
      { id: "2", rank: "9", suit: "diamonds" },
      { id: "3", rank: "9", suit: "clubs" },
    ],
  },
  {
    id: "meld-2",
    type: "run",
    ownerId: "player-1",
    cards: [
      { id: "4", rank: "5", suit: "spades" },
      { id: "5", rank: "6", suit: "spades" },
      { id: "6", rank: "7", suit: "spades" },
      { id: "7", rank: "8", suit: "spades" },
    ],
  },
];

const PLAYER_WITH_MANY_MELDS: Meld[] = [
  ...PLAYER_WITH_MELDS,
  {
    id: "meld-3",
    type: "set",
    ownerId: "player-1",
    cards: [
      { id: "8", rank: "K", suit: "hearts" },
      { id: "9", rank: "K", suit: "spades" },
      { id: "10", rank: "K", suit: "diamonds" },
      { id: "11", rank: "2", suit: "clubs" },
    ],
  },
  {
    id: "meld-4",
    type: "run",
    ownerId: "player-1",
    cards: [
      { id: "12", rank: "10", suit: "hearts" },
      { id: "13", rank: "J", suit: "hearts" },
      { id: "14", rank: "Q", suit: "hearts" },
    ],
  },
];

export function PlayerMeldsDisplayStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">PlayerMeldsDisplay</h1>
        <p className="text-muted-foreground mt-1">
          All melds belonging to one player in a bordered container.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <PlayerMeldsDisplay playerName="Alice" melds={PLAYER_WITH_MELDS} />
      </section>

      {/* Current Player */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Current Player</h2>
        <PlayerMeldsDisplay
          playerName="You"
          melds={PLAYER_WITH_MELDS}
          isCurrentPlayer
        />
        <p className="text-xs text-muted-foreground mt-2">
          Current player has highlighted border and "(You)" label.
        </p>
      </section>

      {/* No Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">No Melds</h2>
        <PlayerMeldsDisplay playerName="Bob" melds={[]} />
      </section>

      {/* Many Melds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Many Melds</h2>
        <PlayerMeldsDisplay playerName="Charlie" melds={PLAYER_WITH_MANY_MELDS} />
        <p className="text-xs text-muted-foreground mt-2">
          Melds wrap to multiple rows when there are many.
        </p>
      </section>

      {/* Multiple Players */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Multiple Players</h2>
        <div className="space-y-3">
          <PlayerMeldsDisplay
            playerName="Alice"
            melds={PLAYER_WITH_MELDS}
            isCurrentPlayer
          />
          <PlayerMeldsDisplay
            playerName="Bob"
            melds={[PLAYER_WITH_MELDS[0]!]}
          />
          <PlayerMeldsDisplay playerName="Charlie" melds={[]} />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the player melds display adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="p-2">
            <PlayerMeldsDisplay
              playerName="Alice"
              melds={PLAYER_WITH_MANY_MELDS}
              isCurrentPlayer
            />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
