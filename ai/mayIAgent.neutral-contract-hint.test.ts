import { expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { outputGameStateForLLM } from "./mayIAgent.prompt-renderer";
import { createMayITools } from "./mayIAgent.tools";
import { buildMayICallDecisionPrompt, createMayICallDecisionTools } from "./mayIAgent.may-i-call";
import { createAIPlayerRolloutHistory } from "./evals/ai-player-rollout-history";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./evals/ai-player-short-rollout-scenarios";
import { selectAIPlayerShortRolloutScenarios } from "./evals/ai-player-short-rollout-runner";

// An independent inverse of the explicitly allowed wording changes. Exact
// equality after this mapping checks all other text, positions and facts.
export function restoreImperativeContractWording(text: string): string {
  return text
    .replace("LEGAL CONTRACT EXAMPLE:", "EXACT CONTRACT AVAILABLE:")
    .replace("  lay_down with melds ", "  CALL lay_down with melds ")
    .replace("  One legal example, not a strategic ranking or an exhaustive list.\n", "")
    .replace("CONDITIONAL FUTURE LAYOFFS:", "PROTECT FOR FUTURE LAYOFFS:")
    .replace("  These cards are outside the example contract, so retaining them does not prevent that lay_down.",
      "  These cards are outside the exact contract above, so keeping them does not weaken lay_down.")
    .replace(/  Alternative leftover discard: ([^\n]+)\./, "  Discard $1 instead.")
    .replace("  Every leftover is listed above; a required discard would use one of them.",
      "  Protect them when possible; if every leftover is protected, one is your only discard option.");
}

it("neutralizes only the single contract hint while preserving the legacy default bytes", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural")!;
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const snapshot = await runtime.getSnapshot();
    const before = structuredClone(snapshot);
    const baseline = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId);
    expect(createHash("sha256").update(baseline).digest("hex")).toBe("a47a1ffcc55a0c02f541000e13a37a4b25c505aaeac5182eeeb98cc78f18abf6");
    const neutral = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "neutral-contract-hint" });
    expect(neutral).toContain("LEGAL CONTRACT EXAMPLE:");
    expect(neutral).toContain("not a strategic ranking or an exhaustive list");
    expect(neutral).toContain("CONDITIONAL FUTURE LAYOFFS:");
    expect(neutral).toContain("Alternative leftover discard: K♣.");
    expect(neutral).not.toContain("CALL lay_down");
    expect(neutral).not.toContain("CONTRACT OPTIONS");
    expect(restoreImperativeContractWording(neutral)).toBe(baseline);
    expect(snapshot).toEqual(before);

    // Hidden-card perturbation must not affect either public view.
    const opponent = snapshot.players.find(p => p.id !== scenario.evaluatedPlayerId)!;
    [opponent.hand[0], snapshot.stock[0]] = [snapshot.stock[0]!, opponent.hand[0]!];
    expect(outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "neutral-contract-hint" })).toBe(neutral);

    // All leftovers fitting the table exercises the non-directive fallback.
    const allFit = structuredClone(before);
    const player = allFit.players.find(p => p.id === scenario.evaluatedPlayerId)!;
    const fitting = player.hand.find(c => c.rank === "Q" && c.suit === "clubs")!;
    player.hand = [fitting, ...player.hand.slice(3, 10)];
    const allFitText = outputGameStateForLLM(allFit, player.id, { tacticalPresentation: "neutral-contract-hint" });
    expect(allFitText).toContain("Every leftover is listed above");
    expect(restoreImperativeContractWording(allFitText)).toBe(outputGameStateForLLM(allFit, player.id));
  } finally { history.actor.stop(); }
});

it("preserves every eligible initial view's facts and all no-hint states, including other players", async () => {
  let withHints = 0, withoutHints = 0;
  for (const scenario of selectAIPlayerShortRolloutScenarios(undefined, "development", "all-eligible")) {
    const history = await createAIPlayerRolloutHistory(scenario, 1);
    try {
      const snapshot = await history.createRuntime(scenario.evaluatedPlayerId).runtime.getSnapshot();
      for (const player of snapshot.players) {
        const actionLog = history.getActionLog();
        const baseline = outputGameStateForLLM(snapshot, player.id, { actionLog });
        const neutral = outputGameStateForLLM(snapshot, player.id, { actionLog, tacticalPresentation: "neutral-contract-hint" });
        expect(restoreImperativeContractWording(neutral)).toBe(baseline);
        if (baseline.includes("EXACT CONTRACT AVAILABLE:")) {
          withHints++;
          expect(neutral).toContain("LEGAL CONTRACT EXAMPLE:");
        } else {
          withoutHints++;
          expect(neutral).toBe(baseline);
        }
      }
    } finally { history.actor.stop(); }
  }
  expect(withHints).toBeGreaterThan(0);
  expect(withoutHints).toBeGreaterThan(0);
});

it("propagates the selected view through ordinary and May I tool results and initial prompts", async () => {
  const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === "contract-horizon-safe-natural")!;
  const history = await createAIPlayerRolloutHistory(scenario, 1);
  try {
    const { runtime } = history.createRuntime(scenario.evaluatedPlayerId);
    const tools = createMayITools(runtime, scenario.evaluatedPlayerId, { tacticalPresentation: "neutral-contract-hint" });
    const options = { toolCallId: "neutral-view-check", messages: [], context: {} };
    const organized = await tools.organize_hand.execute!({ order: "suit" }, options);
    expect(organized).toMatchObject({ success: true, gameState: expect.stringContaining("LEGAL CONTRACT EXAMPLE:") });
    const rejected = await tools.discard.execute!({ position: 99 }, options);
    expect(rejected).toMatchObject({ success: false, gameState: expect.stringContaining("LEGAL CONTRACT EXAMPLE:") });
    const snapshot = await runtime.getSnapshot();
    const neutral = outputGameStateForLLM(snapshot, scenario.evaluatedPlayerId, { tacticalPresentation: "neutral-contract-hint" });
    expect(organized).toMatchObject({ gameState: neutral });
    expect(buildMayICallDecisionPrompt(snapshot, scenario.evaluatedPlayerId, [], undefined, "neutral-contract-hint")).toContain(neutral);

    // Using the ordinary actor's state deliberately makes the framing visible
    // in these tool results; CALL_MAY_I is rejected by the actual engine.
    const mayI = createMayICallDecisionTools(runtime, scenario.evaluatedPlayerId, "neutral-contract-hint");
    const pass = await mayI.pass_may_i.execute!({}, options);
    expect(pass).toMatchObject({ success: true, gameState: neutral });
    const invalidCall = await mayI.call_may_i.execute!({}, options);
    expect(invalidCall).toMatchObject({ success: false, gameState: expect.stringContaining("LEGAL CONTRACT EXAMPLE:") });
  } finally { history.actor.stop(); }
});
