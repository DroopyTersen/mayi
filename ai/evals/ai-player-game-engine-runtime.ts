import type {
  AIActionResult,
  AIActionRuntime,
  GameAction,
} from "../ai-action-runtime.types";
import { GameEngine } from "../../core/engine/game-engine";
import {
  ACTIONS_THAT_IGNORE_LAST_ERROR,
  validateGameActionCommand,
} from "../../core/engine/game-action.command-policy";
import type { GameSnapshot } from "../../core/engine/game-engine.types";

export const AI_PLAYER_GAME_ENGINE_RUNTIME_VERSION = "game-engine-runtime-v2";

export interface AIPlayerGameEngineAttempt {
  playerId: string;
  action: GameAction;
  ok: boolean;
  error?: string;
}

function stateFingerprint(snapshot: GameSnapshot): string {
  const { updatedAt: _updatedAt, ...stableState } = snapshot;
  return JSON.stringify(stableState);
}

function executeEngineAction(
  engine: GameEngine,
  playerId: string,
  action: GameAction,
): GameSnapshot {
  switch (action.type) {
    case "DRAW_FROM_STOCK":
      return engine.drawFromStock(playerId);
    case "DRAW_FROM_DISCARD":
      return engine.drawFromDiscard(playerId);
    case "LAY_DOWN":
      return engine.layDown(playerId, action.melds);
    case "LAY_OFF":
      return engine.layOff(
        playerId,
        action.cardId,
        action.meldId,
        action.position,
      );
    case "SWAP_JOKER":
      return engine.swapJoker(
        playerId,
        action.meldId,
        action.jokerCardId,
        action.swapCardId,
      );
    case "DISCARD":
      return engine.discard(playerId, action.cardId);
    case "SKIP":
      return engine.skip(playerId);
    case "REORDER_HAND":
      return engine.reorderHand(playerId, action.cardIds);
    case "CALL_MAY_I":
      return engine.callMayI(playerId);
    case "ALLOW_MAY_I":
      return engine.allowMayI(playerId);
    case "CLAIM_MAY_I":
      return engine.claimMayI(playerId);
  }
}

export function createAIPlayerGameEngineRuntime(
  engine: GameEngine,
  playerId: string,
): {
  runtime: AIActionRuntime;
  attempts: AIPlayerGameEngineAttempt[];
} {
  const attempts: AIPlayerGameEngineAttempt[] = [];

  const runtime: AIActionRuntime = {
    async getSnapshot() {
      return engine.getSnapshot();
    },
    async executeAction(action): Promise<AIActionResult> {
      const before = engine.getSnapshot();
      const validation = validateGameActionCommand(before, playerId, action);
      if (!validation.ok) {
        const error = validation.error;
        attempts.push({ playerId, action, ok: false, error });
        return { ok: false, snapshot: before, error };
      }
      try {
        const after = executeEngineAction(engine, playerId, action);
        const changed = stateFingerprint(before) !== stateFingerprint(after);
        const previousHand = before.players.find(
          (player) => player.id === playerId,
        )?.hand;
        // Organization can succeed without a state change when already sorted.
        const validNoOpReorder =
          action.type === "REORDER_HAND" &&
          previousHand !== undefined &&
          previousHand.length === action.cardIds.length &&
          previousHand.every((card, index) => card.id === action.cardIds[index]);
        // Round-level commands retain the turn machine's last error. Match the
        // production command policy without reclassifying rejected turn actions.
        const ok =
          (changed || validNoOpReorder) &&
          (after.lastError === null || ACTIONS_THAT_IGNORE_LAST_ERROR.has(action.type));
        const error = after.lastError ?? "Action was not accepted";
        attempts.push({
          playerId,
          action,
          ok,
          ...(ok ? {} : { error }),
        });
        return ok
          ? { ok: true, snapshot: after }
          : { ok: false, snapshot: after, error };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = engine.getSnapshot();
        attempts.push({ playerId, action, ok: false, error: message });
        return { ok: false, snapshot, error: message };
      }
    },
  };

  return { runtime, attempts };
}
