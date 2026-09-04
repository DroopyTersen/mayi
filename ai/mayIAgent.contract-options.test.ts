import { expect, it } from "bun:test";
import { findLayDownCandidates } from "./mayIAgent.contract-candidates";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";
import { createMayITools } from "./mayIAgent.tools";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";
import type { Card } from "../core/card/card.types";

const face = (card: Card) => `${card.rank}:${card.suit}`;

it("selects distinct residual card faces before applying the option limit", () => {
  const hand: Card[] = [
    ...["hearts", "hearts", "diamonds", "diamonds", "clubs", "clubs"].map((suit, i) => ({ id: `nine-${i}`, rank: "9" as const, suit: suit as Card["suit"] })),
    ...["hearts", "diamonds", "clubs"].map((suit, i) => ({ id: `seven-${i}`, rank: "7" as const, suit: suit as Card["suit"] })),
    { id: "ks", rank: "K", suit: "spades" },
  ];
  const input = { hand, contract: { roundNumber: 1 as const, sets: 2, runs: 0 }, playerId: "p0", limit: 3 };
  const legacy = findLayDownCandidates(input);
  const distinct = findLayDownCandidates({ ...input, distinctResidualHands: true });
  const signatures = distinct.map((option) => hand.filter(c => option.remainingCardIds.includes(c.id)).map(face).sort().join(","));
  expect(distinct[0]).toEqual(legacy[0]);
  expect(new Set(signatures).size).toBe(distinct.length);
  expect(distinct).toHaveLength(3);
});

it("shows alternative contracts neutrally and verifies every displayed option with the engine", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural");
  if (!scenario) throw new Error("Missing contract comparison fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const snapshot = await runtime.getSnapshot();
    const baseline = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId);
    const rendered = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options" });
    expect(baseline).toContain("EXACT CONTRACT AVAILABLE:");
    expect(baseline).toContain("CALL lay_down");
    expect(rendered).toContain("CONTRACT OPTIONS");
    expect(rendered).not.toContain("CALL lay_down");
    expect(rendered).not.toContain("PROTECT FOR FUTURE LAYOFFS");
    expect(rendered).toContain("not strategic ranking");
    expect(rendered).toContain("not guaranteed");
    const groups = [...rendered.matchAll(/Option \d+: lay_down melds (\[\[.*?\]\])/g)];
    expect(groups).toHaveLength(2);
    for (const match of groups) {
      if (!match[1]) throw new Error("Missing option groups");
      const replay = await createAIPlayerRolloutHistory(scenario, 1);
      try {
        const state = replay.createRuntime(scenario.evaluatedPlayerId);
        const tools = createMayITools(state.runtime, scenario.evaluatedPlayerId);
        if (!tools.lay_down.execute) throw new Error("Missing laydown executor");
        const result = await tools.lay_down.execute({ melds: JSON.parse(match[1]) }, { toolCallId: "verify-option", messages: [], context: {} });
        expect(result).toMatchObject({ success: true });
      } finally { replay.actor.stop(); }
    }
    const hiddenVariant = structuredClone(snapshot);
    const opponent = hiddenVariant.players.find(p => p.id !== scenario.evaluatedPlayerId);
    const held = opponent?.hand[0];
    const stock = hiddenVariant.stock[0];
    if (!opponent || !held || !stock) throw new Error("Missing hidden cards");
    opponent.hand[0] = stock;
    hiddenVariant.stock[0] = held;
    expect(outputGameStateForLLM(hiddenVariant, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options" })).toBe(rendered);
  } finally { history.actor.stop(); }
});

it("retains selected presentation in successful and rejected tool results", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural");
  if (!scenario) throw new Error("Missing contract comparison fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const tools = createMayITools(runtime, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options" });
    if (!tools.organize_hand.execute || !tools.discard.execute) throw new Error("Missing executor");
    const success = await tools.organize_hand.execute({ order: "suit" }, { toolCallId: "organize-options", messages: [], context: {} });
    expect(success).toMatchObject({ success: true, gameState: expect.stringContaining("CONTRACT OPTIONS") });
    const failure = await tools.discard.execute({ position: 99 }, { toolCallId: "reject-options", messages: [], context: {} });
    expect(failure).toMatchObject({ success: false, gameState: expect.stringContaining("CONTRACT OPTIONS") });
    expect(JSON.stringify(await runtime.getSnapshot())).not.toContain("CONTRACT OPTIONS");
  } finally { history.actor.stop(); }
});
