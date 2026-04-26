/**
 * Tool definitions for May I? AI Agent
 *
 * Each game action is a separate tool. Tools are filtered at runtime
 * based on the current GameEngine snapshot.
 */

import { tool } from "ai";
import { z } from "zod/v4";
import type { GameSnapshot, MeldSpec } from "../core/engine/game-engine.types";
import type { ToolExecutionResult } from "./mayIAgent.types";
import { outputGameStateForLLM, type ActionLogEntry } from "../cli/shared/cli.llm-output";
import { getAvailableActions } from "../core/engine/game-engine.availability";
import { isValidRun, isValidSet } from "../core/meld/meld.validation";
import type { AIActionRuntime, GameAction } from "./ai-action-runtime.types";

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
  runtime: AIActionRuntime,
  playerId: string,
  options: CreateMayIToolsOptions = {}
) {
  function toolFailure(snapshot: GameSnapshot, error: string): ToolExecutionResult {
    const stateWithError = { ...snapshot, lastError: error };
    return {
      success: false,
      message: error,
      gameState: outputGameStateForLLM(stateWithError, playerId, {
        actionLog: options.actionLog,
      }),
      turnComplete: snapshot.awaitingPlayerId !== playerId,
    };
  }

  async function executeAction(action: GameAction): Promise<ToolExecutionResult> {
    const result = await runtime.executeAction(action);
    const state = result.snapshot;
    const gameState = outputGameStateForLLM(state, playerId, {
      actionLog: options.actionLog,
    });
    const turnComplete = state.awaitingPlayerId !== playerId;

    return {
      success: result.ok,
      message: result.ok ? "OK" : result.error,
      gameState,
      turnComplete,
    };
  }

  function getPlayer(snapshot: GameSnapshot) {
    return snapshot.players.find((player) => player.id === playerId) ?? null;
  }

  return {
    draw_from_stock: tool({
      description: "Draw the top card from the stock pile.",
      inputSchema: z.object({}),
      execute: async () => executeAction({ type: "DRAW_FROM_STOCK" }),
    }),

    draw_from_discard: tool({
      description:
        "Take the top card from the discard pile as your draw (only if you are not down).",
      inputSchema: z.object({}),
      execute: async () => executeAction({ type: "DRAW_FROM_DISCARD" }),
    }),

    lay_down: tool({
      description: `Lay down your contract by specifying melds as arrays of card positions (1-indexed from your hand).

Example for Round 1 (2 sets): [[1,2,3], [4,5,6]]
Example for Round 2 (1 set + 1 run): [[1,2,3], [4,5,6,7]]

Rules:
- Use each hand position at most once across all melds.
- Each meld must already be a valid set or run.
- If a lay_down attempt fails, read the error and do not repeat the same meld positions.

In Round 6, you must use ALL cards in your hand.`,
      inputSchema: z.object({
        melds: z.array(z.array(z.number().int().min(1))).min(1),
      }),
      execute: async ({ melds }) => {
        const snapshot = await runtime.getSnapshot();
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }

        const meldSpecs: MeldSpec[] = [];
        const usedPositions = new Set<number>();

        for (const group of melds) {
          for (const position of group) {
            if (usedPositions.has(position)) {
              return toolFailure(
                snapshot,
                "Each hand position can be used at most once when laying down. Re-check the contract before retrying with corrected meld positions."
              );
            }
            usedPositions.add(position);
          }

          const cards = group.map((position) => player.hand[position - 1]);
          if (cards.some((card) => card === undefined)) {
            return toolFailure(snapshot, "Card position out of range");
          }

          const concreteCards = cards.filter((card) => card !== undefined);
          const canBeSet = isValidSet(concreteCards);
          const canBeRun = isValidRun(concreteCards);
          if (!canBeSet && !canBeRun) {
            return toolFailure(
              snapshot,
              `Meld positions [${group.join(", ")}] do not form a valid set or run. Re-check ranks, suits, wild ratio, and run order before retrying.`
            );
          }

          const type: "set" | "run" =
            canBeSet && !canBeRun ? "set" : canBeRun && !canBeSet ? "run" : "set";

          meldSpecs.push({ type, cardIds: concreteCards.map((card) => card.id) });
        }

        return executeAction({ type: "LAY_DOWN", melds: meldSpecs });
      },
    }),

    discard: tool({
      description:
        "Discard a card from your hand to end your turn. Provide the hand position (1-indexed). If you're still in the action phase, the engine will ignore invalid discards; prefer to use skip when needed.",
      inputSchema: z.object({
        position: z.number().int().min(1),
      }),
      execute: async ({ position }) => {
        const snapshot = await runtime.getSnapshot();
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }

        const card = player.hand[position - 1];
        if (!card) {
          return toolFailure(snapshot, "Card position out of range");
        }

        return executeAction({ type: "DISCARD", cardId: card.id });
      },
    }),

    lay_off: tool({
      description:
        "Add a card from your hand to an existing meld on the table. Provide hand position and meld number (both 1-indexed). For runs, use position=start when adding to the low end.",
      inputSchema: z.object({
        cardPosition: z.number().int().min(1),
        meldNumber: z.number().int().min(1),
        position: z.enum(["start", "end"]).optional(),
      }),
      execute: async ({ cardPosition, meldNumber, position }) => {
        const snapshot = await runtime.getSnapshot();
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }

        const card = player.hand[cardPosition - 1];
        if (!card) {
          return toolFailure(snapshot, "Card position out of range");
        }

        const meld = snapshot.table[meldNumber - 1];
        if (!meld) {
          return toolFailure(snapshot, "Meld position out of range");
        }

        return executeAction({
          type: "LAY_OFF",
          cardId: card.id,
          meldId: meld.id,
          ...(position ? { position } : {}),
        });
      },
    }),

    allow_may_i: tool({
      description: "Allow the May I caller to take the discard (when prompted).",
      inputSchema: z.object({}),
      execute: async () => executeAction({ type: "ALLOW_MAY_I" }),
    }),

    claim_may_i: tool({
      description: "Claim the discard for yourself, blocking the original caller (when prompted).",
      inputSchema: z.object({}),
      execute: async () => executeAction({ type: "CLAIM_MAY_I" }),
    }),

    swap_joker: tool({
      description:
        "Swap a Joker out of a run by playing the natural card it represents (only before you lay down).",
      inputSchema: z.object({
        meldNumber: z.number().int().min(1),
        jokerPosition: z.number().int().min(1),
        cardPosition: z.number().int().min(1),
      }),
      execute: async ({ meldNumber, jokerPosition, cardPosition }) => {
        const snapshot = await runtime.getSnapshot();
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }

        const swapCard = player.hand[cardPosition - 1];
        if (!swapCard) {
          return toolFailure(snapshot, "Card position out of range");
        }

        const meld = snapshot.table[meldNumber - 1];
        if (!meld) {
          return toolFailure(snapshot, "Meld position out of range");
        }

        const jokerCard = meld.cards[jokerPosition - 1];
        if (!jokerCard) {
          return toolFailure(snapshot, "Joker position out of range");
        }

        return executeAction({
          type: "SWAP_JOKER",
          meldId: meld.id,
          jokerCardId: jokerCard.id,
          swapCardId: swapCard.id,
        });
      },
    }),
  };
}

/**
 * Get the tools available for the current game snapshot.
 *
 * Uses the centralized getAvailableActions utility and maps to tool names.
 * Current agent policy: only act when the engine is awaiting this player.
 */
export function getAvailableToolNames(snapshot: GameSnapshot, playerId: string): string[] {
  // Only act when the engine is awaiting this player
  if (snapshot.awaitingPlayerId !== playerId) {
    return [];
  }

  const actions = getAvailableActions(snapshot, playerId);

  const toolNames: string[] = [];

  // Map AvailableActions flags to tool names
  if (actions.canDrawFromStock) toolNames.push("draw_from_stock");
  if (actions.canDrawFromDiscard) toolNames.push("draw_from_discard");
  if (actions.canLayDown) toolNames.push("lay_down");
  if (actions.canSwapJoker) toolNames.push("swap_joker");
  if (actions.canLayOff) toolNames.push("lay_off");
  if (actions.canDiscard) toolNames.push("discard");
  if (actions.canAllowMayI) toolNames.push("allow_may_i");
  if (actions.canClaimMayI) toolNames.push("claim_may_i");

  return toolNames;
}

export type MayITools = ReturnType<typeof createMayITools>;
