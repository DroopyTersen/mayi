/**
 * RoundMachine - XState machine for managing a single round
 *
 * States: dealing -> active (with TurnMachine) -> scoring
 */

import { setup, assign } from "xstate";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player, RoundRecord, RoundNumber } from "./engine.types";
import type { Contract } from "./contracts";
import { CONTRACTS } from "./contracts";
import { createDeck, shuffle, deal } from "../card/card.deck";

/**
 * Input provided when spawning RoundMachine from GameMachine
 */
export interface RoundInput {
  roundNumber: RoundNumber;
  players: Player[];
  dealerIndex: number;
}

/**
 * Context for the RoundMachine
 */
export interface RoundContext {
  roundNumber: RoundNumber;
  contract: Contract;
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  stock: Card[];
  discard: Card[];
  table: Meld[];
  winnerPlayerId: string | null;
}

/**
 * Events that can be sent to the RoundMachine
 */
export type RoundEvent =
  | { type: "TURN_COMPLETE"; wentOut: boolean; playerId: string; hand: Card[]; stock: Card[]; discard: Card[]; table: Meld[]; isDown: boolean }
  | { type: "RESHUFFLE_STOCK" };

/**
 * Output produced when round ends
 */
export interface RoundOutput {
  roundRecord: RoundRecord;
}

/**
 * Get deck configuration based on player count
 */
export function getDeckConfig(playerCount: number): { deckCount: number; jokerCount: number } {
  if (playerCount >= 6) {
    return { deckCount: 3, jokerCount: 6 }; // 162 cards
  }
  return { deckCount: 2, jokerCount: 4 }; // 108 cards
}

export const roundMachine = setup({
  types: {
    context: {} as RoundContext,
    events: {} as RoundEvent,
    input: {} as RoundInput,
    output: {} as RoundOutput,
  },
  guards: {
    wentOut: ({ event }) => event.type === "TURN_COMPLETE" && event.wentOut,
    stockEmpty: ({ context }) => context.stock.length === 0,
  },
  actions: {
    dealCards: assign(({ context }) => {
      const playerCount = context.players.length;
      const deckConfig = getDeckConfig(playerCount);
      const deck = createDeck(deckConfig);
      const shuffledDeck = shuffle(deck);
      const dealResult = deal(shuffledDeck, playerCount);

      // Update players with their dealt hands
      const playersWithHands = context.players.map((player, index) => ({
        ...player,
        hand: dealResult.hands[index]!,
        isDown: false,
      }));

      return {
        players: playersWithHands,
        stock: dealResult.stock,
        discard: dealResult.discard,
      };
    }),
    updateFromTurn: assign(({ context, event }) => {
      if (event.type !== "TURN_COMPLETE") return {};

      // Update the player who just took their turn
      const updatedPlayers = context.players.map((player) =>
        player.id === event.playerId
          ? { ...player, hand: event.hand, isDown: event.isDown }
          : player
      );

      return {
        players: updatedPlayers,
        stock: event.stock,
        discard: event.discard,
        table: event.table,
      };
    }),
    setWinner: assign(({ event }) => {
      if (event.type !== "TURN_COMPLETE") return {};
      return { winnerPlayerId: event.playerId };
    }),
    advanceTurn: assign(({ context }) => ({
      currentPlayerIndex: (context.currentPlayerIndex + 1) % context.players.length,
    })),
    reshuffleStock: assign(({ context }) => {
      // Keep only the top card of discard pile
      const topDiscard = context.discard[context.discard.length - 1];
      const cardsToReshuffle = context.discard.slice(0, -1);
      const newStock = shuffle(cardsToReshuffle);

      return {
        stock: newStock,
        discard: topDiscard ? [topDiscard] : [],
      };
    }),
  },
}).createMachine({
  id: "round",
  initial: "dealing",
  context: ({ input }) => ({
    roundNumber: input.roundNumber,
    contract: CONTRACTS[input.roundNumber],
    players: input.players.map((p) => ({
      ...p,
      hand: [],
      isDown: false,
    })),
    currentPlayerIndex: (input.dealerIndex + 1) % input.players.length,
    dealerIndex: input.dealerIndex,
    stock: [],
    discard: [],
    table: [],
    winnerPlayerId: null,
  }),
  output: ({ context }) => ({
    roundRecord: {
      roundNumber: context.roundNumber,
      scores: Object.fromEntries(
        context.players.map((p) => [
          p.id,
          p.id === context.winnerPlayerId ? 0 : p.hand.reduce((sum, card) => sum + getCardValue(card), 0),
        ])
      ),
      winnerId: context.winnerPlayerId ?? "",
    },
  }),
  states: {
    dealing: {
      entry: "dealCards",
      always: {
        target: "active",
      },
    },
    active: {
      on: {
        TURN_COMPLETE: [
          {
            guard: "wentOut",
            target: "scoring",
            actions: ["updateFromTurn", "setWinner"],
          },
          {
            actions: ["updateFromTurn", "advanceTurn"],
          },
        ],
        RESHUFFLE_STOCK: {
          guard: "stockEmpty",
          actions: "reshuffleStock",
        },
      },
    },
    scoring: {
      type: "final",
    },
  },
});

/**
 * Get the point value of a card for scoring
 */
function getCardValue(card: Card): number {
  if (card.rank === "Joker") return 50;
  if (card.rank === "A") return 15;
  if (["K", "Q", "J", "10"].includes(card.rank)) return 10;
  // Number cards 2-9
  const rank = parseInt(card.rank, 10);
  if (!isNaN(rank)) return rank;
  return 0;
}
