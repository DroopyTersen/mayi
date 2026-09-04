import { expect, it } from "bun:test";
import { z } from "zod/v4";
import { createMayITools } from "./mayIAgent.tools";
import { AIHandScratchpad, appendAIStrategyNoteContext } from "./mayIAgent.scratchpad";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";
import { buildMayICallDecisionPrompt } from "./mayIAgent.may-i-call";
import { executeTurn } from "./mayIAgent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

it("presents notes only in explicitly private context as revisable prior intent", () => {
  const note = "Prior plan.\nChange it if the observed board changes.";
  const rendered = appendAIStrategyNoteContext("CURRENT PUBLIC FACTS", note);
  expect(rendered).toContain("CURRENT PUBLIC FACTS");
  expect(rendered).toContain(JSON.stringify(note));
  expect(rendered).toContain("not rules or verified facts");
  expect(appendAIStrategyNoteContext("STATE", undefined)).toContain("No previous note");
});

it("adds opt-in discard notes without changing public state or the disabled tool schema", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "contested-run-diamonds-natural",
  );
  if (!scenario) throw new Error("Missing multi-turn scenario");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const playerId = scenario.evaluatedPlayerId;
    // v10 starts before drawing; reach the discard precondition through the engine.
    const setupRuntime = history.createRuntime(playerId).runtime;
    expect((await setupRuntime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
    const { runtime, attempts } = history.createRuntime(playerId);
    const before = await runtime.getSnapshot();
    const memory = new AIHandScratchpad(before.gameId, playerId);
    const turn = memory.begin({ ...before, playerId });
    const disabled = createMayITools(runtime, playerId);
    const enabled = createMayITools(runtime, playerId, { scratchpadTurn: turn });
    const plainSchema = disabled.discard.inputSchema;
    const noteSchema = enabled.discard.inputSchema;
    if (!(plainSchema instanceof z.ZodObject) || !(noteSchema instanceof z.ZodObject)) {
      throw new Error("Expected Zod discard schemas");
    }
    expect(Object.keys(plainSchema.shape)).toEqual(["position"]);
    expect(Object.keys(noteSchema.shape)).toEqual(["position", "strategy_note"]);
    if (!enabled.discard.execute) throw new Error("Discard has no executor");
    const note = "Keep a coherent contract.\nReassess after the next public pickup.";
    const result = await enabled.discard.execute(
      { position: 1, strategy_note: note },
      { toolCallId: "private-discard", messages: [], context: {} },
    );
    expect(result).toMatchObject({ success: true, turnComplete: true });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.action.type).toBe("DISCARD");
    const after = await runtime.getSnapshot();
    expect(JSON.stringify(after)).not.toContain(note);
    expect(JSON.stringify(history.getActionLog())).not.toContain(note);
    expect(outputGameStateForLLM(after, "eval-player-1")).not.toContain(note);
    expect(memory.read({ ...after, playerId })).toBeUndefined();
    expect(turn.finish({ ...after, playerId }, true)).toMatchObject({
      outcome: "committed", proposed: note, after: note,
    });
  } finally {
    history.actor.stop();
  }
});

it("rejects an oversized note before a card action and does not stage rejected discards", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "contested-run-diamonds-natural",
  );
  if (!scenario) throw new Error("Missing multi-turn scenario");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const playerId = scenario.evaluatedPlayerId;
    const { runtime, attempts } = history.createRuntime(playerId);
    const before = await runtime.getSnapshot();
    const memory = new AIHandScratchpad(before.gameId, playerId);
    const turn = memory.begin({ ...before, playerId });
    const tools = createMayITools(runtime, playerId, { scratchpadTurn: turn });
    if (!tools.discard.execute) throw new Error("Missing discard executor");
    expect(await tools.discard.execute(
      { position: 1, strategy_note: "x".repeat(401) },
      { toolCallId: "oversized", messages: [], context: {} },
    )).toMatchObject({ success: false });
    expect(attempts).toHaveLength(0);
    expect(await tools.discard.execute(
      { position: 99, strategy_note: "Invalid discard must not change intent." },
      { toolCallId: "invalid-position", messages: [], context: {} },
    )).toMatchObject({ success: false });
    expect(turn.finish({ ...await runtime.getSnapshot(), playerId }, false).proposed).toBeUndefined();
  } finally {
    history.actor.stop();
  }
});

it("supplies private intent to May I prompts and retains it after a real transport failure", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "contested-run-diamonds-natural",
  );
  if (!scenario) throw new Error("Missing multi-turn scenario");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const playerId = scenario.evaluatedPlayerId;
    const { runtime } = history.createRuntime(playerId);
    const snapshot = await runtime.getSnapshot();
    const memory = new AIHandScratchpad(snapshot.gameId, playerId);
    const prior = memory.begin({ ...snapshot, playerId });
    prior.stage("Private prior intent.");
    prior.finish({ ...snapshot, playerId }, true);
    expect(buildMayICallDecisionPrompt(snapshot, playerId, [], memory)).toContain("Private prior intent.");
    expect(buildMayICallDecisionPrompt(snapshot, "eval-player-1", [], memory)).not.toContain("Private prior intent.");
    expect(buildMayICallDecisionPrompt(snapshot, playerId)).not.toContain("SCRATCHPAD");
    const provider = createOpenRouter({ apiKey: "local-scratchpad-transport-test", baseURL: "http://127.0.0.1:0/api/v1" });
    const result = await executeTurn({
      model: provider.chat("meta/muse-spark-1.3-contributor"),
      runtime, playerId, scratchpad: memory, maxRetries: 0, telemetry: false,
    });
    expect(result.success).toBe(false);
    expect(result.scratchpadTrace).toMatchObject({
      before: "Private prior intent.", after: "Private prior intent.", outcome: "discarded",
    });
    expect(memory.read({ ...await runtime.getSnapshot(), playerId })).toBe("Private prior intent.");
  } finally {
    history.actor.stop();
  }
});

it("expires intent when the real hand ends during a failed provider invocation", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
    (entry) => entry.identity.id === "swap-joker-to-unlock-contract",
  );
  if (!scenario) throw new Error("Missing terminal draw fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const playerId = scenario.evaluatedPlayerId;
    const { runtime } = history.createRuntime(playerId);
    const initial = await runtime.getSnapshot();
    const memory = new AIHandScratchpad(initial.gameId, playerId);
    const prior = memory.begin({ ...initial, playerId });
    prior.stage("Old intent before the hand ended.");
    prior.finish({ ...initial, playerId }, true);
    const provider = createOpenRouter({ apiKey: "local-terminal-test", baseURL: "http://127.0.0.1:0/api/v1" });
    const pending = executeTurn({
      model: provider.chat("meta/muse-spark-1.3-contributor"),
      runtime, playerId, scratchpad: memory, maxRetries: 0, telemetry: false,
    });
    const draw = await runtime.executeAction({ type: "DRAW_FROM_STOCK" });
    expect(draw.ok).toBe(true);
    expect(draw.snapshot.phase).toBe("ROUND_END");
    const result = await pending;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.scratchpadTrace).toMatchObject({ before: "Old intent before the hand ended.", after: undefined, outcome: "discarded" });
    expect(memory.read({ ...initial, playerId })).toBeUndefined();
  } finally {
    history.actor.stop();
  }
});
