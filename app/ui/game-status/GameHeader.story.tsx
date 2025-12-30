import { GameHeader } from "./GameHeader";
import { ViewportComparison } from "~/storybook/ViewportSimulator";

// Standard May I? contracts by round
const CONTRACTS = [
  { sets: 2, runs: 0 }, // Round 1
  { sets: 1, runs: 1 }, // Round 2
  { sets: 0, runs: 2 }, // Round 3
  { sets: 3, runs: 0 }, // Round 4
  { sets: 2, runs: 1 }, // Round 5
  { sets: 1, runs: 2 }, // Round 6
];

export function GameHeaderStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">GameHeader</h1>
        <p className="text-muted-foreground mt-1">
          Displays round information and current contract.
        </p>
      </header>

      {/* Default */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Default</h2>
        <GameHeader round={1} totalRounds={6} contract={CONTRACTS[0]!} />
      </section>

      {/* All Rounds */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Rounds</h2>
        <div className="space-y-2">
          {CONTRACTS.map((contract, i) => (
            <GameHeader
              key={i}
              round={i + 1}
              totalRounds={6}
              contract={contract}
            />
          ))}
        </div>
      </section>

      {/* Mid-Game */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Mid-Game (Round 4)</h2>
        <GameHeader round={4} totalRounds={6} contract={CONTRACTS[3]!} />
      </section>

      {/* Final Round */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Final Round</h2>
        <GameHeader round={6} totalRounds={6} contract={CONTRACTS[5]!} />
      </section>

      {/* Custom Contracts */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Custom Contracts</h2>
        <div className="space-y-2">
          <GameHeader round={1} totalRounds={4} contract={{ sets: 1, runs: 0 }} />
          <GameHeader round={2} totalRounds={4} contract={{ sets: 0, runs: 1 }} />
          <GameHeader round={3} totalRounds={4} contract={{ sets: 2, runs: 2 }} />
        </div>
      </section>

      {/* Responsive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Responsive Comparison</h2>
        <p className="text-sm text-muted-foreground mb-4">
          How the game header adapts to different container widths.
        </p>
        <ViewportComparison>
          <GameHeader round={4} totalRounds={6} contract={CONTRACTS[3]!} />
        </ViewportComparison>
      </section>
    </div>
  );
}
