/**
 * RoundMachine - XState machine for managing a single round
 *
 * States: dealing -> active (with TurnMachine and May I resolution) -> scoring
 *
 * The active state is a compound state with:
 * - playing: invokes TurnMachine for each player's turn
 * - resolvingMayI: handles interactive May I resolution
 *
 * When a turn completes, we either advance to the next player or end the round.
 */

import { setup, assign, sendTo, raise } from "xstate";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { Player, RoundRecord, RoundNumber, MayIResolution } from "./engine.types";
import type { Contract } from "./contracts";
import { CONTRACTS } from "./contracts";
import { createDeck, shuffle, deal } from "../card/card.deck";
import { turnMachine, type TurnInput, type TurnOutput, type TurnContext as TurnMachineContext } from "./turn.machine";
import { calculateHandScore } from "../scoring/scoring";

/**
 * Events that need to be forwarded to child turn actor
 */
type ForwardedTurnEvent =
  | { type: "DRAW_FROM_STOCK"; playerId?: string }
  | { type: "DRAW_FROM_DISCARD"; playerId?: string }
  | { type: "SKIP_LAY_DOWN"; playerId?: string }
  | { type: "LAY_DOWN"; playerId?: string; melds: unknown[] }
  | { type: "LAY_OFF"; playerId?: string; cardId: string; meldId: string }
  | { type: "DISCARD"; playerId?: string; cardId: string }
  | { type: "PASS_MAY_I" }
  | { type: "SWAP_JOKER"; playerId?: string; jokerCardId: string; meldId: string; swapCardId: string }
  | { type: "GO_OUT"; playerId?: string; finalLayOffs: unknown[] }
  | { type: "REORDER_HAND"; playerId?: string; newOrder: string[] };

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
  /** Current turn number within this round (starts at 1) */
  turnNumber: number;
  /** Who discarded the top card (previous player). Used for May I eligibility. */
  lastDiscardedByPlayerId: string | null;
  /** Predefined state from input (used by dealCards action) */
  predefinedState: PredefinedRoundState | null;
  /** Tracks an active May I resolution. null when no resolution in progress. */
  mayIResolution: MayIResolution | null;
  /** Whether the exposed discard has been claimed this turn. */
  discardClaimed: boolean;
  /** Whether the current player has drawn from stock (loses May I priority) */
  currentPlayerHasDrawnFromStock: boolean;
}

/**
 * Events that can be sent to the RoundMachine
 */
export type RoundEvent =
  | { type: "RESHUFFLE_STOCK" }
  | { type: "CALL_MAY_I"; playerId: string }
  | { type: "ALLOW_MAY_I"; playerId: string }
  | { type: "CLAIM_MAY_I"; playerId: string }
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

/**
 * Calculate players who are ahead of the caller in priority order.
 * Priority order: closest to current player in turn order.
 */
function getPlayersAheadOfCaller(
  callerIndex: number,
  currentPlayerIndex: number,
  players: Player[],
  currentPlayerHasDrawnFromStock: boolean
): string[] {
  const result: string[] = [];
  const playerCount = players.length;

  // Start from current player and go until caller
  for (let i = 0; i < playerCount; i++) {
    const index = (currentPlayerIndex + i) % playerCount;

    // Stop when we reach the caller
    if (index === callerIndex) break;

    const player = players[index]!;

    // Skip down players
    if (player.isDown) continue;

    // Skip current player if they drew from stock
    if (index === currentPlayerIndex && currentPlayerHasDrawnFromStock) continue;

    result.push(player.id);
  }

  return result;
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

    canCallMayI: ({ context, event }) => {
      if (event.type !== "CALL_MAY_I") return false;
      const playerId = event.playerId;

      // Can't call May I if resolution in progress
      if (context.mayIResolution !== null) return false;

      // Can't call May I if discard already claimed this turn
      if (context.discardClaimed) return false;

      // Can't call May I if no discard to claim
      if (context.discard.length === 0) return false;

      // Find the player
      const player = context.players.find((p) => p.id === playerId);
      if (!player) return false;

      // Down players can't call May I
      if (player.isDown) return false;

      // Can't claim your own discard
      if (context.lastDiscardedByPlayerId === playerId) return false;

      return true;
    },

    isPlayerBeingPrompted: ({ context, event }) => {
      if (!context.mayIResolution) return false;
      if (!("playerId" in event)) return false;
      return context.mayIResolution.playerBeingPrompted === event.playerId;
    },

    hasMorePlayersToCheck: ({ context }) => {
      if (!context.mayIResolution) return false;
      return context.mayIResolution.currentPromptIndex < context.mayIResolution.playersToCheck.length;
    },

    noPlayersToCheck: ({ context }) => {
      if (!context.mayIResolution) return false;
      return context.mayIResolution.playersToCheck.length === 0;
    },

    isCurrentPlayerClaiming: ({ context, event }) => {
      if (!context.mayIResolution) return false;
      if (!("playerId" in event)) return false;
      const currentPlayer = context.players[context.currentPlayerIndex];
      return currentPlayer?.id === event.playerId && !context.currentPlayerHasDrawnFromStock;
    },
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
      turnNumber: ({ context }) => context.turnNumber + 1,
      discardClaimed: false,
      currentPlayerHasDrawnFromStock: false,
    }),

    reshuffleStock: assign(({ context }) => {
      // Keep only the exposed (top) discard card.
      // Discard pile is stored with the top card at index 0.
      const topDiscard = context.discard[0];
      const cardsToReshuffle = context.discard.slice(1);
      const newStock = shuffle(cardsToReshuffle);

      return {
        stock: newStock,
        discard: topDiscard ? [topDiscard] : [],
      };
    }),

    trackDrawFromStock: assign({
      currentPlayerHasDrawnFromStock: true,
    }),

    initializeMayIResolution: assign(({ context, event }) => {
      if (event.type !== "CALL_MAY_I") return {};

      const callerIndex = context.players.findIndex((p) => p.id === event.playerId);
      if (callerIndex === -1) return {};

      const playersToCheck = getPlayersAheadOfCaller(
        callerIndex,
        context.currentPlayerIndex,
        context.players,
        context.currentPlayerHasDrawnFromStock
      );

      const cardBeingClaimed = context.discard[0];
      if (!cardBeingClaimed) return {};

      const resolution: MayIResolution = {
        originalCaller: event.playerId,
        cardBeingClaimed,
        playersToCheck,
        currentPromptIndex: 0,
        playerBeingPrompted: playersToCheck[0] ?? null,
        playersWhoAllowed: [],
        winner: null,
        outcome: null,
      };

      // If no players to check, caller wins immediately
      if (playersToCheck.length === 0) {
        resolution.winner = event.playerId;
        resolution.outcome = "caller_won";
      }

      return { mayIResolution: resolution };
    }),

    advanceMayIResolution: assign(({ context, event }) => {
      if (!context.mayIResolution) return {};
      if (event.type !== "ALLOW_MAY_I") return {};

      const resolution = { ...context.mayIResolution };
      resolution.playersWhoAllowed = [...resolution.playersWhoAllowed, event.playerId];
      resolution.currentPromptIndex += 1;

      if (resolution.currentPromptIndex >= resolution.playersToCheck.length) {
        // All players allowed, original caller wins
        resolution.winner = resolution.originalCaller;
        resolution.outcome = "caller_won";
        resolution.playerBeingPrompted = null;
      } else {
        // Move to next player
        resolution.playerBeingPrompted = resolution.playersToCheck[resolution.currentPromptIndex] ?? null;
      }

      return { mayIResolution: resolution };
    }),

    blockMayIResolution: assign(({ context, event }) => {
      if (!context.mayIResolution) return {};
      if (event.type !== "CLAIM_MAY_I") return {};

      const resolution = { ...context.mayIResolution };
      resolution.winner = event.playerId;
      resolution.outcome = "blocked";
      resolution.playerBeingPrompted = null;

      return { mayIResolution: resolution };
    }),

    currentPlayerClaimsMayI: assign(({ context, event }) => {
      if (!context.mayIResolution) return {};
      if (event.type !== "CLAIM_MAY_I") return {};

      const currentPlayer = context.players[context.currentPlayerIndex];
      if (!currentPlayer) return {};

      const resolution = { ...context.mayIResolution };
      resolution.winner = currentPlayer.id;
      resolution.outcome = "current_player_claimed";
      resolution.playerBeingPrompted = null;

      return { mayIResolution: resolution };
    }),

    grantMayICardsToWinner: assign(({ context, self }) => {
      if (!context.mayIResolution?.winner) return {};

      const resolution = context.mayIResolution;
      const winnerId = resolution.winner;
      const cardBeingClaimed = resolution.cardBeingClaimed;
      const isCurrentPlayerClaim = resolution.outcome === "current_player_claimed";

      // Fallback to round context if, for some reason, turn actor isn't available
      let stock: Card[] = context.stock;
      let discard: Card[] = context.discard;

      // Read current piles from the invoked TurnMachine (if present)
      const turnActor = self.getSnapshot().children.turn;
      const turnSnapshot = turnActor?.getSnapshot();
      const turnContext = (turnSnapshot?.context ?? null) as TurnMachineContext | null;
      if (turnContext) {
        stock = turnContext.stock;
        discard = turnContext.discard;
      }

      // Remove the claimed discard card from the discard pile (if still present)
      discard = discard.filter((c) => c.id !== cardBeingClaimed.id);

      // Helper: replenish stock from discard if empty (keeping discard[0] exposed)
      const replenishStockIfEmpty = (
        currentStock: Card[],
        currentDiscard: Card[]
      ): { stock: Card[]; discard: Card[] } => {
        if (currentStock.length > 0) return { stock: currentStock, discard: currentDiscard };
        if (currentDiscard.length <= 1) return { stock: currentStock, discard: currentDiscard };
        const topDiscard = currentDiscard[0];
        const cardsToReshuffle = currentDiscard.slice(1);
        return {
          stock: shuffle(cardsToReshuffle),
          discard: topDiscard ? [topDiscard] : [],
        };
      };

      // Determine penalty card for non-current-player winners
      let penaltyCard: Card | null = null;
      if (!isCurrentPlayerClaim) {
        // If stock is empty, auto-replenish from discard first (house rules)
        ({ stock, discard } = replenishStockIfEmpty(stock, discard));

        penaltyCard = stock[0] ?? null;
        if (penaltyCard) {
          stock = stock.slice(1);
          // If that was the last stock card, auto-replenish again
          ({ stock, discard } = replenishStockIfEmpty(stock, discard));
        }
      }

      const cardsToAdd: Card[] = [];
      if (!isCurrentPlayerClaim) {
        cardsToAdd.push(cardBeingClaimed);
        if (penaltyCard) cardsToAdd.push(penaltyCard);
      }

      return {
        players: context.players.map((player) => {
          if (player.id === winnerId && cardsToAdd.length > 0) {
            return { ...player, hand: [...player.hand, ...cardsToAdd] };
          }
          return player;
        }),
        stock,
        discard,
        discardClaimed: true,
      };
    }),

    clearMayIResolution: assign({
      mayIResolution: null,
    }),

    resetDiscardClaimed: assign({
      discardClaimed: false,
    }),

    syncTurnPiles: sendTo("turn", ({ context }) => ({
      type: "SYNC_PILES",
      stock: context.stock,
      discard: context.discard,
    })),
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
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    predefinedState: input.predefinedState ?? null,
    mayIResolution: null,
    discardClaimed: false,
    currentPlayerHasDrawnFromStock: false,
  }),
  output: ({ context }) => ({
    roundRecord: {
      roundNumber: context.roundNumber,
      scores: Object.fromEntries(
        context.players.map((p) => [
          p.id,
          p.id === context.winnerPlayerId ? 0 : calculateHandScore(p.hand),
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
      initial: "playing",
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
            // May I support (still needed for some turn logic)
            playerOrder: context.players.map((p) => p.id),
            playerDownStatus: Object.fromEntries(
              context.players.map((p) => [p.id, p.isDown])
            ),
            lastDiscardedByPlayerId: context.lastDiscardedByPlayerId ?? undefined,
          };
        },
        onDone: [
          {
            // Player went out - end the round
            guard: ({ event }) => (event.output as TurnOutput).wentOut === true,
            target: "#round.scoring",
            actions: assign(({ context, event }) => {
              const output = event.output as TurnOutput;
              const handUpdates = output.handUpdates ?? {};

              return {
                players: context.players.map((player) => {
                  if (player.id === output.playerId) {
                    return { ...player, hand: output.hand, isDown: output.isDown };
                  }
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
            // Normal turn completion - advance to next player and start new turn
            target: "#round.active",
            reenter: true,
            actions: [
              assign(({ context, event }) => {
                const output = event.output as TurnOutput;
                const handUpdates = output.handUpdates ?? {};

                return {
                  players: context.players.map((player) => {
                    if (player.id === output.playerId) {
                      return { ...player, hand: output.hand, isDown: output.isDown };
                    }
                    const update = handUpdates[player.id];
                    if (update) {
                      return { ...player, hand: [...player.hand, ...update.added] };
                    }
                    return player;
                  }),
                  stock: output.stock,
                  discard: output.discard,
                  table: output.table,
                  lastDiscardedByPlayerId: output.playerId,
                };
              }),
              "advanceTurn",
            ],
          },
        ],
      },
      states: {
        playing: {
          on: {
            // May I is now handled at round level
            CALL_MAY_I: {
              guard: "canCallMayI",
              target: "resolvingMayI",
              actions: "initializeMayIResolution",
            },
            // Track when current player draws from stock (loses May I priority)
            DRAW_FROM_STOCK: {
              actions: [
                "trackDrawFromStock",
                sendTo("turn", ({ event }) => event),
              ],
            },
            // Track when current player draws from discard (claims it)
            DRAW_FROM_DISCARD: {
              actions: [
                assign({ discardClaimed: true }),
                sendTo("turn", ({ event }) => event),
              ],
            },
            // Forward other events to turn machine
            SKIP_LAY_DOWN: { actions: sendTo("turn", ({ event }) => event) },
            LAY_DOWN: { actions: sendTo("turn", ({ event }) => event) },
            LAY_OFF: { actions: sendTo("turn", ({ event }) => event) },
            DISCARD: {
              actions: [
                "resetDiscardClaimed",
                sendTo("turn", ({ event }) => event),
              ],
            },
            PASS_MAY_I: { actions: sendTo("turn", ({ event }) => event) },
            SWAP_JOKER: { actions: sendTo("turn", ({ event }) => event) },
            GO_OUT: { actions: sendTo("turn", ({ event }) => event) },
            REORDER_HAND: { actions: sendTo("turn", ({ event }) => event) },
            RESHUFFLE_STOCK: {
              guard: "stockEmpty",
              actions: "reshuffleStock",
            },
          },
        },
        resolvingMayI: {
          initial: "checkingNextPlayer",
          states: {
            checkingNextPlayer: {
              always: [
                {
                  // Resolution complete (no more players to check OR auto-resolved)
                  guard: ({ context }) =>
                    context.mayIResolution?.winner !== null,
                  target: "resolved",
                },
                {
                  // More players to prompt
                  guard: "hasMorePlayersToCheck",
                  target: "waitingForResponse",
                },
                {
                  // No one to check, caller wins
                  target: "resolved",
                  actions: assign(({ context }) => {
                    if (!context.mayIResolution) return {};
                    return {
                      mayIResolution: {
                        ...context.mayIResolution,
                        winner: context.mayIResolution.originalCaller,
                        outcome: "caller_won" as const,
                      },
                    };
                  }),
                },
              ],
            },
            waitingForResponse: {
              on: {
                ALLOW_MAY_I: {
                  guard: "isPlayerBeingPrompted",
                  target: "checkingNextPlayer",
                  actions: "advanceMayIResolution",
                },
                CLAIM_MAY_I: [
                  {
                    // Current player claiming (special case - no penalty)
                    guard: "isCurrentPlayerClaiming",
                    target: "resolved",
                    actions: [
                      sendTo("turn", ({ event }) => ({
                        type: "DRAW_FROM_DISCARD",
                        playerId: event.type === "CLAIM_MAY_I" ? event.playerId : undefined,
                      })),
                      "currentPlayerClaimsMayI",
                    ],
                  },
                  {
                    // Other player claiming (blocks the caller)
                    guard: "isPlayerBeingPrompted",
                    target: "resolved",
                    actions: "blockMayIResolution",
                  },
                ],
              },
            },
            resolved: {
              type: "final",
            },
          },
          onDone: {
            target: "playing",
            actions: [
              "grantMayICardsToWinner",
              "syncTurnPiles",
              "clearMayIResolution",
            ],
          },
        },
      },
    },
    scoring: {
      type: "final",
    },
  },
});
