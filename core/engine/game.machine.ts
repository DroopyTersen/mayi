/**
 * GameMachine - XState machine for managing the full game lifecycle
 *
 * States: setup -> playing (with RoundMachine) -> roundEnd -> gameEnd
 */

import { setup, assign } from "xstate";
import type { Player, RoundRecord } from "./engine.types";

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
}

/**
 * Events that can be sent to the GameMachine
 */
export type GameEvent =
  | { type: "ADD_PLAYER"; name: string }
  | { type: "START_GAME" }
  | { type: "ROUND_COMPLETE"; roundRecord: RoundRecord };

/**
 * Output produced when game ends
 */
export interface GameOutput {
  finalScores: Record<string, number>;
  winners: string[];
  roundHistory: RoundRecord[];
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    output: {} as GameOutput,
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
    addRoundRecord: assign({
      roundHistory: ({ context, event }) => {
        if (event.type !== "ROUND_COMPLETE") return context.roundHistory;
        return [...context.roundHistory, event.roundRecord];
      },
      players: ({ context, event }) => {
        if (event.type !== "ROUND_COMPLETE") return context.players;
        // Update player total scores from round record
        return context.players.map((player) => ({
          ...player,
          totalScore: player.totalScore + (event.roundRecord.scores[player.id] || 0),
        }));
      },
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
  },
}).createMachine({
  id: "game",
  initial: "setup",
  context: {
    gameId: "",
    players: [],
    currentRound: 1 as GameRoundNumber,
    dealerIndex: 0,
    roundHistory: [],
    winners: [],
  },
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
        START_GAME: {
          guard: "hasMinPlayers",
          target: "playing",
          actions: "initializePlayers",
        },
      },
    },
    playing: {
      on: {
        ROUND_COMPLETE: {
          target: "roundEnd",
          actions: "addRoundRecord",
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
