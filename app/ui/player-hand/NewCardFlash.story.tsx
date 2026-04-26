import { useState } from "react";
import type { Card } from "core/card/card.types";
import { HandDisplay } from "./HandDisplay";
import { Button } from "~/shadcn/components/ui/button";

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const satisfies readonly NonNullable<Card["suit"]>[];
const RANKS: Card["rank"][] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

let drawCounter = 0;
function makeCard(rank: Card["rank"], suit: NonNullable<Card["suit"]>): Card {
  drawCounter += 1;
  return { id: `flash-${drawCounter}`, rank, suit };
}

function makeJoker(): Card {
  drawCounter += 1;
  return { id: `flash-${drawCounter}`, rank: "Joker", suit: null };
}

function randomCard(): Card {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)] ?? "2";
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? "hearts";
  return makeCard(rank, suit);
}

const STARTING_HAND: Card[] = [
  makeCard("4", "hearts"),
  makeCard("6", "spades"),
  makeCard("10", "diamonds"),
  makeCard("J", "clubs"),
  makeCard("K", "hearts"),
];

export function NewCardFlashStory() {
  const [hand, setHand] = useState<Card[]>(STARTING_HAND);

  const drawRandom = () => setHand((h) => [...h, randomCard()]);
  const drawJoker = () => setHand((h) => [...h, makeJoker()]);
  const drawTwo = () =>
    setHand((h) => [...h, randomCard(), randomCard()]);
  const drawFour = () =>
    setHand((h) => [
      ...h,
      randomCard(),
      randomCard(),
      randomCard(),
      randomCard(),
    ]);
  const reset = () => setHand(STARTING_HAND);

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">New Card Flash</h1>
        <p className="text-muted-foreground mt-1">
          When a card is added to the hand, it briefly pulses with an amber
          glow so the player notices what they just drew.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Try the buttons below — each one mutates the hand. A single new card
          flashes; a batch of 4+ is treated as an initial deal and skipped.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={drawRandom}>Draw 1 random card</Button>
        <Button onClick={drawJoker} variant="secondary">
          Draw a Joker
        </Button>
        <Button onClick={drawTwo} variant="outline">
          Draw 2 cards (May I pickup)
        </Button>
        <Button onClick={drawFour} variant="outline">
          Draw 4 cards (initial deal — no flash)
        </Button>
        <Button onClick={reset} variant="ghost">
          Reset
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Hand ({hand.length} cards)
        </h2>
        <div className="border rounded-lg p-6 bg-card">
          <HandDisplay cards={hand} size="lg" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Auto-sized (container queries)
        </h2>
        <div className="border rounded-lg p-6 bg-card">
          <HandDisplay cards={hand} size="auto" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Small size
        </h2>
        <div className="border rounded-lg p-6 bg-card">
          <HandDisplay cards={hand} size="sm" />
        </div>
      </section>
    </div>
  );
}
