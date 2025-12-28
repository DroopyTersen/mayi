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
import { CONTRACTS, validateContractMelds } from "./contracts";
import { isValidSet, isValidRun } from "../meld/meld.validation";
import {
  canLayOffCard,
  canLayOffToSet,
  canLayOffToRun,
  validateCardOwnership,
  getCardFromHand,
} from "./layoff";

/**
 * Meld proposal for LAY_DOWN event
 */
export interface MeldProposal {
  type: "set" | "run";
  cardIds: string[];
}

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
  laidDownThisTurn: boolean;
  table: Meld[];
}

/**
 * Lay off specification for GO_OUT command
 */
export interface LayOffSpec {
  cardId: string;
  meldId: string;
}

/**
 * Events that can be sent to the TurnMachine
 */
export type TurnEvent =
  | { type: "DRAW_FROM_STOCK" }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "SKIP_LAY_DOWN" }
  | { type: "LAY_DOWN"; melds: MeldProposal[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "GO_OUT"; finalLayOffs: LayOffSpec[] }
  | { type: "END_TURN_STUCK" };

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
  laidDownThisTurn?: boolean;
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
  isDown: boolean;
  table: Meld[];
  /** True if player went out (hand became empty), false otherwise */
  wentOut?: boolean;
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
      // Card must be in hand
      if (!context.hand.some((card) => card.id === event.cardId)) return false;
      // In round 6, cannot discard last card to go out
      if (context.roundNumber === 6 && context.hand.length === 1 && context.isDown) {
        return false;
      }
      return true;
    },
    canLayDown: ({ context, event }) => {
      if (event.type !== "LAY_DOWN") return false;

      // Cannot lay down if already down this round
      if (context.isDown) return false;

      // Build melds from card IDs
      const melds: Meld[] = [];
      for (const proposal of event.melds) {
        const cards: Card[] = [];
        for (const cardId of proposal.cardIds) {
          const card = context.hand.find((c) => c.id === cardId);
          if (!card) return false; // Card not in hand
          cards.push(card);
        }
        melds.push({
          id: `meld-${Math.random()}`,
          type: proposal.type,
          cards,
          ownerId: context.playerId,
        });
      }

      // Validate each meld individually
      for (const meld of melds) {
        if (meld.type === "set" && !isValidSet(meld.cards)) {
          return false;
        }
        if (meld.type === "run" && !isValidRun(meld.cards)) {
          return false;
        }
      }

      // Validate contract requirements
      const contract = CONTRACTS[context.roundNumber];
      const result = validateContractMelds(contract, melds);
      return result.valid;
    },
    // canLayDown AND laying down uses all cards in hand
    canLayDownAndGoOut: ({ context, event }) => {
      if (event.type !== "LAY_DOWN") return false;

      // Cannot lay down if already down this round
      if (context.isDown) return false;

      // Check if all cards in hand are used in melds
      const usedCardIds = new Set(event.melds.flatMap((m) => m.cardIds));
      if (usedCardIds.size !== context.hand.length) return false;

      // Build melds from card IDs
      const melds: Meld[] = [];
      for (const proposal of event.melds) {
        const cards: Card[] = [];
        for (const cardId of proposal.cardIds) {
          const card = context.hand.find((c) => c.id === cardId);
          if (!card) return false; // Card not in hand
          cards.push(card);
        }
        melds.push({
          id: `meld-${Math.random()}`,
          type: proposal.type,
          cards,
          ownerId: context.playerId,
        });
      }

      // Validate each meld individually
      for (const meld of melds) {
        if (meld.type === "set" && !isValidSet(meld.cards)) {
          return false;
        }
        if (meld.type === "run" && !isValidRun(meld.cards)) {
          return false;
        }
      }

      // Validate contract requirements
      const contract = CONTRACTS[context.roundNumber];
      const result = validateContractMelds(contract, melds);
      return result.valid;
    },
    canLayOff: ({ context, event }) => {
      if (event.type !== "LAY_OFF") return false;

      // Check player state preconditions
      const layOffContext = {
        isDown: context.isDown,
        laidDownThisTurn: context.laidDownThisTurn,
        hasDrawn: context.hasDrawn,
      };
      if (!canLayOffCard(layOffContext)) return false;

      // Validate card ownership
      const cardOwnership = validateCardOwnership(event.cardId, context.hand);
      if (!cardOwnership.valid) return false;

      // Find the card and meld
      const card = getCardFromHand(event.cardId, context.hand);
      if (!card) return false;

      const meld = context.table.find((m) => m.id === event.meldId);
      if (!meld) return false;

      // Check if card fits the meld
      if (meld.type === "set") {
        return canLayOffToSet(card, meld);
      } else {
        return canLayOffToRun(card, meld);
      }
    },
    // Check if hand will be empty after discard
    willGoOutAfterDiscard: ({ context }) => {
      // After discarding 1 card, hand will have length - 1 cards
      return context.hand.length === 1;
    },
    // Check if hand is empty (went out via lay off)
    handIsEmpty: ({ context }) => {
      return context.hand.length === 0;
    },
    // Check if GO_OUT command is valid
    canGoOut: ({ context, event }) => {
      if (event.type !== "GO_OUT") return false;

      // Player must be down
      if (!context.isDown) return false;

      // Must have the right number of lay offs to empty the hand
      if (event.finalLayOffs.length !== context.hand.length) return false;

      // Validate each lay off would be valid
      // We need to simulate the lay offs in sequence
      let simulatedHand = [...context.hand];
      let simulatedTable = context.table.map((m) => ({ ...m, cards: [...m.cards] }));

      for (const layOff of event.finalLayOffs) {
        // Find the card in simulated hand
        const card = simulatedHand.find((c) => c.id === layOff.cardId);
        if (!card) return false;

        // Find the meld in simulated table
        const meld = simulatedTable.find((m) => m.id === layOff.meldId);
        if (!meld) return false;

        // Check if card fits the meld
        if (meld.type === "set") {
          if (!canLayOffToSet(card, meld)) return false;
        } else {
          if (!canLayOffToRun(card, meld)) return false;
        }

        // Simulate the lay off
        simulatedHand = simulatedHand.filter((c) => c.id !== layOff.cardId);
        meld.cards = [...meld.cards, card];
      }

      // After all lay offs, hand must be empty
      return simulatedHand.length === 0;
    },
    // Check if it's round 6
    isRound6: ({ context }) => {
      return context.roundNumber === 6;
    },
    // Check if player can end turn when stuck (round 6 only)
    canEndTurnStuck: ({ context }) => {
      // Only in round 6
      if (context.roundNumber !== 6) return false;
      // Player must be down
      if (!context.isDown) return false;
      // Must have exactly 1 card (stuck with unlayable card)
      if (context.hand.length !== 1) return false;
      return true;
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
    layDown: assign({
      hand: ({ context, event }) => {
        if (event.type !== "LAY_DOWN") return context.hand;
        // Remove all cards used in melds from hand
        const usedCardIds = new Set(event.melds.flatMap((m) => m.cardIds));
        return context.hand.filter((card) => !usedCardIds.has(card.id));
      },
      table: ({ context, event }) => {
        if (event.type !== "LAY_DOWN") return context.table;
        // Build melds and add to table
        const newMelds: Meld[] = event.melds.map((proposal) => {
          const cards = proposal.cardIds
            .map((id) => context.hand.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined);
          return {
            id: `meld-${crypto.randomUUID()}`,
            type: proposal.type,
            cards,
            ownerId: context.playerId,
          };
        });
        return [...context.table, ...newMelds];
      },
      isDown: () => true,
      laidDownThisTurn: () => true,
    }),
    layOff: assign({
      hand: ({ context, event }) => {
        if (event.type !== "LAY_OFF") return context.hand;
        return context.hand.filter((card) => card.id !== event.cardId);
      },
      table: ({ context, event }) => {
        if (event.type !== "LAY_OFF") return context.table;

        const card = context.hand.find((c) => c.id === event.cardId);
        if (!card) return context.table;

        return context.table.map((meld) => {
          if (meld.id !== event.meldId) return meld;

          // Add card to meld at the appropriate position
          if (meld.type === "set") {
            // For sets, order doesn't matter - append
            return { ...meld, cards: [...meld.cards, card] };
          } else {
            // For runs, we need to determine if it goes at low or high end
            // This is handled in canLayOffToRun - here we just need to add it
            // For now, append to end (more sophisticated positioning can be added)
            return { ...meld, cards: [...meld.cards, card] };
          }
        });
      },
    }),
    // GO_OUT action - performs all lay offs in order
    goOut: assign({
      hand: () => [], // Hand becomes empty
      table: ({ context, event }) => {
        if (event.type !== "GO_OUT") return context.table;

        // Apply all lay offs to the table
        let updatedTable = context.table.map((m) => ({ ...m, cards: [...m.cards] }));

        for (const layOff of event.finalLayOffs) {
          const card = context.hand.find((c) => c.id === layOff.cardId);
          if (!card) continue;

          updatedTable = updatedTable.map((meld) => {
            if (meld.id !== layOff.meldId) return meld;
            return { ...meld, cards: [...meld.cards, card] };
          });
        }

        return updatedTable;
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
    laidDownThisTurn: input.laidDownThisTurn ?? false,
    table: input.table,
  }),
  output: ({ context }) => ({
    playerId: context.playerId,
    hand: context.hand,
    stock: context.stock,
    discard: context.discard,
    isDown: context.isDown,
    table: context.table,
    // wentOut is true when hand is empty at end of turn (player went out)
    wentOut: context.hand.length === 0,
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
        LAY_DOWN: [
          {
            // If laying down uses all cards and is valid, go out immediately
            guard: "canLayDownAndGoOut",
            target: "wentOut",
            actions: "layDown",
          },
          {
            // Round 6: after laying down, stay in drawn to allow lay offs
            guard: ({ context, event }) => {
              if (event.type !== "LAY_DOWN") return false;
              if (context.roundNumber !== 6) return false;

              // Cannot lay down if already down this round
              if (context.isDown) return false;

              // Build melds from card IDs and validate
              const melds: Meld[] = [];
              for (const proposal of event.melds) {
                const cards: Card[] = [];
                for (const cardId of proposal.cardIds) {
                  const card = context.hand.find((c) => c.id === cardId);
                  if (!card) return false;
                  cards.push(card);
                }
                melds.push({
                  id: `meld-${Math.random()}`,
                  type: proposal.type,
                  cards,
                  ownerId: context.playerId,
                });
              }

              // Validate each meld individually
              for (const meld of melds) {
                if (meld.type === "set" && !isValidSet(meld.cards)) {
                  return false;
                }
                if (meld.type === "run" && !isValidRun(meld.cards)) {
                  return false;
                }
              }

              // Validate contract requirements
              const contract = CONTRACTS[context.roundNumber];
              const result = validateContractMelds(contract, melds);
              return result.valid;
            },
            target: "drawn", // Stay in drawn for round 6
            actions: "layDown",
          },
          {
            guard: "canLayDown",
            target: "awaitingDiscard",
            actions: "layDown",
          },
        ],
        LAY_OFF: {
          guard: "canLayOff",
          target: "drawn", // Stay in drawn state to allow more lay offs
          actions: "layOff",
        },
        GO_OUT: {
          guard: "canGoOut",
          target: "wentOut",
          actions: "goOut",
        },
      },
      always: {
        // After lay off, if hand is empty, go out immediately
        guard: "handIsEmpty",
        target: "wentOut",
      },
    },
    awaitingDiscard: {
      on: {
        DISCARD: [
          {
            // If discarding last card, go out (rounds 1-5 only)
            // In round 6, cannot discard last card to go out
            guard: ({ context, event }) => {
              if (event.type !== "DISCARD") return false;
              // In round 6 when down, cannot discard to go out
              if (context.roundNumber === 6 && context.hand.length === 1 && context.isDown) {
                return false;
              }
              return context.hand.length === 1;
            },
            target: "wentOut",
            actions: "discardCard",
          },
          {
            // Normal discard (including round 6 when not going out)
            guard: "canDiscard",
            target: "turnComplete",
            actions: "discardCard",
          },
        ],
        END_TURN_STUCK: {
          // Round 6 only: end turn when stuck with 1 unlayable card
          guard: "canEndTurnStuck",
          target: "turnComplete",
        },
      },
    },
    turnComplete: {
      type: "final",
    },
    wentOut: {
      type: "final",
    },
  },
});
