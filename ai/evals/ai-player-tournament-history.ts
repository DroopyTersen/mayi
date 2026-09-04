import { isDisplayableActivityEntry } from "../../core/activity/activity-log.format";
import {
  projectGameActionActivity,
  type PublicGameActivity,
} from "../../core/activity/game-action-activity";
import type { GameEngine } from "../../core/engine/game-engine";
import type { AIActionRuntime } from "../ai-action-runtime.types";
import { createAIPlayerGameEngineRuntime } from "./ai-player-game-engine-runtime";

export const AI_PLAYER_TOURNAMENT_OBSERVATION_VERSION = "public-action-history-v1";

/** One public journal per game, shared by ordinary turns and May I decisions. */
export function createAIPlayerTournamentHistory(engine: GameEngine) {
  const activity: PublicGameActivity[] = [];

  function createRuntime(playerId: string) {
    const state = createAIPlayerGameEngineRuntime(engine, playerId);
    const runtime: AIActionRuntime = {
      getSnapshot: state.runtime.getSnapshot,
      async executeAction(action) {
        // The real engine runtime mutates synchronously before returning its
        // promise. Do not yield between this snapshot and that mutation: SDK
        // tool calls can overlap, and each needs its own actual before state.
        const before = engine.getSnapshot();
        const result = await state.runtime.executeAction(action);
        if (result.ok) {
          activity.push(
            ...projectGameActionActivity({
              playerId,
              action,
              before,
              after: result.snapshot,
            }),
          );
        }
        return result;
      },
    };
    return { ...state, runtime };
  }

  return {
    createRuntime,
    getActionLog(): PublicGameActivity[] {
      const currentRound = engine.getSnapshot().currentRound;
      return activity
        .filter(
          (entry) =>
            entry.roundNumber === currentRound && isDisplayableActivityEntry(entry),
        )
        .map((entry) => ({ ...entry }));
    },
    /** Public historical evidence, including events that ended an earlier hand. */
    getRecordedActivity(): PublicGameActivity[] {
      return activity.map((entry) => ({ ...entry }));
    },
  };
}
