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
import {
  outputGameStateForLLM,
  type ActionLogEntry,
} from "./mayIAgent.prompt-renderer";
import { isValidRun, isValidSet } from "../core/meld/meld.validation";
import type { AIActionRuntime, GameAction } from "./ai-action-runtime.types";
import { parseAIStrategyNote, type AIHandScratchpadTurn } from "./mayIAgent.scratchpad";
import type { AITacticalPresentation } from "./mayIAgent.contract-options";
import {
  sortHandByRank,
  sortHandBySuit,
} from "../core/engine/hand.reordering";

/** Options for creating May I tools */
export interface CreateMayIToolsOptions {
  /** Optional action log entries for LLM context */
  actionLog?: ActionLogEntry[];
  /** Optional private intent staged alongside a successful discard. */
  scratchpadTurn?: AIHandScratchpadTurn;
  tacticalPresentation?: AITacticalPresentation;
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
        tacticalPresentation: options.tacticalPresentation,
      }),
      turnComplete: snapshot.awaitingPlayerId !== playerId,
    };
  }

  async function executeAction(
    action: GameAction,
    completesDecision = false,
  ): Promise<ToolExecutionResult> {
    const result = await runtime.executeAction(action);
    const state = result.snapshot;
    const gameState = outputGameStateForLLM(state, playerId, {
      actionLog: options.actionLog,
      tacticalPresentation: options.tacticalPresentation,
    });
    const turnComplete =
      completesDecision ||
      state.awaitingPlayerId !== playerId ||
      state.phase === "ROUND_END" ||
      state.phase === "GAME_END";

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

    organize_hand: tool({
      description:
        "Organize your entire hand without ending the turn. Use rank for set-heavy contracts and suit for run-heavy contracts.",
      inputSchema: z.object({
        order: z.enum(["rank", "suit"]),
      }),
      execute: async ({ order }) => {
        const snapshot = await runtime.getSnapshot();
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }
        const organized =
          order === "rank"
            ? sortHandByRank(player.hand)
            : sortHandBySuit(player.hand);
        return executeAction({
          type: "REORDER_HAND",
          cardIds: organized.map((card) => card.id),
        });
      },
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
        "Discard a card from your hand to end your turn. Provide the hand position (1-indexed). The engine validates whether discarding is legal in the current phase.",
      inputSchema: z.object({
        position: z.number().int().min(1),
        ...(options.scratchpadTurn === undefined ? {} : {
          strategy_note: z.string().max(400).optional().describe(
            "One or two short lines of strategy intent for your next turn; current plan and what would change it. Private, revisable, not game rules.",
          ),
        }),
      }),
      execute: async ({ position, strategy_note }) => {
        const snapshot = await runtime.getSnapshot();
        let note: string | undefined;
        if (strategy_note !== undefined && options.scratchpadTurn !== undefined) {
          if (typeof strategy_note !== "string") return toolFailure(snapshot, "Strategy note must be text");
          try {
            note = parseAIStrategyNote(strategy_note);
          } catch (error) {
            return toolFailure(snapshot, error instanceof Error ? error.message : "Invalid strategy note");
          }
        }
        const player = getPlayer(snapshot);
        if (!player) {
          return toolFailure(snapshot, "AI player not found in latest snapshot");
        }

        const card = player.hand[position - 1];
        if (!card) {
          return toolFailure(snapshot, "Card position out of range");
        }

        const result = await executeAction({ type: "DISCARD", cardId: card.id });
        if (result.success && note !== undefined) options.scratchpadTurn?.stage(note);
        return result;
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
      execute: async () => executeAction({ type: "ALLOW_MAY_I" }, true),
    }),

    claim_may_i: tool({
      description: "Claim the discard for yourself, blocking the original caller (when prompted).",
      inputSchema: z.object({}),
      execute: async () => executeAction({ type: "CLAIM_MAY_I" }, true),
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

export type MayITools = ReturnType<typeof createMayITools>;
