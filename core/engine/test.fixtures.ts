/**
 * Test fixtures for setting up deterministic game states
 *
 * These helpers create PredefinedRoundState objects that can be injected
 * into RoundMachine to test specific scenarios without random dealing.
 */

import type { Card, Suit } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { PredefinedRoundState } from "./round.machine";
import { createDeck, shuffle, deal } from "../card/card.deck";

/**
 * Creates cards with deterministic IDs for testing
 */
export function createTestCard(
  rank: Card["rank"],
  suit: Suit | null,
  id?: string
): Card {
  const cardId = id ?? `${rank}-${suit ?? "joker"}`;
  return {
    id: cardId,
    rank,
    suit,
  };
}

/**
 * Creates a standard test hand with 11 cards
 */
export function createTestHand(cards: Array<{ rank: Card["rank"]; suit: Suit }>): Card[] {
  return cards.map((c, i) => createTestCard(c.rank, c.suit, `hand-${i}-${c.rank}-${c.suit}`));
}

/**
 * Fixture: Basic 3-player setup with dealt hands
 * Returns a predefined state where each player has 11 cards
 */
export function createBasicThreePlayerState(): PredefinedRoundState {
  // Use real dealing to get a valid state
  const deck = createDeck({ deckCount: 2, jokerCount: 4 });
  const shuffled = shuffle(deck);
  const dealResult = deal(shuffled, 3);

  return {
    hands: dealResult.hands,
    stock: dealResult.stock,
    discard: dealResult.discard,
    table: [],
  };
}

/**
 * Fixture: Player about to go out
 * Creates a state where player 0 has exactly the cards needed to complete
 * the Round 1 contract (2 sets of 3) and discard their last card
 */
export function createAboutToGoOutState(): PredefinedRoundState {
  // Player 0: Has 2 sets of 3 + 1 card to discard (7 cards total needed for contract, but they have 11)
  // For Round 1: 2 sets required
  // Each set needs 3+ cards of same rank
  const player0Hand: Card[] = [
    // Set 1: Three Kings
    createTestCard("K", "hearts", "p0-K-H"),
    createTestCard("K", "diamonds", "p0-K-D"),
    createTestCard("K", "spades", "p0-K-S"),
    // Set 2: Three Queens
    createTestCard("Q", "hearts", "p0-Q-H"),
    createTestCard("Q", "diamonds", "p0-Q-D"),
    createTestCard("Q", "clubs", "p0-Q-C"),
    // Card to discard
    createTestCard("3", "hearts", "p0-discard"),
  ];

  // Other players have standard hands
  const player1Hand = createTestHand([
    { rank: "5", suit: "hearts" },
    { rank: "6", suit: "hearts" },
    { rank: "7", suit: "hearts" },
    { rank: "8", suit: "hearts" },
    { rank: "9", suit: "hearts" },
    { rank: "10", suit: "hearts" },
    { rank: "J", suit: "hearts" },
    { rank: "A", suit: "hearts" },
    { rank: "5", suit: "diamonds" },
    { rank: "6", suit: "diamonds" },
    { rank: "7", suit: "diamonds" },
  ]);

  const player2Hand = createTestHand([
    { rank: "5", suit: "clubs" },
    { rank: "6", suit: "clubs" },
    { rank: "7", suit: "clubs" },
    { rank: "8", suit: "clubs" },
    { rank: "9", suit: "clubs" },
    { rank: "10", suit: "clubs" },
    { rank: "J", suit: "clubs" },
    { rank: "A", suit: "clubs" },
    { rank: "5", suit: "spades" },
    { rank: "6", suit: "spades" },
    { rank: "7", suit: "spades" },
  ]);

  // Small stock and discard
  const stock: Card[] = [
    createTestCard("4", "hearts", "stock-1"),
    createTestCard("4", "diamonds", "stock-2"),
    createTestCard("4", "clubs", "stock-3"),
  ];

  const discard: Card[] = [createTestCard("3", "clubs", "discard-top")];

  return {
    hands: [player0Hand, player1Hand, player2Hand],
    stock,
    discard,
    table: [],
  };
}

/**
 * Fixture: Stock nearly depleted
 * Creates a state where the stock has only a few cards left
 */
export function createLowStockState(): PredefinedRoundState {
  const baseState = createBasicThreePlayerState();

  // Move most stock cards to discard
  const stockToKeep = 2;
  const movedCards = baseState.stock.slice(stockToKeep);

  return {
    ...baseState,
    stock: baseState.stock.slice(0, stockToKeep),
    discard: [...baseState.discard, ...movedCards],
  };
}

/**
 * Fixture: Stock empty (needs reshuffle)
 */
export function createEmptyStockState(): PredefinedRoundState {
  const baseState = createBasicThreePlayerState();

  return {
    ...baseState,
    stock: [],
    discard: [...baseState.discard, ...baseState.stock],
  };
}

/**
 * Fixture: Player already laid down (isDown = true)
 * Creates a state where player 0 has already laid down melds
 */
export function createPlayerDownState(): PredefinedRoundState {
  // Player 0 already laid down and has fewer cards
  const player0Hand: Card[] = [
    createTestCard("3", "hearts", "p0-1"),
    createTestCard("4", "hearts", "p0-2"),
    createTestCard("5", "hearts", "p0-3"),
    createTestCard("6", "hearts", "p0-4"),
    createTestCard("7", "hearts", "p0-5"),
  ];

  const player1Hand = createTestHand([
    { rank: "5", suit: "diamonds" },
    { rank: "6", suit: "diamonds" },
    { rank: "7", suit: "diamonds" },
    { rank: "8", suit: "diamonds" },
    { rank: "9", suit: "diamonds" },
    { rank: "10", suit: "diamonds" },
    { rank: "J", suit: "diamonds" },
    { rank: "A", suit: "diamonds" },
    { rank: "5", suit: "clubs" },
    { rank: "6", suit: "clubs" },
    { rank: "7", suit: "clubs" },
  ]);

  const player2Hand = createTestHand([
    { rank: "5", suit: "spades" },
    { rank: "6", suit: "spades" },
    { rank: "7", suit: "spades" },
    { rank: "8", suit: "spades" },
    { rank: "9", suit: "spades" },
    { rank: "10", suit: "spades" },
    { rank: "J", suit: "spades" },
    { rank: "A", suit: "spades" },
    { rank: "K", suit: "hearts" },
    { rank: "K", suit: "diamonds" },
    { rank: "K", suit: "clubs" },
  ]);

  const stock: Card[] = [
    createTestCard("4", "clubs", "stock-1"),
    createTestCard("4", "diamonds", "stock-2"),
    createTestCard("4", "spades", "stock-3"),
    createTestCard("8", "hearts", "stock-4"),
    createTestCard("9", "hearts", "stock-5"),
  ];

  const discard: Card[] = [createTestCard("3", "clubs", "discard-top")];

  // Melds that player 0 laid down
  const table: Meld[] = [
    {
      id: "meld-player-0-0",
      type: "set",
      cards: [
        createTestCard("Q", "hearts", "table-Q-H"),
        createTestCard("Q", "diamonds", "table-Q-D"),
        createTestCard("Q", "clubs", "table-Q-C"),
      ],
      ownerId: "player-0",
    },
    {
      id: "meld-player-0-1",
      type: "set",
      cards: [
        createTestCard("J", "hearts", "table-J-H"),
        createTestCard("J", "diamonds", "table-J-D"),
        createTestCard("J", "spades", "table-J-S"),
      ],
      ownerId: "player-0",
    },
  ];

  return {
    hands: [player0Hand, player1Hand, player2Hand],
    stock,
    discard,
    table,
    playerDownStatus: [true, false, false],
  };
}

/**
 * Fixture: Player has one card left (can go out by discarding)
 */
export function createOneCardLeftState(): PredefinedRoundState {
  const baseState = createPlayerDownState();

  // Player 0 has just 1 card
  return {
    ...baseState,
    hands: [
      [createTestCard("3", "hearts", "p0-last")],
      baseState.hands[1]!,
      baseState.hands[2]!,
    ],
    playerDownStatus: [true, false, false],
  };
}

/**
 * Fixture: Player can go out via sequential LAY_OFF
 * Player 0 is down, has 2 cards that can be laid off to existing melds
 * After drawing, they can LAY_OFF all 3 cards to trigger wentOut
 */
export function createCanGoOutState(): PredefinedRoundState {
  // Player 0 is down and has 2 Queens (can lay off to Queens meld)
  const player0Hand: Card[] = [
    createTestCard("Q", "spades", "p0-Q-S"), // Can lay off to Queens meld
    createTestCard("J", "clubs", "p0-J-C"),  // Can lay off to Jacks meld
  ];

  const player1Hand = createTestHand([
    { rank: "5", suit: "diamonds" },
    { rank: "6", suit: "diamonds" },
    { rank: "7", suit: "diamonds" },
    { rank: "8", suit: "diamonds" },
    { rank: "9", suit: "diamonds" },
    { rank: "10", suit: "diamonds" },
    { rank: "J", suit: "diamonds" },
    { rank: "A", suit: "diamonds" },
    { rank: "5", suit: "clubs" },
    { rank: "6", suit: "clubs" },
    { rank: "7", suit: "clubs" },
  ]);

  const player2Hand = createTestHand([
    { rank: "5", suit: "spades" },
    { rank: "6", suit: "spades" },
    { rank: "7", suit: "spades" },
    { rank: "8", suit: "spades" },
    { rank: "9", suit: "spades" },
    { rank: "10", suit: "spades" },
    { rank: "J", suit: "spades" },
    { rank: "A", suit: "spades" },
    { rank: "K", suit: "hearts" },
    { rank: "K", suit: "diamonds" },
    { rank: "K", suit: "clubs" },
  ]);

  // Stock has a Queen that player 0 can draw and lay off
  const stock: Card[] = [
    createTestCard("Q", "diamonds", "stock-Q-D"), // Can be laid off to Queens
    createTestCard("4", "diamonds", "stock-2"),
    createTestCard("4", "spades", "stock-3"),
  ];

  const discard: Card[] = [createTestCard("3", "clubs", "discard-top")];

  // Melds on table - player 0 can lay off to these
  const table: Meld[] = [
    {
      id: "meld-player-0-0",
      type: "set",
      cards: [
        createTestCard("Q", "hearts", "table-Q-H"),
        createTestCard("Q", "clubs", "table-Q-C"),
        createTestCard("2", "hearts", "table-wild"), // Wild used in set
      ],
      ownerId: "player-0",
    },
    {
      id: "meld-player-0-1",
      type: "set",
      cards: [
        createTestCard("J", "hearts", "table-J-H"),
        createTestCard("J", "diamonds", "table-J-D"),
        createTestCard("J", "spades", "table-J-S"),
      ],
      ownerId: "player-0",
    },
  ];

  return {
    hands: [player0Hand, player1Hand, player2Hand],
    stock,
    discard,
    table,
    playerDownStatus: [true, false, false],
  };
}

/**
 * Fixture: Creates a specific hand for May I testing
 * Player 1 (not current) has cards that match the discard
 */
export function createMayIScenarioState(): PredefinedRoundState {
  // Player 0 (current) doesn't want discard
  const player0Hand: Card[] = [
    createTestCard("5", "hearts", "p0-1"),
    createTestCard("6", "hearts", "p0-2"),
    createTestCard("7", "hearts", "p0-3"),
    createTestCard("8", "hearts", "p0-4"),
    createTestCard("9", "hearts", "p0-5"),
    createTestCard("10", "hearts", "p0-6"),
    createTestCard("J", "hearts", "p0-7"),
    createTestCard("Q", "hearts", "p0-8"),
    createTestCard("K", "hearts", "p0-9"),
    createTestCard("A", "hearts", "p0-10"),
    createTestCard("3", "hearts", "p0-11"),
  ];

  // Player 1 wants the discard (has 2 Kings, discard is King)
  const player1Hand: Card[] = [
    createTestCard("K", "diamonds", "p1-K-D"),
    createTestCard("K", "spades", "p1-K-S"),
    createTestCard("5", "clubs", "p1-3"),
    createTestCard("6", "clubs", "p1-4"),
    createTestCard("7", "clubs", "p1-5"),
    createTestCard("8", "clubs", "p1-6"),
    createTestCard("9", "clubs", "p1-7"),
    createTestCard("10", "clubs", "p1-8"),
    createTestCard("J", "clubs", "p1-9"),
    createTestCard("Q", "clubs", "p1-10"),
    createTestCard("A", "clubs", "p1-11"),
  ];

  const player2Hand = createTestHand([
    { rank: "5", suit: "spades" },
    { rank: "6", suit: "spades" },
    { rank: "7", suit: "spades" },
    { rank: "8", suit: "spades" },
    { rank: "9", suit: "spades" },
    { rank: "10", suit: "spades" },
    { rank: "J", suit: "spades" },
    { rank: "Q", suit: "spades" },
    { rank: "A", suit: "spades" },
    { rank: "3", suit: "diamonds" },
    { rank: "4", suit: "diamonds" },
  ]);

  const stock: Card[] = [
    createTestCard("4", "hearts", "stock-1"),
    createTestCard("4", "clubs", "stock-2"),
    createTestCard("2", "hearts", "stock-3"),
    createTestCard("2", "clubs", "stock-4"),
    createTestCard("2", "diamonds", "stock-5"),
  ];

  // King on discard - player 1 would want this for their set
  const discard: Card[] = [createTestCard("K", "clubs", "discard-K-C")];

  return {
    hands: [player0Hand, player1Hand, player2Hand],
    stock,
    discard,
    table: [],
  };
}

/**
 * Fixture: Player can lay down (meet Round 1 contract: 2 sets)
 * Player 0 has 2 sets of 3 cards each, plus extra cards
 * They are NOT down yet (isDown: false)
 */
export function createCanLayDownState(): PredefinedRoundState {
  // Player 0 has 2 sets ready + extra cards (11 total after drawing)
  // Set 1: Three Kings, Set 2: Three Queens, plus 4 extra cards
  const player0Hand: Card[] = [
    // Set 1: Three Kings
    createTestCard("K", "hearts", "p0-K-H"),
    createTestCard("K", "diamonds", "p0-K-D"),
    createTestCard("K", "spades", "p0-K-S"),
    // Set 2: Three Queens
    createTestCard("Q", "hearts", "p0-Q-H"),
    createTestCard("Q", "diamonds", "p0-Q-D"),
    createTestCard("Q", "clubs", "p0-Q-C"),
    // Extra cards (will remain in hand after laying down)
    createTestCard("3", "hearts", "p0-3-H"),
    createTestCard("4", "hearts", "p0-4-H"),
    createTestCard("5", "hearts", "p0-5-H"),
    createTestCard("6", "hearts", "p0-6-H"),
    createTestCard("7", "hearts", "p0-7-H"),
  ];

  const player1Hand = createTestHand([
    { rank: "5", suit: "diamonds" },
    { rank: "6", suit: "diamonds" },
    { rank: "7", suit: "diamonds" },
    { rank: "8", suit: "diamonds" },
    { rank: "9", suit: "diamonds" },
    { rank: "10", suit: "diamonds" },
    { rank: "J", suit: "diamonds" },
    { rank: "A", suit: "diamonds" },
    { rank: "5", suit: "clubs" },
    { rank: "6", suit: "clubs" },
    { rank: "7", suit: "clubs" },
  ]);

  const player2Hand = createTestHand([
    { rank: "5", suit: "spades" },
    { rank: "6", suit: "spades" },
    { rank: "7", suit: "spades" },
    { rank: "8", suit: "spades" },
    { rank: "9", suit: "spades" },
    { rank: "10", suit: "spades" },
    { rank: "J", suit: "spades" },
    { rank: "A", suit: "spades" },
    { rank: "K", suit: "clubs" },
    { rank: "Q", suit: "spades" },
    { rank: "J", suit: "clubs" },
  ]);

  const stock: Card[] = [
    createTestCard("8", "hearts", "stock-1"),
    createTestCard("9", "hearts", "stock-2"),
    createTestCard("10", "hearts", "stock-3"),
    createTestCard("J", "hearts", "stock-4"),
    createTestCard("A", "hearts", "stock-5"),
  ];

  const discard: Card[] = [createTestCard("2", "clubs", "discard-top")];

  return {
    hands: [player0Hand, player1Hand, player2Hand],
    stock,
    discard,
    table: [],
    playerDownStatus: [false, false, false], // No one is down yet
  };
}

/**
 * Helper to create meld proposals from card IDs
 */
export function createMeldProposal(
  type: "set" | "run",
  cardIds: string[]
): { type: "set" | "run"; cardIds: string[] } {
  return { type, cardIds };
}
