import { describe, expect, it } from "bun:test";
import { createDeck } from "../../core/card/card.deck";
import { AI_PLAYER_SHORT_ROLLOUT_SCENARIOS } from "./ai-player-short-rollout-scenarios";
import {
  AI_PLAYER_ROLLOUT_SCOPE_VERSION,
  AI_PLAYER_ROLLOUT_SCOPE,
  getAIPlayerRolloutScope,
  buildAIPlayerRolloutSelection,
  summarizeAIPlayerRolloutScopeScores,
} from "./ai-player-rollout-scope";

describe("versioned short-rollout eligibility", () => {
  it("backs strategic inventory and undisputed initial sizes with the actual fixtures", () => {
    const inventory = (cards: ReturnType<typeof createDeck>) =>
      cards.map((card) => `${card.rank}:${card.suit}`).sort();
    for (const scenario of AI_PLAYER_SHORT_ROLLOUT_SCENARIOS) {
      if (getAIPlayerRolloutScope(scenario.identity.id).scope !== "strategy")
        continue;
      const state = scenario.input.predefinedState!;
      const cards = [
        ...state.hands.flat(),
        ...state.stock,
        ...state.discard,
        ...(state.table ?? []).flatMap((meld) => meld.cards),
      ];
      expect(inventory(cards), scenario.identity.id).toEqual(
        inventory(createDeck({ deckCount: 2, jokerCount: 4 })),
      );
      expect(
        new Set(cards.map((card) => card.id)).size,
        scenario.identity.id,
      ).toBe(108);
      state.hands.forEach((hand, index) => {
        if (!state.playerDownStatus?.[index])
          expect(hand.length, scenario.identity.id).toBeGreaterThanOrEqual(11);
      });
      if (scenario.input.roundNumber === 6) continue;
      const actions = [
        ...(scenario.historyPrelude ?? []).map((step) => step.action),
        ...scenario.referenceSequence.flatMap((decision) => decision.actions),
      ];
      for (const action of actions) {
        if (action.type !== "LAY_DOWN") continue;
        for (const meld of action.melds)
          expect(meld.cardIds.length, scenario.identity.id).toBe(
            meld.type === "set" ? 3 : 4,
          );
      }
    }
  });
  it("classifies every catalog case explicitly without silently admitting new ones", () => {
    expect(AI_PLAYER_ROLLOUT_SCOPE_VERSION).toBe("rollout-scope-v2");
    const ids = AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.map(
      (scenario) => scenario.identity.id,
    ).sort();
    expect(Object.keys(AI_PLAYER_ROLLOUT_SCOPE).sort()).toEqual(ids);
    expect(() => getAIPlayerRolloutScope("unreviewed-new-case")).toThrow(
      "Unclassified",
    );
    for (const id of ["toString", "constructor", "__proto__"]) {
      expect(() => getAIPlayerRolloutScope(id)).toThrow("Unclassified");
    }
    for (const scenario of AI_PLAYER_SHORT_ROLLOUT_SCENARIOS) {
      const scope = getAIPlayerRolloutScope(scenario.identity.id);
      expect(scope.reason.length).toBeGreaterThan(20);
      expect(scope.familyId.length).toBeGreaterThan(0);
      expect(scope.historySource).toBe(
        scenario.historyPrelude !== undefined
          ? "replayed-public-actions"
          : scenario.actionLog?.length
            ? "constructed-fixture-history"
            : "no-recorded-prelude",
      );
      if (scope.ruleStatus === "disputed")
        expect(scope.scope).toBe("quarantine");
    }
  });

  it("retains rare exhaustion branches as robustness without redefining historical scores", () => {
    for (const id of [
      "pass-may-i-before-delayed-exhaustion",
      "call-may-i-with-two-more-reserves",
    ]) {
      expect(getAIPlayerRolloutScope(id)).toMatchObject({
        scope: "robustness",
        ruleStatus: "independent",
      });
      expect(
        AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.some(
          (scenario) => scenario.identity.id === id,
        ),
      ).toBe(true);
    }
  });

  it("quarantines rule-dependent wins but preserves validated paired strategy roots", () => {
    expect(
      getAIPlayerRolloutScope("include-extended-run-to-go-out"),
    ).toMatchObject({ scope: "quarantine", ruleStatus: "disputed" });
    for (const id of [
      "hand6-preserve-options-natural",
      "hand6-preserve-options-wild",
      "contract-horizon-safe-natural",
      "contract-horizon-safe-wild",
      "contract-horizon-known-exit",
      "shared-run-delay-natural",
      "shared-run-delay-wild",
      "shared-run-take-immediate-win",
    ]) {
      expect(getAIPlayerRolloutScope(id)).toMatchObject({
        scope: "strategy",
        ruleStatus: "independent",
      });
    }
  });

  it("records all exclusions and distinguishes near-transfer holdouts from new families", () => {
    const selection = buildAIPlayerRolloutSelection(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
      { split: "development", scope: "all-eligible" },
    );
    expect(selection.scopeVersion).toBe("rollout-scope-v2");
    expect(selection.fullEligibleSplit).toBe(true);
    expect(selection.selected.length + selection.excluded.length).toBe(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.length,
    );
    expect(
      selection.excluded.find(
        (caseInfo) => caseInfo.scenarioId === "include-extended-run-to-go-out",
      ),
    ).toMatchObject({
      exclusion: "quarantine",
      scope: "quarantine",
      ruleStatus: "disputed",
    });
    expect(selection.coverage.strategyDevelopmentCases).toBe(12);
    expect(selection.coverage.strategyHoldoutCases).toBe(2);
    expect(selection.coverage.strategyDevelopmentFamilies).toHaveLength(4);
    expect(selection.coverage.strategyHoldoutFamilies).toEqual([
      "contested-run-planning",
    ]);
    for (const id of [
      "contested-run-diamonds-natural",
      "contested-run-diamonds-wild",
      "contested-run-spades-natural",
      "contested-run-stronger-diamonds",
      "contested-run-high-diamonds-holdout",
      "contested-run-upper-boundary-holdout",
    ]) {
      expect(getAIPlayerRolloutScope(id)).toMatchObject({
        scope: "strategy",
        familyId: "contested-run-planning",
        physicalInventory: "conserved-108",
        historySource: "replayed-public-actions",
        ruleStatus: "independent",
      });
    }
    const subset = buildAIPlayerRolloutSelection(
      AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
      {
        split: "development",
        scope: "strategy",
        scenarioIds: ["shared-run-delay-natural"],
      },
    );
    expect(subset.fullEligibleSplit).toBe(false);
    expect(subset.selected).toHaveLength(1);
    expect(
      subset.excluded.some(
        (caseInfo) => caseInfo.exclusion === "not-requested",
      ),
    ).toBe(true);
    expect(() =>
      buildAIPlayerRolloutSelection(AI_PLAYER_SHORT_ROLLOUT_SCENARIOS, {
        split: "development",
        scope: "all-eligible",
        scenarioIds: [
          "shared-run-delay-natural",
          "decline-unusable-joker-swap",
        ],
      }),
    ).toThrow("split");
    expect(() =>
      buildAIPlayerRolloutSelection(AI_PLAYER_SHORT_ROLLOUT_SCENARIOS, {
        split: "development",
        scope: "all-eligible",
        scenarioIds: ["shared-run-delay-natural", "shared-run-delay-natural"],
      }),
    ).toThrow("Duplicate");
  });

  it("does not inflate strategy quality with passing mechanics or empty evidence", () => {
    const scores = summarizeAIPlayerRolloutScopeScores([
      { scenarioId: "shared-run-delay-natural", qualityPercent: 0 },
      { scenarioId: "shared-run-take-immediate-win", qualityPercent: 100 },
      { scenarioId: "sequence-layoffs-to-go-out", qualityPercent: 100 },
    ]);
    expect(scores.strategy).toEqual({ caseCount: 2, qualityPercent: 50 });
    expect(scores.robustness).toEqual({ caseCount: 1, qualityPercent: 100 });
    expect(summarizeAIPlayerRolloutScopeScores([]).strategy).toEqual({
      caseCount: 0,
      qualityPercent: null,
    });
    expect(() =>
      summarizeAIPlayerRolloutScopeScores([
        { scenarioId: "include-extended-run-to-go-out", qualityPercent: 100 },
      ]),
    ).toThrow("quarantine");
  });
});
