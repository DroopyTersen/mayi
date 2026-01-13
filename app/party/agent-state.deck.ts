/**
 * Deck generation utilities for agent testing
 *
 * Creates decks of cards for test state injection.
 * Uses a deterministic seed for reproducible tests when needed.
 */

import type { Card, Suit, Rank } from "../../core/card/card.types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2",
];

/**
 * Create a standard double deck with jokers (108 cards)
 *
 * This matches the May I? game requirements:
 * - 2 standard 52-card decks
 * - 4 jokers (2 per deck)
 * - Total: 108 cards
 */
export function createDoubleDeck(): Card[] {
  const cards: Card[] = [];
  let cardId = 1;

  // Two full decks
  for (let deckNum = 0; deckNum < 2; deckNum++) {
    // Standard cards
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `card-${cardId++}`,
          suit,
          rank,
        });
      }
    }

    // Jokers (2 per deck)
    cards.push({
      id: `card-${cardId++}`,
      suit: null,
      rank: "Joker",
    });
    cards.push({
      id: `card-${cardId++}`,
      suit: null,
      rank: "Joker",
    });
  }

  return cards;
}

/**
 * Simple seeded random number generator
 *
 * Uses a linear congruential generator for reproducibility.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[], random: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Create a shuffled double deck with deterministic seed
 *
 * @param seed - Optional seed for reproducibility. Default uses current timestamp.
 */
export function createShuffledDeck(seed?: number): Card[] {
  const deck = createDoubleDeck();
  const random = seededRandom(seed ?? Date.now());
  return shuffleArray(deck, random);
}

/**
 * Create a default test deck (shuffled, deterministic seed for tests)
 *
 * Uses seed 12345 for reproducible test scenarios.
 */
export function createDefaultTestDeck(): Card[] {
  return createShuffledDeck(12345);
}
