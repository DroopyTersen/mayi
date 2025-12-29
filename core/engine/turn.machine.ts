/**
 * TurnMachine - XState machine for managing a single player's turn
 *
 * States: awaitingDraw -> mayIWindow -> drawn -> awaitingDiscard -> turnComplete
 *
 * When the current player draws from stock, the May I window opens for other
 * players to claim the discarded card. The mayIWindow state invokes the
 * mayIWindowMachine to handle this resolution.
 */

import { setup, assign, sendTo } from "xstate";
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
import { canSwapJokerWithCard } from "../meld/meld.joker";
import {
  mayIWindowMachine,
  type MayIWindowInput,
  type MayIWindowOutput,
} from "./mayIWindow.machine";

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
  /** Error message from last failed operation */
  lastError: string | null;
  /** All player IDs in turn order (for May I) */
  playerOrder: string[];
  /** Map of playerId -> isDown (for May I eligibility) */
  playerDownStatus: Record<string, boolean>;
  /** Tracks May I winner's received cards to include in output */
  mayIResult: {
    winnerId: string;
    cardsReceived: Card[];
  } | null;
  /** Card on top of discard when May I window opened */
  mayIDiscardTop: Card | null;
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
  | { type: "DRAW_FROM_STOCK"; playerId?: string }
  | { type: "DRAW_FROM_DISCARD"; playerId?: string }
  | { type: "CALL_MAY_I"; playerId: string }
  | { type: "SKIP_LAY_DOWN" }
  | { type: "LAY_DOWN"; melds: MeldProposal[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "GO_OUT"; finalLayOffs: LayOffSpec[] }
  | { type: "SWAP_JOKER"; jokerCardId: string; meldId: string; swapCardId: string };

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
  /** All player IDs in turn order (for May I). If empty/missing, May I window is skipped. */
  playerOrder?: string[];
  /** Map of playerId -> isDown (for May I eligibility). Defaults to empty. */
  playerDownStatus?: Record<string, boolean>;
}

/**
 * Hand update for a player (used for May I winners)
 */
export interface HandUpdate {
  added: Card[];
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
  /** Updates to other players' hands (e.g., May I winner) */
  handUpdates?: Record<string, HandUpdate>;
}

export const turnMachine = setup({
  types: {
    context: {} as TurnContext,
    events: {} as TurnEvent,
    input: {} as TurnInput,
    output: {} as TurnOutput,
  },
  actors: {
    mayIWindowMachine,
  },
  guards: {
    canDrawFromStock: ({ context }) => {
      // Cannot draw from stock if stock is empty
      return context.stock.length > 0;
    },
    canDrawFromDiscard: ({ context }) => {
      // Cannot draw from discard if already down
      if (context.isDown) return false;
      return context.discard.length > 0;
    },
    shouldOpenMayIWindow: ({ context }) => {
      // Open May I window when:
      // - Stock is not empty (can draw)
      // - Discard pile has a card to claim
      // - There are other players who could claim
      // - At least one other player is not down (eligible to claim)
      if (context.stock.length === 0) return false;
      if (context.discard.length === 0) return false;
      if (context.playerOrder.length <= 1) return false;
      const otherPlayers = context.playerOrder.filter((id) => id !== context.playerId);
      return otherPlayers.some((id) => !context.playerDownStatus[id]);
    },
    canDiscard: ({ context, event }) => {
      if (event.type !== "DISCARD") return false;
      // Card must be in hand
      if (!context.hand.some((card) => card.id === event.cardId)) return false;
      // Note: In Round 6, players in awaitingDiscard are never "down"
      // because laying down = going out. No special Round 6 logic needed here.
      return true;
    },
    canLayDown: ({ context, event }) => {
      if (event.type !== "LAY_DOWN") return false;

      // Round 6: must use ALL cards (handled by canLayDownAndGoOut, not here)
      if (context.roundNumber === 6) return false;

      // Cannot lay down if already down this round
      if (context.isDown) return false;

      // Build melds from card IDs
      const melds: Meld[] = [];
      for (let i = 0; i < event.melds.length; i++) {
        const proposal = event.melds[i]!;
        const cards: Card[] = [];
        for (const cardId of proposal.cardIds) {
          const card = context.hand.find((c) => c.id === cardId);
          if (!card) return false; // Card not in hand
          cards.push(card);
        }
        melds.push({
          id: `validation-meld-${i}`, // Deterministic ID for validation
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
      for (let i = 0; i < event.melds.length; i++) {
        const proposal = event.melds[i]!;
        const cards: Card[] = [];
        for (const cardId of proposal.cardIds) {
          const card = context.hand.find((c) => c.id === cardId);
          if (!card) return false; // Card not in hand
          cards.push(card);
        }
        melds.push({
          id: `validation-meld-${i}`, // Deterministic ID for validation
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

      // Round 6: laying off is not allowed (no melds on table until someone wins)
      if (context.roundNumber === 6) return false;

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
    // Check if player can swap a Joker from a meld
    canSwapJoker: ({ context, event }) => {
      if (event.type !== "SWAP_JOKER") return false;

      // Round 6: swapping is not allowed (no melds on table)
      if (context.roundNumber === 6) return false;

      // Player must not be down yet (per house rules)
      if (context.isDown) return false;

      // Find the meld
      const meld = context.table.find((m) => m.id === event.meldId);
      if (!meld) return false;

      // Meld must be a run (not a set)
      if (meld.type !== "run") return false;

      // Find the joker card in the meld
      const jokerCard = meld.cards.find((c) => c.id === event.jokerCardId);
      if (!jokerCard) return false;

      // Must be a Joker (not a 2)
      if (jokerCard.rank !== "Joker") return false;

      // Find the swap card in hand
      const swapCard = context.hand.find((c) => c.id === event.swapCardId);
      if (!swapCard) return false;

      // Check if swap is valid using the meld.joker utility
      return canSwapJokerWithCard(meld, jokerCard, swapCard);
    },
  },
  actions: {
    clearError: assign({
      lastError: () => null,
    }),
    setLayDownError: assign({
      lastError: ({ context, event }) => {
        if (event.type !== "LAY_DOWN") return "invalid event";
        if (context.isDown) return "already laid down this round";

        // Round 6: must use ALL cards
        if (context.roundNumber === 6) {
          const usedCardIds = new Set(event.melds.flatMap((m) => m.cardIds));
          if (usedCardIds.size !== context.hand.length) {
            return `Round 6 requires laying down ALL ${context.hand.length} cards at once`;
          }
        }

        // Check card ownership
        for (const proposal of event.melds) {
          for (const cardId of proposal.cardIds) {
            if (!context.hand.find((c) => c.id === cardId)) {
              return "card not in hand";
            }
          }
        }
        // Check contract
        const contract = CONTRACTS[context.roundNumber];
        const setsNeeded = contract.sets;
        const runsNeeded = contract.runs;
        const setsProvided = event.melds.filter((m) => m.type === "set").length;
        const runsProvided = event.melds.filter((m) => m.type === "run").length;
        if (setsProvided !== setsNeeded || runsProvided !== runsNeeded) {
          return `contract requires ${setsNeeded} set(s) and ${runsNeeded} run(s)`;
        }
        // Check which specific meld is invalid
        for (let i = 0; i < event.melds.length; i++) {
          const proposal = event.melds[i]!;
          const cards = proposal.cardIds
            .map((id) => context.hand.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined);
          if (proposal.type === "set" && !isValidSet(cards)) {
            return `meld ${i + 1} is not a valid set`;
          }
          if (proposal.type === "run" && !isValidRun(cards)) {
            return `meld ${i + 1} is not a valid run`;
          }
        }
        return "invalid melds";
      },
    }),
    setLayOffError: assign({
      lastError: ({ context, event }) => {
        if (event.type !== "LAY_OFF") return "invalid event";
        if (context.roundNumber === 6) return "laying off is not allowed in Round 6";
        if (!context.isDown) return "must be down from a previous turn to lay off";
        if (context.laidDownThisTurn) return "cannot lay off on same turn as laying down";
        if (!context.hand.find((c) => c.id === event.cardId)) return "card not in hand";
        if (!context.table.find((m) => m.id === event.meldId)) return "meld not found";
        // Card doesn't fit the meld (wrong rank for set, or doesn't extend run)
        // Note: Wild ratio is NOT enforced during layoff per house rules
        return "card does not fit this meld";
      },
    }),
    setStockEmptyError: assign({
      lastError: () => "stock is empty - reshuffle required",
    }),
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
        // Build melds and add to table with deterministic IDs
        const tableLen = context.table.length;
        const newMelds: Meld[] = event.melds.map((proposal, i) => {
          const cards = proposal.cardIds
            .map((id) => context.hand.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined);
          return {
            id: `meld-${context.playerId}-${tableLen + i}`,
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
    // SWAP_JOKER action - swap a Joker from a run with a card from hand
    swapJoker: assign({
      hand: ({ context, event }) => {
        if (event.type !== "SWAP_JOKER") return context.hand;

        // Find the meld and joker
        const meld = context.table.find((m) => m.id === event.meldId);
        if (!meld) return context.hand;

        const jokerCard = meld.cards.find((c) => c.id === event.jokerCardId);
        if (!jokerCard) return context.hand;

        // Remove swap card from hand and add joker
        return [
          ...context.hand.filter((c) => c.id !== event.swapCardId),
          jokerCard,
        ];
      },
      table: ({ context, event }) => {
        if (event.type !== "SWAP_JOKER") return context.table;

        // Find the swap card in hand
        const swapCard = context.hand.find((c) => c.id === event.swapCardId);
        if (!swapCard) return context.table;

        return context.table.map((meld) => {
          if (meld.id !== event.meldId) return meld;

          // Find the joker's position and replace it with the swap card
          const jokerIndex = meld.cards.findIndex((c) => c.id === event.jokerCardId);
          if (jokerIndex === -1) return meld;

          const newCards = [...meld.cards];
          newCards[jokerIndex] = swapCard;

          return { ...meld, cards: newCards };
        });
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
    lastError: null,
    playerOrder: input.playerOrder ?? [],
    playerDownStatus: input.playerDownStatus ?? {},
    mayIResult: null,
    mayIDiscardTop: null,
  }),
  output: ({ context }): TurnOutput => {
    const handUpdates: Record<string, { added: Card[] }> = {};
    if (context.mayIResult) {
      handUpdates[context.mayIResult.winnerId] = {
        added: context.mayIResult.cardsReceived,
      };
    }
    return {
      playerId: context.playerId,
      hand: context.hand,
      stock: context.stock,
      discard: context.discard,
      isDown: context.isDown,
      table: context.table,
      // wentOut is true when hand is empty at end of turn (player went out)
      wentOut: context.hand.length === 0,
      // Include handUpdates only if there's a May I winner
      ...(Object.keys(handUpdates).length > 0 ? { handUpdates } : {}),
    };
  },
  states: {
    awaitingDraw: {
      on: {
        DRAW_FROM_STOCK: [
          {
            // Open May I window when there are eligible claimants
            guard: "shouldOpenMayIWindow",
            target: "mayIWindow",
            actions: [
              // Store the discard top before drawing (for May I window)
              assign({
                mayIDiscardTop: ({ context }) => context.discard[0] ?? null,
              }),
              "drawFromStock",
              "clearError",
            ],
          },
          {
            // Skip May I window - go directly to drawn
            guard: "canDrawFromStock",
            target: "drawn",
            actions: ["drawFromStock", "clearError"],
          },
          {
            // Fallback: set error when stock is empty
            actions: "setStockEmptyError",
          },
        ],
        DRAW_FROM_DISCARD: {
          guard: "canDrawFromDiscard",
          target: "drawn",
          actions: "drawFromDiscard",
        },
      },
    },
    mayIWindow: {
      invoke: {
        id: "mayIWindow",
        src: "mayIWindowMachine",
        input: ({ context }): MayIWindowInput => ({
          discardedCard: context.mayIDiscardTop!,
          discardedByPlayerId: context.playerId, // Previous player discarded
          currentPlayerId: context.playerId,
          currentPlayerIndex: context.playerOrder.indexOf(context.playerId),
          playerOrder: context.playerOrder,
          stock: context.stock,
          playerDownStatus: context.playerDownStatus,
        }),
        onDone: {
          target: "drawn",
          actions: assign(({ context, event }) => {
            const output = event.output as MayIWindowOutput;

            // If there's a May I winner (non-current player), record result
            if (output.type === "MAY_I_RESOLVED" && output.winnerId && output.winnerId !== context.playerId) {
              return {
                // Update discard pile - remove the claimed card
                discard: context.discard.filter((c) => c.id !== output.discardedCard.id),
                // Update stock (penalty card was taken)
                stock: output.updatedStock,
                // Store May I result for output
                mayIResult: {
                  winnerId: output.winnerId,
                  cardsReceived: output.winnerReceived,
                },
              };
            }

            // If current player claimed via DRAW_FROM_DISCARD
            if (output.type === "CURRENT_PLAYER_CLAIMED") {
              // Current player already drew from stock, now also gets discard
              return {
                hand: [...context.hand, output.discardedCard],
                discard: context.discard.filter((c) => c.id !== output.discardedCard.id),
              };
            }

            // No claims - just clear mayIDiscardTop
            return {
              mayIDiscardTop: null,
            };
          }),
        },
      },
      on: {
        // Forward May I events to the invoked machine
        CALL_MAY_I: {
          actions: sendTo("mayIWindow", ({ event }) => event),
        },
        DRAW_FROM_STOCK: {
          // Current player passes on discard (closes window)
          actions: sendTo("mayIWindow", ({ event, context }) => ({
            type: "DRAW_FROM_STOCK" as const,
            playerId: event.playerId ?? context.playerId,
          })),
        },
        DRAW_FROM_DISCARD: {
          // Current player claims discard (if not down)
          actions: sendTo("mayIWindow", ({ event, context }) => ({
            type: "DRAW_FROM_DISCARD" as const,
            playerId: event.playerId ?? context.playerId,
          })),
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
            // In Round 6, this is the ONLY way to lay down (must use all cards)
            guard: "canLayDownAndGoOut",
            target: "wentOut",
            actions: ["layDown", "clearError"],
          },
          {
            // Rounds 1-5: lay down contract, then go to discard phase
            // Round 6 is blocked here - must use all cards via canLayDownAndGoOut
            guard: "canLayDown",
            target: "awaitingDiscard",
            actions: ["layDown", "clearError"],
          },
          {
            // Fallback: set error when all guards fail
            actions: "setLayDownError",
          },
        ],
        LAY_OFF: [
          {
            guard: "canLayOff",
            target: "drawn", // Stay in drawn state to allow more lay offs
            actions: ["layOff", "clearError"],
          },
          {
            // Fallback: set error when guard fails
            actions: "setLayOffError",
          },
        ],
        SWAP_JOKER: {
          guard: "canSwapJoker",
          target: "drawn", // Stay in drawn state after swap
          actions: "swapJoker",
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
            // If discarding last card, go out
            // Note: In Round 6, you can never be "down" without going out,
            // so players in awaitingDiscard are never down in Round 6
            guard: "willGoOutAfterDiscard",
            target: "wentOut",
            actions: "discardCard",
          },
          {
            // Normal discard
            guard: "canDiscard",
            target: "turnComplete",
            actions: "discardCard",
          },
        ],
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
