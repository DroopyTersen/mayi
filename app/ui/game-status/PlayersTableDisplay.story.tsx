import { PlayersTableDisplay } from "./PlayersTableDisplay";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

const SAMPLE_PLAYERS = [
  { id: "p1", name: "Alice", cardCount: 8, isDown: true, score: 45 },
  { id: "p2", name: "Bob", cardCount: 11, isDown: false, score: 120 },
  { id: "p3", name: "Charlie", cardCount: 6, isDown: true, score: 30 },
  { id: "p4", name: "Diana", cardCount: 9, isDown: false, score: 85 },
];

const EARLY_GAME_PLAYERS = [
  { id: "p1", name: "Alice", cardCount: 11, isDown: false, score: 0 },
  { id: "p2", name: "Bob", cardCount: 11, isDown: false, score: 0 },
  { id: "p3", name: "Charlie", cardCount: 11, isDown: false, score: 0 },
];

const TWO_PLAYERS = [
  { id: "p1", name: "Alice", cardCount: 3, isDown: true, score: 25 },
  { id: "p2", name: "Bob", cardCount: 0, isDown: true, score: 0 },
];

export function PlayersTableDisplayStory() {
  return (
    <div className="space-y-10 max-w-md">
      <header>
        <h1 className="text-2xl font-bold">PlayersTableDisplay</h1>
        <p className="text-muted-foreground mt-1">
          Table showing all players' status in the game.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default (4 players)</h2>
        <PlayersTableDisplay players={SAMPLE_PLAYERS} />
      </section>

      {/* With Current Player */}
      <section>
        <h2 className="text-lg font-semibold mb-3">With Current Player</h2>
        <PlayersTableDisplay players={SAMPLE_PLAYERS} currentPlayerId="p1" />
        <p className="text-xs text-muted-foreground mt-2">
          Alice is the current player, row is highlighted.
        </p>
      </section>

      {/* Current Player in Middle */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Current Player in Middle</h2>
        <PlayersTableDisplay players={SAMPLE_PLAYERS} currentPlayerId="p3" />
      </section>

      {/* Early Game */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Early Game</h2>
        <PlayersTableDisplay
          players={EARLY_GAME_PLAYERS}
          currentPlayerId="p2"
        />
        <p className="text-xs text-muted-foreground mt-2">
          No one is down yet, all scores are 0.
        </p>
      </section>

      {/* Two Players */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Two Players</h2>
        <PlayersTableDisplay players={TWO_PLAYERS} currentPlayerId="p2" />
        <p className="text-xs text-muted-foreground mt-2">
          Bob just went out (0 cards).
        </p>
      </section>

      {/* Wide Container */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Full Width</h2>
        <div className="max-w-xl">
          <PlayersTableDisplay players={SAMPLE_PLAYERS} currentPlayerId="p1" />
        </div>
      </section>

      {/* Responsive */}
      <section className="max-w-none">
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the players table adapts to different container widths.
        </p>
        <ViewportComparison>
          <div className="p-2">
            <PlayersTableDisplay players={SAMPLE_PLAYERS} currentPlayerId="p1" />
          </div>
        </ViewportComparison>
      </section>
    </div>
  );
}
