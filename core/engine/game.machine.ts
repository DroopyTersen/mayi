/**
 * GameMachine - XState machine for managing the full game lifecycle
 *
 * States: setup -> playing (with RoundMachine) -> roundEnd -> gameEnd
 *
 * The playing state invokes RoundMachine as a child actor. When the round
 * completes, its output is used to update scores and advance to the next round.
 */

import { setup, assign, sendTo } from "xstate";
import type { Player, RoundRecord, RoundNumber } from "./engine.types";
import { roundMachine, type RoundInput, type RoundOutput } from "./round.machine";

/**
 * Events that need to be forwarded to child round actor
 */
type ForwardedEvent =
  | { type: "DRAW_FROM_STOCK"; playerId?: string }
  | { type: "DRAW_FROM_DISCARD" }
  | { type: "SKIP_LAY_DOWN" }
  | { type: "LAY_DOWN"; melds: unknown[] }
  | { type: "LAY_OFF"; cardId: string; meldId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "CALL_MAY_I"; playerId: string }
  | { type: "PASS_MAY_I" }
  | { type: "SWAP_JOKER"; jokerCardId: string; meldId: string; swapCardId: string }
  | { type: "GO_OUT"; finalLayOffs: unknown[] }
  | { type: "RESHUFFLE_STOCK" }
  | { type: "REORDER_HAND"; newOrder: string[] };

/**
 * Internal round number that allows 7 to signal game over
 * (RoundNumber type is 1-6, but we need to check currentRound > 6)
 */
type GameRoundNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Context for the GameMachine
 */
export interface GameContext {
  gameId: string;
  players: Player[];
  currentRound: GameRoundNumber;
  dealerIndex: number;
  roundHistory: RoundRecord[];
  winners: string[]; // Player IDs of winners (determined at game end)
  /** Error message from last failed operation */
  lastError: string | null;
}

/**
 * Events that can be sent to the GameMachine
 *
 * GameMachine handles setup events directly and forwards gameplay events
 * to the invoked RoundMachine during the playing state. Round completion
 * happens automatically via the RoundMachine invoke's onDone handler.
 */
export type GameEvent =
  | { type: "ADD_PLAYER"; name: string }
  | { type: "START_GAME" }
  // Forwarded events (sent to round/turn machines)
  | ForwardedEvent
  /**
   * @internal Testing utility - simulates round completion without playing through gameplay.
   * In production, rounds complete via invoke's onDone when roundMachine reaches final state.
   * This event allows tests to verify game-level transitions without full round simulation.
   */
  | { type: "ROUND_COMPLETE"; roundRecord: RoundRecord };

/**
 * Output produced when game ends
 */
export interface GameOutput {
  finalScores: Record<string, number>;
  winners: string[];
  roundHistory: RoundRecord[];
}

/**
 * Input for creating a new game
 */
export interface GameInput {
  startingRound?: RoundNumber;
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as GameInput,
    output: {} as GameOutput,
  },
  actors: {
    roundMachine: roundMachine,
  },
  guards: {
    hasMinPlayers: ({ context }) => context.players.length >= 3,
    hasMaxPlayers: ({ context }) => context.players.length >= 8,
    // Check if we just finished round 6 (game has 6 rounds)
    isGameOver: ({ context }) => context.currentRound >= 6,
  },
  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== "ADD_PLAYER") return context.players;
        const newPlayer: Player = {
          id: `player-${context.players.length}`,
          name: event.name,
          hand: [],
          isDown: false,
          totalScore: 0,
        };
        return [...context.players, newPlayer];
      },
    }),
    initializePlayers: assign({
      players: ({ context }) =>
        context.players.map((p) => ({
          ...p,
          hand: [],
          isDown: false,
          totalScore: 0,
        })),
    }),
    incrementRound: assign({
      currentRound: ({ context }) => {
        const nextRound = context.currentRound + 1;
        // Cap at 7 to signal game over (checked by isGameOver guard)
        return (nextRound <= 7 ? nextRound : 7) as GameRoundNumber;
      },
    }),
    advanceDealer: assign({
      dealerIndex: ({ context }) => (context.dealerIndex + 1) % context.players.length,
    }),
    calculateFinalScores: assign({
      winners: ({ context }) => {
        if (context.players.length === 0) return [];
        const minScore = Math.min(...context.players.map((p) => p.totalScore));
        return context.players.filter((p) => p.totalScore === minScore).map((p) => p.id);
      },
    }),
    clearError: assign({
      lastError: () => null,
    }),
    setStartGameError: assign({
      lastError: ({ context }) => {
        if (context.players.length < 3) {
          return "minimum 3 players required";
        }
        return null;
      },
    }),
  },
}).createMachine({
  id: "game",
  initial: "setup",
  context: ({ input }) => ({
    gameId: "",
    players: [],
    currentRound: (input?.startingRound ?? 1) as GameRoundNumber,
    dealerIndex: 0,
    roundHistory: [],
    winners: [],
    lastError: null,
  }),
  output: ({ context }) => ({
    finalScores: Object.fromEntries(context.players.map((p) => [p.id, p.totalScore])),
    winners: context.winners,
    roundHistory: context.roundHistory,
  }),
  states: {
    setup: {
      on: {
        ADD_PLAYER: {
          guard: ({ context }) => context.players.length < 8,
          actions: "addPlayer",
        },
        START_GAME: [
          {
            guard: "hasMinPlayers",
            target: "playing",
            actions: ["initializePlayers", "clearError"],
          },
          {
            // Fallback: set error when guard fails
            actions: "setStartGameError",
          },
        ],
      },
    },
    playing: {
      invoke: {
        id: "round",
        src: "roundMachine",
        input: ({ context }): RoundInput => ({
          roundNumber: context.currentRound as RoundNumber,
          players: context.players,
          dealerIndex: context.dealerIndex,
        }),
        onDone: {
          target: "roundEnd",
          actions: assign({
            roundHistory: ({ context, event }) => {
              const roundOutput = event.output as RoundOutput;
              return [...context.roundHistory, roundOutput.roundRecord];
            },
            players: ({ context, event }) => {
              const roundOutput = event.output as RoundOutput;
              const roundRecord = roundOutput.roundRecord;
              return context.players.map((player) => ({
                ...player,
                totalScore: player.totalScore + (roundRecord.scores[player.id] || 0),
              }));
            },
          }),
        },
      },
      on: {
        // Forward gameplay events to the round actor
        DRAW_FROM_STOCK: { actions: sendTo("round", ({ event }) => event) },
        DRAW_FROM_DISCARD: { actions: sendTo("round", ({ event }) => event) },
        SKIP_LAY_DOWN: { actions: sendTo("round", ({ event }) => event) },
        LAY_DOWN: { actions: sendTo("round", ({ event }) => event) },
        LAY_OFF: { actions: sendTo("round", ({ event }) => event) },
        DISCARD: { actions: sendTo("round", ({ event }) => event) },
        CALL_MAY_I: { actions: sendTo("round", ({ event }) => event) },
        PASS_MAY_I: { actions: sendTo("round", ({ event }) => event) },
        SWAP_JOKER: { actions: sendTo("round", ({ event }) => event) },
        GO_OUT: { actions: sendTo("round", ({ event }) => event) },
        RESHUFFLE_STOCK: { actions: sendTo("round", ({ event }) => event) },
        REORDER_HAND: { actions: sendTo("round", ({ event }) => event) },
        // @internal Testing utility - see GameEvent type documentation
        ROUND_COMPLETE: {
          target: "roundEnd",
          actions: assign({
            roundHistory: ({ context, event }) => {
              if (event.type !== "ROUND_COMPLETE") return context.roundHistory;
              return [...context.roundHistory, event.roundRecord];
            },
            players: ({ context, event }) => {
              if (event.type !== "ROUND_COMPLETE") return context.players;
              return context.players.map((player) => ({
                ...player,
                totalScore: player.totalScore + (event.roundRecord.scores[player.id] || 0),
              }));
            },
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
