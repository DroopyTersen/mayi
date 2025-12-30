/**
 * Tool definitions for May I? AI Agent
 *
 * Each game action is a separate tool. Tools are filtered at runtime
 * using AI SDK's availableTools based on the current game phase.
 */

import { tool } from "ai";
import { z } from "zod/v4";
import type { Orchestrator } from "../cli/harness/orchestrator";
import type { ToolExecutionResult } from "./mayIAgent.types";
import { outputGameStateForLLM } from "../cli/shared/cli.llm-output";

/**
 * Create all tools for the May I? agent
 *
 * Each tool executes an action via the Orchestrator and returns the new game state.
 */
export function createMayITools(orchestrator: Orchestrator, playerId: string) {
  /**
   * Helper to execute an action and return standardized result
   */
  function executeAction(
    actionFn: () => { success: boolean; message: string }
  ): ToolExecutionResult {
    const result = actionFn();
    const state = orchestrator.getPersistedState();
    const gameState = outputGameStateForLLM(state, playerId);
    const turnComplete = state.harness.awaitingPlayerId !== playerId;

    return {
      success: result.success,
      message: result.message,
      gameState,
      turnComplete,
    };
  }

  return {
    /**
     * Draw a card from the stock pile
     */
    draw_from_stock: tool({
      description:
        "Draw the top card from the stock pile. Use this when you want to draw without taking the discard. After drawing from stock, a May I window opens for other players to claim the discard.",
      inputSchema: z.object({}),
      execute: async () => {
        return executeAction(() => orchestrator.drawFromStock());
      },
    }),

    /**
     * Draw a card from the discard pile
     */
    draw_from_discard: tool({
      description:
        "Take the top card from the discard pile as your draw. Only available if you are NOT down (haven't laid down your contract yet). This prevents other players from claiming the card via May I.",
      inputSchema: z.object({}),
      execute: async () => {
        return executeAction(() => orchestrator.drawFromDiscard());
      },
    }),

    /**
     * Lay down your contract
     */
    lay_down: tool({
      description: `Lay down your contract by specifying which cards form each meld.

Each meld is an array of card positions (1-indexed from your hand).
- Sets require exactly 3 cards of the same rank
- Runs require exactly 4 cards of the same suit in sequence

Example for Round 1 (2 sets): [[1,2,3], [4,5,6]]
Example for Round 2 (1 set + 1 run): [[1,2,3], [4,5,6,7]]

IMPORTANT: Card positions refer to your hand. Position 1 is the first card, position 2 is the second, etc.
In Round 6, you must use ALL cards in your hand.`,
      inputSchema: z.object({
        melds: z
          .array(z.array(z.number().int().min(1)))
          .min(1)
          .describe(
            "Array of melds, where each meld is an array of card positions (1-indexed)"
          ),
      }),
      execute: async ({ melds }) => {
        return executeAction(() => orchestrator.layDown(melds));
      },
    }),

    /**
     * Discard a card
     */
    discard: tool({
      description:
        "Discard a card from your hand to end your turn. Specify the position (1-indexed) of the card to discard. Can be called directly from the action phase - will automatically skip to discard phase first.",
      inputSchema: z.object({
        position: z
          .number()
          .int()
          .min(1)
          .describe("Position of the card to discard (1-indexed)"),
      }),
      execute: async ({ position }) => {
        // Auto-skip if still in AWAITING_ACTION phase
        const state = orchestrator.getStateView();
        if (state.phase === "AWAITING_ACTION") {
          orchestrator.skip();
        }
        return executeAction(() => orchestrator.discardCard(position));
      },
    }),

    /**
     * Lay off a card to an existing meld
     */
    lay_off: tool({
      description: `Add a card from your hand to an existing meld on the table.

Only available after you have laid down your contract (you are "down").
Cannot be used on the same turn you lay down.

- For sets: add another card of the same rank
- For runs: extend the sequence at either end`,
      inputSchema: z.object({
        cardPosition: z
          .number()
          .int()
          .min(1)
          .describe("Position of the card in your hand (1-indexed)"),
        meldNumber: z
          .number()
          .int()
          .min(1)
          .describe("Number of the meld on the table (1-indexed)"),
      }),
      execute: async ({ cardPosition, meldNumber }) => {
        return executeAction(() =>
          orchestrator.layOff(cardPosition, meldNumber)
        );
      },
    }),

    /**
     * Call May I to claim a discarded card
     */
    call_may_i: tool({
      description: `Call "May I!" to claim the discarded card when it's another player's turn.

You will receive the discarded card PLUS one penalty card from the stock.
Only available when you are NOT down (haven't laid down your contract).
Priority goes to players closer to the current player in turn order.`,
      inputSchema: z.object({}),
      execute: async () => {
        return executeAction(() => orchestrator.callMayI());
      },
    }),

    /**
     * Pass on May I
     */
    pass: tool({
      description:
        "Pass on claiming the discarded card. The May I window will continue to the next player.",
      inputSchema: z.object({}),
      execute: async () => {
        return executeAction(() => orchestrator.pass());
      },
    }),

    /**
     * Swap a Joker from a run
     */
    swap_joker: tool({
      description: `Swap a Joker out of a run on the table by playing the natural card it represents.

Only available BEFORE you lay down your contract.
Only works on runs (not sets).
You must have the exact card the Joker is standing in for.
The Joker goes into your hand.`,
      inputSchema: z.object({
        meldNumber: z
          .number()
          .int()
          .min(1)
          .describe("Number of the meld containing the Joker (1-indexed)"),
        jokerPosition: z
          .number()
          .int()
          .min(1)
          .describe("Position of the Joker within the meld (1-indexed)"),
        cardPosition: z
          .number()
          .int()
          .min(1)
          .describe("Position of the replacement card in your hand (1-indexed)"),
      }),
      execute: async ({ meldNumber, jokerPosition, cardPosition }) => {
        return executeAction(() =>
          orchestrator.swap(meldNumber, jokerPosition, cardPosition)
        );
      },
    }),
  };
}

/**
 * Get the tools available for the current game phase
 *
 * Uses DecisionPhase to filter which tools are valid.
 */
export function getAvailableToolNames(
  phase: string,
  isDown: boolean
): string[] {
  switch (phase) {
    case "AWAITING_DRAW":
      // If down, auto-draw happens in agent loop - no tools needed
      // If not down, can choose between stock and discard
      return isDown ? [] : ["draw_from_stock", "draw_from_discard"];

    case "AWAITING_ACTION":
      // Can lay down (if not down), lay off (if down), swap joker (if not down), or discard (auto-skips)
      if (isDown) {
        return ["lay_off", "discard"];
      }
      return ["lay_down", "swap_joker", "discard"];

    case "AWAITING_DISCARD":
      return ["discard"];

    case "MAY_I_WINDOW":
      // Can call May I (if not down) or pass
      return isDown ? ["pass"] : ["call_may_i", "pass"];

    case "ROUND_END":
    case "GAME_END":
      // No tools available - game state transitions
      return [];

    default:
      return [];
  }
}

/** Type for the tools object */
export type MayITools = ReturnType<typeof createMayITools>;
