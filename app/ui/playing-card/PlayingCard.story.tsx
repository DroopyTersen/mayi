import { PlayingCard } from "./PlayingCard";
import type { Card } from "core/card/card.types";

// Helper to create card objects
function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}`, rank, suit };
}

export function PlayingCardStory() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">PlayingCard</h1>
        <p className="text-muted-foreground mt-1">
          Single playing card display with rank and suit.
        </p>
      </header>

      {/* Sizes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Sizes</h2>
        <div className="flex gap-4 items-end">
          <div className="text-center">
            <PlayingCard card={card("K", "hearts")} size="sm" />
            <p className="text-xs text-muted-foreground mt-1">sm</p>
          </div>
          <div className="text-center">
            <PlayingCard card={card("K", "hearts")} size="md" />
            <p className="text-xs text-muted-foreground mt-1">md</p>
          </div>
          <div className="text-center">
            <PlayingCard card={card("K", "hearts")} size="lg" />
            <p className="text-xs text-muted-foreground mt-1">lg</p>
          </div>
        </div>
      </section>

      {/* Suits */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Suits</h2>
        <div className="flex gap-2">
          <PlayingCard card={card("9", "hearts")} />
          <PlayingCard card={card("9", "diamonds")} />
          <PlayingCard card={card("9", "clubs")} />
          <PlayingCard card={card("9", "spades")} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Hearts and diamonds are red, clubs and spades are black.
        </p>
      </section>

      {/* All Ranks */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Ranks</h2>
        <div className="flex flex-wrap gap-2">
          <PlayingCard card={card("A", "spades")} />
          <PlayingCard card={card("K", "spades")} />
          <PlayingCard card={card("Q", "spades")} />
          <PlayingCard card={card("J", "spades")} />
          <PlayingCard card={card("10", "spades")} />
          <PlayingCard card={card("9", "spades")} />
          <PlayingCard card={card("8", "spades")} />
          <PlayingCard card={card("7", "spades")} />
          <PlayingCard card={card("6", "spades")} />
          <PlayingCard card={card("5", "spades")} />
          <PlayingCard card={card("4", "spades")} />
          <PlayingCard card={card("3", "spades")} />
          <PlayingCard card={card("2", "spades")} />
        </div>
      </section>

      {/* Wild Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Wild Cards</h2>
        <div className="flex gap-2">
          <PlayingCard card={card("Joker", null)} />
          <PlayingCard card={card("2", "hearts")} />
          <PlayingCard card={card("2", "clubs")} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Jokers and 2s are wild. They have a subtle amber background.
        </p>
      </section>

      {/* Selected State */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Selected State</h2>
        <div className="flex gap-2">
          <div className="text-center">
            <PlayingCard card={card("A", "hearts")} />
            <p className="text-xs text-muted-foreground mt-1">Normal</p>
          </div>
          <div className="text-center">
            <PlayingCard card={card("A", "hearts")} selected />
            <p className="text-xs text-muted-foreground mt-1">Selected</p>
          </div>
        </div>
      </section>

      {/* Interactive */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Interactive</h2>
        <div className="flex gap-2">
          <div className="text-center">
            <PlayingCard card={card("Q", "diamonds")} />
            <p className="text-xs text-muted-foreground mt-1">No onClick</p>
          </div>
          <div className="text-center">
            <PlayingCard
              card={card("Q", "diamonds")}
              onClick={() => alert("Clicked!")}
            />
            <p className="text-xs text-muted-foreground mt-1">With onClick</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Cards with onClick have hover effects.
        </p>
      </section>

      {/* Face Down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Face Down</h2>
        <div className="flex gap-4 items-end">
          <div className="text-center">
            <PlayingCard card={card("A", "spades")} size="sm" faceDown />
            <p className="text-xs text-muted-foreground mt-1">sm</p>
          </div>
          <div className="text-center">
            <PlayingCard card={card("A", "spades")} size="md" faceDown />
            <p className="text-xs text-muted-foreground mt-1">md</p>
          </div>
          <div className="text-center">
            <PlayingCard card={card("A", "spades")} size="lg" faceDown />
            <p className="text-xs text-muted-foreground mt-1">lg</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Face-down cards show a blue pattern back.
        </p>
      </section>
    </div>
  );
}
