import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { evaluateCase, parseAIPlayerShortRolloutRunnerArguments } from "./ai-player-short-rollout-runner";

it("selects neutral wording explicitly without enabling any other experiment", () => {
  const selected = parseAIPlayerShortRolloutRunnerArguments(["--tactical-presentation", "neutral-contract-hint"]);
  expect(selected.tacticalPresentation).toBe("neutral-contract-hint");
  expect(selected.candidateId).toBe("spark-low");
  expect(selected.repetitions).toBe(4);
  expect(selected.scratchpad).toBeUndefined();
  expect(selected.reasoningReplay).toBeUndefined();
  expect(selected.conversation).toBeUndefined();
  expect(selected.promptExperiment).toBeUndefined();
  expect(parseAIPlayerShortRolloutRunnerArguments([]).tacticalPresentation).toBeUndefined();
});

it("records neutral presentation and its own version even on a real transport failure", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural")!;
  const provider = createOpenRouter({ apiKey: "local-neutral-view-test", baseURL: "http://127.0.0.1:0/api/v1" });
  const prompt = buildSystemPrompt();
  const result = await evaluateCase({
    runId: "neutral-view-transport", candidate: AI_PLAYER_EVAL_CANDIDATES["spark-low"],
    model: provider.chat("meta/muse-spark-1.3-contributor"), scenario, repetition: 1,
    baseSystemPrompt: prompt, ordinaryTurnSystemPrompt: prompt,
    promptExperimentScope: "all-candidate-decisions", tacticalPresentation: "neutral-contract-hint",
  });
  expect(result.completed).toBe(false);
  expect(result.inputStates[0]).toContain("LEGAL CONTRACT EXAMPLE:");
  expect(result.inputStates[0]).not.toContain("CALL lay_down");
  expect(result.tacticalPresentation).toEqual({ mode: "neutral-contract-hint", version: "neutral-contract-hint-v1" });
  expect(result.scratchpad).toBeUndefined();
  expect(result.reasoningReplay).toBeUndefined();
  expect(result.conversation).toBeUndefined();
}, 10000);
