import { describe, expect, it } from "bun:test";
import { AIPlayerRolloutDecisionRecorder } from "./ai-player-rollout-decision-evidence";
import { AI_PLAYER_CONTESTED_RUN_SCENARIOS } from "./ai-player-contested-run-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";

describe("candidate-perspective action evidence", () => {
  it("captures the actual pre-discard hand and rejected attempts without exposing hidden zones", async () => {
    const scenario = AI_PLAYER_CONTESTED_RUN_SCENARIOS[0]!;
    const history = await createAIPlayerRolloutHistory(scenario);
    try {
      const recorder = new AIPlayerRolloutDecisionRecorder(scenario.evaluatedPlayerId);
      const runtime = recorder.wrap(history.createRuntime(scenario.evaluatedPlayerId).runtime);
      expect((await runtime.executeAction({ type: "DISCARD", cardId: "missing" })).ok).toBe(false);
      expect((await runtime.executeAction({ type: "SKIP" })).ok).toBe(true);
      expect((await runtime.executeAction({ type: "DISCARD", cardId: scenario.diagnostics.referenceDiscardId })).ok).toBe(true);
      const evidence = recorder.evidence;
      expect(evidence).toHaveLength(3);
      expect(evidence.map(item => item.ok)).toEqual([false, true, true]);
      expect(evidence[2]!.before.hand).toHaveLength(12);
      expect(evidence[2]!.after.hand).toHaveLength(11);
      expect(evidence[2]!.after.discard[0]?.id).toBe(scenario.diagnostics.referenceDiscardId);
      expect(Object.keys(evidence[2]!.before).sort()).toEqual(["discard", "hand", "isDown", "roundNumber", "table", "turnNumber"]);
      expect(JSON.stringify(evidence)).not.toContain("future-draw");
      evidence[2]!.before.hand.length = 0;
      expect(recorder.evidence[2]!.before.hand).toHaveLength(12);
    } finally {
      history.actor.stop();
    }
  });

  it("records separate evidence for each reference decision", async () => {
    const result = await runAIPlayerShortRolloutReference(AI_PLAYER_CONTESTED_RUN_SCENARIOS[0]!);
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0]!.actionEvidence).toHaveLength(2);
    expect(result.decisions[1]!.actionEvidence).toHaveLength(3);
    expect(result.decisions[0]!.actionEvidence?.[0]?.before.turnNumber).toBe(9);
    expect(result.decisions[1]!.actionEvidence?.[0]?.before.turnNumber).toBe(12);
  });
});
