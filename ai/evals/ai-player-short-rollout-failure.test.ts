import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { evaluateCase } from "./ai-player-short-rollout-runner";
import { AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION } from "./ai-player-rollout-policy";

it("versions optional player views separately from the game runtime and rubric", () => {
  expect(AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION).toBe("short-rollout-harness-v8");
});

it("ends the rollout at the first unavailable-provider invocation without dispatching later decisions", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "contested-run-diamonds-natural",
  );
  if (!scenario) throw new Error("Missing multi-turn fixture");
  // Port zero is not a listening service. Exercise the real transport error;
  // do not provide synthetic model responses or use the user's provider key.
  const provider = createOpenRouter({
    apiKey: "local-transport-failure-test",
    baseURL: "http://127.0.0.1:0/api/v1",
  });
  const prompt = buildSystemPrompt();
  const result = await evaluateCase({
    runId: "local-provider-failure",
    candidate: AI_PLAYER_EVAL_CANDIDATES["spark-low"],
    model: provider.chat("meta/muse-spark-1.3-contributor"),
    scenario,
    repetition: 1,
    baseSystemPrompt: prompt,
    ordinaryTurnSystemPrompt: prompt,
    promptExperimentScope: "ordinary-turns",
  });

  expect(result.completed).toBe(false);
  expect(result.modelDecisions).toBe(1);
  expect(result.inputStates).toHaveLength(1);
  expect(result.wallDurationPerDecisionMs).toHaveLength(1);
  expect(result.attempts).toEqual([]);
  expect(result.toolRequests).toEqual([]);
  expect(result.toolRequestHealth).toEqual({ total: 0, succeeded: 0, rejected: 0, errors: 0, unresolved: 0, successRate: undefined });
  expect(result.schemaVersion).toBe(7);
  expect(result.decisions).toHaveLength(1);
  expect(result.decisions[0]?.actionEvidence).toEqual([]);
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).not.toContain("Opponent script");
  expect(result.failureMode).toBe("provider");
  expect(result.finalSnapshot.turnNumber).toBe(6);
  expect(result.finalSnapshot.turnPhase).toBe("AWAITING_DRAW");
});

it("stops a broken opponent script at its first rejected action", async () => {
  const root = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "contested-run-diamonds-natural",
  );
  if (!root) throw new Error("Missing multi-turn fixture");
  const provider = createOpenRouter({
    apiKey: "local-transport-failure-test",
    baseURL: "http://127.0.0.1:0/api/v1",
  });
  const prompt = buildSystemPrompt();
  const result = await evaluateCase({
    runId: "broken-opponent-script",
    candidate: AI_PLAYER_EVAL_CANDIDATES["spark-low"],
    model: provider.chat("meta/muse-spark-1.3-contributor"),
    scenario: {
      ...root,
      referenceSequence: [
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [{ type: "DRAW_FROM_STOCK" }, { type: "SKIP" }],
        },
        { playerId: root.evaluatedPlayerId, kind: "candidate-turn", actions: [] },
      ],
    },
    repetition: 1,
    baseSystemPrompt: prompt,
    ordinaryTurnSystemPrompt: prompt,
    promptExperimentScope: "ordinary-turns",
  });
  expect(result.completed).toBe(false);
  expect(result.modelDecisions).toBe(0);
  expect(result.attempts).toHaveLength(1);
  expect(result.attempts[0]?.ok).toBe(false);
  expect(result.warnings).toHaveLength(1);
  expect(result.failureMode).toBe("harness-artifact");
  expect(result.inputStates).toEqual([]);
});
