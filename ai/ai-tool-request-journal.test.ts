import { expect, it } from "bun:test";
import { AIToolRequestJournal, summarizeAIToolRequests } from "./ai-tool-request-journal";
import { createMayITools } from "./mayIAgent.tools";
import { createMayICallDecisionTools, getEligibleMayICallerIds } from "./mayIAgent.may-i-call";
import { GameEngine } from "../core/engine/game-engine";
import { createAIPlayerGameEngineRuntime } from "./evals/ai-player-game-engine-runtime";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";

it("retains a real pre-engine rejected laydown even after a successful recovery", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contested-run-diamonds-natural");
  if (!scenario) throw new Error("Missing regression fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const state = history.createRuntime(scenario.evaluatedPlayerId);
    // The conserved history fixture now ends before the candidate's draw.
    expect((await state.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok).toBe(true);
    const tools = createMayITools(state.runtime, scenario.evaluatedPlayerId);
    if (!tools.organize_hand.execute || !tools.lay_down.execute || !tools.discard.execute) throw new Error("Missing executor");
    const journal = new AIToolRequestJournal();
    const inputs = { melds: [[4, 9, 11], [5, 10, 12], [1, 2, 3]] };
    await tools.organize_hand.execute({ order: "suit" }, { toolCallId: "sort", messages: [], context: {} });
    const before = history.actor.getPersistedSnapshot();
    const rejected = await tools.lay_down.execute(inputs, { toolCallId: "bad-run", messages: [], context: {} });
    expect(rejected).toMatchObject({ success: false });
    expect(history.actor.getPersistedSnapshot()).toEqual(before);
    expect(state.attempts.every(a => a.ok)).toBe(true);
    journal.recordStep({ content: [
      { type: "tool-call", toolCallId: "bad-run", toolName: "lay_down", input: inputs },
      { type: "tool-result", toolCallId: "bad-run", toolName: "lay_down", input: inputs, output: rejected },
    ] });
    const discarded = await tools.discard.execute({ position: 8 }, { toolCallId: "recover", messages: [], context: {} });
    expect(discarded).toMatchObject({ success: true });
    journal.recordStep({ content: [
      { type: "tool-call", toolCallId: "recover", toolName: "discard", input: { position: 8 } },
      { type: "tool-result", toolCallId: "recover", toolName: "discard", input: { position: 8 }, output: discarded },
    ] });
    expect(journal.requests).toMatchObject([
      { toolCallId: "bad-run", toolName: "lay_down", input: inputs, status: "rejected", output: rejected },
      { toolCallId: "recover", toolName: "discard", status: "succeeded", output: discarded },
    ]);
    expect(journal.requests[0]?.error).toBeTruthy();
  } finally { history.actor.stop(); }
});

it("accounts for schema errors, unknown tools, and calls without results without inventing success", () => {
  const journal = new AIToolRequestJournal();
  journal.recordStep({ content: [
    { type: "tool-call", toolCallId: "schema", toolName: "discard", input: { position: "bad" }, invalid: true },
    { type: "tool-error", toolCallId: "schema", toolName: "discard", input: { position: "bad" }, error: new Error("Invalid input") },
    { type: "tool-call", toolCallId: "unknown", toolName: "invented", input: {}, invalid: true },
    { type: "tool-error", toolCallId: "unknown", toolName: "invented", input: {}, error: "No such tool" },
    { type: "tool-call", toolCallId: "interrupted", toolName: "draw_from_stock", input: {} },
  ] });
  expect(journal.requests.map(r => r.status)).toEqual(["error", "error", "unresolved"]);
  expect(JSON.parse(JSON.stringify(journal.requests))[0].error).toBe("Invalid input");
  expect(journal.requests[1]?.error).toBe("No such tool");
  expect(summarizeAIToolRequests(journal.requests)).toEqual({ total: 3, succeeded: 0, rejected: 0, errors: 2, unresolved: 1, successRate: 0 });
});

it("merges lifecycle observations once per step while retaining reused IDs in later steps", () => {
  const journal = new AIToolRequestJournal();
  const call = { type: "tool-call", toolCallId: "repeat", toolName: "discard", input: { position: 8 } };
  const output = { ...call, type: "tool-result", output: { success: false, message: "Position unavailable" } };
  journal.startStep(0);
  journal.recordModelResponse({ content: [call] });
  expect(journal.requests[0]?.status).toBe("unresolved");
  journal.recordToolOutput(output);
  expect(journal.requests[0]?.status).toBe("rejected");
  journal.recordStep({ content: [call, output] });
  expect(journal.requests).toHaveLength(1);
  journal.startStep(1);
  journal.recordModelResponse({ content: [call] });
  journal.recordToolOutput({ ...output, output: { success: true } });
  journal.recordStep({ content: [call, { ...output, output: { success: true } }] });
  expect(journal.requests.map(r => [r.stepNumber, r.status])).toEqual([[0, "rejected"], [1, "succeeded"]]);
  expect(summarizeAIToolRequests(journal.requests).successRate).toBe(0.5);
});

it("retains real May I pass, call, and engine rejection outcomes", async () => {
  const engine = GameEngine.createGame({ playerNames: ["A", "B", "C"], seed: "tool-journal-may-i" });
  try {
    const currentId = engine.getSnapshot().awaitingPlayerId;
    const callerId = getEligibleMayICallerIds(engine.getSnapshot())[0];
    if (!callerId) throw new Error("No eligible caller");
    const state = createAIPlayerGameEngineRuntime(engine, callerId);
    const tools = createMayICallDecisionTools(state.runtime, callerId);
    const journal = new AIToolRequestJournal();
    const pass = await tools.pass_may_i.execute?.({}, { toolCallId: "pass", messages: [], context: {} });
    journal.recordStep({ content: [
      { type: "tool-call", toolCallId: "pass", toolName: "pass_may_i", input: {} },
      { type: "tool-result", toolCallId: "pass", toolName: "pass_may_i", input: {}, output: pass },
    ] });
    expect(state.attempts).toEqual([]);
    const ineligible = createAIPlayerGameEngineRuntime(engine, currentId);
    const badCall = await createMayICallDecisionTools(ineligible.runtime, currentId).call_may_i.execute?.({}, { toolCallId: "bad", messages: [], context: {} });
    journal.recordStep({ content: [
      { type: "tool-call", toolCallId: "bad", toolName: "call_may_i", input: {} },
      { type: "tool-result", toolCallId: "bad", toolName: "call_may_i", input: {}, output: badCall },
    ] });
    expect(ineligible.attempts[0]?.ok).toBe(false);
    const call = await tools.call_may_i.execute?.({}, { toolCallId: "call", messages: [], context: {} });
    journal.recordStep({ content: [
      { type: "tool-call", toolCallId: "call", toolName: "call_may_i", input: {} },
      { type: "tool-result", toolCallId: "call", toolName: "call_may_i", input: {}, output: call },
    ] });
    expect(state.attempts[0]?.ok).toBe(true);
    expect(journal.requests.map(r => r.status)).toEqual(["succeeded", "rejected", "succeeded"]);
  } finally { engine.stop(); }
});
