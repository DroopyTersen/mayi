import { expect, it } from "bun:test";
import { AIPlayerOrganizationTracker } from "./ai-player-organization-opportunity";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_CONTESTED_RUN_SCENARIOS } from "./ai-player-contested-run-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { createMayITools } from "../mayIAgent.tools";
import { scoreAIPlayerShortRolloutCriteria } from "./ai-player-short-rollout-scenarios";

it("does not count a terminal required draw as an opportunity to organize", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "swap-joker-to-unlock-contract");
  if (!scenario) throw new Error("Missing terminal-draw fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime, attempts } = history.createRuntime(scenario.evaluatedPlayerId);
    const tracker = new AIPlayerOrganizationTracker(await runtime.getSnapshot(), scenario.evaluatedPlayerId);
    const before = await runtime.getSnapshot();
    const action = { type: "DRAW_FROM_STOCK" } as const;
    const result = await runtime.executeAction(action);
    const after = await runtime.getSnapshot();
    expect(result.ok).toBe(true);
    expect(after.phase).toBe("ROUND_END");
    tracker.observe(action, result.ok, before, after);
    expect(tracker.summary).toEqual({ expectedTurns: 0, correctTurns: 0 });
    const grade = scenario.grade({ snapshot: after, candidateAttempts: attempts, decisions: [
      { playerId: scenario.evaluatedPlayerId, kind: "candidate-turn", success: true },
    ] });
    expect(scoreAIPlayerShortRolloutCriteria(grade)).toBe(0);
  } finally { history.actor.stop(); }
});

it("counts a nonterminal draw once and does not waive missed sorting after the turn ends", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "hand6-take-discard-to-win");
  if (!scenario) throw new Error("Missing draw fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const state = history.createRuntime(scenario.evaluatedPlayerId);
    const tracker = new AIPlayerOrganizationTracker(await state.runtime.getSnapshot(), scenario.evaluatedPlayerId);
    const runtime = tracker.wrap(state.runtime);
    expect(tracker.summary.expectedTurns).toBe(0);
    expect((await runtime.executeAction({ type: "DRAW_FROM_DISCARD" })).ok).toBe(true);
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 0 });
    const hand = (await runtime.getSnapshot()).players.find(p => p.id === scenario.evaluatedPlayerId)?.hand;
    if (!hand?.[0]) throw new Error("Missing hand");
    expect((await runtime.executeAction({ type: "DISCARD", cardId: hand[0].id })).ok).toBe(true);
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 0 });
  } finally { history.actor.stop(); }
});

it("credits successful contract-appropriate organization, not rejected or wrong-order attempts", async () => {
  const scenario = AI_PLAYER_CONTESTED_RUN_SCENARIOS.find(s => s.identity.id === "contested-run-diamonds-natural");
  if (!scenario) throw new Error("Missing sorting fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const state = history.createRuntime(scenario.evaluatedPlayerId);
    const tracker = new AIPlayerOrganizationTracker(await state.runtime.getSnapshot(), scenario.evaluatedPlayerId);
    const runtime = tracker.wrap(state.runtime);
    expect((await runtime.executeAction({ type: "REORDER_HAND", cardIds: [] })).ok).toBe(false);
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 0 });
    const tools = createMayITools(runtime, scenario.evaluatedPlayerId);
    if (!tools.organize_hand.execute) throw new Error("Missing executor");
    await tools.organize_hand.execute({ order: "rank" }, { toolCallId: "wrong", messages: [], context: {} });
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 0 });
    await tools.organize_hand.execute({ order: "suit" }, { toolCallId: "right", messages: [], context: {} });
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 1 });
    await tools.organize_hand.execute({ order: "suit" }, { toolCallId: "again", messages: [], context: {} });
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 1 });
  } finally { history.actor.stop(); }
});

it("still counts a missed organization in an already-drawn ordinary turn", async () => {
  const scenario = AI_PLAYER_CONTESTED_RUN_SCENARIOS.find(s => s.identity.id === "contested-run-diamonds-natural");
  if (!scenario) throw new Error("Missing post-draw fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const tracker = new AIPlayerOrganizationTracker(await runtime.getSnapshot(), scenario.evaluatedPlayerId);
    expect(tracker.summary).toEqual({ expectedTurns: 1, correctTurns: 0 });
  } finally { history.actor.stop(); }
});
