import type {
  AIActionResult,
  AIActionRuntime,
  GameAction,
} from "../../ai/ai-action-runtime.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { CliGameAdapter } from "./cli-game-adapter";

function snapshotWithError(snapshot: GameSnapshot, error: string): GameSnapshot {
  return {
    ...snapshot,
    lastError: error,
  };
}

export function createCliAIActionRuntime(game: CliGameAdapter): AIActionRuntime {
  return {
    getSnapshot: async () => game.getSnapshot(),
    executeAction: async (action: GameAction): Promise<AIActionResult> => {
      try {
        const snapshot = game.executeGameAction(action);
        if (snapshot.lastError) {
          return {
            ok: false,
            snapshot,
            error: snapshot.lastError,
          };
        }

        return {
          ok: true,
          snapshot,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          snapshot: snapshotWithError(game.getSnapshot(), message),
          error: message,
        };
      }
    },
  };
}
