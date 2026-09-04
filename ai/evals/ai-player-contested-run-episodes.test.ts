import { describe, expect, it } from "bun:test";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import type { GameAction } from "../ai-action-runtime.types";
import { AI_PLAYER_CONTESTED_RUN_EPISODES } from "./ai-player-contested-run-episodes";
import { AI_PLAYER_CONTESTED_RUN_SCENARIOS } from "./ai-player-contested-run-scenarios";
import { AIPlayerRolloutDecisionRecorder } from "./ai-player-rollout-decision-evidence";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { resolveAIPlayerRolloutActions } from "./ai-player-rollout-policy";
import { getAIPlayerFixedStateInputForRepetition, projectAIPlayerFixedStateSnapshot } from "./ai-player-fixed-state-scenarios";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS, runAIPlayerShortRolloutReference, scoreAIPlayerShortRolloutCriteria } from "./ai-player-short-rollout-scenarios";
import type { AIPlayerShortRolloutDecisionRecord, AIPlayerShortRolloutScenario } from "./ai-player-short-rollout-scenario";
import type { AIPlayerFixedStateAttempt } from "./ai-player-fixed-state-scenarios";

// Legal engine controls, not substitute LLM responses. Final action choices are
// constructed only after observing the actual draw, including shifted stocks.
async function playBranch(scenario: AIPlayerShortRolloutScenario, choices: {
  firstDiscard: string;
  secondDiscard: string;
  firstDraw?: "DRAW_FROM_STOCK" | "DRAW_FROM_DISCARD";
  skipConversion?: boolean;
}) {
  const history = await createAIPlayerRolloutHistory(scenario);
  const decisions: AIPlayerShortRolloutDecisionRecord[] = [];
  const candidateAttempts: AIPlayerFixedStateAttempt[] = [];
  try {
    for (const step of scenario.referenceSequence) {
      const state = history.createRuntime(step.playerId);
      if (step.kind === "opponent-script") {
        for (const action of resolveAIPlayerRolloutActions(step, projectAIPlayerFixedStateSnapshot(history.actor)))
          expect((await state.runtime.executeAction(action)).ok).toBe(true);
        continue;
      }
      const recorder = new AIPlayerRolloutDecisionRecorder(step.playerId);
      const runtime = recorder.wrap(state.runtime);
      expect((await runtime.executeAction({ type: decisions.length === 0 ? choices.firstDraw ?? "DRAW_FROM_STOCK" : "DRAW_FROM_STOCK" })).ok).toBe(true);
      const hand = (await runtime.getSnapshot()).players[0]!.hand;
      const actions: GameAction[] = [];
      if (decisions.length < 2) {
        actions.push({ type: "SKIP" }, { type: "DISCARD", cardId: decisions.length === 0 ? choices.firstDiscard : choices.secondDiscard });
      } else {
        const contract = findLayDownCandidates({ hand, contract: { roundNumber: 5, sets: 2, runs: 1 }, playerId: step.playerId, limit: Number.MAX_SAFE_INTEGER })
          .find(candidate => candidate.positionGroups.every((group, index) => group.length === (index < 2 ? 3 : 4)));
        if (contract && !choices.skipConversion) {
          actions.push({ type: "LAY_DOWN", melds: contract.positionGroups.map((positions, index) => ({ type: index < 2 ? "set" : "run", cardIds: positions.map(position => hand[position - 1]!.id) })) });
          actions.push({ type: "DISCARD", cardId: contract.remainingCardIds[0]! });
        } else actions.push({ type: "SKIP" }, { type: "DISCARD", cardId: hand.at(-1)!.id });
      }
      for (const action of actions) expect((await runtime.executeAction(action)).ok).toBe(true);
      candidateAttempts.push(...state.attempts);
      decisions.push({ playerId: step.playerId, kind: step.kind, success: true, actionEvidence: recorder.evidence });
    }
    const snapshot = projectAIPlayerFixedStateSnapshot(history.actor);
    const criteria = scenario.grade({ snapshot, decisions, candidateAttempts });
    return { decisions, criteria, qualityPercent: scoreAIPlayerShortRolloutCriteria(criteria), snapshot };
  } finally { history.actor.stop(); }
}

describe("three-turn public-availability episodes", () => {
  it("moves a real earlier own turn into development without changing holdouts or adding family weight", async () => {
    expect(AI_PLAYER_CONTESTED_RUN_EPISODES).toHaveLength(6);
    for (const episode of AI_PLAYER_CONTESTED_RUN_EPISODES) {
      const original = AI_PLAYER_CONTESTED_RUN_SCENARIOS.find(s => s.identity.id === episode.identity.id)!;
      expect(AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(s => s.identity.id === episode.identity.id)).toBe(episode);
      if (episode.identity.split === "holdout") { expect(episode).toBe(original); continue; }
      expect(episode.maxModelDecisions).toBe(3);
      expect(episode.historyPrelude).toEqual(original.historyPrelude!.slice(0, 15));
      const history = await createAIPlayerRolloutHistory(episode);
      try {
        const root = projectAIPlayerFixedStateSnapshot(history.actor);
        expect(root.turnNumber).toBe(6);
        expect(root.turnPhase).toBe("AWAITING_DRAW");
        expect(root.players.map(player => player.hand.length)).toEqual([11, 11, 11]);
        const prompt = outputGameStateForLLM(root, episode.evaluatedPlayerId, { actionLog: history.getActionLog() });
        expect(prompt).not.toContain("future-draw");
        expect(prompt).not.toContain("completingDrawCount");
        const hiddenPermutation = structuredClone(root);
        hiddenPermutation.stock.reverse();
        hiddenPermutation.players.slice(1).forEach(player => player.hand.reverse());
        expect(outputGameStateForLLM(hiddenPermutation, episode.evaluatedPlayerId, { actionLog: history.getActionLog() })).toBe(prompt);
      } finally { history.actor.stop(); }
    }
  });

  for (const episode of AI_PLAYER_CONTESTED_RUN_EPISODES.filter(s => s.identity.split === "development")) {
    it(`${episode.identity.id}: full credit is legally attainable in four deal-order repetitions`, async () => {
      for (const repetition of [1, 2, 3, 4]) {
        const result = await runAIPlayerShortRolloutReference({ ...episode, input: getAIPlayerFixedStateInputForRepetition(episode, repetition) });
        expect(result.legal).toBe(true);
        expect(result.completed).toBe(true);
        expect(result.qualityPercent).toBe(100);
        expect(result.modelDecisions).toBe(3);
        expect(result.decisions.map(d => d.actionEvidence?.[0]?.before.turnNumber)).toEqual([6, 9, 12]);
      }
    });

    it(`${episode.identity.id}: distinguishes later choices with exactly the same earlier action prefix`, async () => {
      const original = AI_PLAYER_CONTESTED_RUN_SCENARIOS.find(s => s.identity.id === episode.identity.id)!;
      const good = await playBranch(episode, { firstDiscard: "prelude-p0-draw-2", secondDiscard: original.diagnostics.referenceDiscardId });
      const bad = await playBranch(episode, { firstDiscard: "prelude-p0-draw-2", secondDiscard: original.diagnostics.inferiorDiscardId });
      expect(good.decisions[0]).toEqual(bad.decisions[0]);
      expect(good.qualityPercent).toBe(100);
      expect(bad.qualityPercent).toBe(original.diagnostics.futureDraw.rank === "Joker" ? 50 : 0);
      expect(good.criteria[0]?.passed).toBe(true);
      expect(bad.criteria[0]?.passed).toBe(false);
    });
  }

  it("preserves a legal discard-pile draw branch and adapts opponent discards to the actual stock", async () => {
    const episode = AI_PLAYER_CONTESTED_RUN_EPISODES[0]!;
    const branch = await playBranch(episode, { firstDraw: "DRAW_FROM_DISCARD", firstDiscard: "prelude-p2-draw-2", secondDiscard: "prelude-p2-draw-3" });
    expect(branch.decisions).toHaveLength(3);
    const second = branch.decisions[1]!.actionEvidence!;
    expect(second[0]!.after.hand.some(card => card.id === "prelude-p2-draw-3")).toBe(true);
    expect(second[0]!.after.hand.some(card => card.id === "candidate-7-diamonds")).toBe(false);
    expect(branch.criteria[0]?.passed).toBe(true);
    expect(branch.criteria[1]?.passed).toBe(false);
  });

  it("distinguishes no conversion opportunity from failing to use an available contract", async () => {
    const stronger = AI_PLAYER_CONTESTED_RUN_EPISODES.find(s => s.identity.id === "contested-run-stronger-diamonds")!;
    const unlucky = await playBranch(stronger, { firstDiscard: "candidate-5-diamonds", secondDiscard: "prelude-p0-draw-2" });
    expect(unlucky.criteria[0]?.passed).toBe(true);
    expect(unlucky.criteria[1]?.passed).toBe(false);
    expect(unlucky.criteria[1]?.evidence).toContain("conversion opportunity=false");
    expect(unlucky.criteria[1]?.measurements?.missedConversionOpportunity).toBe(false);
    const natural = AI_PLAYER_CONTESTED_RUN_EPISODES[0]!;
    const original = AI_PLAYER_CONTESTED_RUN_SCENARIOS[0]!;
    const missed = await playBranch(natural, { firstDiscard: "prelude-p0-draw-2", secondDiscard: original.diagnostics.referenceDiscardId, skipConversion: true });
    expect(missed.criteria[0]?.passed).toBe(true);
    expect(missed.criteria[1]?.passed).toBe(false);
    expect(missed.criteria[1]?.evidence).toContain("conversion opportunity=true");
    expect(missed.criteria[1]?.measurements?.missedConversionOpportunity).toBe(true);
  });

  it("reports inherited destruction separately from zero-regret discarding when no live route survives", async () => {
    const branch = await playBranch(AI_PLAYER_CONTESTED_RUN_EPISODES[0]!, { firstDiscard: "candidate-Q-clubs", secondDiscard: "prelude-p0-draw-2" });
    expect(branch.criteria[0]?.passed).toBe(false);
    expect(branch.criteria[0]?.description).toContain("positive");
    expect(branch.criteria[0]?.measurements).toMatchObject({ chosenCompletingDraws: 0, bestCompletingDraws: 0, coverageRegret: 0, positiveCoverageAvailable: false });
    expect(branch.qualityPercent).toBe(0);
  });

  it("does not turn missing final-decision evidence into a claim that no contract was available", async () => {
    const episode = AI_PLAYER_CONTESTED_RUN_EPISODES[0]!;
    const result = await runAIPlayerShortRolloutReference(episode);
    const decisions = result.decisions.map((decision, index) => index === 2 ? { ...decision, actionEvidence: undefined } : decision);
    const criteria = episode.grade({ snapshot: result.finalSnapshot, candidateAttempts: result.attempts.filter(attempt => attempt.kind !== "opponent-script"), decisions });
    expect(criteria[1]?.passed).toBe(false);
    expect(criteria[1]?.measurements).toMatchObject({ exactContractAvailableOnFinalTurn: null, missedConversionOpportunity: null, finalDrawObserved: false });
  });

  it("gates incomplete reference episodes the same way as incomplete model episodes", async () => {
    const episode = AI_PLAYER_CONTESTED_RUN_EPISODES[0]!;
    const result = await runAIPlayerShortRolloutReference({ ...episode, referenceSequence: episode.referenceSequence.slice(0, 6) });
    expect(result.legal).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.criteria[0]?.passed).toBe(true);
    expect(result.qualityPercent).toBe(0);
  });

  it("recognizes an early exact contract and penalizes skipping it without requiring the original root", async () => {
    const original = AI_PLAYER_CONTESTED_RUN_EPISODES[0]!;
    const input = structuredClone(original.input);
    const stock = input.predefinedState!.stock;
    [stock[6], stock[9]] = [stock[9]!, stock[6]!];
    const episode = { ...original, input };
    const skipped = await playBranch(episode, { firstDiscard: "prelude-p0-draw-2", secondDiscard: "candidate-6-diamonds" });
    expect(skipped.criteria[0]?.passed).toBe(false);
    expect(skipped.criteria[0]?.measurements?.skippedReadyContract).toBe(true);
    expect(skipped.criteria[1]?.passed).toBe(true);
    const finalDecision = original.referenceSequence.at(-1)!;
    const early = await runAIPlayerShortRolloutReference({
      ...episode,
      referenceSequence: original.referenceSequence.map((decision, index) =>
        index === 5 ? { ...decision, actions: finalDecision.actions } :
        index === original.referenceSequence.length - 1 ? { ...decision, actions: [{ type: "DRAW_FROM_STOCK" }, { type: "SKIP" }, { type: "DISCARD", cardId: "candidate-7-diamonds" }] } : decision),
    });
    expect(early.completed).toBe(true);
    expect(early.legal).toBe(true);
    expect(early.qualityPercent).toBe(100);
    expect(early.criteria[0]?.measurements?.exactContractLaidBySecond).toBe(true);
  });
});
