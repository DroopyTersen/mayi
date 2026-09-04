import { expect, it } from "bun:test";
import {
  AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
  runAIPlayerShortRolloutReference,
} from "./ai-player-short-rollout-scenarios";
import { getAIPlayerFixedStateInputForRepetition } from "./ai-player-fixed-state-scenarios";

for (const repetition of [1, 2, 3, 4]) {
  it(`completes the legal but losing allow branch without inventing a candidate turn (permutation ${repetition})`, async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
      (entry) => entry.identity.id === "claim-may-i-to-complete-contract",
    );
    if (scenario === undefined) throw new Error("Missing May I priority fixture");
    const result = await runAIPlayerShortRolloutReference({
      ...scenario,
      input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
      referenceSequence: scenario.referenceSequence.map((decision) =>
        decision.kind === "candidate-response"
          ? { ...decision, actions: [{ type: "ALLOW_MAY_I" as const }] }
          : decision,
      ),
    });

    expect(result.completed).toBe(true);
    expect(result.legal).toBe(true);
    expect(result.qualityPercent).toBe(0);
    expect(result.modelDecisions).toBe(1);
    expect(result.candidateTurns).toBe(0);
    expect(result.criteria.every((criterion) => !criterion.passed)).toBe(true);
    expect(result.attempts.every((attempt) => attempt.ok)).toBe(true);
    expect(result.finalSnapshot.phase).toBe("ROUND_END");
  });
}
