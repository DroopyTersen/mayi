/**
 * TurnMachine - XState machine for managing a single player's turn
 *
 * States: awaitingDraw -> drawn -> awaitingDiscard -> turnComplete
 *
 * Note: May I is now handled at the round level (round.machine.ts), not here.
 * The mayIWindow state has been removed - players can call May I at any time
 * during a turn, and resolution is handled by the round machine.
 */

import { setup, assign } from "xstate";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber } from "./engine.types";
import { CONTRACTS, validateContractMelds } from "./contracts";
import { isValidSet, isValidRun } from "../meld/meld.validation";
import { shuffle } from "../card/card.deck";
import {
  canLayOffCard,
  canLayOffToSet,
  canLayOffToRun,
  validateCardOwnership,
  getCardFromHand,
} from "./layoff";
import { canSwapJokerWithCard } from "../meld/meld.joker";
// Note: May I is now handled at the round level, not turn level
// The mayIWindow.machine.ts will be removed

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
  // Note: May I is now handled at the round level
  // These fields are kept for backward compatibility but will be removed
  /** All player IDs in turn order */
  playerOrder: string[];
  /** Map of playerId -> isDown */
  playerDownStatus: Record<string, boolean>;
  /** Who discarded the top card of the discard pile (previous player) */
  lastDiscardedByPlayerId: string | null;
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
  | { type: "SYNC_PILES"; stock: Card[]; discard: Card[] }
  | { type: "CALL_MAY_I"; playerId: string }
  | { type: "SKIP_LAY_DOWN"; playerId?: string }
  | { type: "LAY_DOWN"; playerId?: string; melds: MeldProposal[] }
  | { type: "LAY_OFF"; playerId?: string; cardId: string; meldId: string }
  | { type: "DISCARD"; playerId?: string; cardId: string }
  | { type: "GO_OUT"; playerId?: string; finalLayOffs: LayOffSpec[] }
  | { type: "SWAP_JOKER"; playerId?: string; jokerCardId: string; meldId: string; swapCardId: string }
  | { type: "REORDER_HAND"; playerId?: string; newOrder: string[] };

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
  /** Who discarded the top card of the discard pile (previous player). Used to prevent calling May I on your own discard. */
  lastDiscardedByPlayerId?: string;
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
    // Note: May I is now handled at round level - mayIWindowMachine removed
  },
  guards: {
    isCurrentPlayer: ({ context, event }) => {
      // Validate that the event's playerId matches the current turn's player
      // If playerId is not provided, assume it's the current player (legacy behavior)
      if ("playerId" in event && event.playerId !== undefined) {
        return event.playerId === context.playerId;
      }
      return true;
    },
    canDrawFromStockAsPlayer: ({ context, event }) => {
      // Must be current player and stock must not be empty
      if ("playerId" in event && event.playerId !== undefined) {
        if (event.playerId !== context.playerId) return false;
      }
      return context.stock.length > 0;
    },
    canDrawFromDiscardAsPlayer: ({ context, event }) => {
      // Must be current player, not already down, and discard not empty
      if ("playerId" in event && event.playerId !== undefined) {
        if (event.playerId !== context.playerId) return false;
      }
      if (context.isDown) return false;
      return context.discard.length > 0;
    },
    // Note: May I is now handled at round level - guards removed
    canDrawFromStock: ({ context }) => {
      // Cannot draw from stock if stock is empty
      return context.stock.length > 0;
    },
    canDrawFromDiscard: ({ context }) => {
      // Cannot draw from discard if already down
      if (context.isDown) return false;
      return context.discard.length > 0;
    },
    canDiscard: ({ context, event }) => {
      if (event.type !== "DISCARD") return false;
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;
      // Card must be in hand
      if (!context.hand.some((card) => card.id === event.cardId)) return false;
      // Note: In Round 6, players in awaitingDiscard are never "down"
      // because laying down = going out. No special Round 6 logic needed here.
      return true;
    },
    canLayDown: ({ context, event }) => {
      if (event.type !== "LAY_DOWN") return false;
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;

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
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;

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
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;

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
    willGoOutAfterDiscard: ({ context, event }) => {
      if (event.type !== "DISCARD") return false;
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;
      // Must actually be discarding the last card from hand
      if (!context.hand.some((c) => c.id === event.cardId)) return false;
      return context.hand.length === 1;
    },
    // Check if hand is empty (went out via lay off)
    handIsEmpty: ({ context }) => {
      return context.hand.length === 0;
    },
    // Check if GO_OUT command is valid
    canGoOut: ({ context, event }) => {
      if (event.type !== "GO_OUT") return false;
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;

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
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;

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
    // Check if hand can be reordered (free action)
    canReorderHand: ({ context, event }) => {
      if (event.type !== "REORDER_HAND") return false;
      // Must be current player (when provided)
      if (event.playerId !== undefined && event.playerId !== context.playerId) return false;
      // Must have same number of cards
      if (event.newOrder.length !== context.hand.length) return false;
      // All cards in newOrder must be in hand
      const handIds = new Set(context.hand.map((c) => c.id));
      for (const cardId of event.newOrder) {
        if (!handIds.has(cardId)) return false;
      }
      // All cards in hand must be in newOrder (no duplicates, no missing)
      const orderIds = new Set(event.newOrder);
      if (orderIds.size !== event.newOrder.length) return false;
      return true;
    },
  },
  actions: {
    clearError: assign({
      lastError: () => null,
    }),
    setLayDownError: assign({
      lastError: ({ context, event }) => {
        if (event.type !== "LAY_DOWN") return "invalid event";
        if (event.playerId !== undefined && event.playerId !== context.playerId) {
          return context.lastError;
        }
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
        if (event.playerId !== undefined && event.playerId !== context.playerId) {
          return context.lastError;
        }
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
    drawFromStock: assign(({ context }) => {
      const topCard = context.stock[0];
      if (!topCard) return {};

      const hand = [...context.hand, topCard];
      let stock = context.stock.slice(1);
      let discard = context.discard;

      // House rules: stock pile should never be empty.
      // When the last stock card is drawn, immediately replenish from discard
      // (keeping the exposed top discard card at index 0).
      if (stock.length === 0 && discard.length > 1) {
        const topDiscard = discard[0];
        const cardsToReshuffle = discard.slice(1);
        stock = shuffle(cardsToReshuffle);
        discard = topDiscard ? [topDiscard] : [];
      }

      return { hand, stock, discard, hasDrawn: true };
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
    syncPiles: assign(({ event }) => {
      if (event.type !== "SYNC_PILES") return {};
      return {
        stock: event.stock,
        discard: event.discard,
      };
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
    // REORDER_HAND action - reorder cards in hand (free action)
    reorderHand: assign({
      hand: ({ context, event }) => {
        if (event.type !== "REORDER_HAND") return context.hand;

        // Reorder hand according to newOrder
        const cardMap = new Map(context.hand.map((c) => [c.id, c]));
        const reordered: Card[] = [];
        for (const cardId of event.newOrder) {
          const card = cardMap.get(cardId);
          if (card) {
            reordered.push(card);
          }
        }
        return reordered;
      },
    }),
    setReorderError: assign({
      lastError: ({ context, event }) => {
        if (event.type !== "REORDER_HAND") return "invalid event";
        if (event.playerId !== undefined && event.playerId !== context.playerId) {
          return context.lastError;
        }
        if (event.newOrder.length !== context.hand.length) {
          return "card count mismatch";
        }
        const handIds = new Set(context.hand.map((c) => c.id));
        for (const cardId of event.newOrder) {
          if (!handIds.has(cardId)) {
            return "card not in hand";
          }
        }
        const orderIds = new Set(event.newOrder);
        for (const card of context.hand) {
          if (!orderIds.has(card.id)) {
            return "card missing from new order";
          }
        }
        return "invalid reorder";
      },
    }),
  },
}).createMachine({
  id: "turn",
  initial: "awaitingDraw",
  on: {
    SYNC_PILES: { actions: "syncPiles" },
  },
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
    lastDiscardedByPlayerId: input.lastDiscardedByPlayerId ?? null,
  }),
  output: ({ context }): TurnOutput => {
    // Note: May I handUpdates are now handled at round level
    return {
      playerId: context.playerId,
      hand: context.hand,
      stock: context.stock,
      discard: context.discard,
      isDown: context.isDown,
      table: context.table,
      // wentOut is true when hand is empty at end of turn (player went out)
      wentOut: context.hand.length === 0,
    };
  },
  // Note: REORDER_HAND is handled in individual states (awaitingDraw, drawn, awaitingDiscard)
  // to ensure proper event handling with nested invoked actors
  states: {
    awaitingDraw: {
      on: {
        // Note: May I is now handled at round level
        // DRAW_FROM_STOCK goes directly to drawn state
        DRAW_FROM_STOCK: [
          {
            guard: "canDrawFromStockAsPlayer",
            target: "drawn",
            actions: ["drawFromStock", "clearError"],
          },
          {
            // Fallback: set error when stock is empty (for debugging)
            guard: "isCurrentPlayer",
            actions: "setStockEmptyError",
          },
          // Wrong player - silently ignore (XState philosophy)
        ],
        DRAW_FROM_DISCARD: {
          guard: "canDrawFromDiscardAsPlayer",
          target: "drawn",
          actions: ["drawFromDiscard", "clearError"],
        },
        REORDER_HAND: [
          { guard: "canReorderHand", actions: ["reorderHand", "clearError"] },
          { actions: "setReorderError" },
        ],
      },
    },
    // Note: mayIWindow state removed - May I is now handled at round level
    drawn: {
      on: {
        SKIP_LAY_DOWN: {
          guard: "isCurrentPlayer",
          target: "awaitingDiscard",
          actions: "clearError",
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
          actions: ["swapJoker", "clearError"],
        },
        GO_OUT: {
          guard: "canGoOut",
          target: "wentOut",
          actions: ["goOut", "clearError"],
        },
        REORDER_HAND: [
          { guard: "canReorderHand", actions: ["reorderHand", "clearError"] },
          { actions: "setReorderError" },
        ],
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
            actions: ["discardCard", "clearError"],
          },
          {
            // Normal discard
            guard: "canDiscard",
            target: "turnComplete",
            actions: ["discardCard", "clearError"],
          },
        ],
        REORDER_HAND: [
          { guard: "canReorderHand", actions: ["reorderHand", "clearError"] },
          { actions: "setReorderError" },
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
