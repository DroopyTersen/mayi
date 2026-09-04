import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { MAYI_AI_PROMPT_VERSION } from "../mayIAgent.prompt-version";
import { AI_HAND_SCRATCHPAD_VERSION } from "../mayIAgent.scratchpad";
import { loadAIPlayerEvalPromptSelection } from "./ai-player-eval-prompt";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { evaluateCase, parseAIPlayerShortRolloutRunnerArguments } from "./ai-player-short-rollout-runner";

const experimentArguments = [
  "--prompt-experiment", "hand-scratchpad-v1",
  "--prompt-addendum-file", "ai/evals/prompts/hand-scratchpad-v1.md",
  "--prompt-scope", "all-candidate-decisions",
];

it("requires explicit per-hand memory with guidance across all candidate decisions", () => {
  expect(parseAIPlayerShortRolloutRunnerArguments([]).scratchpad).toBeUndefined();
  expect(parseAIPlayerShortRolloutRunnerArguments([
    ...experimentArguments, "--scratchpad", "per-hand",
  ]).scratchpad).toBe("per-hand");
  expect(() => parseAIPlayerShortRolloutRunnerArguments(["--scratchpad", "shared"])).toThrow("per-hand");
  expect(() => parseAIPlayerShortRolloutRunnerArguments(["--scratchpad", "per-hand"])).toThrow("explicit prompt experiment");
  expect(() => parseAIPlayerShortRolloutRunnerArguments([
    ...experimentArguments.slice(0, 4), "--scratchpad", "per-hand",
  ])).toThrow("all-candidate-decisions");
});

it("keeps scratchpad instructions in player guidance and preserves rules, protocol, and organization", async () => {
  const base = { baseVersion: MAYI_AI_PROMPT_VERSION, baseContent: buildSystemPrompt() };
  const baseline = await loadAIPlayerEvalPromptSelection({ ...base, experiment: undefined });
  const experiment = await loadAIPlayerEvalPromptSelection({
    ...base, experiment: { id: "hand-scratchpad-v1", addendumFile: "ai/evals/prompts/hand-scratchpad-v1.md" },
  });
  expect(experiment.components?.houseRules).toEqual(baseline.components?.houseRules);
  expect(experiment.components?.toolProtocol).toEqual(baseline.components?.toolProtocol);
  const guidanceBody = /<player_guidance[^>]*>([\s\S]*?)<\/player_guidance>/;
  expect(experiment.content.match(guidanceBody)?.[1]).toContain(baseline.content.match(guidanceBody)?.[1]?.trim() ?? "missing");
  expect(experiment.experiment?.content).toContain("strategy_note");
  expect(experiment.experiment?.content).toContain("400");
  expect(experiment.experiment?.content).toContain("house rules");
});

it("records empty isolated private context and a discarded write on real provider failure", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find((entry) => entry.identity.id === "contested-run-diamonds-natural");
  if (!scenario) throw new Error("Missing multi-turn fixture");
  const provider = createOpenRouter({ apiKey: "local-scratchpad-test", baseURL: "http://127.0.0.1:0/api/v1" });
  const prompt = buildSystemPrompt();
  const options = {
    runId: "scratchpad-transport", candidate: AI_PLAYER_EVAL_CANDIDATES["spark-low"],
    model: provider.chat("meta/muse-spark-1.3-contributor"), scenario, repetition: 1,
    baseSystemPrompt: prompt, ordinaryTurnSystemPrompt: prompt,
    promptExperimentScope: "all-candidate-decisions" as const,
  };
  const baseline = await evaluateCase(options);
  expect(baseline.scratchpad).toBeUndefined();
  expect(baseline.inputStates[0]).not.toContain("PRIVATE STRATEGY SCRATCHPAD");
  for (let repetition = 1; repetition <= 2; repetition++) {
    const result = await evaluateCase({ ...options, repetition, scratchpad: "per-hand" });
    expect(result.completed).toBe(false);
    expect(result.scratchpad).toEqual({ version: AI_HAND_SCRATCHPAD_VERSION, decisions: [{
      decisionIndex: 0, kind: "candidate-turn", before: undefined, proposed: undefined,
      after: undefined, outcome: "discarded",
    }] });
    expect(result.inputStates[0]).toContain("No previous note for this hand.");
    expect(result.modelDecisions).toBe(1);
  }
}, 15000);
