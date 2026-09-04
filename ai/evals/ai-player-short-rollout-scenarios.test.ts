import { describe, expect, it } from "bun:test";
import {
  AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
  AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION,
  runAIPlayerShortRolloutReference,
} from "./ai-player-short-rollout-scenarios";
import { getAIPlayerFixedStateInputForRepetition } from "./ai-player-fixed-state-scenarios";
import { AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS } from "./ai-player-short-rollout-challenge-scenarios";
import type { GameAction } from "../ai-action-runtime.types";
import { getAIPlayerRolloutScope } from "./ai-player-rollout-scope";

describe("AI player short rollout scenarios", () => {
  it("covers nuanced May I, Joker, and endgame choices with bounded decisions", () => {
    expect(AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION).toBe("short-rollout-v11");
    expect(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.map((scenario) => scenario.identity.id),
    ).toEqual([
      "plan-call-may-i-and-go-out",
      "pass-may-i-before-stock-exhaustion",
      "claim-may-i-to-complete-contract",
      "allow-may-i-to-avoid-joker-liability",
      "swap-joker-to-unlock-contract",
      "sequence-layoffs-to-go-out",
      "avoid-publicly-collected-rank",
      "preserve-future-layoff-cards",
      "include-extended-run-to-go-out",
      "prioritize-own-contract-over-public-layoff",
      "hand6-take-discard-to-win",
      "avoid-publicly-collected-run-gap",
      "respect-same-suit-run-gap",
      "decline-unusable-joker-swap",
      "hand6-discard-unmeldable-extra",
      "call-may-i-with-recyclable-stock",
      "hand6-preserve-options-natural",
      "hand6-preserve-options-wild",
      "pass-may-i-before-delayed-exhaustion",
      "call-may-i-with-two-more-reserves",
      "contract-horizon-safe-natural",
      "contract-horizon-safe-wild",
      "contract-horizon-known-exit",
      "shared-run-delay-natural",
      "shared-run-delay-wild",
      "shared-run-take-immediate-win",
      "contested-run-diamonds-natural",
      "contested-run-diamonds-wild",
      "contested-run-spades-natural",
      "contested-run-stronger-diamonds",
      "contested-run-high-diamonds-holdout",
      "contested-run-upper-boundary-holdout",
    ]);
    expect(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.every(
        (scenario) => scenario.maxModelDecisions <= 3,
      ),
    ).toBe(true);
    expect(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.filter(
        (scenario) => scenario.identity.split === "development",
      ),
    ).toHaveLength(26);
    expect(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.filter(
        (scenario) => scenario.identity.split === "holdout",
      ),
    ).toHaveLength(6);
    expect(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.every(
        (scenario) =>
          scenario.rubric.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);
  });

  for (const scenario of AI_PLAYER_SHORT_ROLLOUT_SCENARIOS) {
    // The historical "disputed" fixtures remain quarantined. Drew confirmed
    // their oversized Hands 1-5 initial melds are illegal on 2026-09-04.
    if (getAIPlayerRolloutScope(scenario.identity.id).ruleStatus === "disputed") {
      it(`${scenario.identity.id}: rejects the quarantined oversized initial laydown`, async () => {
        expect(getAIPlayerRolloutScope(scenario.identity.id).scope).toBe("quarantine");
        const result = await runAIPlayerShortRolloutReference(scenario);
        expect(result.legal).toBe(false);
        expect(result.qualityPercent).toBeLessThan(100);
      });
      continue;
    }
    it(`${scenario.identity.id}: has a legal full-credit reference trajectory`, async () => {
      const result = await runAIPlayerShortRolloutReference(scenario);
      expect(result.completed, scenario.identity.id).toBe(true);
      expect(result.legal, scenario.identity.id).toBe(true);
      expect(result.qualityPercent, scenario.identity.id).toBe(100);
      expect(
        result.criteria.every((criterion) => criterion.passed),
        scenario.identity.id,
      ).toBe(true);
    });
  }

  it("does not certify a reference containing an illegal opponent action", async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
      (entry) => entry.identity.id === "pass-may-i-before-stock-exhaustion",
    );
    if (scenario === undefined) throw new Error("Missing pass scenario");
    const result = await runAIPlayerShortRolloutReference({
      ...scenario,
      referenceSequence: [
        {
          playerId: "eval-player-1",
          kind: "opponent-script",
          actions: [{ type: "DISCARD", cardId: "not-in-hand" }],
        },
        ...scenario.referenceSequence,
      ],
    });
    expect(result.legal).toBe(false);
    expect(result.qualityPercent).toBe(0);
  });

  it("labels subjective judgments and uses full candidate hands in new challenges", () => {
    expect(
      new Set(
        AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.map(
          (scenario) => scenario.assessment,
        ),
      ),
    ).toEqual(
      new Set(["tactical", "scripted-outcome", "strategic-preference"]),
    );
    for (const scenario of AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS) {
      expect(
        scenario.input.predefinedState?.hands[0]?.length,
        scenario.identity.id,
      ).toBe(11);
    }
  });

  it("rejects a plausible inferior or illegal line in every new challenge", async () => {
    const alternatives: Record<
      string,
      (actions: readonly GameAction[]) => GameAction[]
    > = {
      "include-extended-run-to-go-out": (actions) =>
        actions.map((action) =>
          action.type === "LAY_DOWN"
            ? {
                ...action,
                melds: action.melds.map((meld) =>
                  meld.type === "run"
                    ? { ...meld, cardIds: meld.cardIds.slice(0, 4) }
                    : meld,
                ),
              }
            : action,
        ),
      "prioritize-own-contract-over-public-layoff": (actions) =>
        actions.map((action) =>
          action.type === "LAY_DOWN"
            ? {
                ...action,
                melds: action.melds.map((meld) => ({
                  ...meld,
                  cardIds: meld.cardIds.filter((id) => id !== "own-run-7"),
                })),
              }
            : action,
        ),
      "hand6-take-discard-to-win": () => [
        { type: "DRAW_FROM_STOCK" },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "six-stock-k" },
      ],
      "avoid-publicly-collected-run-gap": (actions) =>
        actions.map((action) =>
          action.type === "DISCARD"
            ? { ...action, cardId: "defense-9h" }
            : action,
        ),
      "respect-same-suit-run-gap": (actions) =>
        actions.map((action) =>
          action.type === "LAY_DOWN"
            ? {
                ...action,
                melds: action.melds.map((meld, index) =>
                  index === 1
                    ? { ...meld, cardIds: ["gap-8", ...meld.cardIds] }
                    : meld,
                ),
              }
            : action,
        ),
      "decline-unusable-joker-swap": () => [
        {
          type: "SWAP_JOKER",
          jokerCardId: "liability-joker",
          meldId: "liability-run",
          swapCardId: "liability-6h",
        },
        { type: "SKIP" },
        { type: "DISCARD", cardId: "liability-joker" },
      ],
      "hand6-discard-unmeldable-extra": (actions) => [
        {
          type: "LAY_DOWN",
          melds: [
            {
              type: "set",
              cardIds: ["extra-set-0", "extra-set-1", "extra-set-2"],
            },
            {
              type: "run",
              cardIds: [
                "extra-low-3",
                "extra-low-4",
                "extra-low-5",
                "extra-low-6",
              ],
            },
            {
              type: "run",
              cardIds: [
                "extra-high-9",
                "extra-high-10",
                "extra-high-j",
                "extra-high-q",
              ],
            },
          ],
        },
        ...actions,
      ],
      "call-may-i-with-recyclable-stock": () => [],
    };
    for (const scenario of AI_PLAYER_SHORT_ROLLOUT_CHALLENGE_SCENARIOS) {
      const alternative = alternatives[scenario.identity.id];
      if (alternative === undefined)
        throw new Error(`Missing negative control: ${scenario.identity.id}`);
      const result = await runAIPlayerShortRolloutReference({
        ...scenario,
        referenceSequence: scenario.referenceSequence.map((decision, index) =>
          index !== 0
            ? decision
            : {
                ...decision,
                actions: alternative(decision.actions),
                ...(decision.kind === "candidate-may-i"
                  ? { mayIDecision: "pass" as const }
                  : {}),
              },
        ),
      });
      expect(result.qualityPercent, scenario.identity.id).toBeLessThan(100);
    }
  });

  it("gives equivalent run-gap outcomes equal credit regardless of the unknown stock card", async () => {
    const scenario = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
      (entry) => entry.identity.id === "respect-same-suit-run-gap",
    );
    if (scenario === undefined) throw new Error("Missing run-gap scenario");
    const result = await runAIPlayerShortRolloutReference({
      ...scenario,
      referenceSequence: scenario.referenceSequence.map((decision) => ({
        ...decision,
        actions: decision.actions.map((action) =>
          action.type === "DRAW_FROM_STOCK"
            ? { type: "DRAW_FROM_DISCARD" as const }
            : action.type === "DISCARD"
              ? { ...action, cardId: "opening" }
              : action,
        ),
      })),
    });
    expect(result.legal).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.qualityPercent).toBe(100);
  });

  it("defines four deterministic hand-order permutations per scenario", () => {
    for (const scenario of AI_PLAYER_SHORT_ROLLOUT_SCENARIOS) {
      const orders = [1, 2, 3, 4].map(
        (repetition) =>
          getAIPlayerFixedStateInputForRepetition(
            scenario,
            repetition,
          ).predefinedState?.hands[0]?.map((card) => card.id) ?? [],
      );
      expect(
        new Set(orders.map((order) => order.join(","))).size,
      ).toBeGreaterThan(1);
      expect(orders.map((order) => [...order].sort())).toEqual(
        orders.map(() => [...(orders[0] ?? [])].sort()),
      );
    }
  });
});
