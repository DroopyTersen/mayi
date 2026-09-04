import { expect, it } from "bun:test";
import type { Card } from "../core/card/card.types";
import { renderContractOptions } from "./mayIAgent.contract-options";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";
import { createMayITools } from "./mayIAgent.tools";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { parseAIPlayerShortRolloutRunnerArguments } from "./evals/ai-player-short-rollout-runner";

function optionBlocks(text: string): string[] {
  return [...text.matchAll(/  Option \d+: ([^\n]+)(\n    Individual later-turn fits[^\n]+)?/g)]
    .map(match => `${match[1]}${match[2] ?? ""}`);
}

it("reverses only the admitted option blocks, without changing the three-candidate set or facts", () => {
  const hand: Card[] = [
    ...["hearts", "hearts", "diamonds", "diamonds", "clubs", "clubs"].map((suit, index) => ({ id: `nine-${index}`, rank: "9" as const, suit: suit as Card["suit"] })),
    ...["hearts", "diamonds", "clubs"].map((suit, index) => ({ id: `seven-${index}`, rank: "7" as const, suit: suit as Card["suit"] })),
    { id: "king", rank: "K", suit: "spades" },
  ];
  const input = { hand, contract: { roundNumber: 1 as const, sets: 2, runs: 0 }, playerId: "p0", table: [], meldNumbers: new Map<string, number>() };
  const before = structuredClone(hand);
  const normal = renderContractOptions(input).join("\n");
  const reversed = renderContractOptions({ ...input, order: "reversed" }).join("\n");
  expect(optionBlocks(normal)).toHaveLength(3);
  expect(optionBlocks(reversed)).toEqual(optionBlocks(normal).toReversed());
  expect(reversed).not.toBe(normal);
  const withoutOptions = (text: string) => text.replace(/  Option \d+: [^\n]+(\n    Individual later-turn fits[^\n]+)?\n/g, "");
  expect(withoutOptions(reversed)).toBe(withoutOptions(normal));
  expect(hand).toEqual(before);
  expect(renderContractOptions(input).join("\n")).toBe(normal);

  for (const smaller of [hand.slice(0, 6), hand.slice(0, 2)]) {
    const minimal = { ...input, hand: smaller };
    const ordinary = renderContractOptions(minimal).join("\n");
    expect(optionBlocks(ordinary).length).toBeLessThanOrEqual(1);
    expect(renderContractOptions({ ...minimal, order: "reversed" }).join("\n")).toBe(ordinary);
  }
});

it("preserves reversed two-option presentation after organization and rejected requests, without hidden-card dependence", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural");
  if (!scenario) throw new Error("Missing contract fixture");
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const snapshot = await runtime.getSnapshot();
    const normal = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options" });
    const reversed = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options-reversed" });
    expect(optionBlocks(normal)).toHaveLength(2);
    expect(optionBlocks(reversed)).toEqual(optionBlocks(normal).toReversed());
    expect(reversed).not.toContain("CALL lay_down");
    const hidden = structuredClone(snapshot);
    const opponent = hidden.players.find(player => player.id !== scenario.evaluatedPlayerId);
    const held = opponent?.hand[0], stock = hidden.stock[0];
    if (!opponent || !held || !stock) throw new Error("Missing hidden cards");
    opponent.hand[0] = stock; hidden.stock[0] = held;
    expect(outputGameStateForLLM(hidden, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options-reversed" })).toBe(reversed);

    const tools = createMayITools(runtime, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options-reversed" });
    if (!tools.organize_hand.execute || !tools.discard.execute) throw new Error("Missing real tools");
    const options = { toolCallId: "order-check", messages: [], context: {} };
    const organized = await tools.organize_hand.execute({ order: "suit" }, options);
    const after = await runtime.getSnapshot();
    const afterNormal = outputGameStateForLLM(after, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options" });
    const afterReversed = outputGameStateForLLM(after, scenario.evaluatedPlayerId, { tacticalPresentation: "contract-options-reversed" });
    expect(optionBlocks(afterReversed)).toEqual(optionBlocks(afterNormal).toReversed());
    expect(organized).toMatchObject({ success: true, gameState: afterReversed });
    const rejected = await tools.discard.execute({ position: 99 }, options);
    expect(rejected).toMatchObject({ success: false, message: "Card position out of range" });
    if (!rejected || typeof rejected !== "object" || !("gameState" in rejected) || typeof rejected.gameState !== "string") {
      throw new Error("Missing rejection state");
    }
    expect(optionBlocks(rejected.gameState)).toEqual(optionBlocks(afterReversed));
  } finally { history.actor.stop(); }
});

it("selects reversed presentation explicitly without changing the runner defaults or enabling other experiments", () => {
  const selected = parseAIPlayerShortRolloutRunnerArguments(["--tactical-presentation", "contract-options-reversed"]);
  expect(selected.tacticalPresentation).toBe("contract-options-reversed");
  expect(selected.scratchpad).toBeUndefined();
  expect(selected.promptExperiment).toBeUndefined();
  expect(selected.candidateId).toBe("spark-low");
  expect(parseAIPlayerShortRolloutRunnerArguments([]).tacticalPresentation).toBeUndefined();
});
