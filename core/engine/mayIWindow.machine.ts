/**
 * MayIWindowMachine - Phase 6
 *
 * State machine for handling May I claiming window
 */

import { setup, createMachine, assign } from "xstate";
import type { Card } from "../card/card.types";

/**
 * Input to create a May I window
 */
export interface MayIWindowInput {
  discardedCard: Card;
  discardedByPlayerId: string;
  currentPlayerId: string;
  currentPlayerIndex: number;
  playerOrder: string[]; // All player IDs in turn order
  stock: Card[];
}

/**
 * Context for the May I window machine
 */
export interface MayIWindowContext {
  discardedCard: Card;
  discardedByPlayerId: string;
  currentPlayerId: string;
  currentPlayerIndex: number;
  playerOrder: string[];
  claimants: string[];
  currentPlayerClaimed: boolean;
  currentPlayerPassed: boolean;
  winnerId: string | null;
  stock: Card[];
  penaltyCard: Card | null;
}

/**
 * Events for the May I window machine
 */
export type MayIWindowEvent =
  | { type: "DRAW_FROM_DISCARD"; playerId: string }
  | { type: "DRAW_FROM_STOCK"; playerId: string }
  | { type: "CALL_MAY_I"; playerId: string };

/**
 * Output types for the May I window
 */
export type MayIWindowOutputType =
  | "CURRENT_PLAYER_CLAIMED"
  | "MAY_I_RESOLVED"
  | "NO_CLAIMS";

/**
 * Output from the May I window machine
 */
export interface MayIWindowOutput {
  type: MayIWindowOutputType;
  winnerId: string | null;
  winnerReceived: Card[];
  discardedCard: Card;
  penaltyCard: Card | null;
  updatedStock: Card[];
}

/**
 * Calculate priority order for May I claims
 * Priority goes to players closest to the current player in turn order
 * Excludes the discarder and current player
 */
export function getClaimPriority(
  playerOrder: string[],
  currentPlayerIndex: number,
  discardedByPlayerId: string
): string[] {
  const priority: string[] = [];
  const playerCount = playerOrder.length;

  // Start from player after current, wrap around, exclude current and discarder
  for (let i = 1; i < playerCount; i++) {
    const index = (currentPlayerIndex + i) % playerCount;
    const playerId = playerOrder[index]!;
    if (playerId !== discardedByPlayerId) {
      priority.push(playerId);
    }
  }

  return priority;
}

/**
 * Resolve claims by priority - first claimant in priority order wins
 */
export function resolveByPriority(
  claimants: string[],
  priorityOrder: string[]
): string | null {
  if (claimants.length === 0) return null;
  if (claimants.length === 1) return claimants[0]!;

  for (const playerId of priorityOrder) {
    if (claimants.includes(playerId)) {
      return playerId;
    }
  }

  return claimants[0] ?? null;
}

export const mayIWindowMachine = setup({
  types: {
    context: {} as MayIWindowContext,
    events: {} as MayIWindowEvent,
    input: {} as MayIWindowInput,
    output: {} as MayIWindowOutput,
  },
  guards: {
    isCurrentPlayer: ({ context, event }) => {
      if ("playerId" in event) {
        return event.playerId === context.currentPlayerId;
      }
      return false;
    },
    canCallMayI: ({ context, event }) => {
      if (event.type !== "CALL_MAY_I") return false;
      // Cannot May I your own discard
      if (event.playerId === context.discardedByPlayerId) return false;
      // Cannot call if already claimed
      if (context.claimants.includes(event.playerId)) return false;
      return true;
    },
    hasClaimants: ({ context }) => context.claimants.length > 0,
    noClaimants: ({ context }) => context.claimants.length === 0,
  },
  actions: {
    setCurrentPlayerClaimed: assign({
      currentPlayerClaimed: true,
    }),
    setCurrentPlayerPassed: assign({
      currentPlayerPassed: true,
    }),
    addClaimant: assign({
      claimants: ({ context, event }) => {
        if (event.type === "CALL_MAY_I") {
          return [...context.claimants, event.playerId];
        }
        return context.claimants;
      },
    }),
    resolveClaims: assign(({ context }) => {
      const priorityOrder = getClaimPriority(
        context.playerOrder,
        context.currentPlayerIndex,
        context.discardedByPlayerId
      );
      const winner = resolveByPriority(context.claimants, priorityOrder);
      const penaltyCard = winner && context.stock.length > 0 ? context.stock[0]! : null;
      const updatedStock = winner && penaltyCard ? context.stock.slice(1) : context.stock;

      return {
        winnerId: winner,
        penaltyCard,
        stock: updatedStock,
      };
    }),
  },
}).createMachine({
  id: "mayIWindow",
  initial: "open",
  context: ({ input }) => ({
    discardedCard: input.discardedCard,
    discardedByPlayerId: input.discardedByPlayerId,
    currentPlayerId: input.currentPlayerId,
    currentPlayerIndex: input.currentPlayerIndex,
    playerOrder: input.playerOrder,
    claimants: [],
    currentPlayerClaimed: false,
    currentPlayerPassed: false,
    winnerId: null,
    stock: input.stock,
    penaltyCard: null,
  }),
  states: {
    open: {
      on: {
        DRAW_FROM_DISCARD: {
          guard: "isCurrentPlayer",
          target: "closedByCurrentPlayer",
          actions: "setCurrentPlayerClaimed",
        },
        DRAW_FROM_STOCK: {
          guard: "isCurrentPlayer",
          target: "resolvingClaims",
          actions: "setCurrentPlayerPassed",
        },
        CALL_MAY_I: {
          guard: "canCallMayI",
          actions: "addClaimant",
        },
      },
    },
    resolvingClaims: {
      always: [
        {
          guard: "noClaimants",
          target: "closedNoClaim",
        },
        {
          guard: "hasClaimants",
          target: "resolved",
          actions: "resolveClaims",
        },
      ],
    },
    closedByCurrentPlayer: {
      type: "final",
    },
    resolved: {
      type: "final",
    },
    closedNoClaim: {
      type: "final",
    },
  },
  output: ({ context }) => {
    if (context.currentPlayerClaimed) {
      return {
        type: "CURRENT_PLAYER_CLAIMED" as const,
        winnerId: context.currentPlayerId,
        winnerReceived: [context.discardedCard],
        discardedCard: context.discardedCard,
        penaltyCard: null,
        updatedStock: context.stock,
      };
    }

    if (context.winnerId) {
      const received: Card[] = [context.discardedCard];
      if (context.penaltyCard) {
        received.push(context.penaltyCard);
      }
      return {
        type: "MAY_I_RESOLVED" as const,
        winnerId: context.winnerId,
        winnerReceived: received,
        discardedCard: context.discardedCard,
        penaltyCard: context.penaltyCard,
        updatedStock: context.stock,
      };
    }

    return {
      type: "NO_CLAIMS" as const,
      winnerId: null,
      winnerReceived: [],
      discardedCard: context.discardedCard,
      penaltyCard: null,
      updatedStock: context.stock,
    };
  },
});
