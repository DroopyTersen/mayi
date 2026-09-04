import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  getAIPlayerFixedStateInputForRepetition,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_LAYOFF_HORIZON_SCENARIOS } from "./ai-player-layoff-horizon-scenarios";
import { createAIPlayerRolloutHistory } from "./ai-player-rollout-history";

describe("contract choice versus public opponent horizon", () => {
  it("conserves108 cards and replays the public-history prelude legally", async () => {
    for (const scenario of AI_PLAYER_LAYOFF_HORIZON_SCENARIOS) {
      const state = scenario.input.predefinedState!;
      const cards = [
        ...state.hands.flat(),
        ...state.stock,
        ...state.discard,
        ...(state.table ?? []).flatMap((meld) => meld.cards),
      ];
      const inventory = (cards: typeof state.stock) =>
        cards.map((card) => `${card.rank}:${card.suit}`).sort();
      expect(new Set(cards.map((card) => card.id)).size).toBe(108);
      expect(inventory(cards)).toEqual(
        inventory(createDeck({ deckCount: 2, jokerCount: 4 })),
      );
      const actor = createAIPlayerFixedStateActor({
        identity: scenario.identity,
        input: scenario.input,
      });
      try {
        for (const step of scenario.historyPrelude) {
          const { runtime } = createAIPlayerFixedStateActorRuntime(
            actor,
            step.playerId,
          );
          expect(
            (await runtime.executeAction(step.action)).ok,
            JSON.stringify(step),
          ).toBe(true);
        }
        const root = projectAIPlayerFixedStateSnapshot(actor);
        expect(root.players[0]?.hand).toHaveLength(12);
        expect(root.players[1]?.hand).toHaveLength(
          scenario.identity.id.includes("known-exit") ? 1 : 3,
        );
        expect(
          root.players[1]?.hand.some((card) => card.id === "public-pickup-9s"),
        ).toBe(true);
        const plans = findLayDownCandidates({
          hand: root.players[0]!.hand,
          contract: root.contract,
          playerId: "eval-player-0",
          limit: 100,
        });
        expect(plans).toHaveLength(2);
        expect(
          plans.every(
            (plan) =>
              plan.positionGroups
                .map((group) => group.length)
                .sort()
                .join(",") === "3,4",
          ),
        ).toBe(true);
        expect(scenario.actionLog).toBeUndefined();
        const recorded = await createAIPlayerRolloutHistory(scenario);
        try {
          const visible = outputGameStateForLLM(root, "eval-player-0", {
            actionLog: recorded.getActionLog(),
          });
          expect(visible).toContain("took from discard 9♠");
          expect(visible).toContain("laid off at start 4♣");
          expect(visible).toContain("laid off at start 3♣");
          expect(visible).toContain("laid off Q♠");
          expect(visible).toContain("discarded K♦");
          expect(visible).not.toContain("known last card");
          expect(recorded.getActionLog()).toHaveLength(15);
        } finally { recorded.actor.stop(); }
      } finally {
        actor.stop();
      }
    }
  });

  it("has full-credit minimum-meld references for four permutations in every branch", async () => {
    expect(AI_PLAYER_LAYOFF_HORIZON_SCENARIOS).toHaveLength(3);
    for (const scenario of AI_PLAYER_LAYOFF_HORIZON_SCENARIOS) {
      for (let repetition = 1; repetition <= 4; repetition++) {
        const result = await runAIPlayerShortRolloutReference({
          ...scenario,
          input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
        });
        expect(result.completed, scenario.identity.id).toBe(true);
        expect(result.legal, scenario.identity.id).toBe(true);
        expect(result.qualityPercent, scenario.identity.id).toBe(100);
      }
    }
  });

  it("rejects opposite contract policies through legal, nonwinning or higher-penalty outcomes", async () => {
    for (const scenario of AI_PLAYER_LAYOFF_HORIZON_SCENARIOS) {
      const urgent = scenario.identity.id.includes("known-exit");
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map((decision, index) =>
          index === 0
            ? {
                ...decision,
                actions: decision.actions.map((action) =>
                  action.type === "LAY_DOWN"
                    ? {
                        ...action,
                        melds: action.melds.map((meld) =>
                          meld.type === "set"
                            ? {
                                ...meld,
                                cardIds: urgent
                                  ? [
                                      "candidate-7c",
                                      "candidate-7d",
                                      "candidate-7h",
                                    ]
                                  : [
                                      "candidate-9c",
                                      "candidate-9d",
                                      "candidate-9h",
                                    ],
                              }
                            : meld,
                        ),
                      }
                    : action,
                ),
              }
            : decision.kind === "candidate-turn"
              ? {
                  ...decision,
                  actions: [
                    { type: "DRAW_FROM_STOCK" },
                    {
                      type: "LAY_OFF",
                      cardId: "candidate-qc",
                      meldId: "public-queens",
                    },
                    { type: "DISCARD", cardId: "candidate-7h" },
                  ],
                }
              : decision,
        ),
      });
      expect(result.completed).toBe(true);
      expect(result.legal).toBe(true);
      expect(result.qualityPercent).toBe(0);
      if (urgent) expect(result.criteria[0]?.evidence).toContain("37");
    }
  });
});
