import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import {
  createAIPlayerFixedStateActor,
  createAIPlayerFixedStateActorRuntime,
  projectAIPlayerFixedStateSnapshot,
} from "./ai-player-fixed-state-scenarios";
import { runAIPlayerShortRolloutReference } from "./ai-player-short-rollout-scenarios";
import { AI_PLAYER_MAY_I_HORIZON_SCENARIOS } from "./ai-player-may-i-horizon-scenarios";

describe("May I delayed stock horizon", () => {
  it("respects hand-plus-table parity after a completed turn and any number of two-card claims", () => {
    for (const scenario of AI_PLAYER_MAY_I_HORIZON_SCENARIOS) {
      const state = scenario.input.predefinedState!;
      expect(state.hands).toHaveLength(4);
      state.hands.forEach((hand, index) => {
        const tableCount = (state.table ?? [])
          .filter((meld) => meld.ownerId === `eval-player-${index}`)
          .reduce((sum, meld) => sum + meld.cards.length, 0);
        expect((hand.length + tableCount) % 2).toBe(1);
      });
    }
  });
  it("conserves all 108 cards and supplies a legal full-credit reference for each reserve size", async () => {
    for (const scenario of AI_PLAYER_MAY_I_HORIZON_SCENARIOS) {
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
      const result = await runAIPlayerShortRolloutReference(scenario);
      expect(result.completed).toBe(true);
      expect(result.legal).toBe(true);
      expect(result.qualityPercent).toBe(100);
    }
  });

  it("proves that the tempting claim survives recycling but ends on the opponent's next draw", async () => {
    const scenario = AI_PLAYER_MAY_I_HORIZON_SCENARIOS[0]!;
    const actor = createAIPlayerFixedStateActor(scenario);
    try {
      const candidate = createAIPlayerFixedStateActorRuntime(
        actor,
        "eval-player-0",
      );
      expect(
        (await candidate.runtime.executeAction({ type: "CALL_MAY_I" })).ok,
      ).toBe(true);
      const afterCall = projectAIPlayerFixedStateSnapshot(actor);
      expect(afterCall.phase).toBe("ROUND_ACTIVE");
      expect(afterCall.stock).toHaveLength(1);
      expect(afterCall.players[0]?.hand).toHaveLength(13);
      const opponent = createAIPlayerFixedStateActorRuntime(
        actor,
        "eval-player-1",
      );
      expect(
        (await opponent.runtime.executeAction({ type: "DRAW_FROM_STOCK" })).ok,
      ).toBe(true);
      expect(projectAIPlayerFixedStateSnapshot(actor).phase).toBe("ROUND_END");
    } finally {
      actor.stop();
    }
    const inferior = await runAIPlayerShortRolloutReference({
      ...scenario,
      referenceSequence: scenario.referenceSequence.map((decision, index) =>
        index === 0
          ? {
              ...decision,
              mayIDecision: "call",
              actions: [{ type: "CALL_MAY_I" }],
            }
          : decision,
      ),
    });
    expect(inferior.completed).toBe(true);
    expect(inferior.legal).toBe(true);
    expect(inferior.qualityPercent).toBe(0);
  });

  it("does not reward blanket passing when two more reserve cards permit laying down", async () => {
    const scenario = AI_PLAYER_MAY_I_HORIZON_SCENARIOS[1]!;
    const inferior = await runAIPlayerShortRolloutReference({
      ...scenario,
      referenceSequence: scenario.referenceSequence.map((decision) =>
        decision.kind === "candidate-may-i"
          ? { ...decision, mayIDecision: "pass", actions: [] }
          : decision.kind === "candidate-turn"
            ? {
                ...decision,
                actions: [
                  { type: "DRAW_FROM_STOCK" },
                  { type: "SKIP" },
                  { type: "DISCARD", cardId: "candidate-10h" },
                ],
              }
            : decision,
      ),
    });
    expect(inferior.completed).toBe(true);
    expect(inferior.legal).toBe(true);
    expect(inferior.qualityPercent).toBe(0);
  });
});
