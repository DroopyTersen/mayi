import { ScoreBreakdown } from "./ScoreBreakdown";

export function ScoreBreakdownStory() {
  const scores = {
    "player-1": 45,
    "player-2": 12,
    "player-3": 78,
    "player-4": 25,
  };

  const playerNames = {
    "player-1": "Alice",
    "player-2": "Bob",
    "player-3": "Charlie",
    "player-4": "Diana",
  };

  return (
    <div className="space-y-8 p-4">
      <h2 className="text-lg font-semibold">ScoreBreakdown</h2>

      <div className="space-y-6">
        {/* Winner is not you */}
        <div className="border rounded-lg p-4 max-w-sm">
          <p className="text-sm text-muted-foreground mb-4">
            Bob went out, you are Alice
          </p>
          <ScoreBreakdown
            scores={scores}
            playerNames={playerNames}
            winnerId="player-2"
            currentPlayerId="player-1"
          />
        </div>

        {/* Winner is you */}
        <div className="border rounded-lg p-4 max-w-sm">
          <p className="text-sm text-muted-foreground mb-4">
            You (Alice) went out
          </p>
          <ScoreBreakdown
            scores={scores}
            playerNames={playerNames}
            winnerId="player-1"
            currentPlayerId="player-1"
          />
        </div>

        {/* Tight scores */}
        <div className="border rounded-lg p-4 max-w-sm">
          <p className="text-sm text-muted-foreground mb-4">
            Close game (similar scores)
          </p>
          <ScoreBreakdown
            scores={{
              "p1": 100,
              "p2": 102,
              "p3": 98,
            }}
            playerNames={{
              "p1": "Alice",
              "p2": "Bob",
              "p3": "Charlie",
            }}
            winnerId="p3"
            currentPlayerId="p1"
          />
        </div>
      </div>
    </div>
  );
}

export const meta = {
  title: "ScoreBreakdown",
  component: ScoreBreakdown,
};
