import { afterEach, describe, expect, it } from "bun:test";
import { getEligibleMayICallerIds } from "../mayIAgent.may-i-call";
import { createAIPlayerFixedStateRuntime } from "./ai-player-fixed-state-scenarios";
import {
  AI_PLAYER_MAY_I_CALL_SCENARIOS,
  AI_PLAYER_MAY_I_CALL_SUITE_VERSION,
  getAIPlayerMayICallScenario,
} from "./ai-player-may-i-call-scenarios";

describe("AI player May I call scenarios", () => {
  const actors: Array<{ stop: () => void }> = [];

  afterEach(() => {
    for (const actor of actors) actor.stop();
    actors.length = 0;
  });

  it("has a stable development and holdout catalog with clear call/pass controls", () => {
    expect(AI_PLAYER_MAY_I_CALL_SUITE_VERSION).toBe("may-i-call-v1");
    expect(AI_PLAYER_MAY_I_CALL_SCENARIOS).toHaveLength(6);
    expect(
      AI_PLAYER_MAY_I_CALL_SCENARIOS.filter(
        (scenario) => scenario.identity.split === "development",
      ),
    ).toHaveLength(4);
    expect(
      AI_PLAYER_MAY_I_CALL_SCENARIOS.filter(
        (scenario) => scenario.identity.split === "holdout",
      ),
    ).toHaveLength(2);
    expect(
      AI_PLAYER_MAY_I_CALL_SCENARIOS.map(
        (scenario) => scenario.expectedDecision,
      ),
    ).toEqual(expect.arrayContaining(["call", "pass"]));

    const ids = AI_PLAYER_MAY_I_CALL_SCENARIOS.map(
      (scenario) => scenario.identity.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const scenario of AI_PLAYER_MAY_I_CALL_SCENARIOS) {
      expect(
        scenario.rubric.reduce(
          (total, criterion) => total + criterion.weight,
          0,
        ),
      ).toBe(100);
    }
  });

  it("makes the evaluated player legally eligible in every scenario", async () => {
    for (const scenario of AI_PLAYER_MAY_I_CALL_SCENARIOS) {
      const state = createAIPlayerFixedStateRuntime(
        scenario,
        1,
        scenario.evaluatedPlayerId,
      );
      actors.push(state.actor);
      const snapshot = await state.runtime.getSnapshot();

      expect(getEligibleMayICallerIds(snapshot)).toContain(
        scenario.evaluatedPlayerId,
      );
      expect(snapshot.awaitingPlayerId).not.toBe(scenario.evaluatedPlayerId);
    }
  });

  it("gives full credit to every frozen reference decision", async () => {
    for (const scenario of AI_PLAYER_MAY_I_CALL_SCENARIOS) {
      for (const repetition of [1, 2]) {
        const state = createAIPlayerFixedStateRuntime(
          scenario,
          repetition,
          scenario.evaluatedPlayerId,
        );
        actors.push(state.actor);

        if (scenario.expectedDecision === "call") {
          expect(
            (await state.runtime.executeAction({ type: "CALL_MAY_I" })).ok,
          ).toBe(true);
        }
        const after = await state.runtime.getSnapshot();
        expect(
          scenario
            .grade(scenario.expectedDecision, after, state.attempts)
            .every((criterion) => criterion.passed),
        ).toBe(true);
      }
    }
  });

  it("fails the opposite decision for positive and negative controls", async () => {
    for (const scenarioId of [
      "call-contract-completing-set",
      "pass-unrelated-discard",
    ]) {
      const scenario = getAIPlayerMayICallScenario(scenarioId);
      const state = createAIPlayerFixedStateRuntime(
        scenario,
        1,
        scenario.evaluatedPlayerId,
      );
      actors.push(state.actor);
      const opposite = scenario.expectedDecision === "call" ? "pass" : "call";
      if (opposite === "call") {
        await state.runtime.executeAction({ type: "CALL_MAY_I" });
      }
      const after = await state.runtime.getSnapshot();

      expect(
        scenario
          .grade(opposite, after, state.attempts)
          .every((criterion) => criterion.passed),
      ).toBe(false);
    }
  });
});
