import { expect, test } from "bun:test";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS, AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION, runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { getAIPlayerFixedStateInputForRepetition } from "./ai-player-fixed-state-scenarios";

test("versions the repaired future-layoff continuation separately from historical results", () => {
  expect(AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION).toBe("short-rollout-v11");
});

for (const repetition of [1, 2, 3, 4]) {
  test(`opponents finish legal turns after the candidate takes discard instead of stock (${repetition})`, async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "preserve-future-layoff-cards");
    if (!scenario) throw new Error("Missing future-layoff fixture");
    const result = await runAIPlayerShortRolloutReference({
      ...scenario,
      input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
      referenceSequence: scenario.referenceSequence.slice(0, -1).map((decision, index) => index !== 0 ? decision : {
        ...decision,
        actions: decision.actions.map(action => action.type === "DRAW_FROM_STOCK" ? { type: "DRAW_FROM_DISCARD" as const } : action.type === "DISCARD" ? { ...action, cardId: "future-opening-jd" } : action),
      }),
    });
    expect(result.attempts.every(attempt => attempt.ok)).toBe(true);
    expect(result.finalSnapshot.awaitingPlayerId).toBe(scenario.evaluatedPlayerId);
    expect(result.finalSnapshot.turnPhase).toBe("AWAITING_DRAW");
    expect(result.finalSnapshot.players.find(p => p.id === scenario.evaluatedPlayerId)?.hand.map(c => c.id).sort()).toEqual(["future-3h", "future-kc"]);
    const completed = await runAIPlayerShortRolloutReference({
      ...scenario,
      input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
      referenceSequence: scenario.referenceSequence.map((decision, index) => index === 0 ? {
        ...decision,
        actions: decision.actions.map(action => action.type === "DRAW_FROM_STOCK" ? { type: "DRAW_FROM_DISCARD" as const } : action.type === "DISCARD" ? { ...action, cardId: "future-opening-jd" } : action),
      } : index === scenario.referenceSequence.length - 1 ? {
        ...decision,
        actions: [
          { type: "DRAW_FROM_STOCK" },
          { type: "LAY_OFF", cardId: "future-kc", meldId: "future-kings" },
          { type: "LAY_OFF", cardId: "future-3h", meldId: "future-threes" },
          { type: "DISCARD", cardId: "future-p2-draw" },
        ],
      } : decision),
    });
    expect(completed.legal).toBe(true);
    expect(completed.completed).toBe(true);
    expect(completed.qualityPercent).toBe(100);
  });
}
