import { expect, it } from "bun:test";
import { AI_PLAYER_MAY_I_HORIZON_SCENARIOS } from "./ai-player-may-i-horizon-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";

it("replays the same seeded trajectory through turn-level stock recycling", async () => {
  const scenario = AI_PLAYER_MAY_I_HORIZON_SCENARIOS.find(
    (entry) => entry.identity.id === "call-may-i-with-two-more-reserves",
  );
  if (!scenario) throw new Error("Missing recyclable-stock scenario");
  for (const repetition of [1, 2, 3, 4]) {
    let expected: unknown[] | undefined;
    for (let replay = 0; replay < 8; replay++) {
      const history = await createAIPlayerRolloutHistory(scenario, repetition);
      const trajectory: unknown[] = [];
      try {
        for (const decision of scenario.referenceSequence) {
          const { runtime } = history.createRuntime(decision.playerId);
          for (const action of decision.actions) {
            const result = await runtime.executeAction(action);
            expect(result.ok).toBe(true);
            const { updatedAt, ...snapshot } = result.snapshot;
            trajectory.push(snapshot);
          }
        }
        if (expected) expect(trajectory).toEqual(expected);
        else expected = trajectory;
      } finally {
        history.actor.stop();
      }
    }
  }
});
