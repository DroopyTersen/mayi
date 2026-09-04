import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { GameAction } from "../ai-action-runtime.types";
import type {
  AIPlayerShortRolloutDecisionRecord,
  AIPlayerShortRolloutReferenceDecision,
} from "./ai-player-short-rollout-scenario";

export const AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION =
  "short-rollout-harness-v8";

export function resolveAIPlayerRolloutActions(
  decision: AIPlayerShortRolloutReferenceDecision,
  snapshot: GameSnapshot,
): readonly GameAction[] {
  if (!decision.opponentPolicy) return decision.actions;
  if (decision.kind !== "opponent-script")
    throw new Error("Only scripted opponents can use an evaluator policy");
  const player = snapshot.players.find(
    (player) => player.id === decision.playerId,
  );
  if (!player)
    throw new Error(`Unknown scripted opponent ${decision.playerId}`);
  return decision.opponentPolicy.selectActions(
    structuredClone({
      hand: player.hand,
      table: snapshot.table,
    }),
  );
}

export function isAIPlayerRolloutTerminal(snapshot: GameSnapshot): boolean {
  return snapshot.phase === "ROUND_END" || snapshot.phase === "GAME_END";
}

/** Ending the hand early is a game outcome, not a failed provider completion. */
export function isAIPlayerRolloutComplete({
  snapshot,
  decisions,
  maxModelDecisions,
  opponentActionsLegal = true,
}: {
  snapshot: GameSnapshot;
  decisions: readonly AIPlayerShortRolloutDecisionRecord[];
  maxModelDecisions: number;
  opponentActionsLegal?: boolean;
}): boolean {
  return (
    opponentActionsLegal &&
    decisions.length > 0 &&
    decisions.length <= maxModelDecisions &&
    decisions.every((decision) => decision.success) &&
    (decisions.length === maxModelDecisions ||
      isAIPlayerRolloutTerminal(snapshot))
  );
}
