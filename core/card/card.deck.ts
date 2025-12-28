import type { Card, Suit, Rank } from "./card.types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
];

export interface DeckOptions {
  deckCount: number;
  jokerCount: number;
}

/**
 * Create a deck of cards for May I?
 *
 * Setup:
 * - 3-5 players: 2 decks + 4 jokers (108 cards)
 * - 6-8 players: 3 decks + 6 jokers (162 cards)
 */
export function createDeck(options: DeckOptions): Card[] {
  const { deckCount, jokerCount } = options;
  const cards: Card[] = [];
  let cardId = 0;

  // Create standard deck(s)
  for (let deck = 0; deck < deckCount; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `card-${cardId++}`,
          suit,
          rank,
        });
      }
    }
  }

  // Add jokers
  for (let i = 0; i < jokerCount; i++) {
    cards.push({
      id: `card-${cardId++}`,
      suit: null,
      rank: "Joker",
    });
  }

  return cards;
}

/**
 * Shuffle a deck of cards using Fisher-Yates algorithm
 * Returns a new shuffled array, does not mutate the original
 */
export function shuffle(cards: Card[]): Card[] {
  const shuffled = [...cards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
