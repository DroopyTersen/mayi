import type { Card, Rank, Suit } from "core/card/card.types";
import type { Meld } from "core/meld/meld.types";
import { RoundSummaryDialog } from "./RoundSummaryDialog";

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

// Helper to create mock meld
function mockMeld(id: string, ownerId: string, cards: Card[], type: "set" | "run"): Meld {
  return {
    id,
    type,
    cards,
    ownerId,
  };
}

export function RoundSummaryDialogStory() {
  const playerNames = {
    "alice": "Alice",
    "bob": "Bob",
    "charlie": "Charlie",
  };

  const playerAvatars = {
    "alice": "ethel",
    "bob": "curt",
    "charlie": undefined,
  };

  const scores = {
    "alice": 25,
    "bob": 0,
    "charlie": 45,
  };

  const tableMelds: Meld[] = [
    mockMeld("m1", "alice", [
      mockCard("c1", 7, "hearts"),
      mockCard("c2", 7, "spades"),
      mockCard("c3", 7, "diamonds"),
    ], "set"),
    mockMeld("m2", "bob", [
      mockCard("c4", 3, "clubs"),
      mockCard("c5", 4, "clubs"),
      mockCard("c6", 5, "clubs"),
    ], "run"),
    mockMeld("m3", "charlie", [
      mockCard("c7", 10, "hearts"),
      mockCard("c8", 10, "spades"),
      mockCard("c9", 10, "diamonds"),
    ], "set"),
  ];

  const playerHands: Record<string, Card[]> = {
    "alice": [
      mockCard("h1", 8, "hearts"),
      mockCard("h2", 2, "spades"),
    ],
    "bob": [], // Winner
    "charlie": [
      mockCard("h3", 5, "diamonds"),
      mockCard("h4", 9, "clubs"),
      mockCard("h5", 3, "hearts"),
      mockCard("h6", 6, "spades"),
    ],
  };

  return (
    <div className="space-y-8 p-4">
      <h2 className="text-lg font-semibold">RoundSummaryDialog</h2>
      <p className="text-sm text-muted-foreground">
        This component is typically shown as a full-screen overlay.
        Below is a static preview of the dialog content.
      </p>

      {/* Full dialog preview (constrained for story) */}
      <div className="border rounded-lg relative h-[600px] overflow-hidden">
        <RoundSummaryDialog
          roundNumber={3}
          winnerId="bob"
          tableMelds={tableMelds}
          playerHands={playerHands}
          scores={scores}
          playerNames={playerNames}
          playerAvatars={playerAvatars}
          currentPlayerId="alice"
          countdownSeconds={15}
        />
      </div>

      {/* You are the winner */}
      <div className="border rounded-lg relative h-[600px] overflow-hidden">
        <p className="absolute top-2 left-2 text-xs text-muted-foreground z-[60] bg-background px-2 py-1 rounded">
          You (Bob) won this round
        </p>
        <RoundSummaryDialog
          roundNumber={1}
          winnerId="bob"
          tableMelds={tableMelds}
          playerHands={playerHands}
          scores={scores}
          playerNames={playerNames}
          playerAvatars={playerAvatars}
          currentPlayerId="bob"
          countdownSeconds={15}
        />
      </div>
    </div>
  );
}

export const meta = {
  title: "RoundSummaryDialog",
  component: RoundSummaryDialog,
};
