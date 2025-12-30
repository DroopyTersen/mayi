# May I? — XState Machine Design

## Overview

The May I game engine uses XState to manage the complex state transitions of a turn-based card game with an interrupt mechanic (the “May I?” rule). This document details the state machine architecture.

---

## Machine Hierarchy

```
GameMachine (top-level)
├── setup
├── playing
│   └── RoundMachine (spawned per round)
│       ├── dealing
│       └── active
│           └── TurnMachine (spawned per turn)
│               ├── awaitingDraw
│               ├── drawn
│               │   ├── canLayDown
│               │   └── canLayOff
│               ├── awaitingDiscard
│               └── discarded
│                   └── MayIWindow (parallel state)
├── roundEnd
└── gameEnd
```

We use **spawned actor machines** for rounds and turns rather than deeply nested states. This keeps each machine focused and testable.

---

## Top-Level Game Machine

```typescript
// core/engine/machine.ts

import { setup, assign, fromPromise, sendTo, raise } from "xstate";

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    initializePlayers: assign({
      /* ... */
    }),
    advanceDealer: assign({
      /* ... */
    }),
    incrementRound: assign({
      /* ... */
    }),
    calculateFinalScores: assign({
      /* ... */
    }),
  },
  guards: {
    isGameOver: ({ context }) => context.currentRound > 6,
    hasMinPlayers: ({ context }) => context.players.length >= 3,
  },
}).createMachine({
  id: "game",
  initial: "setup",
  context: {
    gameId: "",
    players: [],
    currentRound: 1,
    dealerIndex: 0,
    roundHistory: [],
  },

  states: {
    setup: {
      on: {
        START_GAME: {
          guard: "hasMinPlayers",
          target: "playing",
          actions: "initializePlayers",
        },
        ADD_PLAYER: {
          actions: assign({
            players: ({ context, event }) => [...context.players, event.player],
          }),
        },
      },
    },

    playing: {
      entry: raise({ type: "START_ROUND" }),

      invoke: {
        id: "roundMachine",
        src: "roundMachine",
        input: ({ context }) => ({
          roundNumber: context.currentRound,
          players: context.players,
          dealerIndex: context.dealerIndex,
        }),
        onDone: {
          target: "roundEnd",
          actions: assign({
            roundHistory: ({ context, event }) => [
              ...context.roundHistory,
              event.output.roundRecord,
            ],
          }),
        },
      },
    },

    roundEnd: {
      always: [
        {
          guard: "isGameOver",
          target: "gameEnd",
        },
        {
          target: "playing",
          actions: ["incrementRound", "advanceDealer"],
        },
      ],
    },

    gameEnd: {
      entry: "calculateFinalScores",
      type: "final",
    },
  },
});

interface GameContext {
  gameId: string;
  players: Player[];
  currentRound: number;
  dealerIndex: number;
  roundHistory: RoundRecord[];
}
```

---

## Round Machine

Each round is a spawned machine that handles dealing and orchestrates turns.

```typescript
// core/engine/roundMachine.ts

export const roundMachine = setup({
  types: {
    context: {} as RoundContext,
    events: {} as RoundEvent,
    input: {} as RoundInput,
  },
  actions: {
    dealCards: assign({ /* ... */ }),
    flipFirstDiscard: assign({ /* ... */ }),
    advanceTurn: assign({ /* ... */ }),
    scoreRound: assign({ /* ... */ }),
    reshuffleStock: assign({ /* ... */ }),
  },
  guards: {
    someoneWentOut: ({ context }) => context.winnerPlayerId !== null,
    stockEmpty: ({ context }) => context.stock.length === 0,
  },
}).createMachine({
  id: 'round',
  initial: 'dealing',

  context: ({ input }) => ({
    roundNumber: input.roundNumber,
    contract: CONTRACTS[input.roundNumber],
    players: input.players.map(p => ({ ...p, hand: [], isDown: false })),
    currentPlayerIndex: (input.dealerIndex + 1) % input.players.length,
    dealerIndex: input.dealerIndex,
    stock: [],
    discard: [],
    table: [],
    winnerPlayerId: null,
  }),

  states: {
    dealing: {
      entry: ['dealCards', 'flipFirstDiscard'],
      always: 'active',
    },

    active: {
      initial: 'turnInProgress',

      states: {
        turnInProgress: {
          invoke: {
            id: 'turnMachine',
            src: 'turnMachine',
            input: ({ context }) => ({
              playerId: context.players[context.currentPlayerIndex].id,
              playerHand: context.players[context.currentPlayerIndex].hand,
              isDown: context.players[context.currentPlayerIndex].isDown,
              contract: context.contract,
              stock: context.stock,
              discard: context.discard,
              table: context.table,
              roundNumber: context.roundNumber,
            }),
            onDone: [
              {
                guard: ({ event }) => event.output.wentOut,
                target: '#round.scoring',
                actions: assign({
                  winnerPlayerId: ({ event }) => event.output.playerId,
                }),
              },
              {
                target: 'mayIWindow',
                actions: assign({
                  // Update state from turn result
                  discard: ({ event }) => event.output.discard,
                  stock: ({ event }) => event.output.stock,
                  table: ({ event }) => event.output.table,
                  players: ({ context, event }) => /* update player hand */,
                }),
              },
            ],
          },
        },

        mayIWindow: {
          // See detailed May I Window section below
          on: {
            NEXT_PLAYER_DRAWS: {
              target: 'turnInProgress',
              actions: 'advanceTurn',
            },
            MAY_I_RESOLVED: {
              target: 'turnInProgress',
              // Don't advance turn - May I doesn't change turn order
              actions: assign({
                // Give May I winner the discard + penalty card
              }),
            },
          },
        },
      },

      // Handle stock depletion at round level
      always: {
        guard: 'stockEmpty',
        actions: 'reshuffleStock',
      },
    },

    scoring: {
      entry: 'scoreRound',
      type: 'final',
      output: ({ context }) => ({
        roundRecord: {
          roundNumber: context.roundNumber,
          scores: calculateScores(context),
          winnerId: context.winnerPlayerId,
        },
      }),
    },
  },
});

interface RoundContext {
  roundNumber: number;
  contract: Contract;
  players: PlayerRoundState[];
  currentPlayerIndex: number;
  dealerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  winnerPlayerId: string | null;
}
```

---

## Turn Machine

The turn machine handles a single player’s turn with all its phases.

```typescript
// core/engine/turnMachine.ts

export const turnMachine = setup({
  types: {
    context: {} as TurnContext,
    events: {} as TurnEvent,
  },
  guards: {
    hasDrawn: ({ context }) => context.hasDrawn,
    canDrawDiscard: ({ context }) => context.discard.length > 0,
    meetsContract: ({ context, event }) =>
      validateContract(event.melds, context.contract),
    validMelds: ({ context, event }) =>
      event.melds.every((m) => isValidMeld(m)),
    wildsNotOutnumbered: ({ context, event }) =>
      event.melds.every((m) => !wildsOutnumber(m)),
    isDown: ({ context }) => context.isDown,
    notDownYet: ({ context }) => !context.isDown,
    laidDownThisTurn: ({ context }) => context.laidDownThisTurn,
    hasOneCardLeft: ({ context }) => context.hand.length === 1,
    hasZeroCards: ({ context }) => context.hand.length === 0,
    isRound6: ({ context }) => context.roundNumber === 6,
    validLayOff: ({ context, event }) =>
      canLayOffCard(event.cardId, event.meldId, context),
    validJokerSwap: ({ context, event }) => canSwapJoker(event, context),
    notDownForJokerSwap: ({ context }) => !context.isDown,
    cardInHand: ({ context, event }) =>
      context.hand.some((c) => c.id === event.cardId),
  },
  actions: {
    drawFromStock: assign({
      hand: ({ context }) => [...context.hand, context.stock[0]],
      stock: ({ context }) => context.stock.slice(1),
      hasDrawn: true,
    }),
    drawFromDiscard: assign({
      hand: ({ context }) => [...context.hand, context.discard[0]],
      discard: ({ context }) => context.discard.slice(1),
      hasDrawn: true,
    }),
    layDownMelds: assign({
      table: ({ context, event }) => [
        ...context.table,
        ...createMelds(event.melds, context.playerId),
      ],
      hand: ({ context, event }) =>
        removeCards(context.hand, getMeldCardIds(event.melds)),
      isDown: true,
      laidDownThisTurn: true,
    }),
    layOffCard: assign({
      table: ({ context, event }) =>
        addCardToMeld(context.table, event.meldId, event.cardId),
      hand: ({ context, event }) =>
        context.hand.filter((c) => c.id !== event.cardId),
    }),
    swapJoker: assign({
      table: ({ context, event }) => replaceJokerInMeld(context.table, event),
      hand: ({ context, event }) => swapJokerInHand(context.hand, event),
    }),
    discard: assign({
      discard: ({ context, event }) => [
        context.hand.find((c) => c.id === event.cardId)!,
        ...context.discard,
      ],
      hand: ({ context, event }) =>
        context.hand.filter((c) => c.id !== event.cardId),
    }),
  },
}).createMachine({
  id: "turn",
  initial: "awaitingDraw",

  context: ({ input }) => ({
    playerId: input.playerId,
    hand: [...input.playerHand],
    isDown: input.isDown,
    laidDownThisTurn: false,
    hasDrawn: false,
    contract: input.contract,
    stock: input.stock,
    discard: input.discard,
    table: input.table,
    roundNumber: input.roundNumber,
  }),

  states: {
    awaitingDraw: {
      on: {
        DRAW_FROM_STOCK: {
          target: "drawn",
          actions: "drawFromStock",
        },
        DRAW_FROM_DISCARD: {
          guard: "canDrawDiscard",
          target: "drawn",
          actions: "drawFromDiscard",
        },
      },
    },

    drawn: {
      // This is a compound state - player can do multiple actions
      always: [
        // Auto-transition to awaitingDiscard if laid down this turn
        // (can't lay off same turn)
        {
          guard: "laidDownThisTurn",
          target: "awaitingDiscard",
        },
      ],

      on: {
        // Laying down contract
        LAY_DOWN: {
          guard: and([
            "notDownYet",
            "meetsContract",
            "validMelds",
            "wildsNotOutnumbered",
          ]),
          actions: "layDownMelds",
          // Stay in 'drawn' - machine will auto-transition due to laidDownThisTurn
        },

        // Laying off (only if already down from previous turn)
        LAY_OFF: {
          guard: and([
            "isDown",
            not("laidDownThisTurn"),
            "validLayOff",
            "cardInHand",
          ]),
          actions: "layOffCard",
          // Stay in 'drawn' - can lay off multiple cards
        },

        // Joker swapping (only if NOT down yet)
        SWAP_JOKER: {
          guard: and(["notDownForJokerSwap", "validJokerSwap"]),
          actions: "swapJoker",
          // Stay in 'drawn'
        },

        // Ready to discard
        READY_TO_DISCARD: "awaitingDiscard",

        // Round 6 special: go out without discarding
        GO_OUT: {
          guard: and(["isRound6", "isDown", "hasZeroCards"]),
          target: "wentOut",
        },
      },
    },

    awaitingDiscard: {
      on: {
        DISCARD: {
          guard: "cardInHand",
          target: "discarded",
          actions: "discard",
        },

        // Can still lay off while awaiting discard (if down from previous turn)
        LAY_OFF: {
          guard: and([
            "isDown",
            not("laidDownThisTurn"),
            "validLayOff",
            "cardInHand",
          ]),
          actions: "layOffCard",
        },

        // Round 6: if you can get to zero cards via lay off, do it
        GO_OUT: {
          guard: and(["isRound6", "isDown"]),
          // This handles the case where final lay offs get you to zero
          actions: "processFinalLayOffs",
          target: "wentOut",
        },
      },

      // Check if discarding last card means going out (rounds 1-5)
      // Or if we're at zero cards after laying off (round 6)
      always: [
        {
          guard: and(["hasOneCardLeft", not("isRound6")]),
          // Normal rounds: discarding last card = going out
          // The DISCARD event will trigger this
        },
      ],
    },

    discarded: {
      always: [
        {
          guard: "hasZeroCards",
          target: "wentOut",
        },
        {
          target: "turnComplete",
        },
      ],
    },

    wentOut: {
      type: "final",
      output: ({ context }) => ({
        wentOut: true,
        playerId: context.playerId,
        hand: context.hand,
        stock: context.stock,
        discard: context.discard,
        table: context.table,
      }),
    },

    turnComplete: {
      type: "final",
      output: ({ context }) => ({
        wentOut: false,
        playerId: context.playerId,
        hand: context.hand,
        stock: context.stock,
        discard: context.discard,
        table: context.table,
      }),
    },
  },
});

interface TurnContext {
  playerId: string;
  hand: Card[];
  isDown: boolean;
  laidDownThisTurn: boolean;
  hasDrawn: boolean;
  contract: Contract;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundNumber: number;
}
```

---

## May I Window Machine

This is the trickiest part. After a discard, there’s a window where:

1. The next player can choose to draw (closing the window)
1. Any non-active player can call “May I?”
1. First valid claim wins (by turn order priority)

```typescript
// core/engine/mayIWindowMachine.ts

export const mayIWindowMachine = setup({
  types: {
    context: {} as MayIContext,
    events: {} as MayIEvent,
  },
  guards: {
    isNextPlayer: ({ context, event }) =>
      event.playerId === context.nextPlayerId,
    canCallMayI: ({ context, event }) =>
      event.playerId !== context.nextPlayerId &&
      event.playerId !== context.discardedByPlayerId,
    hasClaimants: ({ context }) => context.claimants.length > 0,
  },
  actions: {
    addClaimant: assign({
      claimants: ({ context, event }) => [...context.claimants, event.playerId],
    }),
    resolveByPriority: assign({
      winnerId: ({ context }) =>
        getClosestInTurnOrder(
          context.claimants,
          context.currentPlayerIndex,
          context.playerOrder
        ),
    }),
    giveCardsToWinner: assign({
      // Winner gets discard + penalty card from stock
    }),
  },
}).createMachine({
  id: "mayIWindow",
  initial: "open",

  context: ({ input }) => ({
    discardedCard: input.discardedCard,
    discardedByPlayerId: input.discardedByPlayerId,
    nextPlayerId: input.nextPlayerId,
    currentPlayerIndex: input.currentPlayerIndex,
    playerOrder: input.playerOrder,
    claimants: [],
    winnerId: null,
    stock: input.stock,
    resolved: false,
  }),

  states: {
    open: {
      on: {
        // Next player takes or declines
        NEXT_PLAYER_DRAWS_DISCARD: {
          guard: "isNextPlayer",
          target: "closedByNextPlayer",
        },
        NEXT_PLAYER_DRAWS_STOCK: {
          guard: "isNextPlayer",
          target: "closedByNextPlayer",
        },
        NEXT_PLAYER_DECLINES: {
          guard: "isNextPlayer",
          target: "awaitingClaims",
        },

        // Someone calls May I before next player acts
        // This is the "race" mechanic
        CALL_MAY_I: {
          guard: "canCallMayI",
          actions: "addClaimant",
          // Stay open - collect all simultaneous claims
        },
      },

      // Timeout or explicit close
      after: {
        // In real-time play, you might have a timeout here
        // For AI play, we process immediately
      },
    },

    awaitingClaims: {
      // Brief window for May I claims after next player declines
      on: {
        CALL_MAY_I: {
          guard: "canCallMayI",
          actions: "addClaimant",
        },
        RESOLVE: [
          {
            guard: "hasClaimants",
            target: "resolving",
          },
          {
            target: "closedNoClaim",
          },
        ],
      },

      // Auto-resolve after brief window
      after: {
        MAY_I_WINDOW_MS: "resolving",
      },
    },

    resolving: {
      entry: ["resolveByPriority", "giveCardsToWinner"],
      always: "resolved",
    },

    resolved: {
      type: "final",
      output: ({ context }) => ({
        type: "MAY_I_RESOLVED",
        winnerId: context.winnerId,
        discardedCard: context.discardedCard,
        penaltyCard: context.stock[0],
      }),
    },

    closedByNextPlayer: {
      type: "final",
      output: () => ({
        type: "NEXT_PLAYER_DRAWS",
      }),
    },

    closedNoClaim: {
      type: "final",
      output: () => ({
        type: "NO_MAY_I_CLAIMS",
      }),
    },
  },
});

interface MayIContext {
  discardedCard: Card;
  discardedByPlayerId: string;
  nextPlayerId: string;
  currentPlayerIndex: number;
  playerOrder: string[];
  claimants: string[];
  winnerId: string | null;
  stock: Card[];
  resolved: boolean;
}
```

---

## Guard Functions (Detailed)

```typescript
// core/engine/guards.ts

import { Card, Meld, Contract } from "./types";

// Meld validation
export function isValidSet(cards: Card[]): boolean {
  if (cards.length < 3) return false;

  const naturals = cards.filter((c) => !isWild(c));
  const wilds = cards.filter((c) => isWild(c));

  // Wilds can't outnumber naturals
  if (wilds.length > naturals.length) return false;

  // All naturals must be same rank
  if (naturals.length === 0) return false; // Can't have all wilds
  const targetRank = naturals[0].rank;
  return naturals.every((c) => c.rank === targetRank);
}

export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 4) return false;

  const naturals = cards.filter((c) => !isWild(c));
  const wilds = cards.filter((c) => isWild(c));

  // Wilds can't outnumber naturals
  if (wilds.length > naturals.length) return false;

  // Must have at least one natural to determine suit
  if (naturals.length === 0) return false;

  // All naturals must be same suit
  const targetSuit = naturals[0].suit;
  if (!naturals.every((c) => c.suit === targetSuit)) return false;

  // Check consecutive ranks (accounting for wilds)
  const sorted = sortByRankForRun(cards);
  return isConsecutiveRun(sorted);
}

function isConsecutiveRun(sortedCards: Card[]): boolean {
  const rankOrder = [
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
  ];
  // Note: 2 is wild, not in rank order

  let expectedRankIndex = -1;
  const usedRanks = new Set<string>();

  for (const card of sortedCards) {
    if (isWild(card)) {
      // Wild fills the gap
      expectedRankIndex++;
      continue;
    }

    const rankIndex = rankOrder.indexOf(card.rank);

    if (expectedRankIndex === -1) {
      // First natural card sets the baseline
      expectedRankIndex = rankIndex;
    } else if (rankIndex !== expectedRankIndex) {
      return false; // Gap or wrong order
    }

    // Check for duplicate rank in run
    if (usedRanks.has(card.rank)) {
      return false; // Duplicate rank not allowed
    }
    usedRanks.add(card.rank);

    expectedRankIndex++;
  }

  return true;
}

// Contract validation
export function validateContract(
  proposedMelds: ProposedMeld[],
  contract: Contract
): boolean {
  const sets = proposedMelds.filter((m) => m.type === "set");
  const runs = proposedMelds.filter((m) => m.type === "run");

  return sets.length === contract.sets && runs.length === contract.runs;
}

// Lay off validation
export function canLayOffCard(
  cardId: string,
  meldId: string,
  context: TurnContext
): boolean {
  const card = context.hand.find((c) => c.id === cardId);
  const meld = context.table.find((m) => m.id === meldId);

  if (!card || !meld) return false;

  // Try adding card to meld and validate
  const newMeld = { ...meld, cards: [...meld.cards, card] };

  if (meld.type === "set") {
    return isValidSet(newMeld.cards);
  } else {
    // For runs, need to check where the card fits
    return canExtendRun(meld.cards, card);
  }
}

// Joker swap validation
export function canSwapJoker(
  event: { naturalCardId: string; targetMeldId: string; jokerPosition: number },
  context: TurnContext
): boolean {
  const naturalCard = context.hand.find((c) => c.id === event.naturalCardId);
  const meld = context.table.find((m) => m.id === event.targetMeldId);

  if (!naturalCard || !meld) return false;
  if (isWild(naturalCard)) return false; // Must be natural
  if (meld.type !== "run") return false; // Can only swap from runs

  const jokerCard = meld.cards[event.jokerPosition];
  if (!jokerCard || jokerCard.rank !== "Joker") return false;

  // The natural card must match what the Joker represents
  return cardFitsJokerPosition(meld.cards, event.jokerPosition, naturalCard);
}
```

---

## Action Implementations

```typescript
// core/engine/actions.ts

export function createDeck(config: {
  deckCount: number;
  jokerCount: number;
}): Card[] {
  const cards: Card[] = [];
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: Rank[] = [
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

  for (let deck = 0; deck < config.deckCount; deck++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push({
          id: `${rank}-${suit}-${deck}`,
          suit,
          rank,
        });
      }
    }
  }

  for (let j = 0; j < config.jokerCount; j++) {
    cards.push({
      id: `Joker-${j}`,
      suit: null,
      rank: "Joker",
    });
  }

  return cards;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function deal(
  deck: Card[],
  playerCount: number,
  cardsPerPlayer: number
): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let cardIndex = 0;

  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck[cardIndex++]);
    }
  }

  return {
    hands,
    remaining: deck.slice(cardIndex),
  };
}

export function calculateScores(context: RoundContext): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const player of context.players) {
    if (player.id === context.winnerPlayerId) {
      scores[player.id] = 0;
    } else {
      scores[player.id] = player.hand.reduce(
        (sum, card) => sum + getPointValue(card),
        0
      );
    }
  }

  return scores;
}

export function getClosestInTurnOrder(
  claimants: string[],
  currentPlayerIndex: number,
  playerOrder: string[]
): string {
  // Find who's closest after the current player
  for (let offset = 1; offset < playerOrder.length; offset++) {
    const checkIndex = (currentPlayerIndex + offset) % playerOrder.length;
    const playerId = playerOrder[checkIndex];
    if (claimants.includes(playerId)) {
      return playerId;
    }
  }
  return claimants[0]; // Fallback
}
```

---

## State Serialization

For testing and persistence, we need to hydrate/dehydrate state:

```typescript
// core/engine/serialization.ts

export interface SerializedGameState {
  gameId: string;
  currentRound: number;
  dealerIndex: number;
  players: SerializedPlayer[];
  stock: Card[];
  discard: Card[];
  table: Meld[];
  roundHistory: RoundRecord[];

  // Current turn state (if mid-turn)
  turnState?: {
    currentPlayerIndex: number;
    hasDrawn: boolean;
    laidDownThisTurn: boolean;
  };

  // May I window (if open)
  mayIWindow?: {
    discardedCard: Card;
    discardedByPlayerId: string;
    claimants: string[];
  };
}

export function hydrateGame(serialized: SerializedGameState): GameState {
  // Reconstruct the XState machine at the correct state
  // This is where the JSON test fixtures come in
}

export function dehydrateGame(state: GameState): SerializedGameState {
  // Extract serializable state from XState context
}
```

---

## Command → Event Flow

This is what I meant earlier by command/event separation:

```
┌─────────────────┐         ┌───────────────┐         ┌─────────────────┐
│   Player sends  │         │   XState      │         │   Broadcast     │
│   Command       │────────▶│   Guard       │────────▶│   Event         │
│   (intention)   │         │   validates   │         │   (fact)        │
└─────────────────┘         └───────────────┘         └─────────────────┘
                                    │
                                    │ if invalid
                                    ▼
                            ┌───────────────┐
                            │   Return      │
                            │   Error       │
                            └───────────────┘
```

**Example flow:**

```typescript
// Player sends command
const command = { type: 'LAY_DOWN', melds: [...] };

// XState guards validate:
// - notDownYet: player hasn't laid down this round ✓
// - meetsContract: correct number of sets/runs ✓
// - validMelds: each meld is valid ✓
// - wildsNotOutnumbered: no meld has more wilds than naturals ✓

// If all guards pass, action executes and event is emitted:
const event = {
  type: 'MELDS_LAID_DOWN',
  playerId: 'player-1',
  melds: [...created melds...]
};

// Event is broadcast to all clients for state sync
```

---

## Testing the Machine

```typescript
// core/engine/machine.test.ts

import { createActor } from "xstate";
import { turnMachine } from "./turnMachine";

describe("TurnMachine", () => {
  test("must draw before doing anything else", () => {
    const actor = createActor(turnMachine, {
      input: fixtures.freshTurn,
    }).start();

    // Try to discard without drawing
    actor.send({ type: "DISCARD", cardId: "card-1" });

    // Should still be in awaitingDraw
    expect(actor.getSnapshot().value).toBe("awaitingDraw");
  });

  test("can lay down valid contract", () => {
    const actor = createActor(turnMachine, {
      input: fixtures.hasValidContract,
    }).start();

    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({
      type: "LAY_DOWN",
      melds: [
        { type: "set", cardIds: ["9h", "9d", "9c"] },
        { type: "set", cardIds: ["Kh", "Kd", "Ks"] },
      ],
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.isDown).toBe(true);
    expect(snapshot.context.laidDownThisTurn).toBe(true);
    expect(snapshot.value).toBe("awaitingDiscard");
  });

  test("cannot lay off on same turn as laying down", () => {
    const actor = createActor(turnMachine, {
      input: fixtures.justLaidDownHasExtras,
    }).start();

    // Already laid down this turn in fixture
    actor.send({
      type: "LAY_OFF",
      cardId: "extra-9",
      targetMeldId: "meld-1",
    });

    // Should not have changed - still awaiting discard
    // and hand should still have the extra card
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.hand.some((c) => c.id === "extra-9")).toBe(true);
  });
});
```

---

## Summary

The XState architecture breaks down as:

1. **GameMachine**: Orchestrates rounds, tracks overall progress
1. **RoundMachine**: Handles dealing, turn orchestration, scoring for one round
1. **TurnMachine**: Manages a single player’s turn phases
1. **MayIWindowMachine**: Handles the interrupt window after discards

Key design decisions:

- Spawned actors for rounds/turns (cleaner than deep nesting)
- Guards handle all validation (pure functions, easy to test)
- Actions are pure state transformations
- Events are facts that can be broadcast for sync
- Serialization allows testing with JSON fixtures

---

_Document version: 0.1_
