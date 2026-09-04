import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import { calculateHandScore } from "../../core/scoring/scoring";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";
import {
  getAIPlayerFixedStateInputForRepetition,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_SHARED_RUN_SCENARIOS } from "./ai-player-shared-run-scenarios";

describe("shared-run timing versus a publicly retained opponent card", () => {
  it("conserves the physical deck and supplies an uncompressed legal public prelude", async () => {
    expect(AI_PLAYER_SHARED_RUN_SCENARIOS).toHaveLength(3);
    for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS) {
      const input = scenario.input.predefinedState!;
      const cards = [
        ...input.hands.flat(),
        ...input.stock,
        ...input.discard,
        ...(input.table ?? []).flatMap((meld) => meld.cards),
      ];
      const inventory = (cards: typeof input.stock) =>
        cards.map((card) => `${card.rank}:${card.suit}`).sort();
      expect(new Set(cards.map((card) => card.id)).size).toBe(108);
      expect(inventory(cards)).toEqual(
        inventory(createDeck({ deckCount: 2, jokerCount: 4 })),
      );
      expect(input.hands.map((hand) => hand.length)).toEqual([4, 11, 4]);
      const state = await createAIPlayerRolloutHistory(scenario);
      try {
        const root = projectAIPlayerFixedStateSnapshot(state.actor);
        expect(root.players.map((player) => player.hand.length)).toEqual([
          3, 1, 4,
        ]);
        expect(root.players.every((player) => player.isDown)).toBe(true);
        expect(root.players[1]!.hand[0]!.id).toBe("known-4s");
        const log = state.getActionLog();
        expect(log.length).toBeGreaterThan(10);
        expect(log[0]).toMatchObject({
          action: "took from discard",
          details: "4♠",
        });
        expect(
          log.slice(1).some((entry) => entry.details?.includes("4♠")),
        ).toBe(false);
        const visible = outputGameStateForLLM(
          root,
          scenario.evaluatedPlayerId,
          { actionLog: log },
        );
        expect(visible).toContain("took from discard 4♠");
        expect(visible).not.toContain("future-draw");
        expect(visible).not.toContain("withhold");
      } finally {
        state.actor.stop();
      }
    }
  });

  it("has legal outcome-based references across all four hand permutations", async () => {
    for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS) {
      for (const repetition of [1, 2, 3, 4]) {
        const result = await runAIPlayerShortRolloutReference({
          ...scenario,
          input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
        });
        expect(result.completed, scenario.identity.id).toBe(true);
        expect(result.legal, scenario.identity.id).toBe(true);
        expect(result.qualityPercent, scenario.identity.id).toBe(100);
        expect(result.winnerPlayerId).toBe("eval-player-0");
      }
    }
  });

  it("keeps canonical first observations identical across hidden future-draw branches", async () => {
    // Later repetitions use scenario-ID-keyed hand orders, not paired branch orders.
    const observations: string[] = [];
    for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS.slice(0, 2)) {
      const history = await createAIPlayerRolloutHistory(scenario);
      try {
        observations.push(
          outputGameStateForLLM(
            projectAIPlayerFixedStateSnapshot(history.actor),
            scenario.evaluatedPlayerId,
            { actionLog: history.getActionLog() },
          ),
        );
      } finally {
        history.actor.stop();
      }
    }
    expect(observations[0]).toEqual(observations[1]);
  });

  it("accepts the alternate liability discard when the bridge is retained", async () => {
    for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS.slice(0, 2)) {
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map(
          (decision, index) => ({
            ...decision,
            actions: decision.actions.map((action) =>
              action.type !== "DISCARD" || decision.kind !== "candidate-turn"
                ? action
                : {
                    ...action,
                    cardId: index === 0 ? "candidate-other" : "root-draw",
                  },
            ),
          }),
        ),
      });
      expect(result.completed).toBe(true);
      expect(result.legal).toBe(true);
      expect(result.qualityPercent).toBe(100);
      expect(result.winnerPlayerId).toBe("eval-player-0");
    }
  });

  it("grades premature bridging as a completed legal loss, not a failed model turn", async () => {
    for (const scenario of AI_PLAYER_SHARED_RUN_SCENARIOS.slice(0, 2)) {
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map((decision, index) =>
          index === 0
            ? {
                ...decision,
                actions: [
                  {
                    type: "LAY_OFF" as const,
                    cardId: "candidate-5s",
                    meldId: "public-spades",
                    position: "start" as const,
                  },
                  { type: "DISCARD" as const, cardId: "root-draw" },
                ],
              }
            : decision,
        ),
      });
      expect(result.completed).toBe(true);
      expect(result.legal).toBe(true);
      expect(result.qualityPercent).toBe(0);
      expect(result.winnerPlayerId).toBe("eval-player-1");
      expect(result.candidateTurns).toBe(1);
      expect(result.attempts.every((attempt) => attempt.ok)).toBe(true);
      expect(calculateHandScore(result.finalSnapshot.players[0]!.hand)).toBe(
        10,
      );
    }
  });

  it("does not reward withholding when the candidate can win immediately", async () => {
    const scenario = AI_PLAYER_SHARED_RUN_SCENARIOS[2]!;
    const result = await runAIPlayerShortRolloutReference({
      ...scenario,
      referenceSequence: [
        {
          ...scenario.referenceSequence[0]!,
          actions: [
            {
              type: "LAY_OFF",
              cardId: "candidate-other",
              meldId: "public-clubs",
            },
            { type: "DISCARD", cardId: "root-draw" },
          ],
        },
      ],
    });
    expect(result.completed).toBe(true);
    expect(result.legal).toBe(true);
    expect(result.qualityPercent).toBe(0);
  });

  it("the premature bridge exposes a certain exit without revealing the next private draw", async () => {
    const state = await createAIPlayerRolloutHistory(
      AI_PLAYER_SHARED_RUN_SCENARIOS[0]!,
    );
    try {
      const candidate = state.createRuntime("eval-player-0");
      expect(
        (
          await candidate.runtime.executeAction({
            type: "LAY_OFF",
            cardId: "candidate-5s",
            meldId: "public-spades",
            position: "start",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await candidate.runtime.executeAction({
            type: "DISCARD",
            cardId: "root-draw",
          })
        ).ok,
      ).toBe(true);
      const opponent = state.createRuntime("eval-player-1");
      expect(
        (await opponent.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok,
      ).toBe(true);
      expect(
        (
          await opponent.runtime.executeAction({
            type: "LAY_OFF",
            cardId: "known-4s",
            meldId: "public-spades",
            position: "start",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await opponent.runtime.executeAction({
            type: "DISCARD",
            cardId: "next-p1-draw",
          })
        ).ok,
      ).toBe(true);
      const end = projectAIPlayerFixedStateSnapshot(state.actor);
      expect(end.phase).toBe("ROUND_END");
      expect(calculateHandScore(end.players[0]!.hand)).toBe(10);
    } finally {
      state.actor.stop();
    }
  });
});
