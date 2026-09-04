import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import { findLayDownCandidates } from "../mayIAgent.contract-candidates";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { createMayITools } from "../mayIAgent.tools";
import type { GameAction } from "../ai-action-runtime.types";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  getAIPlayerFixedStateInputForRepetition,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS } from "./ai-player-strategic-rollout-scenarios";

describe("strategic Hand 6 short rollouts", () => {
  it("replays the observed wild-branch tools without rejected engine actions", async () => {
    const scenario = AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS[1]!;
    const actor = createAIPlayerFixedStateActor(scenario);
    try {
      const firstState = createAIPlayerFixedStateActorRuntime(
        actor,
        "eval-player-0",
      );
      const firstTools = createMayITools(firstState.runtime, "eval-player-0");
      await firstTools.organize_hand.execute?.({ order: "suit" }, {} as never);
      await firstTools.discard.execute?.({ position: 9 }, {} as never);
      expect(firstState.attempts.filter((attempt) => !attempt.ok)).toEqual([]);
      for (const decision of scenario.referenceSequence.slice(1, 3)) {
        const state = createAIPlayerFixedStateActorRuntime(
          actor,
          decision.playerId,
        );
        for (const action of decision.actions)
          expect((await state.runtime.executeAction(action)).ok).toBe(true);
      }
      const state = createAIPlayerFixedStateActorRuntime(
        actor,
        "eval-player-0",
      );
      const tools = createMayITools(state.runtime, "eval-player-0");
      await tools.draw_from_stock.execute?.({}, {} as never);
      await tools.organize_hand.execute?.({ order: "suit" }, {} as never);
      await tools.lay_down.execute?.(
        {
          melds: [
            [9, 10, 11, 12],
            [1, 2, 3, 4],
            [5, 6, 7, 8],
          ],
        },
        {} as never,
      );
      expect(state.attempts.filter((attempt) => !attempt.ok)).toEqual([]);
      expect(
        projectAIPlayerFixedStateSnapshot(actor).players[0]?.hand,
      ).toHaveLength(0);
    } finally {
      actor.stop();
    }
  });
  it("conserves a real two-deck inventory and starts with eleven cards", () => {
    const inventory = (cards: ReturnType<typeof createDeck>) =>
      cards.map((card) => `${card.rank}:${card.suit}`).sort();
    for (const scenario of AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS) {
      const state = scenario.input.predefinedState!;
      const cards = [
        ...state.hands.flat(),
        ...state.stock,
        ...state.discard,
        ...(state.table ?? []).flatMap((meld) => meld.cards),
      ];
      expect(cards).toHaveLength(108);
      expect(new Set(cards.map((card) => card.id)).size).toBe(108);
      expect(inventory(cards)).toEqual(
        inventory(createDeck({ deckCount: 2, jokerCount: 4 })),
      );
      expect(state.hands.map((hand) => hand.length)).toEqual([11, 11, 11]);
    }
  });

  it("executes two candidate turns with full-credit references in all four hand permutations", async () => {
    expect(AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS).toHaveLength(2);
    for (const scenario of AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS) {
      for (let repetition = 1; repetition <= 4; repetition++) {
        const result = await runAIPlayerShortRolloutReference({
          ...scenario,
          input: getAIPlayerFixedStateInputForRepetition(scenario, repetition),
        });
        expect(result.completed, scenario.identity.id).toBe(true);
        expect(result.legal, scenario.identity.id).toBe(true);
        expect(result.candidateTurns).toBe(2);
        expect(result.qualityPercent, scenario.identity.id).toBe(100);
      }
    }
  });

  it("rejects the narrower legal plan even when a lucky wild draw still produces a win", async () => {
    for (const scenario of AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS) {
      const state = scenario.input.predefinedState!;
      const root = [...state.hands[0]!, state.stock[0]!];
      const futureDraw = state.stock[3]!;
      const afterDraw = [
        ...root.filter((card) => card.id !== "plan-3h"),
        futureDraw,
      ];
      const win = findLayDownCandidates({
        hand: afterDraw,
        contract: { roundNumber: 6, sets: 1, runs: 2 },
        playerId: "eval-player-0",
        limit: 1,
      })[0];
      const continuation: GameAction[] = [
        { type: "DRAW_FROM_STOCK" },
        ...(win === undefined
          ? [
              { type: "SKIP" } as const,
              { type: "DISCARD", cardId: futureDraw.id } as const,
            ]
          : [
              {
                type: "LAY_DOWN",
                melds: win.positionGroups.map((positions, index) => ({
                  type: index === 0 ? ("set" as const) : ("run" as const),
                  cardIds: positions.map(
                    (position) => afterDraw[position - 1]!.id,
                  ),
                })),
              } as const,
            ]),
      ];
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map((decision, index) =>
          index === 0
            ? {
                ...decision,
                actions: [
                  { type: "SKIP" },
                  { type: "DISCARD", cardId: "plan-3h" },
                ],
              }
            : index === 3
              ? { ...decision, actions: continuation }
              : decision,
        ),
      });
      expect(result.completed).toBe(true);
      expect(result.legal).toBe(true);
      expect(result.qualityPercent).toBe(
        scenario.identity.id.endsWith("wild") ? 50 : 0,
      );
      expect(result.criteria[0]?.evidence).toContain("14/95");
      expect(result.criteria[0]?.evidence).toContain("23/95");
    }
  });

  it("does not reveal which future draw branch will occur in the initial observation", () => {
    const observations = AI_PLAYER_STRATEGIC_ROLLOUT_SCENARIOS.map(
      (scenario) => {
        const actor = createAIPlayerFixedStateActor(scenario);
        try {
          return outputGameStateForLLM(
            projectAIPlayerFixedStateSnapshot(actor),
            "eval-player-0",
          );
        } finally {
          actor.stop();
        }
      },
    );
    expect(observations[0]).toBe(observations[1]);
    expect(observations[0]).not.toContain("23/95");
    expect(observations[0]).not.toContain("future-draw");
  });
});
