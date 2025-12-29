/**
 * RoundMachine - XState machine for managing a single round
 *
 * States: dealing -> active (with TurnMachine) -> scoring
 *
 * The active state invokes TurnMachine for each player's turn.
 * When a turn completes, we either advance to the next player or end the round.
 */

import { setup, assign, sendTo } from "xstate";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player, RoundRecord, RoundNumber } from "./engine.types";
import type { Contract } from "./contracts";
import { CONTRACTS } from "./contracts";
import { createDeck, shuffle, deal } from "../card/card.deck";
import { turnMachine, type TurnInput, type TurnOutput } from "./turn.machine";

/**
 * Events that need to be forwarded to child turn actor
 */
type ForwardedTurnEvent =
  | { type: "DRAW_FROM_STOCK"; playerId?: string }
  | { type: "DRAW_FROM_DISCARD"; playerId?: string }
  | { type: "SKIP_LAY_DOWN" }
  | { type: "LAY_DOWN"; melds: unknown[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "CALL_MAY_I"; playerId: string }
  | { type: "PASS_MAY_I" }
  | { type: "SWAP_JOKER"; jokerCardId: string; meldId: string; swapCardId: string }
  | { type: "GO_OUT"; finalLayOffs: unknown[] };

/**
 * Predefined game state for testing scenarios.
 * When provided, dealCards will use this state instead of randomly dealing.
 */
export interface PredefinedRoundState {
  /** Hands for each player (indexed by player position, not ID) */
  hands: Card[][];
  /** Stock pile */
  stock: Card[];
  /** Discard pile (top card first) */
  discard: Card[];
  /** Melds already on table (optional) */
  table?: Meld[];
  /** Override isDown status per player index (optional) */
  playerDownStatus?: boolean[];
}

/**
 * Input provided when spawning RoundMachine from GameMachine
 */
export interface RoundInput {
  roundNumber: RoundNumber;
  players: Player[];
  dealerIndex: number;
  /**
   * Optional predefined state for testing.
   * When provided, bypasses random dealing and uses this exact state.
   */
  predefinedState?: PredefinedRoundState;
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
  /** Predefined state from input (used by dealCards action) */
  predefinedState: PredefinedRoundState | null;
}

/**
 * Events that can be sent to the RoundMachine
 *
 * RoundMachine handles round-level events and forwards turn events
 * to the invoked TurnMachine during the active state.
 */
export type RoundEvent =
  | { type: "RESHUFFLE_STOCK" }
  // Forwarded events (sent to turn machine)
  | ForwardedTurnEvent;

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
  actors: {
    turnMachine: turnMachine,
  },
  guards: {
    stockEmpty: ({ context }) => context.stock.length === 0,
  },
  actions: {
    dealCards: assign(({ context }) => {
      // Use predefined state if provided (for testing)
      if (context.predefinedState) {
        const predefined = context.predefinedState;
        const playersWithHands = context.players.map((player, index) => ({
          ...player,
          hand: predefined.hands[index] ?? [],
          isDown: predefined.playerDownStatus?.[index] ?? false,
        }));

        return {
          players: playersWithHands,
          stock: predefined.stock,
          discard: predefined.discard,
          table: predefined.table ?? [],
        };
      }

      // Normal random dealing
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
    advanceTurn: assign({
      currentPlayerIndex: ({ context }) =>
        (context.currentPlayerIndex + 1) % context.players.length,
    }),
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
    predefinedState: input.predefinedState ?? null,
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
      invoke: {
        id: "turn",
        src: "turnMachine",
        input: ({ context }): TurnInput => {
          const currentPlayer = context.players[context.currentPlayerIndex]!;
          return {
            playerId: currentPlayer.id,
            hand: currentPlayer.hand,
            stock: context.stock,
            discard: context.discard,
            roundNumber: context.roundNumber,
            isDown: currentPlayer.isDown,
            table: context.table,
            // May I support
            playerOrder: context.players.map((p) => p.id),
            playerDownStatus: Object.fromEntries(
              context.players.map((p) => [p.id, p.isDown])
            ),
          };
        },
        onDone: [
          {
            // Player went out - end the round
            guard: ({ event }) => (event.output as TurnOutput).wentOut === true,
            target: "scoring",
            actions: assign(({ context, event }) => {
              const output = event.output as TurnOutput;
              const handUpdates = output.handUpdates ?? {};

              return {
                players: context.players.map((player) => {
                  // Current player gets their updated hand
                  if (player.id === output.playerId) {
                    return { ...player, hand: output.hand, isDown: output.isDown };
                  }
                  // Other players may have May I updates
                  const update = handUpdates[player.id];
                  if (update) {
                    return { ...player, hand: [...player.hand, ...update.added] };
                  }
                  return player;
                }),
                stock: output.stock,
                discard: output.discard,
                table: output.table,
                winnerPlayerId: output.playerId,
              };
            }),
          },
          {
            // Normal turn completion - advance to next player
            target: "active",
            actions: [
              assign(({ context, event }) => {
                const output = event.output as TurnOutput;
                const handUpdates = output.handUpdates ?? {};

                return {
                  players: context.players.map((player) => {
                    // Current player gets their updated hand
                    if (player.id === output.playerId) {
                      return { ...player, hand: output.hand, isDown: output.isDown };
                    }
                    // Other players may have May I updates
                    const update = handUpdates[player.id];
                    if (update) {
                      return { ...player, hand: [...player.hand, ...update.added] };
                    }
                    return player;
                  }),
                  stock: output.stock,
                  discard: output.discard,
                  table: output.table,
                };
              }),
              "advanceTurn",
            ],
            reenter: true, // Re-invoke turnMachine for next player
          },
        ],
      },
      on: {
        // Forward gameplay events to the turn actor
        DRAW_FROM_STOCK: { actions: sendTo("turn", ({ event }) => event) },
        DRAW_FROM_DISCARD: { actions: sendTo("turn", ({ event }) => event) },
        SKIP_LAY_DOWN: { actions: sendTo("turn", ({ event }) => event) },
        LAY_DOWN: { actions: sendTo("turn", ({ event }) => event) },
        LAY_OFF: { actions: sendTo("turn", ({ event }) => event) },
        DISCARD: { actions: sendTo("turn", ({ event }) => event) },
        CALL_MAY_I: { actions: sendTo("turn", ({ event }) => event) },
        PASS_MAY_I: { actions: sendTo("turn", ({ event }) => event) },
        SWAP_JOKER: { actions: sendTo("turn", ({ event }) => event) },
        GO_OUT: { actions: sendTo("turn", ({ event }) => event) },
        // Stock reshuffle can still be triggered externally if needed
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
