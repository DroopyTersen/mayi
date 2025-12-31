/**
 * Tool definitions for May I? AI Agent
 *
 * Each game action is a separate tool. Tools are filtered at runtime
 * based on the current GameEngine snapshot.
 */

import { tool } from "ai";
import { z } from "zod/v4";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import type { AIGameAdapter } from "./ai-game-adapter.types";
import type { ToolExecutionResult } from "./mayIAgent.types";
import { outputGameStateForLLM, type ActionLogEntry } from "../cli/shared/cli.llm-output";

/** Options for creating May I tools */
export interface CreateMayIToolsOptions {
  /** Optional action log entries for LLM context */
  actionLog?: ActionLogEntry[];
}

/**
 * Create all tools for the May I? agent
 *
 * Each tool executes an action via the game adapter and returns the new game state.
 */
export function createMayITools(
  game: AIGameAdapter,
  playerId: string,
  options: CreateMayIToolsOptions = {}
) {
  function executeAction(actionFn: () => GameSnapshot): ToolExecutionResult {
    const after = actionFn();
    const state = game.getSnapshot();
    const gameState = outputGameStateForLLM(state, playerId, { actionLog: options.actionLog });
    const turnComplete = state.awaitingPlayerId !== playerId;

    return {
      success: after.lastError === null,
      message: after.lastError ?? "OK",
      gameState,
      turnComplete,
    };
  }

  return {
    draw_from_stock: tool({
      description: "Draw the top card from the stock pile.",
      inputSchema: z.object({}),
      execute: async () => executeAction(() => game.drawFromStock()),
    }),

    draw_from_discard: tool({
      description:
        "Take the top card from the discard pile as your draw (only if you are not down).",
      inputSchema: z.object({}),
      execute: async () => executeAction(() => game.drawFromDiscard()),
    }),

    lay_down: tool({
      description: `Lay down your contract by specifying melds as arrays of card positions (1-indexed from your hand).

Example for Round 1 (2 sets): [[1,2,3], [4,5,6]]
Example for Round 2 (1 set + 1 run): [[1,2,3], [4,5,6,7]]

In Round 6, you must use ALL cards in your hand.`,
      inputSchema: z.object({
        melds: z.array(z.array(z.number().int().min(1))).min(1),
      }),
      execute: async ({ melds }) => executeAction(() => game.layDown(melds)),
    }),

    discard: tool({
      description:
        "Discard a card from your hand to end your turn. Provide the hand position (1-indexed). If you're still in the action phase, the engine will ignore invalid discards; prefer to use skip when needed.",
      inputSchema: z.object({
        position: z.number().int().min(1),
      }),
      execute: async ({ position }) => {
        const snapshot = game.getSnapshot();
        if (snapshot.phase === "ROUND_ACTIVE" && snapshot.turnPhase === "AWAITING_ACTION") {
          game.skip();
        }
        return executeAction(() => game.discardCard(position));
      },
    }),

    lay_off: tool({
      description:
        "Add a card from your hand to an existing meld on the table. Provide hand position and meld number (both 1-indexed).",
      inputSchema: z.object({
        cardPosition: z.number().int().min(1),
        meldNumber: z.number().int().min(1),
      }),
      execute: async ({ cardPosition, meldNumber }) =>
        executeAction(() => game.layOff(cardPosition, meldNumber)),
    }),

    allow_may_i: tool({
      description: "Allow the May I caller to take the discard (when prompted).",
      inputSchema: z.object({}),
      execute: async () => executeAction(() => game.allowMayI(playerId)),
    }),

    claim_may_i: tool({
      description: "Claim the discard for yourself, blocking the original caller (when prompted).",
      inputSchema: z.object({}),
      execute: async () => executeAction(() => game.claimMayI(playerId)),
    }),

    swap_joker: tool({
      description:
        "Swap a Joker out of a run by playing the natural card it represents (only before you lay down).",
      inputSchema: z.object({
        meldNumber: z.number().int().min(1),
        jokerPosition: z.number().int().min(1),
        cardPosition: z.number().int().min(1),
      }),
      execute: async ({ meldNumber, jokerPosition, cardPosition }) =>
        executeAction(() => game.swap(meldNumber, jokerPosition, cardPosition)),
    }),
  };
}

/**
 * Get the tools available for the current game snapshot.
 *
 * Current agent policy: only act when the engine is awaiting this player.
 */
export function getAvailableToolNames(snapshot: GameSnapshot, playerId: string): string[] {
  if (snapshot.awaitingPlayerId !== playerId) {
    return [];
  }

  const player = snapshot.players.find((p) => p.id === playerId);
  const isDown = player?.isDown ?? false;

  if (snapshot.phase === "RESOLVING_MAY_I") {
    return ["allow_may_i", "claim_may_i"];
  }

  if (snapshot.phase !== "ROUND_ACTIVE") {
    return [];
  }

  switch (snapshot.turnPhase) {
    case "AWAITING_DRAW":
      return isDown ? ["draw_from_stock"] : ["draw_from_stock", "draw_from_discard"];
    case "AWAITING_ACTION":
      if (isDown) {
        return ["lay_off", "discard"];
      }
      // Joker swap requires melds on table. In Round 6, no melds exist until someone wins.
      const hasMeldsOnTable = snapshot.table.length > 0;
      const canSwapJoker = hasMeldsOnTable && snapshot.currentRound < 6;
      return canSwapJoker ? ["lay_down", "swap_joker", "discard"] : ["lay_down", "discard"];
    case "AWAITING_DISCARD":
      return ["discard"];
  }
}

export type MayITools = ReturnType<typeof createMayITools>;
