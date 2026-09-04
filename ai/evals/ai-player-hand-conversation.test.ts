import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { createAIPlayerEvalModelConfigurationSnapshot } from "./ai-player-model-configuration";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { evaluateCase, hasAIPlayerDecisionUsage, parseAIPlayerShortRolloutRunnerArguments, runAIPlayerShortRollout } from "./ai-player-short-rollout-runner";
import { summarizeAITurnMetrics } from "../ai-turn-metrics";

it("does not label timing-only or partial metrics as complete token usage", () => {
  const timingOnly = summarizeAITurnMetrics({ turnDurationMs: 10, stepPerformance: [], usage: {
    inputTokens: undefined, outputTokens: undefined, totalTokens: undefined,
    inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
  } });
  expect(hasAIPlayerDecisionUsage(undefined)).toBe(false);
  expect(hasAIPlayerDecisionUsage(timingOnly)).toBe(false);
  expect(hasAIPlayerDecisionUsage({ ...timingOnly, inputTokens: 10 })).toBe(false);
  expect(hasAIPlayerDecisionUsage({ ...timingOnly, inputTokens: 0, outputTokens: 0 })).toBe(true);
});

it("isolates fresh and per-hand conversation arms without changing default arguments", () => {
  expect(parseAIPlayerShortRolloutRunnerArguments([]).conversation).toBeUndefined();
  for (const mode of ["fresh", "per-hand"] as const) {
    const args = ["--conversation", mode, "--reasoning-replay", "within-turn"];
    expect(parseAIPlayerShortRolloutRunnerArguments(args).conversation).toBe(mode);
    expect(() => parseAIPlayerShortRolloutRunnerArguments(["--conversation", mode])).toThrow("within-turn");
    expect(() => parseAIPlayerShortRolloutRunnerArguments([...args, "--tactical-presentation", "contract-options"])).toThrow("isolated");
    expect(() => parseAIPlayerShortRolloutRunnerArguments([...args, "--prompt-experiment", "extra", "--prompt-addendum-file", "extra.md"])).toThrow("isolated");
  }
  expect(() => parseAIPlayerShortRolloutRunnerArguments(["--conversation", "shared"])).toThrow("fresh or per-hand");
});

it("enforces conversation isolation for programmatic dispatch, not only CLI parsing", async () => {
  await expect(runAIPlayerShortRollout({ ...parseAIPlayerShortRolloutRunnerArguments([]), conversation: "per-hand" })).rejects.toThrow("within-turn");
});

for (const mode of ["fresh", "per-hand"] as const) {
  it(`${mode}: records exact API context and missing usage on an unreplaced failed trial`, async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contested-run-diamonds-natural");
    if (!scenario) throw new Error("Missing multi-turn fixture");
    const provider = createOpenRouter({ apiKey: "local-conversation-eval-test", baseURL: "http://127.0.0.1:0/api/v1" });
    const snapshot = createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low", { retainReasoning: true });
    const candidate = { ...AI_PLAYER_EVAL_CANDIDATES["spark-low"], modelConfiguration: snapshot.configuration, modelConfigurationSha256: snapshot.sha256 };
    const prompt = buildSystemPrompt();
    const result = await evaluateCase({ runId: "conversation-failure", candidate, model: provider.chat("meta/muse-spark-1.3-contributor"),
      scenario, repetition: 1, baseSystemPrompt: prompt, ordinaryTurnSystemPrompt: prompt, promptExperimentScope: "ordinary-turns",
      reasoningReplay: "within-turn", conversation: mode });
    expect(result.completed).toBe(false);
    expect(result.schemaVersion).toBe(7);
    expect(result.harnessVersion).toBe("short-rollout-harness-v8");
    expect(result.modelDecisions).toBe(1);
    expect(result.conversation).toMatchObject({ mode, version: "private-hand-conversation-v1" });
    expect(result.conversation?.decisions).toHaveLength(1);
    expect(result.conversation?.decisions[0]).toMatchObject({ decisionIndex: 0, kind: "candidate-turn", usageAvailable: false,
      trace: { mode, modelConfigurationSha256: snapshot.sha256, completionValidated: false, requestMessageCount: 1, suppliedHistoryMessageCount: 0 } });
    expect(result.attempts).toEqual([]);
    expect(result.toolRequests).toEqual([]);
  }, 10000);
}
