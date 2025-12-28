/**
 * TurnMachine - XState machine for managing a single player's turn
 *
 * States: awaitingDraw -> drawn -> awaitingDiscard -> turnComplete
 *
 * Phase 3 implementation: adds 'drawn' state for laying down
 */

import { setup, assign } from "xstate";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber } from "./engine.types";

/**
 * Context for the TurnMachine
 */
export interface TurnContext {
  playerId: string;
  hand: Card[];
  stock: Card[];
  discard: Card[];
  hasDrawn: boolean;
  roundNumber: RoundNumber;
  isDown: boolean;
  table: Meld[];
}

/**
 * Events that can be sent to the TurnMachine
 */
export type TurnEvent =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "SKIP_LAY_DOWN" }
  | { type: "DISCARD"; cardId: string };

/**
 * Input required to create a TurnMachine actor
 */
export interface TurnInput {
  playerId: string;
  hand: Card[];
  stock: Card[];
  discard: Card[];
  roundNumber: RoundNumber;
  isDown: boolean;
  table: Meld[];
}

/**
 * Output produced when turn completes
 */
export interface TurnOutput {
  playerId: string;
  hand: Card[];
  stock: Card[];
  discard: Card[];
}

export const turnMachine = setup({
  types: {
    context: {} as TurnContext,
    events: {} as TurnEvent,
    input: {} as TurnInput,
    output: {} as TurnOutput,
  },
  guards: {
    canDrawFromDiscard: ({ context }) => context.discard.length > 0,
    canDiscard: ({ context, event }) => {
      if (event.type !== "DISCARD") return false;
      return context.hand.some((card) => card.id === event.cardId);
    },
  },
  actions: {
    drawFromStock: assign({
      hand: ({ context }) => {
        const topCard = context.stock[0];
        if (!topCard) return context.hand;
        return [...context.hand, topCard];
      },
      stock: ({ context }) => context.stock.slice(1),
      hasDrawn: () => true,
    }),
    drawFromDiscard: assign({
      hand: ({ context }) => {
        const topCard = context.discard[0];
        if (!topCard) return context.hand;
        return [...context.hand, topCard];
      },
      discard: ({ context }) => context.discard.slice(1),
      hasDrawn: () => true,
    }),
    discardCard: assign({
      hand: ({ context, event }) => {
        if (event.type !== "DISCARD") return context.hand;
        return context.hand.filter((card) => card.id !== event.cardId);
      },
      discard: ({ context, event }) => {
        if (event.type !== "DISCARD") return context.discard;
        const card = context.hand.find((c) => c.id === event.cardId);
        if (!card) return context.discard;
        return [card, ...context.discard];
      },
    }),
  },
}).createMachine({
  id: "turn",
  initial: "awaitingDraw",
  context: ({ input }) => ({
    playerId: input.playerId,
    hand: input.hand,
    stock: input.stock,
    discard: input.discard,
    hasDrawn: false,
    roundNumber: input.roundNumber,
    isDown: input.isDown,
    table: input.table,
  }),
  output: ({ context }) => ({
    playerId: context.playerId,
    hand: context.hand,
    stock: context.stock,
    discard: context.discard,
  }),
  states: {
    awaitingDraw: {
      on: {
        DRAW_FROM_STOCK: {
          target: "drawn",
          actions: "drawFromStock",
        },
        DRAW_FROM_DISCARD: {
          guard: "canDrawFromDiscard",
          target: "drawn",
          actions: "drawFromDiscard",
        },
      },
    },
    drawn: {
      on: {
        SKIP_LAY_DOWN: {
          target: "awaitingDiscard",
        },
      },
    },
    awaitingDiscard: {
      on: {
        DISCARD: {
          guard: "canDiscard",
          target: "turnComplete",
          actions: "discardCard",
        },
      },
    },
    turnComplete: {
      type: "final",
    },
  },
});
