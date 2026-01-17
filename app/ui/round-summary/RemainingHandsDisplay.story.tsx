import type { Card, Rank, Suit } from "core/card/card.types";
import { RemainingHandsDisplay } from "./RemainingHandsDisplay";

// Rank mapping for story convenience
const rankMap: Record<number, Rank> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};

// Helper to create mock cards
function mockCard(id: string, rankNum: number, suit: Suit): Card {
  return {
    id,
    rank: rankMap[rankNum] ?? "A",
    suit,
  };
}

export function RemainingHandsDisplayStory() {
  const playerNames = {
    "alice": "Alice",
    "bob": "Bob",
    "charlie": "Charlie",
  };

  const playerHands: Record<string, Card[]> = {
    "alice": [], // Winner - went out
    "bob": [
      mockCard("b1", 7, "hearts"),
      mockCard("b2", 10, "spades"),
      mockCard("b3", 3, "diamonds"),
    ],
    "charlie": [
      mockCard("c1", 5, "clubs"),
      mockCard("c2", 8, "hearts"),
      mockCard("c3", 2, "spades"),
      mockCard("c4", 9, "diamonds"),
      mockCard("c5", 4, "clubs"),
    ],
  };

  const suits = ["hearts", "spades", "diamonds", "clubs"] as const;
  const manyCards: Card[] = Array.from({ length: 12 }, (_, i) =>
    mockCard(`m${i}`, (i % 10) + 3, suits[i % 4] as Suit)
  );

  return (
    <div className="space-y-8 p-4">
      <h2 className="text-lg font-semibold">RemainingHandsDisplay</h2>

      <div className="space-y-6">
        {/* Normal case */}
        <div className="border rounded-lg p-4 max-w-md">
          <p className="text-sm text-muted-foreground mb-4">
            Alice went out, Bob and Charlie have remaining cards
          </p>
          <RemainingHandsDisplay
            playerHands={playerHands}
            playerNames={playerNames}
            winnerId="alice"
            currentPlayerId="bob"
          />
        </div>

        {/* Many cards */}
        <div className="border rounded-lg p-4 max-w-md">
          <p className="text-sm text-muted-foreground mb-4">
            Player with many remaining cards (12)
          </p>
          <RemainingHandsDisplay
            playerHands={{
              "winner": [],
              "unlucky": manyCards,
            }}
            playerNames={{
              "winner": "Winner",
              "unlucky": "Unlucky Player",
            }}
            winnerId="winner"
            currentPlayerId="unlucky"
          />
        </div>

        {/* You are the winner */}
        <div className="border rounded-lg p-4 max-w-md">
          <p className="text-sm text-muted-foreground mb-4">
            You went out (you = alice), others have cards
          </p>
          <RemainingHandsDisplay
            playerHands={playerHands}
            playerNames={playerNames}
            winnerId="alice"
            currentPlayerId="alice"
          />
        </div>
      </div>
    </div>
  );
}

export const meta = {
  title: "RemainingHandsDisplay",
  component: RemainingHandsDisplay,
};
