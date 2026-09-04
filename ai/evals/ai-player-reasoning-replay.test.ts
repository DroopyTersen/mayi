import { expect, it } from "bun:test";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenRouterMuseChatSettings, OPENROUTER_MUSE_CHAT_SETTINGS } from "../openrouter-muse-profile";
import { parseAIPlayerShortRolloutRunnerArguments } from "./ai-player-short-rollout-runner";
import { createAIPlayerEvalModelConfigurationSnapshot } from "./ai-player-model-configuration";

it("retains reasoning only on explicit opt-in without changing effort or usage", () => {
  expect(createOpenRouterMuseChatSettings("low", { retainReasoning: true })).toEqual({
    reasoning: { effort: "low", exclude: false }, usage: { include: true },
  });
  expect(createOpenRouterMuseChatSettings("low")).toEqual({
    reasoning: { effort: "low", exclude: true }, usage: { include: true },
  });
  expect(OPENROUTER_MUSE_CHAT_SETTINGS).toEqual({
    reasoning: { effort: "low", exclude: true }, usage: { include: true },
  });
});

it("the installed provider serializer preserves Meta encrypted blocks without a network call", () => {
  const block = { type: "reasoning.encrypted", format: "meta-responses-v1", id: "test-reasoning", data: "opaque-test-payload" };
  // Inspect the real serializer, not a fake transport/model. No request is sent.
  const model = createOpenRouter().chat("meta/muse-spark-1.3-contributor") as unknown as {
    getArgs(options: { prompt: unknown[] }): { messages: Array<{ reasoning_details?: unknown[] }> };
  };
  const args = model.getArgs({ prompt: [{ role: "assistant", content: [{ type: "tool-call", toolCallId: "test-call", toolName: "submit", input: { value: 1 }, providerOptions: { openrouter: { reasoning_details: [block] } } }] }] });
  expect(args.messages[0]?.reasoning_details).toEqual([block]);
});

it("fingerprints the effective replay setting without changing the baseline snapshot", () => {
  const baseline = createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low");
  const retained = createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low", { retainReasoning: true });
  expect(retained.configuration).toEqual({
    ...baseline.configuration,
    requestProviderOptions: { openrouter: { reasoning: { effort: "low", exclude: false }, usage: { include: true } } },
  });
  expect(retained.sha256).not.toBe(baseline.sha256);
  expect(createAIPlayerEvalModelConfigurationSnapshot("default:meta", "low")).toEqual(baseline);
});

it("selects within-turn replay explicitly without enabling cross-turn memory or other experiments", () => {
  const selected = parseAIPlayerShortRolloutRunnerArguments(["--reasoning-replay", "within-turn"]);
  expect(selected.reasoningReplay).toBe("within-turn");
  expect(selected.candidateId).toBe("spark-low");
  expect(selected.repetitions).toBe(4);
  expect(selected.scratchpad).toBeUndefined();
  expect(selected.tacticalPresentation).toBeUndefined();
  expect(selected.promptExperiment).toBeUndefined();
  expect(parseAIPlayerShortRolloutRunnerArguments([]).reasoningReplay).toBeUndefined();
  expect(() => parseAIPlayerShortRolloutRunnerArguments(["--reasoning-replay", "per-hand"])).toThrow("Reasoning replay must be within-turn");
});
