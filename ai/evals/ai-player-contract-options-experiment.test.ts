import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { evaluateCase, parseAIPlayerShortRolloutRunnerArguments } from "./ai-player-short-rollout-runner";
import { buildMayICallDecisionPrompt } from "../mayIAgent.may-i-call";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION } from "./ai-player-rollout-policy";

it("requires opt-in contract-options presentation without changing default settings", () => {
  expect(parseAIPlayerShortRolloutRunnerArguments([]).tacticalPresentation).toBeUndefined();
  expect(parseAIPlayerShortRolloutRunnerArguments(["--tactical-presentation", "contract-options"]).tacticalPresentation).toBe("contract-options");
  expect(() => parseAIPlayerShortRolloutRunnerArguments(["--tactical-presentation", "best-move"])).toThrow("contract-options");
  expect(AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION).toBe("short-rollout-harness-v8");
});

it("records the selected derived view even when the real provider transport fails", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural");
  if (!scenario) throw new Error("Missing contract comparison fixture");
  const provider = createOpenRouter({ apiKey: "local-contract-view-test", baseURL: "http://127.0.0.1:0/api/v1" });
  const prompt = buildSystemPrompt();
  const result = await evaluateCase({
    runId: "contract-view-transport", candidate: AI_PLAYER_EVAL_CANDIDATES["spark-low"],
    model: provider.chat("meta/muse-spark-1.3-contributor"), scenario, repetition: 1,
    baseSystemPrompt: prompt, ordinaryTurnSystemPrompt: prompt,
    promptExperimentScope: "all-candidate-decisions", tacticalPresentation: "contract-options",
  });
  expect(result.completed).toBe(false);
  expect(result.inputStates[0]).toContain("CONTRACT OPTIONS");
  expect(result.inputStates[0]).not.toContain("CALL lay_down");
  expect(result.tacticalPresentation).toEqual({ mode: "contract-options", version: "distinct-contract-options-v1" });
  expect(result.scratchpad).toBeUndefined();
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const snapshot = await runtime.getSnapshot();
    expect(buildMayICallDecisionPrompt(snapshot, scenario.evaluatedPlayerId, [], undefined, "contract-options")).toContain("CONTRACT OPTIONS");
    expect(buildMayICallDecisionPrompt(snapshot, scenario.evaluatedPlayerId)).toContain("CALL lay_down");
  } finally { history.actor.stop(); }
}, 10000);
