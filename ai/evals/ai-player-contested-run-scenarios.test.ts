import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { AI_PLAYER_CONTESTED_RUN_SCENARIOS } from "./ai-player-contested-run-scenarios";
import { evaluateHand5DiscardCoverage } from "./ai-player-hand5-draw-coverage";
import {
  getAIPlayerFixedStateInputForRepetition,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import type { GameAction } from "../ai-action-runtime.types";

describe("contested runs from actual public pickups", () => {
  it("does not require the candidate to skip a ready contract in the public prelude", async () => {
    for (const scenario of AI_PLAYER_CONTESTED_RUN_SCENARIOS) {
      const history = await createAIPlayerRolloutHistory({
        ...scenario,
        historyPrelude: [],
      });
      try {
        for (const step of scenario.historyPrelude ?? []) {
          if (
            step.playerId === scenario.evaluatedPlayerId &&
            step.action.type === "SKIP"
          ) {
            const hand = projectAIPlayerFixedStateSnapshot(history.actor)
              .players[0]!.hand;
            const ready = findLayDownCandidates({
              hand,
              contract: { roundNumber: 5, sets: 2, runs: 1 },
              playerId: step.playerId,
              limit: Number.MAX_SAFE_INTEGER,
            }).filter((candidate) =>
              candidate.positionGroups.every(
                (group, index) => group.length === (index < 2 ? 3 : 4),
              ),
            );
            expect(ready, scenario.identity.id).toHaveLength(0);
          }
          const result = await history
            .createRuntime(step.playerId)
            .runtime.executeAction(step.action);
          expect(result.ok, scenario.identity.id).toBe(true);
        }
      } finally {
        history.actor.stop();
      }
    }
  });

  it("starts from a complete legal deal and replays older pickup evidence without hiding disposal", async () => {
    expect(
      AI_PLAYER_CONTESTED_RUN_SCENARIOS.filter(
        (s) => s.identity.split === "development",
      ),
    ).toHaveLength(4);
    expect(
      AI_PLAYER_CONTESTED_RUN_SCENARIOS.filter(
        (s) => s.identity.split === "holdout",
      ),
    ).toHaveLength(2);
    for (const scenario of AI_PLAYER_CONTESTED_RUN_SCENARIOS) {
      const initial = scenario.input.predefinedState!;
      const cards = [
        ...initial.hands.flat(),
        ...initial.stock,
        ...initial.discard,
      ];
      expect(initial.hands.map((hand) => hand.length)).toEqual([11, 11, 11]);
      expect(initial.table ?? []).toEqual([]);
      expect(new Set(cards.map((card) => card.id)).size).toBe(108);
      const inventory = (cards: typeof initial.stock) =>
        cards.map((card) => `${card.rank}:${card.suit}`).sort();
      expect(inventory(cards)).toEqual(
        inventory(createDeck({ deckCount: 2, jokerCount: 4 })),
      );
      const history = await createAIPlayerRolloutHistory(scenario);
      try {
        const root = projectAIPlayerFixedStateSnapshot(history.actor);
        expect(root.players.map((player) => player.hand.length)).toEqual([
          12, 11, 11,
        ]);
        expect(root.players.every((player) => !player.isDown)).toBe(true);
        const log = history.getActionLog();
        expect(log).toHaveLength(17);
        expect(log[0]?.action).toBe("took from discard");
        expect(
          root.players[1]!.hand.filter((card) =>
            card.id.startsWith("known-pickup"),
          ),
        ).toHaveLength(2);
        expect(
          inventory(scenario.diagnostics.publiclyKnownOutsideHand),
        ).toEqual(
          inventory([
            ...root.discard,
            ...root.players[1]!.hand.filter((card) =>
              card.id.startsWith("known-pickup"),
            ),
          ]),
        );
        const observation = outputGameStateForLLM(
          root,
          scenario.evaluatedPlayerId,
          { actionLog: log },
        );
        expect(observation).not.toContain("future-draw");
        expect(observation).not.toContain("completingDrawCount");
        const changedPrivate = structuredClone(root);
        changedPrivate.stock.reverse();
        changedPrivate.players
          .slice(1)
          .forEach((player) => player.hand.reverse());
        expect(
          outputGameStateForLLM(changedPrivate, scenario.evaluatedPlayerId, {
            actionLog: log,
          }),
        ).toBe(observation);
      } finally {
        history.actor.stop();
      }
    }
  });

  for (const scenario of AI_PLAYER_CONTESTED_RUN_SCENARIOS) {
    it(`${scenario.identity.id}: has legal full-credit references for four repetitions without running holdout models`, async () => {
      for (const repetition of [1, 2, 3, 4]) {
        const result = await runAIPlayerShortRolloutReference({
          ...scenario,
          input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
        });
        expect(result.completed, scenario.identity.id).toBe(true);
        expect(result.legal, scenario.identity.id).toBe(true);
        expect(result.qualityPercent, scenario.identity.id).toBe(100);
        expect(result.finalSnapshot.players[0]!.isDown).toBe(true);
        expect(result.candidateTurns).toBe(2);
      }
    });
  }

  it("grades the opposite commitment as an inferior legal line, even with a lucky wild draw", async () => {
    for (const scenario of AI_PLAYER_CONTESTED_RUN_SCENARIOS) {
      const { rootHand, futureDraw, inferiorDiscardId } = scenario.diagnostics;
      const nextHand = [
        ...rootHand.filter((card) => card.id !== inferiorDiscardId),
        futureDraw,
      ];
      const contract = findLayDownCandidates({
        hand: nextHand,
        contract: { roundNumber: 5, sets: 2, runs: 1 },
        playerId: scenario.evaluatedPlayerId,
        limit: Number.MAX_SAFE_INTEGER,
      }).find((candidate) =>
        candidate.positionGroups.every(
          (group, index) => group.length === (index < 2 ? 3 : 4),
        ),
      );
      const actions: GameAction[] = [{ type: "DRAW_FROM_STOCK" }];
      if (contract) {
        actions.push({
          type: "LAY_DOWN",
          melds: contract.positionGroups.map((positions, index) => ({
            type: index < 2 ? "set" : "run",
            cardIds: positions.map((position) => nextHand[position - 1]!.id),
          })),
        });
        actions.push({
          type: "DISCARD",
          cardId: contract.remainingCardIds[0]!,
        });
      } else
        actions.push(
          { type: "SKIP" },
          { type: "DISCARD", cardId: futureDraw.id },
        );
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map((decision, index) =>
          index === 0
            ? {
                ...decision,
                actions: [
                  { type: "SKIP" },
                  { type: "DISCARD", cardId: inferiorDiscardId },
                ],
              }
            : decision.kind === "candidate-turn"
              ? { ...decision, actions }
              : decision,
        ),
      });
      expect(result.completed, scenario.identity.id).toBe(true);
      expect(result.legal, scenario.identity.id).toBe(true);
      expect(result.qualityPercent, scenario.identity.id).toBe(
        futureDraw.rank === "Joker" ? 50 : 0,
      );
      expect(
        result.criteria.find(
          (criterion) => criterion.id === "convert-next-turn-contract",
        )?.evidence,
      ).toBe(
        futureDraw.rank === "Joker"
          ? "Candidate contract laid down by the second own turn under the declared continuation."
          : "Candidate contract not laid down by the second own turn under the declared continuation.",
      );
      expect(result.attempts.every((attempt) => attempt.ok)).toBe(true);
    }
  });

  for (const scenario of AI_PLAYER_CONTESTED_RUN_SCENARIOS) {
    it(`${scenario.identity.id}: checks physical completion counts independently of one favorable future draw`, () => {
      const d = scenario.diagnostics;
      const coverage = evaluateHand5DiscardCoverage({
        hand: d.rootHand,
        visibleOutsideHand: d.publiclyKnownOutsideHand,
      });
      expect(coverage.unseenCardCount).toBe(87);
      expect(coverage.immediateContractAvailable).toBe(false);
      expect(coverage.bestDiscardCardIds).toContain(d.referenceDiscardId);
      expect(
        coverage.candidates.find(
          (c) => c.discardCardId === d.referenceDiscardId,
        )?.completingDrawCount,
      ).toBe(d.expectedBestCount);
      expect(
        coverage.candidates.find((c) => c.discardCardId === d.inferiorDiscardId)
          ?.completingDrawCount,
      ).toBe(d.expectedOtherCount);
    });
  }
});
