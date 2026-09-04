import { isDisplayableActivityEntry } from "../../core/activity/activity-log.format";
import { projectGameActionActivity } from "../../core/activity/game-action-activity";
import type { AIActionRuntime } from "../ai-action-runtime.types";
import type { ActionLogEntry } from "../mayIAgent.prompt-renderer";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import type { AIPlayerShortRolloutScenario } from "./ai-player-short-rollout-scenario";

export const AI_PLAYER_ROLLOUT_OBSERVATION_VERSION = "public-action-history-v1";

/** One journal per trial, shared by every candidate and opponent decision. */
export async function createAIPlayerRolloutHistory(
  scenario: AIPlayerShortRolloutScenario,
  repetition = 1,
) {
  const hasPrelude = scenario.historyPrelude !== undefined;
  const actor = createAIPlayerFixedStateActor(
    hasPrelude ? { ...scenario, prepare: undefined } : scenario,
    repetition,
  );
  const history: ActionLogEntry[] = hasPrelude
    ? []
    : structuredClone(scenario.actionLog ?? []);

  function createRuntime(playerId: string) {
    const state = createAIPlayerFixedStateActorRuntime(actor, playerId);
    const runtime: AIActionRuntime = {
      getSnapshot: state.runtime.getSnapshot,
      async executeAction(action) {
        const before = await state.runtime.getSnapshot();
        const result = await state.runtime.executeAction(action);
        if (result.ok) {
          history.push(
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

  try {
    for (const step of scenario.historyPrelude ?? []) {
      const result = await createRuntime(step.playerId).runtime.executeAction(
        step.action,
      );
      if (!result.ok) {
        throw new Error(
          `Invalid history prelude ${scenario.identity.id}/${step.playerId}/${step.action.type}: ${result.error}`,
        );
      }
    }
  } catch (error) {
    actor.stop();
    throw error;
  }

  return {
    actor,
    createRuntime,
    getActionLog(): ActionLogEntry[] {
      const roundNumber = projectAIPlayerFixedStateSnapshot(actor).currentRound;
      return history
        .filter(
          (entry) =>
            entry.roundNumber === roundNumber &&
            isDisplayableActivityEntry(entry),
        )
        .map((entry) => ({ ...entry }));
    },
  };
}
