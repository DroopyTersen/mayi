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
    const cardI = shuffled[i];
    const cardJ = shuffled[j];
    if (cardI !== undefined && cardJ !== undefined) {
      shuffled[i] = cardJ;
      shuffled[j] = cardI;
    }
  }

  return shuffled;
}

const CARDS_PER_HAND = 11;

export interface DealResult {
  hands: Card[][];
  stock: Card[];
  discard: Card[];
}

/**
 * Deal cards to players for May I?
 *
 * - Each player receives 11 cards
 * - Remaining cards form the stock pile
 * - Top card from stock starts the discard pile
 *
 * Does not mutate the original deck.
 */
export function deal(deck: Card[], playerCount: number): DealResult {
  const cardsNeeded = playerCount * CARDS_PER_HAND + 1; // +1 for initial discard

  if (deck.length < cardsNeeded) {
    throw new Error(
      `Not enough cards to deal. Need ${cardsNeeded}, have ${deck.length}`
    );
  }

  const cards = [...deck];

  // Helper to safely shift a card (we've verified enough cards exist)
  const shiftCard = (): Card => {
    const card = cards.shift();
    if (card === undefined) {
      throw new Error("Unexpected: ran out of cards during deal");
    }
    return card;
  };

  // Deal 11 cards to each player
  const hands: Card[][] = [];
  for (let p = 0; p < playerCount; p++) {
    hands.push([]);
  }

  // Deal one card at a time to each player (round-robin style)
  for (let cardNum = 0; cardNum < CARDS_PER_HAND; cardNum++) {
    for (let p = 0; p < playerCount; p++) {
      const hand = hands[p];
      if (hand !== undefined) {
        hand.push(shiftCard());
      }
    }
  }

  // Top card goes to discard pile
  const discard = [shiftCard()];

  // Remaining cards form the stock
  const stock = cards;

  return { hands, stock, discard };
}
